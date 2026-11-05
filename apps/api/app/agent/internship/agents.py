"""The four internship agents as LangGraph workflows (implementation plan sections 3 and 6.3-6.10).

Agent 1  Standup & Blocker Co-Pilot   retrieve docs -> answer (cited) -> save            (live, no approval)
Agent 2  Code Review & PR Mentor      checks -> draft -> create_draft -> [mentor] -> apply
Agent 3  Weekly Assessment & Skills   context -> draft -> validate -> create_draft -> [mentor] -> apply
Agent 4  30/60/90 Appraisal           metrics -> draft -> create_draft -> [mentor] -> apply
"""

import re
import uuid
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.internship import infra
from app.agent.internship.infra import Ctx, traced
from app.agent.llm import AgentUnavailable
from app.agent.runner import finish_run
from app.core.config import get_settings
from app.models import (
    AgentDraft,
    Appraisal,
    BlockerQuestion,
    CodeReview,
    CohortDoc,
    InternshipEnrollment,
    InternTask,
    StallAlert,
    TaskSubmission,
    User,
    WeeklyQuiz,
)
from app.models.base import utcnow
from app.services import internship as svc

# ============================================================== Agent 1: Standup & Blocker Co-Pilot

BUILTIN_DOCS = [
    {
        "id": "builtin:port-in-use",
        "title": "Port already in use / address already bound",
        "body": "Another process is using the port. Find it (Windows: netstat -ano | findstr :8000, then "
        "taskkill /PID <pid> /F; macOS/Linux: lsof -i :8000 then kill <pid>), or start the server on a "
        "different port (uvicorn --port 8001, vite --port 5174). Check for an old terminal still running the app.",
    },
    {
        "id": "builtin:jwt",
        "title": "JWT signature verification failed / invalid token",
        "body": "The token was signed with a different secret than the one verifying it. Make sure JWT_SECRET "
        "is identical everywhere, restart the API after changing .env, then sign out and sign in again to get a "
        "fresh token. Expired tokens fail too: check the exp claim and the server clock.",
    },
    {
        "id": "builtin:alembic",
        "title": "Alembic migration conflict / multiple heads",
        "body": "Run alembic heads. Two heads means two migrations share a parent: create a merge revision "
        "(alembic merge -m 'merge heads' <rev1> <rev2>) or re-point down_revision of your new migration to the "
        "current head, then alembic upgrade head. Never edit a migration that was already applied elsewhere.",
    },
    {
        "id": "builtin:module-not-found",
        "title": "ModuleNotFoundError / Cannot find module",
        "body": "The package is not installed in the environment that runs the code. Activate the project's "
        "virtualenv (or use the project's package manager: uv / pnpm / npm), install dependencies again "
        "(pip install -r requirements.txt, pnpm install), and check the import path and casing.",
    },
    {
        "id": "builtin:cors",
        "title": "CORS error in the browser",
        "body": "The API must allow the web app's origin. Check the API's CORS settings include the exact "
        "origin (scheme, host and port, e.g. http://localhost:5173), and that the request uses the API URL the "
        "dev proxy expects. A failing preflight (OPTIONS) is usually a missing allowed header or method.",
    },
    {
        "id": "builtin:git-merge-conflict",
        "title": "Git merge conflict",
        "body": "Run git status to list conflicted files, open each one, keep the right lines between the "
        "<<<<<<< / ======= / >>>>>>> markers and delete the markers, then git add the files and finish with "
        "git commit (or git rebase --continue). If unsure, ask your mentor before force-pushing anything.",
    },
]

_WORD = re.compile(r"[a-z0-9]{3,}")
_STOP = {"the", "and", "for", "with", "this", "that", "from", "have", "not", "are", "was", "when", "what", "how",
         "why", "error", "issue", "problem", "getting", "get", "cannot", "can"}


def _terms(text: str) -> set[str]:
    return {w for w in _WORD.findall(text.lower()) if w not in _STOP}


