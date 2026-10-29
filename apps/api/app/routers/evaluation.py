"""Mentor review and publishing of Assessment Evaluation Summaries. Publishing is a mentor action, never an agent tool.

State machine: draft -> changes_requested -> draft (v+1) -> approved -> published. `/publish` returns 409 unless the
summary is `approved` (rule 4)."""

import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.evaluation import facts_for, run_evaluation, t_select_practice, validate_summary
from app.agent.llm import AgentUnavailable
from app.agent.registry import ToolContext, ToolError
from app.core import audit
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import mentor_only
from app.models import ExamSession, SessionStatus, User
from app.models.base import utcnow
from app.models.evaluation import EvaluationSummary, PracticeSet, SummaryStatus
from app.routers.exams import own_exam
from app.routers.mentor import mentor_session
from app.routers.results import SessionResult, session_result
from app.services.mailer import send_mail

router = APIRouter(prefix="/evaluation-summaries", tags=["evaluation"], dependencies=[Depends(mentor_only)])


class QueueRow(BaseModel):
    summary_id: uuid.UUID | None
    session_id: uuid.UUID
    candidate_name: str
    session_status: str
    status: SummaryStatus | None
    version: int | None
    ready_for_review: bool
    updated_at: datetime | None


class SummaryOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    status: SummaryStatus
    version: int
    ready_for_review: bool
    edited_by_mentor: bool
    mentor_comment: str | None
    content: dict[str, Any]  # mentor view: includes data_notes and integrity_note
    approved_by_name: str | None
    approved_at: datetime | None
    published_at: datetime | None
    drafted_run_id: uuid.UUID | None


class ReviewOut(BaseModel):
    summary: SummaryOut | None
    result: SessionResult


def _out(db: Session, s: EvaluationSummary) -> SummaryOut:
    approver = db.get(User, s.approved_by) if s.approved_by else None
    return SummaryOut(
        id=s.id,
        session_id=s.session_id,
        status=s.status,
        version=s.version,
        ready_for_review=s.ready_for_review,
        edited_by_mentor=s.edited_by_mentor,
        mentor_comment=s.mentor_comment,
        content=s.content_json,
        approved_by_name=approver.name if approver else None,
        approved_at=s.approved_at,
        published_at=s.published_at,
        drafted_run_id=s.drafted_run_id,
    )


def _summary(
    db: Session, mentor: User, summary_id: uuid.UUID, lock: bool = True
) -> tuple[EvaluationSummary, ExamSession]:
    q = select(EvaluationSummary).where(EvaluationSummary.id == summary_id)
    s = db.scalar(q.with_for_update() if lock else q)
    if s is None:
        raise HTTPException(404, "Summary not found")
    return s, mentor_session(db, mentor, s.session_id)


