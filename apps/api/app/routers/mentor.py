"""Mentor-only views of candidate sessions (identity review now; proctoring details in Phase 5)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit, storage
from app.core.db import get_db
from app.core.deps import mentor_only
from app.models import Exam, ExamSession, SessionStatus, User
from app.models.base import utcnow
from app.models.identity import CheckKind, IdentityCheck, ReviewDecision
from app.routers.courses import mentor_course_ids
from app.services import sessions as session_svc

router = APIRouter(prefix="/mentor", tags=["mentor"], dependencies=[Depends(mentor_only)])


def mentor_session(db: Session, mentor: User, session_id: uuid.UUID, lock: bool = False) -> ExamSession:
    q = select(ExamSession).where(ExamSession.id == session_id)
    if lock:
        q = q.with_for_update()
    sess = db.scalar(q)
    # same access as own_exam: the assessment's creator or any mentor of its course
    if sess is None or (
        sess.exam.mentor_id != mentor.id and sess.exam.course_id not in mentor_course_ids(db, mentor)
    ):
        raise HTTPException(404, "Session not found")
    return sess


class IdentityReviewOut(BaseModel):
    check_id: uuid.UUID
    session_id: uuid.UUID
    exam_title: str
    candidate_name: str
    kind: CheckKind
    attempt: int
    liveness_ok: bool | None
    liveness_detail: str | None
    similarity: float | None
    result: str
    created_at: datetime
    has_crop: bool


class DecisionIn(BaseModel):
    decision: ReviewDecision
    comment: str = Field(default="", max_length=500)


@router.get("/identity-reviews", response_model=list[IdentityReviewOut])
def identity_reviews(db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    rows = db.execute(
        select(IdentityCheck, ExamSession, Exam, User)
        .join(ExamSession, ExamSession.id == IdentityCheck.session_id)
        .join(Exam, Exam.id == ExamSession.exam_id)
        .join(User, User.id == ExamSession.candidate_id)
        .where(
            Exam.mentor_id == mentor.id,
            IdentityCheck.needs_review.is_(True),
            IdentityCheck.decision.is_(None),
        )
        .order_by(IdentityCheck.created_at)
    )
    return [
        IdentityReviewOut(
            check_id=c.id,
            session_id=s.id,
            exam_title=e.title,
            candidate_name=u.name,
            kind=c.kind,
            attempt=c.attempt,
            liveness_ok=c.liveness_ok,
            liveness_detail=c.liveness_detail,
            similarity=c.similarity,
            result=c.result.value,
            created_at=c.created_at,
            has_crop=c.crop_ref is not None,
        )
        for c, s, e, u in rows
    ]


def _check(db: Session, mentor: User, check_id: uuid.UUID) -> tuple[IdentityCheck, ExamSession]:
    check = db.get(IdentityCheck, check_id)
    if check is None:
        raise HTTPException(404, "Check not found")
    return check, mentor_session(db, mentor, check.session_id, lock=True)


@router.get("/identity-checks/{check_id}/crop")
def identity_crop(check_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    check, _ = _check(db, mentor, check_id)
    if not check.crop_ref:
        raise HTTPException(404, "No image")
    return Response(
        storage.get(check.crop_ref), media_type="image/jpeg", headers={"Cache-Control": "no-store"}
    )


@router.post("/identity-checks/{check_id}/decision", response_model=IdentityReviewOut | None)
def identity_decision(
    check_id: uuid.UUID, body: DecisionIn, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    check, sess = _check(db, mentor, check_id)
    if not check.needs_review or check.decision is not None:
        raise HTTPException(409, "This check is not waiting for a decision")
    check.decision = body.decision
    check.decision_comment = body.comment or None
    check.reviewed_by = mentor.id
    check.reviewed_at = utcnow()
    # Only a start check gates the session, and only by a mentor's decision. Random in-assessment checks are
    # recorded for the mentor and never change the session (rule 1).
    if check.kind == CheckKind.start and sess.status == SessionStatus.identity_review:
        target = (
            SessionStatus.calibrating
            if body.decision == ReviewDecision.allow
            else SessionStatus.identity_blocked
        )
        session_svc.transition(db, sess, target, f"mentor {body.decision.value}")
    audit.record(
        db,
        "identity.review_decision",
        "identity_checks",
        check.id,
        after={"decision": body.decision.value, "comment": body.comment},
    )
    db.commit()
    return None