def retrieve_docs(db: Session, cohort_id: uuid.UUID, question: str, k: int = 3) -> list[dict[str, Any]]:
    """Deterministic keyword retrieval over mentor-curated cohort docs plus built-in setup docs."""
    docs = [{"id": f"doc:{d.id}", "title": d.title, "body": d.body}
            for d in db.scalars(select(CohortDoc).where(CohortDoc.cohort_id == cohort_id))]
    docs += BUILTIN_DOCS
    q = _terms(question)
    scored = []
    for d in docs:
        overlap = q & _terms(d["title"] + " " + d["body"])
        title_hits = q & _terms(d["title"])
        score = len(overlap) + 2 * len(title_hits)
        if len(overlap) >= 2 or title_hits:
            scored.append((score, d))
    scored.sort(key=lambda x: -x[0])
    return [d for _, d in scored[:k]]


class BlockerState(TypedDict, total=False):
    mentee_id: str
    question_id: str
    doc_ids: list[str]
    answered: bool


BLOCKER_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string", "minLength": 1, "maxLength": 3000},
        "steps": {"type": "array", "items": {"type": "string"}, "maxItems": 3},
        "cited_doc_ids": {"type": "array", "items": {"type": "string"}},
        "confident": {"type": "boolean"},
    },
    "required": ["answer", "steps", "cited_doc_ids", "confident"],
}

BLOCKER_SYSTEM = (
    "You are the EduProctor Blocker Co-Pilot for software interns. Answer ONLY from the provided documents. "
    "Give at most 3 short, concrete troubleshooting steps and cite the ids of the documents you used. "
    "If the documents do not cover the problem, set confident=false and say so plainly. "
    "Do not write the intern's task solution for them; guide them."
)


@traced("retrieve_docs")
def _blocker_retrieve(state: BlockerState, c: Ctx) -> dict[str, Any]:
    bq = c.db.get(BlockerQuestion, uuid.UUID(state["question_id"]))
    enr = svc.require_enrollment(c.db, bq.mentee_id)
    docs = retrieve_docs(c.db, enr.cohort_id, bq.question)
    return {"doc_ids": [d["id"] for d in docs]}


@traced("answer_question", kind="llm")
def _blocker_answer(state: BlockerState, c: Ctx) -> dict[str, Any]:
    bq = c.db.get(BlockerQuestion, uuid.UUID(state["question_id"]))
    enr = svc.require_enrollment(c.db, bq.mentee_id)
    docs = [d for d in retrieve_docs(c.db, enr.cohort_id, bq.question) if d["id"] in state.get("doc_ids", [])]
    if not docs:
        bq.answer = ("I couldn't find this in your project's docs, so I've passed it to your mentor. "
                     "Meanwhile, note the exact error message and the steps that led to it.")
        bq.escalated = True
        return {"answered": False}
    out = infra.structured_call(
        c, tool="intern_blocker_answer", description="Answer the intern's blocker from the documents.",
        system=BLOCKER_SYSTEM, payload={"question": bq.question, "documents": docs}, schema=BLOCKER_SCHEMA,
    )
    allowed = {d["id"] for d in docs}
    cited = [i for i in out["cited_doc_ids"] if i in allowed]
    titles = {d["id"]: d["title"] for d in docs}
    steps = "\n".join(f"{n}. {s}" for n, s in enumerate(out["steps"], start=1))
    bq.answer = out["answer"] + (f"\n\n{steps}" if steps else "")
    bq.citations = [{"id": i, "title": titles[i]} for i in cited]
    if not out["confident"] or not cited:
        bq.escalated = True
        bq.answer += "\n\nI'm not fully sure this covers it, so I've also let your mentor know."
    return {"answered": True}


@traced("save_and_escalate")
def _blocker_save(state: BlockerState, c: Ctx) -> dict[str, Any]:
    bq = c.db.get(BlockerQuestion, uuid.UUID(state["question_id"]))
    if bq.task_id:
        task = c.db.get(InternTask, bq.task_id)
        if task:
            task.last_activity_at = utcnow()
    if bq.escalated:
        enr = svc.require_enrollment(c.db, bq.mentee_id)
        c.db.add(StallAlert(mentee_id=bq.mentee_id, mentor_id=enr.mentor_id, task_id=bq.task_id,
                            source="blocker_chat", reason=f"Co-Pilot could not resolve: {bq.question[:300]}"))
    return {}


