"""Question Bank Agent: suggests draft questions. Drafts can never enter an assessment until a mentor accepts."""

import difflib
import uuid
from typing import Any

from sqlalchemy import select

from app.agent.registry import AgentSpec, Tool, ToolContext, ToolError
from app.models import (
    Misconception,
    Question,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
    Topic,
)

PROMPT_VERSION = "qb-v1"
DUPLICATE_RATIO = 0.9
SIMILAR_RATIO = 0.5

SYSTEM_PROMPT = """You are the Question Bank Agent for EduProctor, an assessment platform for college and course candidates.
You draft multiple-choice questions for a mentor to review. Every question you create stays a draft until the mentor accepts it.

Rules:
- Call get_syllabus_topics first and only use topic ids it returns.
- Before drafting, call find_similar_questions to avoid duplicating existing questions.
- Each question: one clear stem, 4 options (keys A-D), exactly one correct option, plausible distractors.
- Tag a wrong option with a misconception_id only if get_syllabus_topics listed that misconception for the topic.
- Difficulty is 1 (easy), 2 (medium) or 3 (hard). Marks default to 1.
- Create questions only with create_question_draft. Stop after creating the requested number of drafts.
"""


def _topic_in_course(ctx: ToolContext, topic_id: Any) -> Topic:
    try:
        tid = uuid.UUID(str(topic_id))
    except ValueError:
        raise ToolError("topic_id is not a valid id") from None
    topic = ctx.db.get(Topic, tid)
    if topic is None or topic.course_id != ctx.params["course_id"]:
        raise ToolError("Unknown topic_id for this course")
    allowed = ctx.params.get("topic_id")
    if allowed and topic.id != allowed:
        raise ToolError("The mentor asked for questions on a different topic")
    return topic


def get_syllabus_topics(ctx: ToolContext, _args: dict[str, Any]) -> list[dict[str, Any]]:
    q = select(Topic).where(Topic.course_id == ctx.params["course_id"])
    if ctx.params.get("topic_id"):
        q = q.where(Topic.id == ctx.params["topic_id"])
    out = []
    for t in ctx.db.scalars(q):
        miscs = ctx.db.scalars(select(Misconception).where(Misconception.topic_id == t.id))
        out.append(
            {
                "topic_id": str(t.id),
                "name": t.name,
                "misconceptions": [
                    {"misconception_id": str(m.id), "description": m.description} for m in miscs
                ],
            }
        )
    return out


def _similar(ctx: ToolContext, topic: Topic, text: str) -> list[tuple[float, Question]]:
    rows = ctx.db.scalars(
        select(Question).where(Question.topic_id == topic.id, Question.status != QuestionStatus.skipped)
    )
    scored = [(difflib.SequenceMatcher(None, text.lower(), q.body.lower()).ratio(), q) for q in rows]
    return sorted(scored, key=lambda x: -x[0])


def find_similar_questions(ctx: ToolContext, args: dict[str, Any]) -> list[dict[str, Any]]:
    topic = _topic_in_course(ctx, args.get("topic_id"))
    text = str(args.get("text", ""))
    return [
        {"question_id": str(q.id), "body": q.body, "similarity": round(r, 2)}
        for r, q in _similar(ctx, topic, text)[:5]
        if r >= SIMILAR_RATIO
    ]


def create_question_draft(ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
    created: list[uuid.UUID] = ctx.state.setdefault("created", [])
    if len(created) >= ctx.params["n"]:
        raise ToolError(f"Already created the requested {ctx.params['n']} drafts; stop now")
    topic = _topic_in_course(ctx, args.get("topic_id"))
    body = str(args.get("body", "")).strip()
    if len(body) < 10:
        raise ToolError("body is too short")
    if any(r >= DUPLICATE_RATIO for r, _ in _similar(ctx, topic, body)[:1]):
        raise ToolError("Near-duplicate of an existing question")
    difficulty = int(args.get("difficulty", 2))
    if difficulty not in (1, 2, 3):
        raise ToolError("difficulty must be 1, 2 or 3")
    marks = float(args.get("marks", 1))
    if not 0 < marks <= 10:
        raise ToolError("marks must be between 0 and 10")
    options = args.get("options") or []
    if not 2 <= len(options) <= 6:
        raise ToolError("Provide between 2 and 6 options")
    keys = [str(o.get("key", "")).strip().upper() for o in options]
    if len(set(keys)) != len(keys) or any(not k for k in keys):
        raise ToolError("Option keys must be unique and non-empty")
    if sum(bool(o.get("is_correct")) for o in options) != 1:
        raise ToolError("Exactly one option must be correct")
    valid_miscs = {
        m.id for m in ctx.db.scalars(select(Misconception).where(Misconception.topic_id == topic.id))
    }
    q = Question(
        course_id=topic.course_id,
        topic_id=topic.id,
        subtopic=(args.get("subtopic") or None),
        type=QuestionType.mcq,
        difficulty=difficulty,
        marks=marks,
        body=body,
        status=QuestionStatus.draft,
        source=QuestionSource.agent,
        agent_run_id=ctx.run.id,
    )
    for key, o in zip(keys, options, strict=True):
        misc_id = None
        if o.get("misconception_id") and not o.get("is_correct"):
            try:
                misc_id = uuid.UUID(str(o["misconception_id"]))
            except ValueError:
                misc_id = None
            if misc_id not in valid_miscs:
                raise ToolError("Unknown misconception_id for this topic")
        q.options.append(
            QuestionOption(
                key=key,
                text=str(o.get("text", "")).strip(),
                is_correct=bool(o.get("is_correct")),
                misconception_id=misc_id,
            )
        )
    ctx.db.add(q)
    ctx.db.flush()
    created.append(q.id)
    return {"question_id": str(q.id), "status": "draft"}


TOOLS = (
    Tool(
        "get_syllabus_topics",
        "List the course topics (and known misconceptions per topic) you may write questions for.",
        {"type": "object", "properties": {}},
        get_syllabus_topics,
    ),
    Tool(
        "find_similar_questions",
        "Find existing questions in a topic that are similar to the given text, to avoid duplicates.",
        {
            "type": "object",
            "properties": {"topic_id": {"type": "string"}, "text": {"type": "string"}},
            "required": ["topic_id", "text"],
        },
        find_similar_questions,
    ),
    Tool(
        "create_question_draft",
        "Create ONE draft multiple-choice question for mentor review. It is not usable until the mentor accepts it.",
        {
            "type": "object",
            "properties": {
                "topic_id": {"type": "string"},
                "subtopic": {"type": "string"},
                "difficulty": {"type": "integer", "enum": [1, 2, 3]},
                "marks": {"type": "number"},
                "body": {"type": "string"},
                "options": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "key": {"type": "string"},
                            "text": {"type": "string"},
                            "is_correct": {"type": "boolean"},
                            "misconception_id": {"type": "string"},
                        },
                        "required": ["key", "text", "is_correct"],
                    },
                },
            },
            "required": ["topic_id", "difficulty", "body", "options"],
        },
        create_question_draft,
        read_only=False,
    ),
)

SPEC = AgentSpec(
    name="question_bank", prompt_version=PROMPT_VERSION, system_prompt=SYSTEM_PROMPT, tools=TOOLS
)
