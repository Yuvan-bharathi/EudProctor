"""Proctoring records. Mentor-only data: never exposed through candidate routes (CLAUDE.md rule 3)."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, created_at, uuid_pk


class ProctorEvent(Base):
    """Integrity alerts and red flags. Glances live in glance_log; look-aways under glance_min are dropped."""

    __tablename__ = "proctor_events"
    __table_args__ = (UniqueConstraint("session_id", "client_event_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    client_event_id: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(40), index=True)
    severity: Mapped[str] = mapped_column(String(10))  # high / medium / low
    started_at: Mapped[datetime]
    duration_ms: Mapped[int] = mapped_column(default=0)
    exam_clock_ms: Mapped[int | None] = mapped_column(default=None)
    payload: Mapped[dict[str, Any]] = mapped_column(default=dict)
    snapshot_ref: Mapped[str | None] = mapped_column(String(80), default=None, info={"audit": False})
    created_at: Mapped[datetime] = created_at()


class CandidateFlag(Base):
    __tablename__ = "candidate_flags"

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proctor_events.id", ondelete="CASCADE"), unique=True
    )
    flag_no: Mapped[int | None] = mapped_column(default=None)  # 1..max_flags, NULL = post_limit
    source: Mapped[str] = mapped_column(String(10))  # head / eyes
    direction: Mapped[str] = mapped_column(String(10))
    started_at: Mapped[datetime]
    duration_ms: Mapped[int]
    snapshot_ref: Mapped[str | None] = mapped_column(String(80), default=None, info={"audit": False})
    notified: Mapped[bool] = mapped_column(default=False)


class GlanceLog(Base):
    __tablename__ = "glance_log"
    __table_args__ = (UniqueConstraint("session_id", "client_event_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    client_event_id: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(10))
    direction: Mapped[str] = mapped_column(String(10))
    started_at: Mapped[datetime]
    duration_ms: Mapped[int]
    exam_clock_ms: Mapped[int | None] = mapped_column(default=None)


class FlagReview(Base):
    """A mentor decision on one timeline item (red flag, glance or other alert)."""

    __tablename__ = "flag_reviews"

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    item_type: Mapped[str] = mapped_column(String(10))  # event / glance
    item_id: Mapped[uuid.UUID] = mapped_column(index=True)
    mentor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String(10))  # dismiss / concern / escalate
    comment: Mapped[str | None] = mapped_column(String(500), default=None)
    at: Mapped[datetime] = created_at()