def _build_blocker() -> Any:
    g = StateGraph(BlockerState)
    g.add_node("retrieve_docs", _blocker_retrieve)
    g.add_node("answer_question", _blocker_answer)
    g.add_node("save_and_escalate", _blocker_save)
    g.add_edge(START, "retrieve_docs")
    g.add_edge("retrieve_docs", "answer_question")
    g.add_edge("answer_question", "save_and_escalate")
    g.add_edge("save_and_escalate", END)
    return g.compile(checkpointer=infra.get_checkpointer())


def ask_blocker(db: Session, mentee: User, question: str, task_id: uuid.UUID | None) -> BlockerQuestion:
    bq = BlockerQuestion(mentee_id=mentee.id, task_id=task_id, question=question.strip()[:4000])
    db.add(bq)
    db.flush()
    run = infra.start_agent_run(db, "blocker_copilot", "Answer an intern's blocker from project docs",
                                {"question_id": str(bq.id)}, triggered_by=f"user:{mentee.id}",
                                subject_type="blocker_question", subject_id=str(bq.id))
    bq.run_id = run.id
    try:
        out = infra.invoke(_build_blocker(), {"mentee_id": str(mentee.id), "question_id": str(bq.id)},
                           infra.new_thread_id("blocker"), db, run)
        infra.end_run(run, out)
    except Exception as exc:  # not configured, out of credit, provider error...: the mentor takes over
        bq.answer = "The AI Co-Pilot isn't available right now, so I've passed your question to your mentor."
        bq.escalated = True
        enr = svc.require_enrollment(db, mentee.id)
        db.add(StallAlert(mentee_id=mentee.id, mentor_id=enr.mentor_id, task_id=task_id, source="blocker_chat",
                          reason=f"Co-Pilot unavailable: {question[:300]}"))
        finish_run(run, "failed", str(exc))
    return bq


# ============================================================== Agent 2: Code Review & PR Mentor

class ReviewState(TypedDict, total=False):
    submission_id: str
    review_id: str
    draft_id: str
    draft: dict[str, Any]
    decision: dict[str, Any]


REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "minLength": 1, "maxLength": 1500},
        "strengths": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
        "socratic_questions": {
            "type": "array",
            "minItems": 1,
            "maxItems": 6,
            "items": {
                "type": "object",
                "properties": {
                    "line": {"type": ["integer", "null"]},
                    "question": {"type": "string", "minLength": 1},
                    "why_it_matters": {"type": "string"},
                },
                "required": ["question", "why_it_matters"],
            },
        },
        "findings_explained": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"rule": {"type": "string"}, "explanation": {"type": "string"}},
                "required": ["rule", "explanation"],
            },
        },
        "mentor_walkthrough_questions": {"type": "array", "items": {"type": "string"}, "maxItems": 3},
    },
    "required": ["summary", "strengths", "socratic_questions", "findings_explained", "mentor_walkthrough_questions"],
}

REVIEW_SYSTEM = (
    "You are a Socratic code reviewer for a software intern. Explain the implications of the code and the "
    "automated findings and ask guiding questions; do NOT rewrite the code or hand over a full solution. "
    "Be specific (refer to line numbers), kind and brief. Do not give any numeric quality score."
)


@traced("deterministic_checks")
def _review_checks(state: ReviewState, c: Ctx) -> dict[str, Any]:
    sub = c.db.get(TaskSubmission, uuid.UUID(state["submission_id"]))
    code = svc.decrypt_code(sub.code_enc) or ""
    findings, metrics = svc.static_checks(code)
    review = c.db.scalar(select(CodeReview).where(CodeReview.submission_id == sub.id))
    if review is None:
        review = CodeReview(submission_id=sub.id, findings=findings, metrics=metrics)
        c.db.add(review)
        c.db.flush()
    sub.review_status = "pending_review"
    return {"review_id": str(review.id)}


