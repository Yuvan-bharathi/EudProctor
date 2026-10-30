"""Session lifecycle. The server deadline is the source of truth.

Status changes only through `transition()`. Auto-submit happens ONLY when the deadline passes
(never because of a proctoring signal; proctoring code has no access to this module's transitions).
"""

import random
import uuid
from datetime import UTC, datetime, timedelta

def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import get_settings
from app.models import ExamAssignment, Question
from app.models.base import utcnow
from app.models.session import ExamSession, SessionStatus, SubmitReason

S = SessionStatus
TRANSITIONS: dict[SessionStatus, set[SessionStatus]] = {
    S.link_opened: {S.identity_check, S.expired},
    S.identity_check: {S.identity_review, S.calibrating, S.expired},
    S.identity_review: {S.calibrating, S.identity_blocked, S.expired},
    S.identity_blocked: set(),
    S.calibrating: {S.in_progress, S.expired},
    S.in_progress: {S.submitted},
    S.submitted: {S.scored},
    S.expired: set(),
    S.scored: {S.analysed},
    S.analysed: set(),
}
ACTIVE = {S.link_opened, S.identity_check, S.identity_review, S.calibrating, S.in_progress}


def transition(db: Session, sess: ExamSession, to: SessionStatus, reason: str) -> None:
    if to not in TRANSITIONS[sess.status]:
        raise HTTPException(409, f"Cannot move from {sess.status.value} to {to.value}")
    before = sess.status.value
    sess.status = to
    audit.record(
        db,
        "session.transition",
        "sessions",
        sess.id,
        before={"status": before},
        after={"status": to.value, "reason": reason},
    )


def open_session(db: Session, assignment: ExamAssignment) -> ExamSession:
    exam = assignment.exam
    existing = db.scalar(select(ExamSession).where(ExamSession.assignment_id == assignment.id))
    if existing:
        return existing
    qids = [str(eq.question_id) for eq in exam.questions]
    rng = random.Random(str(assignment.id))  # deterministic per candidate
    option_order: dict[str, list[str]] = {}
    for eq in exam.questions:
        keys = [o.key for o in eq.question.options]
        if exam.shuffle:
            rng.shuffle(keys)
        option_order[str(eq.question_id)] = keys
    if exam.shuffle:
        rng.shuffle(qids)
    sess = ExamSession(
        exam_id=exam.id,
        candidate_id=assignment.candidate_id,
        assignment_id=assignment.id,
        status=S.link_opened,
        accommodations=dict(assignment.accommodations or {}),
        question_order=qids,
        option_order=option_order,
    )
    db.add(sess)
    db.flush()
    return sess


def own_session(
    db: Session, session_id: uuid.UUID, candidate_id: uuid.UUID, lock: bool = False
) -> ExamSession:
    q = select(ExamSession).where(ExamSession.id == session_id)
    if lock:
        q = q.with_for_update()
    sess = db.scalar(q)
    if sess is None or sess.candidate_id != candidate_id:
        raise HTTPException(404, "Session not found")
    enforce_deadline(db, sess)
    return sess


def begin(db: Session, sess: ExamSession) -> None:
    """Start the clock: calibrating -> in_progress."""
    now = utcnow()
    exam = sess.exam
    if now >= _ensure_utc(exam.window_end):
        transition(db, sess, S.expired, "window closed")
        raise HTTPException(409, "The assessment window has closed.")
    transition(db, sess, S.in_progress, "candidate started")
    sess.started_at = now
    sess.deadline_at = min(now + timedelta(minutes=exam.duration_min), _ensure_utc(exam.window_end))
    from app.services.identity import schedule_random_checks  # local import: identity depends on this module

    schedule_random_checks(sess)


def submit(db: Session, sess: ExamSession, reason: SubmitReason) -> None:
    if sess.status != S.in_progress:
        return  # idempotent
    transition(db, sess, S.submitted, reason.value)
    sess.submitted_at = min(utcnow(), _ensure_utc(sess.deadline_at)) if reason == SubmitReason.deadline else utcnow()
    sess.submit_reason = reason
    from app.scoring.service import on_submitted  # local import: scoring uses transition() from this module

    on_submitted(db, sess)


def enforce_deadline(db: Session, sess: ExamSession, now: datetime | None = None) -> bool:
    """Auto-submit at the deadline (the only automatic submit). Returns True if it submitted."""
    now = now or utcnow()
    if sess.status == S.in_progress and sess.deadline_at and now >= sess.deadline_at:
        submit(db, sess, SubmitReason.deadline)
        return True
    if sess.status in ACTIVE - {S.in_progress} and now >= _ensure_utc(sess.exam.window_end):
        sess.status = S.expired
        audit.record(
            db,
            "session.transition",
            "sessions",
            sess.id,
            after={"status": "expired", "reason": "window closed"},
        )
    return False


def sweep_deadlines(db: Session) -> int:
    rows = db.scalars(
        select(ExamSession)
        .where(ExamSession.status == S.in_progress, ExamSession.deadline_at <= utcnow())
        .with_for_update(skip_locked=True)
    )
    n = sum(enforce_deadline(db, s) for s in rows)
    db.commit()
    return n


def can_accept_answers(sess: ExamSession, answered_at: datetime | None) -> bool:
    """In progress, or auto-submitted at the deadline and syncing answers buffered offline before it."""
    if sess.status == S.in_progress:
        return True
    if (
        sess.status in (S.submitted, S.scored)
        and sess.submit_reason == SubmitReason.deadline
        and sess.deadline_at
    ):
        grace = timedelta(seconds=get_settings().late_sync_grace_s)
        return (
            answered_at is not None
            and sess.started_at is not None
            and sess.started_at <= answered_at <= sess.deadline_at
            and utcnow() <= sess.deadline_at + grace
        )
    return False


def questions_for(db: Session, sess: ExamSession) -> list[Question]:
    ids = [uuid.UUID(q) for q in sess.question_order]
    by_id = {q.id: q for q in db.scalars(select(Question).where(Question.id.in_(ids)))}
    return [by_id[i] for i in ids if i in by_id]
