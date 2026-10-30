"""Signed, single-use, time-limited assessment links bound to one candidate."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import sign_value
from app.models import Exam, ExamAssignment, User
from app.models.base import utcnow
from app.services.mailer import send_mail


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def token_hash(token: str) -> str:
    # HMAC with the server secret, then SHA-256 so the DB never holds anything usable as a link
    return hashlib.sha256(sign_value(token).encode()).hexdigest()


def issue_link(db: Session, exam: Exam, assignment: ExamAssignment, candidate: User) -> str:
    """Create a fresh token (invalidating any previous one) and email it. Returns the raw token (never stored)."""
    s = get_settings()
    token = secrets.token_urlsafe(32)
    now = utcnow()
    assignment.link_token_hash = token_hash(token)
    window_end = _ensure_utc(exam.window_end)
    assignment.link_expires_at = min(window_end, now + timedelta(hours=s.link_ttl_hours))
    assignment.link_sent_at = now
    assignment.link_used_at = None
    url = f"{s.web_base_url}/join/{token}"
    send_mail(
        candidate.email,
        f"Your assessment link: {exam.title}",
        f'Hello {candidate.name},\n\nYou have been assigned the assessment "{exam.title}" '
        f"({exam.duration_min} minutes).\n\nOpen this link to start (it works once, only for you, until "
        f"{assignment.link_expires_at:%Y-%m-%d %H:%M} UTC):\n{url}\n\nYou will be asked to sign in, give "
        "consent and verify your face before you begin.\n",
    )
    return token


def redeem_link(db: Session, token: str, user: User) -> ExamAssignment:
    """Validate and consume a link. Locks the row so two tabs cannot both redeem it."""
    assignment = db.scalar(
        select(ExamAssignment).where(ExamAssignment.link_token_hash == token_hash(token)).with_for_update()
    )
    if assignment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is not valid.")
    if assignment.candidate_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This link belongs to another candidate.")
    if assignment.link_used_at is not None:
        raise HTTPException(status.HTTP_410_GONE, "This link has already been used.")
    now = utcnow()
    expires_at = _ensure_utc(assignment.link_expires_at)
    if expires_at is None or expires_at <= now:
        raise HTTPException(status.HTTP_410_GONE, "This link has expired.")
    exam = assignment.exam
    window_start = _ensure_utc(exam.window_start)
    if window_start is not None and now < window_start:
        raise HTTPException(status.HTTP_409_CONFLICT, "This assessment has not opened yet.")
    assignment.link_used_at = now
    return assignment