@traced("draft_review", kind="llm")
def _review_draft(state: ReviewState, c: Ctx) -> dict[str, Any]:
    sub = c.db.get(TaskSubmission, uuid.UUID(state["submission_id"]))
    task = c.db.get(InternTask, sub.task_id)
    review = c.db.get(CodeReview, uuid.UUID(state["review_id"]))
    code = svc.decrypt_code(sub.code_enc) or ""
    numbered = "\n".join(f"{i:4d} | {ln}" for i, ln in enumerate(code.splitlines()[: get_settings().max_submission_lines], 1))
    draft = infra.structured_call(
        c, tool="intern_code_review", description="Write a Socratic review of the intern's submission.",
        system=REVIEW_SYSTEM,
        payload={
            "task": {"title": task.title, "acceptance_criteria": task.acceptance_criteria, "skill_area": task.skill_area},
            "language": sub.language, "filename": sub.filename, "intern_notes": sub.notes,
            "automated_findings": review.findings, "metrics": review.metrics, "code_with_line_numbers": numbered,
        },
        schema=REVIEW_SCHEMA,
    )
    return {"draft": draft}


@traced("create_mentor_draft")
def _review_create_draft(state: ReviewState, c: Ctx) -> dict[str, Any]:
    sub = c.db.get(TaskSubmission, uuid.UUID(state["submission_id"]))
    task = c.db.get(InternTask, sub.task_id)
    mentee = c.db.get(User, sub.mentee_id)
    draft = infra.create_draft(
        c, agent="code_review", thread_id=_thread(c), mentor_id=task.mentor_id, mentee_id=sub.mentee_id,
        subject_type="task_submission", subject_id=str(sub.id),
        title=f"Code review · {mentee.name} · {task.title}", content=state["draft"],
    )
    sub.review_status = "awaiting_mentor"
    return {"draft_id": str(draft.id)}


def apply_review_decision(db: Session, draft: AgentDraft, decision: dict[str, Any]) -> None:
    sub = db.get(TaskSubmission, uuid.UUID(draft.subject_id))
    review = db.scalar(select(CodeReview).where(CodeReview.submission_id == sub.id))
    if decision["action"] == "approve":
        review.review = decision.get("content") or draft.content
        review.status = "published"
        review.published_at = utcnow()
        sub.review_status = "published"
    else:
        review.status = "rejected"
        sub.review_status = "rejected"


@traced("apply_mentor_decision")
def _review_apply(state: ReviewState, c: Ctx) -> dict[str, Any]:
    apply_review_decision(c.db, c.db.get(AgentDraft, uuid.UUID(state["draft_id"])), state["decision"])
    return {}


def _thread(c: Ctx) -> str:
    # The thread id of the running graph is stored on the run's inputs when the run starts.
    return c.run.inputs_json["thread_id"]


def _build_review() -> Any:
    g = StateGraph(ReviewState)
    g.add_node("deterministic_checks", _review_checks)
    g.add_node("draft_review", _review_draft)
    g.add_node("create_mentor_draft", _review_create_draft)
    g.add_node("wait_for_mentor", infra.wait_for_mentor)
    g.add_node("apply_mentor_decision", _review_apply)
    g.add_edge(START, "deterministic_checks")
    g.add_edge("deterministic_checks", "draft_review")
    g.add_edge("draft_review", "create_mentor_draft")
    g.add_edge("create_mentor_draft", "wait_for_mentor")
    g.add_edge("wait_for_mentor", "apply_mentor_decision")
    g.add_edge("apply_mentor_decision", END)
    return g.compile(checkpointer=infra.get_checkpointer())


def start_code_review(db: Session, submission: TaskSubmission, triggered_by: str) -> None:
    tid = infra.new_thread_id("code_review")
    run = infra.start_agent_run(db, "code_review", "Draft a Socratic review of a task submission",
                                {"submission_id": str(submission.id), "thread_id": tid}, triggered_by=triggered_by,
                                subject_type="task_submission", subject_id=str(submission.id))
    try:
        out = infra.invoke(_build_review(), {"submission_id": str(submission.id)}, tid, db, run)
        infra.end_run(run, out)
    except AgentUnavailable as exc:
        submission.review_status = "agent_unavailable"
        finish_run(run, "failed", str(exc))
    except Exception as exc:  # the submission itself is safe; the mentor reviews manually
        submission.review_status = "agent_failed"
        finish_run(run, "failed", str(exc)[:500])


