"""Plain-language descriptions of recorded agent steps for the run detail page.

Works from what was recorded (tool name, arguments, output summary, error). Output summaries are capped in length,
so parsing falls back to pattern matching when the stored JSON was cut short.
"""

import json
import re
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AgentStep, Misconception, Note, Question, Topic

UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
TOPIC_ROW = re.compile(
    r'"name": "([^"]+)", "score_pct": ([\d.]+|null), "n_questions": (\d+), "class": "(\w+)"'
)

STOP_REASONS = {
    "tool_use": "decided which tool to use next",
    "end_turn": "finished its work",
    "pause_turn": "paused and continued",
    "max_tokens": "ran out of output space",
    "refusal": "declined to continue",
}


def build_labels(db: Session, steps: list[AgentStep]) -> dict[str, str]:
    """Map ids that appear in the steps to readable names."""
    ids: set[uuid.UUID] = set()
    for s in steps:
        for text in (json.dumps(s.args_json or {}), s.output_summary or ""):
            ids.update(uuid.UUID(m) for m in UUID_RE.findall(text))
    if not ids:
        return {}
    labels: dict[str, str] = {}
    for model, field in (
        (Topic, "name"),
        (Note, "title"),
        (Misconception, "description"),
        (Question, "body"),
    ):
        for row in db.scalars(select(model).where(model.id.in_(ids))):
            text = getattr(row, field)
            labels[str(row.id)] = text if len(text) <= 80 else text[:79] + "…"
    return labels


def _json(text: str | None) -> Any:
    try:
        return json.loads(text or "")
    except ValueError:
        return None


def _name(labels: dict[str, str], value: Any, fallback: str = "this topic") -> str:
    return labels.get(str(value), fallback)


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def describe(step: AgentStep, labels: dict[str, str]) -> dict[str, Any]:
    args = step.args_json or {}
    out_text = step.output_summary or ""
    out = _json(out_text)
    facts: list[dict[str, str]] = []
    for k, v in args.items():
        if k in ("content", "summary_id", "session_id"):  # internal ids stay in the technical details
            continue
        label = {
            "topic_id": "Topic",
            "n": "How many",
            "max_difficulty": "Max difficulty",
            "level": "Level",
            "query": "Search",
            "summary_id": "Summary",
            "session_id": "Session",
            "text": "Text",
            "difficulty": "Difficulty",
            "body": "Question",
        }.get(k, k.replace("_", " ").capitalize())
        value = labels.get(str(v), str(v)) if not isinstance(v, (list, dict)) else f"{len(v)} item(s)"
        facts.append({"label": label, "value": value if len(value) <= 120 else value[:119] + "…"})

    if step.kind == "llm":
        stop = out_text.removeprefix("stop_reason=")
        return {
            "title": f"The model {STOP_REASONS.get(stop, 'responded')}",
            "detail": f"Its note: “{step.reason}”" if step.reason else None,
            "facts": [],
        }

    tool = step.tool or ""
    topic = _name(labels, args.get("topic_id"))
    title, detail = tool.replace("_", " ").capitalize(), None
    if tool == "get_topic_results":
        title = "Read the computed scores for this candidate"
        rows = TOPIC_ROW.findall(out_text)
        overall = re.search(r'"score_pct": ([\d.]+), "class_percentile": ([\d.]+|null)', out_text)
        parts = []
        if overall:
            parts.append(
                f"Overall score {overall.group(1)}%"
                + (f", class percentile {overall.group(2)}" if overall.group(2) != "null" else "")
            )
        if rows:
            parts.append("Topics: " + "; ".join(f"{n} {s}% ({c})" for n, s, _, c in rows))
        if len(out_text) >= 590:
            parts.append("(list shortened)")
        detail = ". ".join(parts) or None
    elif tool == "get_wrong_answers":
        title = f"Looked at the questions answered incorrectly in {topic}"
        detail = _plural(len(out), "question") + " answered incorrectly" if isinstance(out, list) else None
    elif tool == "get_misconceptions":
        title = "Checked which misconceptions this candidate showed"
        detail = (
            ("; ".join(m.get("description", "") for m in out) or "None detected")
            if isinstance(out, list)
            else None
        )
    elif tool == "find_notes":
        title = f"Searched the approved notes library for {topic}"
        if isinstance(out, list):
            detail = (
                ("Found: " + "; ".join(n.get("title", "") for n in out))
                if out
                else ("No approved notes found, so the topic is flagged for the mentor to add one")
            )
    elif tool == "select_practice_questions":
        title = f"Picked practice questions for {topic}"
        if isinstance(out, list):
            detail = (
                f"{_plural(len(out), 'unseen question')} selected"
                if out
                else "No unseen practice questions available"
            )
    elif tool == "draft_evaluation_summary":
        title = "Saved the summary draft"
        detail = f"Draft saved (version {out.get('version')})" if isinstance(out, dict) else None
    elif tool == "submit_for_mentor_review":
        title = "Sent the draft to the mentor's review queue"
        detail = "Waiting for a mentor to review, edit and approve it"
    elif tool == "get_syllabus_topics":
        title = "Listed the course topics"
        detail = ("Topics: " + ", ".join(t.get("name", "") for t in out)) if isinstance(out, list) else None
    elif tool == "find_similar_questions":
        title = f"Checked for similar existing questions in {topic}"
        detail = (
            (f"{_plural(len(out), 'similar question')} found" if out else "No similar questions found")
            if isinstance(out, list)
            else None
        )
    elif tool == "create_question_draft":
        title = f"Created a draft question in {topic}"
        detail = "Saved as a draft for the mentor to accept or skip" if isinstance(out, dict) else None
    elif tool == "get_session_timeline":
        title = "Counted proctoring events (no AI involved)"
        detail = out_text or None
    if step.error:
        detail = f"Rejected: {step.error.removeprefix('Rejected: ')}"
    return {"title": title, "detail": detail, "facts": facts}
