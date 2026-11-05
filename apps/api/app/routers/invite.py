"""Public invitation endpoints: the landing point of the "Accept Invitation" email button.

Flow:
1. GET  /invite/{token}         -> what the invitation is for, and whether the candidate must create a password.
2. POST /invite/{token}/accept  -> verifies the password emailed with the invitation (username = name,
                                   unique per-candidate password); accounts with no password create one.
                                   Marks the invitation accepted and signs the candidate in (JWT pair).
The candidate then starts the assessment from the candidate portal (POST /sessions/start).

The raw token is the credential: it was emailed only to the candidate, is stored only as an HMAC hash,
and is bound to one assignment. These routes are therefore unauthenticated by design
(listed in tests/test_role_guards.PUBLIC_ROUTES).
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.db import get_db
from app.core.security import (
    check_password_strength,
    create_token,
    hash_password,
    password_not_set,
    verify_password,
)
from app.models import ExamAssignment, Role, User
from app.models.base import utcnow
from app.schemas.users import TokenOut, UserOut
from app.services.links import token_hash

router = APIRouter(prefix="/invite", tags=["invitation"])

class InvitationOut(BaseModel):
    status: str  # "pending" | "accepted" | "expired"
    candidate_name: str
    candidate_email: str
    candidate_username: str | None = None
    needs_password: bool
    exam_code: str | None = None
    exam_title: str
    course_name: str | None = None
    duration_min: int
    question_count: int
    window_start: datetime | None = None
    window_end: datetime | None = None
    link_expires_at: datetime | None = None


class AcceptIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)

    @field_validator("password")
    @classmethod
    def _no_surrounding_space(cls, v: str) -> str:
        if v != v.strip():
            raise ValueError("Password cannot start or end with a space")
        return v


def _utc(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _lookup(db: Session, token: str, lock: bool = False) -> tuple[ExamAssignment, User]:
    q = select(ExamAssignment).where(ExamAssignment.link_token_hash == token_hash(token))
    if lock:
        q = q.with_for_update()
    assignment = db.scalar(q)
    user = db.get(User, assignment.candidate_id) if assignment else None
    if assignment is None or user is None or user.role != Role.candidate or not user.is_active:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "This invitation link is not valid. It may have been replaced by a newer invitation — "
            "please use the most recent email, or ask your mentor to resend it.",
        )
    return assignment, user


def _status(a: ExamAssignment) -> str:
    if a.link_used_at is not None:
        return "accepted"
    exp = _utc(a.link_expires_at)
    if exp is None or exp <= utcnow():
        return "expired"
    return "pending"


@router.get("/{token}", response_model=InvitationOut)
def get_invitation(token: str, db: Session = Depends(get_db)) -> InvitationOut:
    assignment, user = _lookup(db, token)
    exam = assignment.exam
    return InvitationOut(
        status=_status(assignment),
        candidate_name=user.name,
        candidate_email=user.email,
        candidate_username=user.username,
        needs_password=password_not_set(user.password_hash),
        exam_code=exam.code,
        exam_title=exam.title,
        course_name=exam.course.name if getattr(exam, "course", None) else None,
        duration_min=exam.duration_min,
        question_count=len(exam.questions),
        window_start=exam.window_start,
        window_end=exam.window_end,
        link_expires_at=assignment.link_expires_at,
    )


@router.post("/{token}/accept", response_model=TokenOut)
def accept_invitation(token: str, body: AcceptIn, db: Session = Depends(get_db)) -> TokenOut:
    """Create (first time) or verify the candidate's password, accept the invitation and sign in."""
    assignment, user = _lookup(db, token, lock=True)
    state = _status(assignment)
    if state == "expired":
        raise HTTPException(status.HTTP_410_GONE, "This invitation has expired. Please ask your mentor to resend it.")

    actor = audit.Actor("user", str(user.id))
    if password_not_set(user.password_hash):
        # Also covers candidates who accepted under the old flow (shared default password).
        problem = check_password_strength(body.password)
        if problem:
            raise HTTPException(422, problem)
        user.password_hash = hash_password(body.password)
        audit.record(db, "auth.password_created", "users", user.id, actor=actor)
    elif not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect password.")

    if state == "pending":
        now = utcnow()
        assignment.link_used_at = now
        meta = dict(assignment.accommodations or {})
        meta["invitation_status"] = "Accepted"
        meta["invitation_accepted_at"] = now.isoformat()
        assignment.accommodations = meta
        audit.record(db, "invitation.accepted", "exam_assignments", assignment.id, actor=actor)

    audit.record(db, "auth.login", "users", user.id, actor=actor)
    db.commit()
    return TokenOut(
        access_token=create_token(user.id, user.role.value, "access"),
        refresh_token=create_token(user.id, user.role.value, "refresh"),
        user=UserOut.model_validate(user),
    )