# ============================================================== Agent 3: Weekly Assessment & Skill Matrix

class QuizState(TypedDict, total=False):
    quiz_id: str
    skills: list[str]
    draft: dict[str, Any]
    draft_id: str
    decision: dict[str, Any]


QUIZ_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "minItems": 1,
            "maxItems": 10,
            "items": {
                "type": "object",
                "properties": {
                    "skill": {"type": "string"},
                    "body": {"type": "string", "minLength": 5},
                    "options": {
                        "type": "array",
                        "minItems": 4,
                        "maxItems": 4,
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string", "enum": ["A", "B", "C", "D"]},
                                "text": {"type": "string", "minLength": 1},
                                "misconception": {"type": ["string", "null"]},
                            },
                            "required": ["key", "text"],
                        },
                    },
                    "correct_key": {"type": "string", "enum": ["A", "B", "C", "D"]},
                    "explanation": {"type": "string"},
                },
                "required": ["skill", "body", "options", "correct_key", "explanation"],
            },
        }
    },
    "required": ["questions"],
}

QUIZ_SYSTEM = (
    "You write a short weekly multiple-choice check for a software intern about the concepts behind THEIR "
    "tasks this week. Each question has exactly 4 options A-D and exactly one correct answer. Tag every "
    "question with one skill from the allowed list. For wrong options, name the misconception they reveal "
    "(short tag such as 'cache-invalidation-timing'). Test understanding, not trivia."
)


def validate_quiz_questions(questions: list[dict[str, Any]], allowed_skills: list[str]) -> list[dict[str, Any]]:
    """Deterministic validation + normalisation. Raises ValueError with a user-facing message."""
    out = []
    allowed = {s.lower(): s for s in allowed_skills}
    for i, q in enumerate(questions, start=1):
        keys = [o["key"].strip().upper() for o in q["options"]]
        if sorted(keys) != ["A", "B", "C", "D"]:
            raise ValueError(f"Question {i}: options must be exactly A, B, C and D")
        if any(not o["text"].strip() for o in q["options"]):
            raise ValueError(f"Question {i}: every option needs text")
        correct = q["correct_key"].strip().upper()
        if correct not in keys:
            raise ValueError(f"Question {i}: the correct answer must be one of A-D")
        if not q["body"].strip():
            raise ValueError(f"Question {i}: the question text is empty")
        skill = allowed.get(q["skill"].strip().lower(), allowed_skills[0])
        out.append({
            "id": q.get("id") or f"q{i}",
            "skill": skill,
            "body": q["body"].strip(),
            "options": [{"key": o["key"].strip().upper(), "text": o["text"].strip(),
                         "misconception": (o.get("misconception") or None)} for o in q["options"]],
            "correct_key": correct,
            "explanation": (q.get("explanation") or "").strip(),
        })
    return out


def _week_tasks(db: Session, quiz: WeeklyQuiz) -> list[InternTask]:
    tasks = list(db.scalars(select(InternTask).where(
        InternTask.mentee_id == quiz.mentee_id, InternTask.cohort_id == quiz.cohort_id,
        InternTask.week_number.in_([quiz.week_number, quiz.week_number - 1]))))
    return tasks


def quiz_skills(db: Session, quiz: WeeklyQuiz) -> list[str]:
    skills: list[str] = []
    for t in _week_tasks(db, quiz):
        for s in [t.skill_area, *(t.skill_tags or [])]:
            if s and s not in skills:
                skills.append(s)
    return skills or ["General Engineering"]


@traced("gather_week_context")
def _quiz_context(state: QuizState, c: Ctx) -> dict[str, Any]:
    quiz = c.db.get(WeeklyQuiz, uuid.UUID(state["quiz_id"]))
    return {"skills": quiz_skills(c.db, quiz)}


