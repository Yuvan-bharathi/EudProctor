import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at, str_enum, utcnow, uuid_pk
from app.models.exam import Exam


class SessionStatus(StrEnum):
    link_opened = "link_opened"
    identity_check = "identity_check"
    identity_review = "identity_review"
    identity_blocked = "identity_blocked"  # mentor decision after review (not a proctoring outcome)
    calibrating = "calibrating"
    in_progress = "in_progress"
    submitted = "submitted"
    expired = "expired"  # window closed before the candidate started
    scored = "scored"
    analysed = "analysed"


class SubmitReason(StrEnum):
    manual = "manual"
    deadline = "deadline"


class ExamSession(Base):
    """An attempt. NOTE: proctoring code must never change `status` (CLAUDE.md rule 1)."""

    __tablename__ = "sessions"
    __table_args__ = (UniqueConstraint("assignment_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id"), index=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    assignment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_assignments.id"))
    status: Mapped[SessionStatus] = mapped_column(str_enum(SessionStatus), index=True)
    started_at: Mapped[datetime | None] = mapped_column(default=None)
    deadline_at: Mapped[datetime | None] = mapped_column(default=None, index=True)
    submitted_at: Mapped[datetime | None] = mapped_column(default=None)
    submit_reason: Mapped[SubmitReason | None] = mapped_column(str_enum(SubmitReason), default=None)
    flag_count: Mapped[int] = mapped_column(default=0)
    flag_limit_reached: Mapped[bool] = mapped_column(default=False)
    accommodations: Mapped[dict[str, Any]] = mapped_column(default=dict)
    question_order: Mapped[list[Any]] = mapped_column(default=list)  # question ids in display order
    option_order: Mapped[dict[str, Any]] = mapped_column(
        default=dict
    )  # question id -> option keys in display order
    identity_checks_due: Mapped[list[Any]] = mapped_column(default=list)  # seconds after start
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    exam: Mapped[Exam] = relationship()
    answers: Mapped[list["Answer"]] = relationship(cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (UniqueConstraint("session_id", "question_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"))
    value: Mapped[dict[str, Any]] = mapped_column(default=dict)  # {"option_key": "B"} or {"text": "..."}
    client_seq: Mapped[int] = mapped_column(default=0)
    answered_at: Mapped[datetime | None] = mapped_column(default=None)  # client-reported, for offline sync
    saved_at: Mapped[datetime] = mapped_column(default=utcnow)
    # marking (Phase 6)
    marks_awarded: Mapped[float | None] = mapped_column(default=None)
    marked_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    marked_at: Mapped[datetime | None] = mapped_column(default=None)
    mark_comment: Mapped[str | None] = mapped_column(String(500), default=None)
