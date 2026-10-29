import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, created_at, str_enum, utcnow, uuid_pk


class NoteLevel(StrEnum):
    intro = "intro"
    core = "core"
    advanced = "advanced"


class Note(Base):
    """Notes library. Only `approved` notes may ever be recommended (checked in SQL, not just in the index)."""

    __tablename__ = "notes"

    id: Mapped[uuid.UUID] = uuid_pk()
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    url_or_body: Mapped[str] = mapped_column(Text)
    level: Mapped[NoteLevel] = mapped_column(str_enum(NoteLevel), default=NoteLevel.core)
    approved: Mapped[bool] = mapped_column(default=False, index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    created_at: Mapped[datetime] = created_at()


class SummaryStatus(StrEnum):
    draft = "draft"
    changes_requested = "changes_requested"
    approved = "approved"
    published = "published"


class EvaluationSummary(Base):
    __tablename__ = "evaluation_summaries"

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), unique=True)
    status: Mapped[SummaryStatus] = mapped_column(str_enum(SummaryStatus), index=True)
    content_json: Mapped[dict[str, Any]] = mapped_column(default=dict)
    version: Mapped[int] = mapped_column(default=1)
    ready_for_review: Mapped[bool] = mapped_column(default=False)
    edited_by_mentor: Mapped[bool] = mapped_column(default=False)
    mentor_comment: Mapped[str | None] = mapped_column(Text, default=None)
    drafted_run_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("agent_runs.id"), default=None)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    approved_at: Mapped[datetime | None] = mapped_column(default=None)
    published_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class PracticeSet(Base):
    __tablename__ = "practice_sets"

    id: Mapped[uuid.UUID] = uuid_pk()
    summary_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("evaluation_summaries.id", ondelete="CASCADE"), unique=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    question_ids: Mapped[list[Any]] = mapped_column(default=list)
    due_at: Mapped[datetime | None] = mapped_column(default=None)
    status: Mapped[str] = mapped_column(String(16), default="assigned")  # assigned / completed
    created_at: Mapped[datetime] = created_at()


class PracticeAttempt(Base):
    __tablename__ = "practice_attempts"

    id: Mapped[uuid.UUID] = uuid_pk()
    practice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("practice_sets.id", ondelete="CASCADE"), index=True
    )
    answers: Mapped[dict[str, Any]] = mapped_column(default=dict)
    score_pct: Mapped[float]
    completed_at: Mapped[datetime] = mapped_column(default=utcnow)