@traced("draft_questions", kind="llm")
def _quiz_draft(state: QuizState, c: Ctx) -> dict[str, Any]:
    quiz = c.db.get(WeeklyQuiz, uuid.UUID(state["quiz_id"]))
    tasks = _week_tasks(c.db, quiz)
    subs = list(c.db.scalars(select(TaskSubmission).where(TaskSubmission.task_id.in_([t.id for t in tasks]))))
    draft = infra.structured_call(
        c, tool="intern_weekly_quiz", description="Draft the intern's weekly multiple-choice check.",
        system=QUIZ_SYSTEM,
        payload={
            "week_number": quiz.week_number,
            "allowed_skills": state["skills"],
            "number_of_questions": get_settings().weekly_quiz_questions,
            "tasks_this_week": [{"title": t.title, "description": t.description[:800], "skill_area": t.skill_area,
                                 "skill_tags": t.skill_tags, "acceptance_criteria": t.acceptance_criteria[:500]}
                                for t in tasks],
            "intern_submission_notes": [s.notes[:500] for s in subs if s.notes][:5],
        },
        schema=QUIZ_SCHEMA,
    )
    return {"draft": draft}


@traced("validate_and_create_draft")
def _quiz_create_draft(state: QuizState, c: Ctx) -> dict[str, Any]:
    quiz = c.db.get(WeeklyQuiz, uuid.UUID(state["quiz_id"]))
    questions = validate_quiz_questions(state["draft"]["questions"], state["skills"])
    quiz.questions = questions
    quiz.status = "awaiting_mentor"
    enr = svc.require_enrollment(c.db, quiz.mentee_id)
    mentee = c.db.get(User, quiz.mentee_id)
    draft = infra.create_draft(
        c, agent="weekly_quiz", thread_id=_thread(c), mentor_id=enr.mentor_id, mentee_id=quiz.mentee_id,
        subject_type="weekly_quiz", subject_id=str(quiz.id),
        title=f"Weekly quiz · {mentee.name} · Week {quiz.week_number}",
        content={"questions": questions, "allowed_skills": state["skills"]},
    )
    return {"draft_id": str(draft.id)}


def apply_quiz_decision(db: Session, draft: AgentDraft, decision: dict[str, Any]) -> None:
    quiz = db.get(WeeklyQuiz, uuid.UUID(draft.subject_id))
    if decision["action"] == "approve":
        content = decision.get("content") or draft.content
        quiz.questions = validate_quiz_questions(content["questions"], draft.content.get("allowed_skills") or ["General Engineering"])
        quiz.status = "available"
        quiz.released_at = utcnow()
    else:
        quiz.status = "rejected"


@traced("apply_mentor_decision")
def _quiz_apply(state: QuizState, c: Ctx) -> dict[str, Any]:
    apply_quiz_decision(c.db, c.db.get(AgentDraft, uuid.UUID(state["draft_id"])), state["decision"])
    return {}


def _build_quiz() -> Any:
    g = StateGraph(QuizState)
    g.add_node("gather_week_context", _quiz_context)
    g.add_node("draft_questions", _quiz_draft)
    g.add_node("validate_and_create_draft", _quiz_create_draft)
    g.add_node("wait_for_mentor", infra.wait_for_mentor)
    g.add_node("apply_mentor_decision", _quiz_apply)
    g.add_edge(START, "gather_week_context")
    g.add_edge("gather_week_context", "draft_questions")
    g.add_edge("draft_questions", "validate_and_create_draft")
    g.add_edge("validate_and_create_draft", "wait_for_mentor")
    g.add_edge("wait_for_mentor", "apply_mentor_decision")
    g.add_edge("apply_mentor_decision", END)
    return g.compile(checkpointer=infra.get_checkpointer())


