"""Assessment Evaluation Agent (+ the separate deterministic Integrity Summary step).

The LLM only writes explanations, orders recommended topics and picks notes/practice questions from IDs the tools
return. Every number in a draft is checked against the computed scores; anything else is rejected (rules 4, 5, 7).
There is deliberately no publish tool and no tool that writes marks, events or flags.
"""

import json
import re
import time
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agent.llm import LLM
from app.agent.notes_index import find_notes as search_notes
from app.agent.registry import AgentSpec, Tool, ToolContext, ToolError
from app.agent.runner import add_step, finish_run, run_agent, start_run
from app.core import audit
from app.core.config import get_settings
from app.models import (
    Course,
    Exam,
    ExamSession,
    GlanceLog,
    IdentityCheck,
    Misconception,
    ProctorEvent,
    Question,
    QuestionStatus,
    QuestionType,
    SessionStatus,
    Topic,
)
from app.models.agent import AgentRun
from app.models.evaluation import EvaluationSummary, Note, NoteLevel, SummaryStatus
from app.models.results import Result, SessionMisconception, TopicResult

HERE = Path(__file__).parent
PROMPT_VERSION = "eval-v1"
NUMBER_PCT = re.compile(r"(-?\d+(?:\.\d+)?)\s*(?:%|percent)", re.IGNORECASE)
FORBIDDEN = re.compile(
    r"\b(cheat\w*|proctor\w*|flag(?:s|ged)?|glance\w*|honest\w*|dishonest\w*|suspicio\w*|integrity|misconduct|plagiar\w*|"
    r"look(?:ed|ing)?\s+away)\b",
    re.IGNORECASE,
)


@lru_cache
def _schema_validator() -> Draft202012Validator:
    return Draft202012Validator(
        json.loads((HERE / "schemas" / "summary.schema.json").read_text(encoding="utf-8"))
    )


@lru_cache
def _prompt_template() -> str:
    text = (HERE / "prompts" / f"{PROMPT_VERSION}.md").read_text(encoding="utf-8")
    return re.sub(r"^<!--.*?-->\s*", "", text, flags=re.S)


# ---------- deterministic facts ----------
@dataclass
class Facts:
    session: ExamSession
    result: Result
    topics: dict[str, TopicResult]
    topic_names: dict[str, str]
    misconceptions: dict[str, tuple[str, int]]
    change_pct: float | None

    def by_class(self, cls: str) -> set[str]:
        return {tid for tid, t in self.topics.items() if t.cls == cls}


def facts_for(db: Session, sess: ExamSession) -> Facts:
    result = db.get(Result, sess.id)
    if result is None:
        raise ToolError("This session has not been scored yet")
    trs = {
        str(t.topic_id): t for t in db.scalars(select(TopicResult).where(TopicResult.session_id == sess.id))
    }
    names = (
        {
            str(t.id): t.name
            for t in db.scalars(select(Topic).where(Topic.id.in_([uuid.UUID(k) for k in trs])))
        }
        if trs
        else {}
    )
    miscs = {}
    for hit, m in db.execute(
        select(SessionMisconception, Misconception)
        .join(Misconception, Misconception.id == SessionMisconception.misconception_id)
        .where(SessionMisconception.session_id == sess.id)
    ):
        miscs[str(m.id)] = (m.description, hit.count)
    prev = db.scalar(
        select(Result.score_pct)
        .join(ExamSession, ExamSession.id == Result.session_id)
        .join(Exam, Exam.id == ExamSession.exam_id)
        .where(
            ExamSession.candidate_id == sess.candidate_id,
            ExamSession.id != sess.id,
            Exam.course_id == sess.exam.course_id,
            Result.score_pct.is_not(None),
            ExamSession.submitted_at < (sess.submitted_at or sess.created_at),
        )
        .order_by(ExamSession.submitted_at.desc())
        .limit(1)
    )
    change = round(result.score_pct - prev, 2) if prev is not None and result.score_pct is not None else None
    return Facts(sess, result, trs, names, miscs, change)


def deterministic_data_notes(f: Facts) -> list[str]:
    notes = []
    for tid, t in f.topics.items():
        if t.cls == "insufficient":
            notes.append(
                f"{f.topic_names.get(tid, 'A topic')}: only {t.n_questions} question(s), not enough to classify."
            )
    if f.result.n_unmarked:
        notes.append(f"{f.result.n_unmarked} written answer(s) not yet marked; scores may change.")
    return notes


