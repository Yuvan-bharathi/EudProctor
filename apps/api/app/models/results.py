import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class Result(Base):
    __tablename__ = "results"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )
    total_obtained: Mapped[float]
    total_max: Mapped[float]
    score_pct: Mapped[float | None]
    percentile: Mapped[float | None] = mapped_column(default=None)
    n_unmarked: Mapped[int] = mapped_column(default=0)
    computed_at: Mapped[datetime] = mapped_column(default=utcnow)


class TopicResult(Base):
    __tablename__ = "topic_results"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id"), primary_key=True)
    marks_obtained: Mapped[float]
    max_marks: Mapped[float]
    score_pct: Mapped[float | None]
    n_questions: Mapped[int]
    n_unmarked: Mapped[int] = mapped_column(default=0)
    cls: Mapped[str] = mapped_column(String(16))  # strong / developing / weak / insufficient
    priority: Mapped[float | None] = mapped_column(default=None)


class SessionMisconception(Base):
    __tablename__ = "session_misconceptions"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )
    misconception_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("misconceptions.id"), primary_key=True)
    count: Mapped[int]


class ItemStat(Base):
    __tablename__ = "item_stats"

    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), primary_key=True)
    n_attempted: Mapped[int]
    p: Mapped[float | None]
    d: Mapped[float | None]
    distractor_shares: Mapped[dict[str, Any]] = mapped_column(default=dict)
    flags: Mapped[list[Any]] = mapped_column(default=list)
    computed_at: Mapped[datetime] = mapped_column(default=utcnow)