def start_weekly_quiz(db: Session, enrollment: InternshipEnrollment, week: int, triggered_by: str) -> WeeklyQuiz:
    quiz = db.scalar(select(WeeklyQuiz).where(WeeklyQuiz.mentee_id == enrollment.mentee_id,
                                              WeeklyQuiz.cohort_id == enrollment.cohort_id,
                                              WeeklyQuiz.week_number == week))
    if quiz is not None and quiz.status not in ("rejected", "failed"):
        return quiz
    if quiz is None:
        quiz = WeeklyQuiz(mentee_id=enrollment.mentee_id, cohort_id=enrollment.cohort_id, week_number=week,
                          title=f"Week {week} check")
        db.add(quiz)
    quiz.status = "drafting"
    quiz.questions = []
    db.flush()
    tid = infra.new_thread_id("weekly_quiz")
    run = infra.start_agent_run(db, "weekly_quiz", "Draft the weekly task-aware quiz",
                                {"quiz_id": str(quiz.id), "thread_id": tid}, triggered_by=triggered_by,
                                subject_type="weekly_quiz", subject_id=str(quiz.id))
    try:
        out = infra.invoke(_build_quiz(), {"quiz_id": str(quiz.id)}, tid, db, run)
        infra.end_run(run, out)
    except Exception as exc:
        quiz.status = "failed"
        finish_run(run, "failed", str(exc)[:500])
    return quiz


# ============================================================== Agent 4: 30/60/90 Appraisal

class AppraisalState(TypedDict, total=False):
    appraisal_id: str
    draft: dict[str, Any]
    draft_id: str
    decision: dict[str, Any]


_STR_LIST = {"type": "array", "items": {"type": "string"}, "maxItems": 6}
APPRAISAL_SCHEMA = {
    "type": "object",
    "properties": {
        "qualitative_summary": {"type": "string", "minLength": 1, "maxLength": 2000},
        "strengths": _STR_LIST,
        "growth_areas": _STR_LIST,
        "next_goals": _STR_LIST,
        "mentor_brief": {"type": "string", "maxLength": 2000},
        "self_appraisal_scaffold": {
            "type": "object",
            "properties": {"accomplishments": _STR_LIST, "challenges": _STR_LIST, "focus_goals": _STR_LIST},
            "required": ["accomplishments", "challenges", "focus_goals"],
        },
    },
    "required": ["qualitative_summary", "strengths", "growth_areas", "next_goals", "mentor_brief",
                 "self_appraisal_scaffold"],
}

APPRAISAL_SYSTEM = (
    "You prepare a milestone growth summary for a software intern from the metrics provided. Be factual and "
    "constructive and only use the numbers given (never invent figures). No ranking against other interns, "
    "no hiring/stipend/conversion language, no labels about character. Coding and communication quality are "
    "assessed by the mentor; do not score them."
)


@traced("compute_metrics")
def _appr_metrics(state: AppraisalState, c: Ctx) -> dict[str, Any]:
    ap = c.db.get(Appraisal, uuid.UUID(state["appraisal_id"]))
    enr = svc.require_enrollment(c.db, ap.mentee_id)
    ap.metrics = svc.appraisal_metrics(c.db, enr, ap.milestone_day)
    return {}


@traced("draft_appraisal", kind="llm")
def _appr_draft(state: AppraisalState, c: Ctx) -> dict[str, Any]:
    ap = c.db.get(Appraisal, uuid.UUID(state["appraisal_id"]))
    tasks = list(c.db.scalars(select(InternTask).where(InternTask.mentee_id == ap.mentee_id)))
    draft = infra.structured_call(
        c, tool="intern_appraisal", description="Draft the intern's milestone growth summary.",
        system=APPRAISAL_SYSTEM,
        payload={"milestone_day": ap.milestone_day, "metrics": ap.metrics,
                 "tasks": [{"title": t.title, "status": t.status.value, "skill_area": t.skill_area} for t in tasks][:30]},
        schema=APPRAISAL_SCHEMA,
    )
    return {"draft": draft}


@traced("create_mentor_draft")
def _appr_create_draft(state: AppraisalState, c: Ctx) -> dict[str, Any]:
    ap = c.db.get(Appraisal, uuid.UUID(state["appraisal_id"]))
    enr = svc.require_enrollment(c.db, ap.mentee_id)
    mentee = c.db.get(User, ap.mentee_id)
    ap.status = "awaiting_mentor"
    draft = infra.create_draft(
        c, agent="appraisal", thread_id=_thread(c), mentor_id=enr.mentor_id, mentee_id=ap.mentee_id,
        subject_type="appraisal", subject_id=str(ap.id),
        title=f"Day-{ap.milestone_day} appraisal · {mentee.name}",
        content={**state["draft"], "metrics": ap.metrics},
    )
    return {"draft_id": str(draft.id)}