# ---------- validation (used for agent drafts AND mentor edits) ----------
def _close(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return abs(float(a) - float(b)) <= get_settings().summary_score_tolerance


def _check_text(label: str, text: str, allowed_numbers: set[float] | None = None) -> None:
    m = FORBIDDEN.search(text or "")
    if m:
        raise ToolError(f"{label} must not mention '{m.group(0)}' (no proctoring or integrity language)")
    if allowed_numbers is not None:
        for num in NUMBER_PCT.findall(text or ""):
            if not any(_close(float(num), a) for a in allowed_numbers):
                raise ToolError(
                    f"{label} mentions {num}% which is not a computed score; copy numbers exactly"
                )


def validate_summary(db: Session, f: Facts, content: dict[str, Any], *, author: str) -> dict[str, Any]:
    """Returns the content to store. Raises ToolError with a specific reason."""
    errors = sorted(_schema_validator().iter_errors(content), key=lambda e: list(e.path))
    if errors:
        e = errors[0]
        raise ToolError(f"Schema error at {'/'.join(map(str, e.path)) or '(root)'}: {e.message}")

    ov = content["overall"]
    if not _close(ov["score_pct"], f.result.score_pct):
        raise ToolError(f"overall.score_pct must be {f.result.score_pct} (computed); do not change numbers")
    if ov.get("class_percentile") is not None and not _close(ov["class_percentile"], f.result.percentile):
        raise ToolError(f"overall.class_percentile must be {f.result.percentile} or null")
    if ov.get("change_vs_previous_pct") is not None and not _close(
        ov["change_vs_previous_pct"], f.change_pct
    ):
        raise ToolError(f"overall.change_vs_previous_pct must be {f.change_pct} or null")

    for key, cls, required in (
        ("strong_topics", "strong", True),
        ("developing_topics", "developing", False),
        ("weak_topics", "weak", True),
    ):
        listed = content.get(key)
        if listed is None:
            if required:
                raise ToolError(f"{key} is required")
            continue
        ids = [t["topic_id"] for t in listed]
        if set(ids) != f.by_class(cls) or len(ids) != len(set(ids)):
            raise ToolError(f"{key} must list exactly the {cls} topics from get_topic_results")
        for t in listed:
            tr = f.topics[t["topic_id"]]
            if not _close(t["score_pct"], tr.score_pct) or t["n_questions"] != tr.n_questions:
                raise ToolError(
                    f"Topic {t['topic_id']}: score_pct/n_questions must equal the computed values"
                )
            if t["name"] != f.topic_names.get(t["topic_id"]):
                raise ToolError(f"Topic {t['topic_id']}: name must be '{f.topic_names.get(t['topic_id'])}'")

    allowed = {v for v in (f.result.score_pct, f.result.percentile, f.change_pct) if v is not None}
    allowed |= {abs(f.change_pct)} if f.change_pct is not None else set()
    allowed |= {t.score_pct for t in f.topics.values() if t.score_pct is not None}

    for m in content.get("misconceptions", []):
        if m["misconception_id"] not in f.misconceptions:
            raise ToolError(f"Unknown misconception_id {m['misconception_id']} for this candidate")
        _check_text("misconception explanation", m["explanation"], allowed)

    recs = content["recommended_topics"]
    eligible = f.by_class("weak") | f.by_class("developing") | f.by_class("insufficient")
    priorities = sorted(r["priority"] for r in recs)
    if priorities != list(range(1, len(recs) + 1)):
        raise ToolError("recommended_topics priorities must be 1..n without gaps")
    seen = set(f.session.question_order)
    practice_total = 0
    for r in recs:
        if r["topic_id"] not in eligible:
            raise ToolError(
                f"Topic {r['topic_id']} cannot be recommended (only weak, developing or insufficient topics)"
            )
        _check_text("reason", r["reason"], allowed)
        for nid in r["note_ids"]:
            note = _uuid_or_none(nid) and db.get(Note, uuid.UUID(nid))
            if not note or not note.approved or str(note.topic_id) != r["topic_id"]:
                raise ToolError(
                    f"note_id {nid} is not an approved note for this topic; use only IDs from find_notes"
                )
        if not r["note_ids"] and r.get("needs_mentor_note") is not True:
            raise ToolError("When note_ids is empty set needs_mentor_note = true (never invent notes)")
        for qid in r.get("practice_question_ids", []):
            q = _uuid_or_none(qid) and db.get(Question, uuid.UUID(qid))
            if (
                not q
                or q.status != QuestionStatus.approved
                or q.type != QuestionType.mcq
                or str(q.topic_id) != r["topic_id"]
                or q.course_id != f.session.exam.course_id
                or qid in seen
            ):
                raise ToolError(
                    f"practice question {qid} is not valid; use only IDs from select_practice_questions"
                )
        practice_total += len(r.get("practice_question_ids", []))
    cfg = get_settings()
    if practice_total > cfg.practice_max_questions:
        raise ToolError(f"At most {cfg.practice_max_questions} practice questions in total")

    _check_text("message", content["message"], allowed)
    if len(content["message"].split()) > cfg.summary_max_message_words:
        raise ToolError(f"message must be under {cfg.summary_max_message_words} words")
    for d in content.get("data_notes", []):
        _check_text("data_notes", d)
    if author == "agent" and content.get("integrity_note"):
        raise ToolError("integrity_note must be an empty string; it is written by a separate step")

    stored = json.loads(json.dumps(content))
    stored["data_notes"] = list(dict.fromkeys([*content.get("data_notes", []), *deterministic_data_notes(f)]))
    return stored


def _uuid_or_none(v: Any) -> bool:
    try:
        uuid.UUID(str(v))
        return True
    except ValueError:
        return False


# ---------- tools ----------
def _sess(ctx: ToolContext) -> ExamSession:
    return ctx.db.get(ExamSession, ctx.params["session_id"])


def _topic_arg(ctx: ToolContext, args: dict[str, Any], f: Facts) -> str:
    tid = str(args.get("topic_id", ""))
    if tid not in f.topics:
        raise ToolError("Unknown topic_id; use IDs from get_topic_results")
    return tid


def t_get_topic_results(ctx: ToolContext, _args: dict[str, Any]) -> dict[str, Any]:
    f = facts_for(ctx.db, _sess(ctx))
    return {
        "overall": {
            "score_pct": f.result.score_pct,
            "class_percentile": f.result.percentile,
            "change_vs_previous_pct": f.change_pct,
        },
        "unmarked_answers": f.result.n_unmarked,
        "topics": [
            {
                "topic_id": tid,
                "name": f.topic_names.get(tid),
                "score_pct": t.score_pct,
                "n_questions": t.n_questions,
                "class": t.cls,
                "priority": t.priority,
            }
            for tid, t in f.topics.items()
        ],
    }


def t_get_wrong_answers(ctx: ToolContext, args: dict[str, Any]) -> list[dict[str, Any]]:
    sess = _sess(ctx)
    f = facts_for(ctx.db, sess)
    tid = _topic_arg(ctx, args, f)
    answers = {str(a.question_id): a for a in sess.answers}
    out = []
    for qid in sess.question_order:
        q = ctx.db.get(Question, uuid.UUID(qid))
        a = answers.get(qid)
        if str(q.topic_id) != tid or (a and a.marks_awarded is not None and a.marks_awarded >= q.marks):
            continue
        chosen = (a.value or {}).get("option_key") if a else None
        opt = next((o for o in q.options if o.key == chosen), None)
        misc = ctx.db.get(Misconception, opt.misconception_id) if opt and opt.misconception_id else None
        out.append(
            {
                "question_id": qid,
                "question": q.body,
                "chosen": opt.text
                if opt
                else ("(written answer)" if q.type == QuestionType.short and a else "(not answered)"),
                "correct": next((o.text for o in q.options if o.is_correct), q.answer_text),
                "misconception_id": str(misc.id) if misc else None,
                "misconception": misc.description if misc else None,
            }
        )
    return out


def t_get_misconceptions(ctx: ToolContext, _args: dict[str, Any]) -> list[dict[str, Any]]:
    f = facts_for(ctx.db, _sess(ctx))
    return [
        {"misconception_id": mid, "description": d, "times_chosen": n}
        for mid, (d, n) in f.misconceptions.items()
    ]


def t_find_notes(ctx: ToolContext, args: dict[str, Any]) -> list[dict[str, Any]]:
    f = facts_for(ctx.db, _sess(ctx))
    tid = _topic_arg(ctx, args, f)
    level = args.get("level")
    level = NoteLevel(level) if level in NoteLevel.__members__ else None
    notes = search_notes(ctx.db, uuid.UUID(tid), str(args.get("query", "")), level)
    return [{"note_id": str(n.id), "title": n.title, "level": n.level.value} for n in notes]


def t_select_practice(ctx: ToolContext, args: dict[str, Any]) -> list[dict[str, Any]]:
    sess = _sess(ctx)
    f = facts_for(ctx.db, sess)
    tid = _topic_arg(ctx, args, f)
    n = max(1, min(int(args.get("n", 5)), get_settings().practice_max_questions))
    max_diff = int(args.get("max_difficulty", 3))
    seen = [uuid.UUID(q) for q in sess.question_order]
    rows = ctx.db.scalars(
        select(Question)
        .where(
            Question.topic_id == uuid.UUID(tid),
            Question.status == QuestionStatus.approved,
            Question.type == QuestionType.mcq,
            Question.difficulty <= max_diff,
            Question.course_id == sess.exam.course_id,
            Question.id.not_in(seen),
        )
        .order_by(Question.difficulty, Question.id)
        .limit(n)
    )
    return [{"question_id": str(q.id), "difficulty": q.difficulty, "question": q.body} for q in rows]


def t_draft(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    sess = _sess(ctx)
    content = args.get("content")
    if not isinstance(content, dict):
        raise ToolError("content must be the summary object")
    stored = validate_summary(ctx.db, facts_for(ctx.db, sess), content, author="agent")
    summary = ctx.db.scalar(select(EvaluationSummary).where(EvaluationSummary.session_id == sess.id))
    if summary and summary.status in (SummaryStatus.approved, SummaryStatus.published):
        raise ToolError("This summary is already approved by the mentor and cannot be redrafted")
    if summary is None:
        summary = EvaluationSummary(session_id=sess.id, status=SummaryStatus.draft, version=1)
        ctx.db.add(summary)
    else:
        stored["integrity_note"] = summary.content_json.get("integrity_note", "")
        summary.version += 1
        summary.status = SummaryStatus.draft
        summary.ready_for_review = False
        summary.edited_by_mentor = False
    summary.content_json = stored
    summary.drafted_run_id = ctx.run.id
    ctx.db.flush()
    ctx.state["summary_id"] = summary.id
    return {"summary_id": str(summary.id), "version": summary.version}


def t_submit(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    sid = ctx.state.get("summary_id")
    if sid is None or str(args.get("summary_id")) != str(sid):
        raise ToolError("Call draft_evaluation_summary first and pass its summary_id")
    summary = ctx.db.get(EvaluationSummary, sid)
    summary.ready_for_review = True  # stays `draft` until a mentor approves
    return {"status": summary.status.value, "ready_for_review": True}


_TOPIC = {"type": "object", "properties": {"topic_id": {"type": "string"}}, "required": ["topic_id"]}
TOOLS = (
    Tool(
        "get_topic_results",
        "Computed overall score, percentile and per-topic results (read-only).",
        {"type": "object", "properties": {}},
        t_get_topic_results,
    ),
    Tool(
        "get_wrong_answers",
        "Questions the candidate got wrong in one topic, with the chosen option and misconception.",
        _TOPIC,
        t_get_wrong_answers,
    ),
    Tool(
        "get_misconceptions",
        "Misconceptions detected for this candidate (ids + descriptions).",
        {"type": "object", "properties": {}},
        t_get_misconceptions,
    ),
    Tool(
        "find_notes",
        "Approved notes for a topic (approved library only). Optional level intro/core/advanced, query.",
        {
            "type": "object",
            "properties": {
                "topic_id": {"type": "string"},
                "level": {"type": "string"},
                "query": {"type": "string"},
            },
            "required": ["topic_id"],
        },
        t_find_notes,
    ),
    Tool(
        "select_practice_questions",
        "Approved practice questions for a topic that the candidate has not seen.",
        {
            "type": "object",
            "properties": {
                "topic_id": {"type": "string"},
                "n": {"type": "integer"},
                "max_difficulty": {"type": "integer"},
            },
            "required": ["topic_id"],
        },
        t_select_practice,
    ),
    Tool(
        "draft_evaluation_summary",
        "Save the summary draft. `content` must follow the summary schema exactly; "
        "numbers must equal get_topic_results; integrity_note must be an empty string.",
        {"type": "object", "properties": {"content": {"type": "object"}}, "required": ["content"]},
        t_draft,
        read_only=False,
    ),
    Tool(
        "submit_for_mentor_review",
        "Put the saved draft in the mentor's review queue.",
        {"type": "object", "properties": {"summary_id": {"type": "string"}}, "required": ["summary_id"]},
        t_submit,
        read_only=False,
    ),
)
SPEC = AgentSpec(
    name="assessment_evaluation", prompt_version=PROMPT_VERSION, system_prompt="", tools=TOOLS, max_turns=16
)


def _system_prompt(sess: ExamSession, course: Course, comment: str | None) -> str:
    text = _prompt_template()
    for k, v in {
        "session_id": str(sess.id),
        "exam_title": sess.exam.title,
        "course_name": course.name,
        "mentor_comment": (comment or "none").replace("\n", " "),
    }.items():
        text = text.replace("{" + k + "}", v)
    return text + (
        "\n\nThe content object you pass to draft_evaluation_summary must validate against this JSON schema:\n"
        + json.dumps(_schema_validator().schema)
    )


# ---------- Integrity Summary step: deterministic, counts only, mentor-only ----------
def integrity_text(db: Session, sess: ExamSession) -> str:
    glances = dict(
        db.execute(
            select(GlanceLog.source, func.count())
            .where(GlanceLog.session_id == sess.id)
            .group_by(GlanceLog.source)
        ).all()
    )
    other = db.scalar(
        select(func.count())
        .select_from(ProctorEvent)
        .where(
            ProctorEvent.session_id == sess.id,
            ProctorEvent.type.not_in(("LOOK_AWAY_FLAG", "LOOK_AWAY_POST_LIMIT")),
        )
    )
    open_reviews = db.scalar(
        select(func.count())
        .select_from(IdentityCheck)
        .where(
            IdentityCheck.session_id == sess.id,
            IdentityCheck.needs_review.is_(True),
            IdentityCheck.decision.is_(None),
        )
    )
    after = " (limit reached)" if sess.flag_limit_reached else ""
    return (
        f"Red flags {min(sess.flag_count, sess.exam.max_flags)} of {sess.exam.max_flags}{after} · "
        f"head glances {glances.get('head', 0)} · eye glances {glances.get('eyes', 0)} · other alerts {other} · "
        f"open identity reviews {open_reviews}. Counts only; see the timeline for details and decisions."
    )


def run_integrity_step(db: Session, sess: ExamSession, summary: EvaluationSummary) -> AgentRun:
    run = start_run(
        db,
        "integrity_summary",
        "Write the mentor-only integrity note from counts",
        {"session_id": str(sess.id)},
        subject_type="session",
        subject_id=str(sess.id),
        prompt_version="deterministic",
    )
    previous_actor = db.info.get("actor", audit.SYSTEM)
    audit.set_actor(db, audit.Actor("agent", f"integrity_summary:{run.id}"))
    try:
        _write_integrity(db, sess, summary, run)
    finally:
        audit.set_actor(db, previous_actor)
    return run


def _write_integrity(db: Session, sess: ExamSession, summary: EvaluationSummary, run: AgentRun) -> None:
    t0 = time.perf_counter()
    note = integrity_text(db, sess)
    content = dict(summary.content_json)
    content["integrity_note"] = note
    summary.content_json = content
    add_step(
        db,
        run,
        kind="deterministic",
        tool="get_session_timeline",
        args_json={"session_id": str(sess.id)},
        output_summary=note,
        latency_ms=int((time.perf_counter() - t0) * 1000),
    )
    audit.record(db, "agent.tool_call", "agent_runs", run.id, after={"tool": "get_session_timeline"})
    finish_run(run, "succeeded")


def run_evaluation(
    db: Session,
    session_id: uuid.UUID,
    *,
    comment: str | None = None,
    triggered_by: str | None = None,
    llm: LLM | None = None,
) -> AgentRun:
    """Draft (or redraft) the summary, then write the integrity note. Raises AgentUnavailable if not configured."""
    sess = db.get(ExamSession, session_id)
    course = db.get(Course, sess.exam.course_id)
    spec = AgentSpec(
        name=SPEC.name,
        prompt_version=SPEC.prompt_version,
        system_prompt=_system_prompt(sess, course, comment),
        tools=SPEC.tools,
        max_turns=SPEC.max_turns,
    )
    run = run_agent(
        db,
        spec,
        goal="Draft the Assessment Evaluation Summary",
        user_prompt=(
            "Draft the Assessment Evaluation Summary for this session, then submit it for mentor review."
            + (f"\nThe mentor asked for these changes: {comment}" if comment else "")
        ),
        params={"session_id": sess.id},
        triggered_by=triggered_by,
        subject_type="session",
        subject_id=str(sess.id),
        llm=llm,
    )
    summary = db.scalar(select(EvaluationSummary).where(EvaluationSummary.session_id == sess.id))
    if summary is not None and summary.drafted_run_id == run.id:
        run_integrity_step(db, sess, summary)
        if sess.status == SessionStatus.scored:
            from app.services.sessions import transition

            transition(db, sess, SessionStatus.analysed, "evaluation summary drafted")
    db.commit()
    return run
