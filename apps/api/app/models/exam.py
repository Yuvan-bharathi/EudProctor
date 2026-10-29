import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at, str_enum, uuid_pk


class QuestionType(StrEnum):
    mcq = "mcq"
    short = "short"


class QuestionStatus(StrEnum):
    draft = "draft"  # agent suggestion awaiting mentor decision
    approved = "approved"
    skipped = "skipped"


class QuestionSource(StrEnum):
    mentor = "mentor"
    agent = "agent"


class ExamStatus(StrEnum):
    draft = "draft"
    scheduled = "scheduled"
    closed = "closed"


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[uuid.UUID] = uuid_pk()
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("topics.id"), default=None)
    created_at: Mapped[datetime] = created_at()


class Misconception(Base):
    __tablename__ = "misconceptions"

    id: Mapped[uuid.UUID] = uuid_pk()
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(300))


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = uuid_pk()
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id"), index=True)
    subtopic: Mapped[str | None] = mapped_column(String(160), default=None)
    type: Mapped[QuestionType] = mapped_column(str_enum(QuestionType))
    difficulty: Mapped[int] = mapped_column(default=2)  # 1 easy · 2 medium · 3 hard
    marks: Mapped[float] = mapped_column(default=1.0)
    body: Mapped[str] = mapped_column(Text)
    answer_text: Mapped[str | None] = mapped_column(Text, default=None)  # model answer for short questions
    status: Mapped[QuestionStatus] = mapped_column(str_enum(QuestionStatus), index=True)
    source: Mapped[QuestionSource] = mapped_column(str_enum(QuestionSource))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    agent_run_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("agent_runs.id"), default=None)
    created_at: Mapped[datetime] = created_at()

    options: Mapped[list["QuestionOption"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.key"
    )
    topic: Mapped[Topic] = relationship()


class QuestionOption(Base):
    __tablename__ = "question_options"

    id: Mapped[uuid.UUID] = uuid_pk()
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(4))
    text: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(default=False)
    misconception_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("misconceptions.id"), default=None)

    question: Mapped[Question] = relationship(back_populates="options")


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[uuid.UUID] = uuid_pk()
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), index=True)
    mentor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    duration_min: Mapped[int]
    window_start: Mapped[datetime]
    window_end: Mapped[datetime]
    shuffle: Mapped[bool] = mapped_column(default=False)
    # per-assessment proctoring policy, defaulted from config at creation
    flag_threshold_s: Mapped[float]
    glance_min_s: Mapped[float]
    max_flags: Mapped[int]
    status: Mapped[ExamStatus] = mapped_column(str_enum(ExamStatus), default=ExamStatus.draft)
    created_at: Mapped[datetime] = created_at()

    questions: Mapped[list["ExamQuestion"]] = relationship(
        cascade="all, delete-orphan", order_by="ExamQuestion.order"
    )


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), primary_key=True)
    order: Mapped[int]

    question: Mapped[Question] = relationship()


class ExamAssignment(Base):
    __tablename__ = "exam_assignments"
    __table_args__ = (UniqueConstraint("exam_id", "candidate_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    link_token_hash: Mapped[str | None] = mapped_column(
        String(64), unique=True, default=None, info={"audit": False}
    )
    link_expires_at: Mapped[datetime | None] = mapped_column(default=None)
    link_sent_at: Mapped[datetime | None] = mapped_column(default=None)
    link_used_at: Mapped[datetime | None] = mapped_column(default=None)
    accommodations: Mapped[dict[str, Any]] = mapped_column(default=dict)
    created_at: Mapped[datetime] = created_at()

    exam: Mapped[Exam] = relationship()