def apply_appraisal_decision(db: Session, draft: AgentDraft, decision: dict[str, Any]) -> None:
    ap = db.get(Appraisal, uuid.UUID(draft.subject_id))
    if decision["action"] == "approve":
        content = dict(decision.get("content") or draft.content)
        content.pop("metrics", None)  # numbers always come from the deterministic metrics, never edited text
        ap.content = content
        ap.status = "published"
        ap.published_at = utcnow()
    else:
        ap.status = "rejected"


@traced("apply_mentor_decision")
def _appr_apply(state: AppraisalState, c: Ctx) -> dict[str, Any]:
    apply_appraisal_decision(c.db, c.db.get(AgentDraft, uuid.UUID(state["draft_id"])), state["decision"])
    return {}


def _build_appraisal() -> Any:
    g = StateGraph(AppraisalState)
    g.add_node("compute_metrics", _appr_metrics)
    g.add_node("draft_appraisal", _appr_draft)
    g.add_node("create_mentor_draft", _appr_create_draft)
    g.add_node("wait_for_mentor", infra.wait_for_mentor)
    g.add_node("apply_mentor_decision", _appr_apply)
    g.add_edge(START, "compute_metrics")
    g.add_edge("compute_metrics", "draft_appraisal")
    g.add_edge("draft_appraisal", "create_mentor_draft")
    g.add_edge("create_mentor_draft", "wait_for_mentor")
    g.add_edge("wait_for_mentor", "apply_mentor_decision")
    g.add_edge("apply_mentor_decision", END)
    return g.compile(checkpointer=infra.get_checkpointer())


def start_appraisal(db: Session, enrollment: InternshipEnrollment, milestone_day: int, triggered_by: str) -> Appraisal:
    ap = db.scalar(select(Appraisal).where(Appraisal.mentee_id == enrollment.mentee_id,
                                           Appraisal.cohort_id == enrollment.cohort_id,
                                           Appraisal.milestone_day == milestone_day))
    if ap is not None and ap.status not in ("rejected", "failed"):
        return ap
    if ap is None:
        ap = Appraisal(mentee_id=enrollment.mentee_id, cohort_id=enrollment.cohort_id, milestone_day=milestone_day)
        db.add(ap)
    ap.status = "drafting"
    db.flush()
    tid = infra.new_thread_id("appraisal")
    run = infra.start_agent_run(db, "appraisal", f"Draft the day-{milestone_day} appraisal",
                                {"appraisal_id": str(ap.id), "thread_id": tid}, triggered_by=triggered_by,
                                subject_type="appraisal", subject_id=str(ap.id))
    try:
        out = infra.invoke(_build_appraisal(), {"appraisal_id": str(ap.id)}, tid, db, run)
        infra.end_run(run, out)
    except Exception as exc:
        ap.status = "failed"
        finish_run(run, "failed", str(exc)[:500])
    return ap


# ============================================================== approval routing

GRAPHS = {
    "code_review": (_build_review, apply_review_decision),
    "weekly_quiz": (_build_quiz, apply_quiz_decision),
    "appraisal": (_build_appraisal, apply_appraisal_decision),
}


def decide_draft(db: Session, draft: AgentDraft, decision: dict[str, Any], actor_id: uuid.UUID) -> None:
    build, apply = GRAPHS[draft.agent]
    infra.record_decision(db, draft, decision, actor_id)
    infra.resume_draft(db, draft, decision, build(), apply, actor_id)


# ============================================================== scheduled jobs


def due_milestones(enrollment: InternshipEnrollment, today: Any) -> list[int]:
    elapsed = (today - enrollment.started_on).days + 1
    return [d for d in (30, 60, 90) if elapsed >= d]