@router.get("", response_model=list[QueueRow])
def review_queue(exam_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    exam = own_exam(db, mentor, exam_id)
    rows = db.execute(
        select(ExamSession, User, EvaluationSummary)
        .join(User, User.id == ExamSession.candidate_id)
        .outerjoin(EvaluationSummary, EvaluationSummary.session_id == ExamSession.id)
        .where(
            ExamSession.exam_id == exam.id,
            ExamSession.status.in_((SessionStatus.scored, SessionStatus.analysed)),
        )
        .order_by(User.name)
    )
    return [
        QueueRow(
            summary_id=s.id if s else None,
            session_id=sess.id,
            candidate_name=u.name,
            session_status=sess.status.value,
            status=s.status if s else None,
            version=s.version if s else None,
            ready_for_review=bool(s and s.ready_for_review),
            updated_at=s.updated_at if s else None,
        )
        for sess, u, s in rows
    ]


@router.get("/by-session/{session_id}", response_model=ReviewOut)
def review(session_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    sess = mentor_session(db, mentor, session_id)
    s = db.scalar(select(EvaluationSummary).where(EvaluationSummary.session_id == sess.id))
    return ReviewOut(summary=_out(db, s) if s else None, result=session_result(db, sess))


class DraftIn(BaseModel):
    session_id: uuid.UUID


@router.post("/draft", response_model=SummaryOut)
def draft(body: DraftIn, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    """Mentor-triggered (re)draft, e.g. when the background job could not run."""
    sess = mentor_session(db, mentor, body.session_id)
    if sess.status not in (SessionStatus.scored, SessionStatus.analysed):
        raise HTTPException(409, "The assessment has not been scored yet")
    existing = db.scalar(select(EvaluationSummary).where(EvaluationSummary.session_id == sess.id))
    if existing and existing.status in (SummaryStatus.approved, SummaryStatus.published):
        raise HTTPException(409, "Already approved")
    try:
        run = run_evaluation(db, sess.id, triggered_by=str(mentor.id))
    except AgentUnavailable as exc:
        raise HTTPException(503, str(exc)) from None
    s = db.scalar(select(EvaluationSummary).where(EvaluationSummary.session_id == sess.id))
    if s is None or s.drafted_run_id != run.id:
        raise HTTPException(
            502, f"The agent did not produce a valid draft: {run.error or 'see the agent run'}"
        )
    return _out(db, s)


class PatchIn(BaseModel):
    content: dict[str, Any]


@router.patch("/{summary_id}", response_model=SummaryOut)
def edit(
    summary_id: uuid.UUID, body: PatchIn, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    s, sess = _summary(db, mentor, summary_id)
    if s.status == SummaryStatus.published:
        raise HTTPException(409, "Published summaries cannot be edited")
    content = dict(body.content)
    content["integrity_note"] = s.content_json.get("integrity_note", "")  # server-written, never edited
    try:
        stored = validate_summary(db, facts_for(db, sess), content, author="mentor")
    except ToolError as exc:
        raise HTTPException(422, str(exc)) from None
    before = {"version": s.version, "status": s.status.value}
    s.content_json = stored
    s.version += 1
    s.edited_by_mentor = True
    s.status = SummaryStatus.draft  # an edit after approval needs approval again
    s.approved_by = s.approved_at = None
    audit.record(
        db, "summary.edit", "evaluation_summaries", s.id, before=before, after={"version": s.version}
    )
    db.commit()
    return _out(db, s)


class CommentIn(BaseModel):
    comment: str = Field(min_length=3, max_length=1000)


@router.post("/{summary_id}/request-changes", response_model=SummaryOut)
def request_changes(
    summary_id: uuid.UUID, body: CommentIn, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    s, sess = _summary(db, mentor, summary_id)
    if s.status not in (SummaryStatus.draft, SummaryStatus.changes_requested):
        raise HTTPException(409, "Only drafts can be sent back for changes")
    s.status = SummaryStatus.changes_requested
    s.mentor_comment = body.comment
    s.ready_for_review = False
    audit.record(db, "summary.request_changes", "evaluation_summaries", s.id, after={"comment": body.comment})
    db.commit()
    try:
        run_evaluation(db, sess.id, comment=body.comment, triggered_by=str(mentor.id))
    except AgentUnavailable as exc:
        raise HTTPException(503, str(exc)) from None
    db.refresh(s)
    return _out(db, s)


@router.post("/{summary_id}/approve", response_model=SummaryOut)
def approve(summary_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    s, _ = _summary(db, mentor, summary_id)
    if s.status != SummaryStatus.draft:
        raise HTTPException(409, f"Cannot approve a summary in status {s.status.value}")
    if not (s.ready_for_review or s.edited_by_mentor):
        raise HTTPException(409, "This draft was not submitted for review yet")
    s.status = SummaryStatus.approved
    s.approved_by = mentor.id
    s.approved_at = utcnow()
    audit.record(db, "summary.approve", "evaluation_summaries", s.id, after={"version": s.version})
    db.commit()
    return _out(db, s)


class PublishIn(BaseModel):
    notify: bool = False


@router.post("/{summary_id}/publish", response_model=SummaryOut)
def publish(
    summary_id: uuid.UUID, body: PublishIn, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    s, sess = _summary(db, mentor, summary_id)
    if s.status != SummaryStatus.approved:  # rule 4: server-side check
        raise HTTPException(409, "Only an approved summary can be published")
    question_ids = [
        q for r in s.content_json.get("recommended_topics", []) for q in r.get("practice_question_ids", [])
    ]
    question_ids = _top_up_practice(db, sess, s, list(dict.fromkeys(question_ids)))
    if question_ids:
        db.add(
            PracticeSet(
                summary_id=s.id,
                candidate_id=sess.candidate_id,
                question_ids=question_ids,
                due_at=utcnow() + timedelta(days=get_settings().practice_due_days),
            )
        )
    s.status = SummaryStatus.published
    s.published_at = utcnow()
    audit.record(
        db,
        "summary.publish",
        "evaluation_summaries",
        s.id,
        after={"practice_questions": len(question_ids), "notify": body.notify},
    )
    db.commit()
    if body.notify:
        candidate = db.get(User, sess.candidate_id)
        send_mail(
            candidate.email,
            "New recommendations available",
            f"Hello {candidate.name},\n\nYour mentor has published recommendations and practice for "
            f'"{sess.exam.title}". Sign in to your EduProctor dashboard to see them.\n',
        )
    return _out(db, s)


def _top_up_practice(db: Session, sess: ExamSession, s: EvaluationSummary, ids: list[str]) -> list[str]:
    """Practice set of practice_min..practice_max questions, topped up deterministically from recommended topics."""
    cfg = get_settings()
    ids = ids[: cfg.practice_max_questions]
    if len(ids) >= cfg.practice_min_questions:
        return ids
    ctx = ToolContext(db=db, run=None, params={"session_id": sess.id})  # type: ignore[arg-type]
    for r in s.content_json.get("recommended_topics", []):
        for q in t_select_practice(ctx, {"topic_id": r["topic_id"], "n": cfg.practice_max_questions}):
            if q["question_id"] not in ids:
                ids.append(q["question_id"])
            if len(ids) >= cfg.practice_max_questions:
                return ids
    return ids


class LibraryNote(BaseModel):
    note_id: uuid.UUID
    title: str
    level: str


@router.get("/notes-library", response_model=list[LibraryNote])
def notes_library(topic_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    """Approved notes for a topic, for the mentor's notes picker (approved library only)."""
    from app.agent.notes_index import approved_notes
    from app.models import Topic
    from app.routers.courses import require_course_mentor

    topic = db.get(Topic, topic_id)
    if topic is None:
        raise HTTPException(404, "Topic not found")
    require_course_mentor(db, mentor, topic.course_id)
    return [
        LibraryNote(note_id=n.id, title=n.title, level=n.level.value) for n in approved_notes(db, topic_id)
    ]
