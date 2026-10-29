"""Manual tool-use loop with full observability.

Every model call and every tool call becomes an agent_steps row; every tool call is also written to the
audit log (CLAUDE.md rule 9). Only tools in the AgentSpec allow-list execute. Writes made by tools are
attributed to the agent actor, never to a mentor.
"""

import json
import time
from typing import Any

from sqlalchemy.orm import Session

from app.agent.llm import LLM, AgentUnavailable, get_llm
from app.agent.registry import AgentSpec, ToolContext, ToolError
from app.core import audit
from app.core.config import get_settings
from app.models import AgentRun, AgentStep
from app.models.base import utcnow

MAX_TOKENS = 16000
SUMMARY_LEN = 600


def _summarise(value: Any) -> str:
    text = value if isinstance(value, str) else json.dumps(value, default=str)
    return text if len(text) <= SUMMARY_LEN else text[: SUMMARY_LEN - 1] + "…"


def _cost(tokens_in: int, tokens_out: int) -> float:
    s = get_settings()
    return round(
        tokens_in / 1e6 * s.agent_price_in_per_mtok + tokens_out / 1e6 * s.agent_price_out_per_mtok, 6
    )


def add_step(db: Session, run: AgentRun, **fields: Any) -> AgentStep:
    seq = len(run.steps) + 1
    step = AgentStep(run_id=run.id, seq=seq, **fields)
    run.steps.append(step)
    db.flush()
    return step


def start_run(
    db: Session,
    agent: str,
    goal: str,
    inputs: dict[str, Any],
    *,
    triggered_by: str | None = None,
    subject_type: str | None = None,
    subject_id: str | None = None,
    prompt_version: str | None = None,
    model: str | None = None,
) -> AgentRun:
    run = AgentRun(
        agent=agent,
        goal=goal,
        inputs_json=inputs,
        triggered_by=triggered_by,
        subject_type=subject_type,
        subject_id=subject_id,
        prompt_version=prompt_version,
        model=model,
    )
    db.add(run)
    db.flush()
    return run


def finish_run(run: AgentRun, status: str, error: str | None = None) -> None:
    run.status = status
    run.error = error
    run.ended_at = utcnow()
    run.cost_usd = _cost(run.tokens_in, run.tokens_out)


def _execute_tool(ctx: ToolContext, spec: AgentSpec, name: str, args: dict[str, Any]) -> tuple[str, bool]:
    db, run = ctx.db, ctx.run
    t0 = time.perf_counter()
    tool = spec.tool(name)
    error: str | None = None
    if tool is None:
        error = f"Tool '{name}' is not allowed for this agent"
        output: Any = error
    else:
        try:
            output = tool.handler(ctx, args)
        except ToolError as exc:
            error = str(exc)
            output = f"Rejected: {exc}"
        except Exception as exc:  # tool bug: report to the model without leaking internals
            error = f"{type(exc).__name__}: {exc}"
            output = "Internal tool error"
    latency = int((time.perf_counter() - t0) * 1000)
    summary = _summarise(output)
    add_step(
        db,
        run,
        kind="tool",
        tool=name,
        args_json=args,
        output_summary=summary,
        latency_ms=latency,
        error=error,
    )
    audit.record(
        db, "agent.tool_call", "agent_runs", run.id, after={"tool": name, "args": args, "error": error}
    )
    return (output if isinstance(output, str) else json.dumps(output, default=str)), error is not None


def run_agent(
    db: Session,
    spec: AgentSpec,
    *,
    goal: str,
    user_prompt: str,
    params: dict[str, Any],
    triggered_by: str | None = None,
    subject_type: str | None = None,
    subject_id: str | None = None,
    llm: LLM | None = None,
) -> AgentRun:
    """Run the loop to completion. Raises AgentUnavailable (after recording a failed run) if no LLM is configured."""
    previous_actor = db.info.get("actor")
    run = start_run(
        db,
        spec.name,
        goal,
        {k: str(v) for k, v in params.items()},
        triggered_by=triggered_by,
        subject_type=subject_type,
        subject_id=subject_id,
        prompt_version=spec.prompt_version,
    )
    audit.set_actor(db, audit.Actor("agent", f"{spec.name}:{run.id}"))
    ctx = ToolContext(db=db, run=run, params=params)
    try:
        client = llm or get_llm()
        run.model = client.model
        messages: list[dict[str, Any]] = [{"role": "user", "content": user_prompt}]
        tools = [t.to_api() for t in spec.tools]
        for _ in range(spec.max_turns):
            t0 = time.perf_counter()
            resp = client.create(
                max_tokens=MAX_TOKENS, system=spec.system_prompt, tools=tools, messages=messages
            )
            tin, tout = resp.usage.input_tokens, resp.usage.output_tokens
            run.tokens_in += tin
            run.tokens_out += tout
            visible_text = " ".join(
                b.text for b in resp.content if getattr(b, "type", None) == "text"
            ).strip()
            add_step(
                db,
                run,
                kind="llm",
                reason=_summarise(visible_text) if visible_text else None,
                output_summary=f"stop_reason={resp.stop_reason}",
                latency_ms=int((time.perf_counter() - t0) * 1000),
                tokens_in=tin,
                tokens_out=tout,
            )
            if resp.stop_reason in ("refusal", "max_tokens"):
                raise RuntimeError(f"Model stopped with {resp.stop_reason}")
            messages.append({"role": "assistant", "content": resp.content})
            if resp.stop_reason == "pause_turn":
                continue
            uses = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]
            if not uses:
                break
            results = []
            for use in uses:
                content, is_error = _execute_tool(ctx, spec, use.name, dict(use.input or {}))
                results.append(
                    {"type": "tool_result", "tool_use_id": use.id, "content": content, "is_error": is_error}
                )
            messages.append({"role": "user", "content": results})
        else:
            raise RuntimeError(f"Agent exceeded {spec.max_turns} turns")
        finish_run(run, "succeeded")
    except AgentUnavailable as exc:
        finish_run(run, "failed", str(exc))
        db.commit()
        raise
    except Exception as exc:
        finish_run(run, "failed", f"{type(exc).__name__}: {exc}")
    finally:
        if previous_actor is not None:
            audit.set_actor(db, previous_actor)
    db.commit()
    return run
