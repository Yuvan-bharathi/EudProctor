"""Rule-based stand-in for the LLM, for demos and E2E tests without an API key (AGENT_LLM=mock, dev/test only).

It drives the real tool loop, so every guardrail and validator still runs; it simply writes plain template text.
It is NOT a model and never runs in production.
"""

import itertools
import json
from types import SimpleNamespace
from typing import Any

MODEL_NAME = "mock-llm (dev only)"
_ids = itertools.count(1)


def _text(t: str) -> SimpleNamespace:
    return SimpleNamespace(type="text", text=t)


def _use(name: str, **inp: Any) -> SimpleNamespace:
    return SimpleNamespace(type="tool_use", id=f"mock_{next(_ids)}", name=name, input=inp)


def _resp(blocks: list[SimpleNamespace], tokens_in: int) -> SimpleNamespace:
    stop = "tool_use" if any(b.type == "tool_use" for b in blocks) else "end_turn"
    out = sum(len(json.dumps(getattr(b, "input", getattr(b, "text", "")))) for b in blocks) // 4
    return SimpleNamespace(
        content=blocks, stop_reason=stop, usage=SimpleNamespace(input_tokens=tokens_in, output_tokens=out)
    )


def _tool_history(messages: list[dict[str, Any]]) -> list[tuple[str, Any]]:
    """(tool name, parsed result) pairs in order."""
    names: dict[str, str] = {}
    out = []
    for m in messages:
        content = m.get("content")
        if not isinstance(content, list):
            continue
        for b in content:
            if getattr(b, "type", None) == "tool_use":
                names[b.id] = b.name
            elif isinstance(b, dict) and b.get("type") == "tool_result":
                try:
                    out.append((names.get(b["tool_use_id"], "?"), json.loads(b["content"])))
                except (TypeError, ValueError):
                    out.append((names.get(b["tool_use_id"], "?"), b["content"]))
    return out


def rule_based_summary(
    results: dict[str, Any], notes: dict[str, list[str]], practice: dict[str, list[str]]
) -> dict[str, Any]:
    """Valid summary content built only from tool results (shared with the demo seed)."""
    topics = results["topics"]

    def pick(cls: str) -> list[dict[str, Any]]:
        return [
            {
                "topic_id": t["topic_id"],
                "name": t["name"],
                "score_pct": t["score_pct"],
                "n_questions": t["n_questions"],
            }
            for t in topics
            if t["class"] == cls
        ]

    ranked = sorted(
        (t for t in topics if t["class"] in ("weak", "developing")), key=lambda t: -(t["priority"] or 0)
    )[:5]
    recs, budget = [], 10
    for i, t in enumerate(ranked, start=1):
        pq = practice.get(t["topic_id"], [])[: max(0, min(4, budget))]
        budget -= len(pq)
        n = notes.get(t["topic_id"], [])[:2]
        recs.append(
            {
                "topic_id": t["topic_id"],
                "priority": i,
                "reason": f"Strengthen {t['name']}: review the core ideas, then work through the practice questions.",
                "note_ids": n,
                "practice_question_ids": pq,
                "needs_mentor_note": not n,
            }
        )
    strong = pick("strong")
    first = strong[0]["name"] if strong else None
    message = (f"Well done on {first}. " if first else "Thank you for completing this assessment. ") + (
        f"Your next step is {ranked[0]['name']}; the notes and practice below will help."
        if ranked
        else "Keep practising to stay confident across all topics."
    )
    return {
        "overall": {
            "score_pct": results["overall"]["score_pct"],
            "class_percentile": results["overall"]["class_percentile"],
            "change_vs_previous_pct": results["overall"].get("change_vs_previous_pct"),
        },
        "strong_topics": strong,
        "developing_topics": pick("developing"),
        "weak_topics": pick("weak"),
        "misconceptions": [],
        "recommended_topics": recs,
        "message": message,
        "data_notes": [],
        "integrity_note": "",
    }


_STEMS = [
    "Which statement about {topic} is correct?",
    "A classmate claims something about {topic}. Which explanation would you accept as accurate?",
    "In a worked example on {topic}, which step is justified?",
    "Pick the option that best defines the key idea in {topic}.",
    "What is the most common mistake to avoid when solving {topic} problems?",
    "Which of these units or quantities belongs with {topic}?",
]


class MockLLM:
    model = MODEL_NAME

    def create(self, **kwargs: Any) -> SimpleNamespace:
        tools = {t["name"] for t in kwargs.get("tools", [])}
        messages = kwargs["messages"]
        tin = sum(len(json.dumps(m, default=str)) for m in messages) // 4
        history = _tool_history(messages)
        if "draft_evaluation_summary" in tools:
            return _resp(self._evaluation(history), tin)
        if "create_question_draft" in tools:
            return _resp(self._questions(history, messages[0]["content"]), tin)
        return _resp([_text("Nothing to do.")], tin)

    def _evaluation(self, history: list[tuple[str, Any]]) -> list[SimpleNamespace]:
        done = [n for n, _ in history]
        if not done:
            return [_text("Reading the computed results."), _use("get_topic_results")]
        results = next(r for n, r in history if n == "get_topic_results")
        focus = [
            t["topic_id"]
            for t in sorted(
                (t for t in results["topics"] if t["class"] in ("weak", "developing")),
                key=lambda t: -(t["priority"] or 0),
            )[:5]
        ]
        asked = [(n, r) for n, r in history if n in ("find_notes", "select_practice_questions")]
        if len(asked) < 2 * len(focus):
            tid = focus[len(asked) // 2]
            if len(asked) % 2 == 0:
                return [_use("find_notes", topic_id=tid)]
            return [_use("select_practice_questions", topic_id=tid, n=4, max_difficulty=3)]
        if "draft_evaluation_summary" not in done:
            notes = {tid: [x["note_id"] for x in asked[2 * i][1]] for i, tid in enumerate(focus)}
            practice = {tid: [x["question_id"] for x in asked[2 * i + 1][1]] for i, tid in enumerate(focus)}
            return [
                _text("Drafting the summary from the tool results."),
                _use("draft_evaluation_summary", content=rule_based_summary(results, notes, practice)),
            ]
        draft = next(r for n, r in reversed(history) if n == "draft_evaluation_summary")
        if "submit_for_mentor_review" not in done and isinstance(draft, dict):
            return [_use("submit_for_mentor_review", summary_id=draft["summary_id"])]
        return [_text("Draft submitted for mentor review.")]

    def _questions(self, history: list[tuple[str, Any]], prompt: str) -> list[SimpleNamespace]:
        if not history:
            return [_use("get_syllabus_topics")]
        topics = history[0][1]
        n = int(next((w for w in prompt.split() if w.isdigit()), "3"))
        made = sum(1 for name, r in history if name == "create_question_draft" and isinstance(r, dict))
        tried = sum(1 for name, _ in history if name == "create_question_draft")
        if made >= n or tried >= n + 3 or not topics:
            return [_text("Drafts created.")]
        t = topics[tried % len(topics)]
        return [
            _use(
                "create_question_draft",
                topic_id=t["topic_id"],
                difficulty=1 + tried % 3,
                marks=1,
                body=_STEMS[tried % len(_STEMS)].format(topic=t["name"]),
                options=[
                    {"key": "A", "text": f"A correct statement about {t['name']}", "is_correct": True},
                    {"key": "B", "text": "A common confusion", "is_correct": False},
                    {"key": "C", "text": "An unrelated statement", "is_correct": False},
                    {"key": "D", "text": "The opposite of the correct statement", "is_correct": False},
                ],
            )
        ]
