"""Internship flow (plan v2 + engineering review, 2 Nov 2026).

Interns are users with role=candidate enrolled in a cohort with one mentor. Every AI output that reaches an
intern or a record passes through AgentDraft (the mentor approval inbox). Scores, attendance status and skill
levels are deterministic code (see app/services/internship_*).
"""

import uuid
from datetime import date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, created_at, str_enum, utcnow, uuid_pk


class TaskStatus(StrEnum):
    assigned = "Assigned"
    in_progress = "In Progress"
    review = "Review"
    done = "Done"
    rework = "Rework"


class DraftStatus(StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class InternshipCohort(Base):
    __tablename__ = "internship_cohorts"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(160))
    track: Mapped[str] = mapped_column(String(40), default="MERN")
    start_date: Mapped[date]
    end_date: Mapped[date]
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    # Code & data policy 6.8: organisation opt-in for sending submitted code to the AI reviewer.
    ai_review_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    created_at: Mapped[datetime] = created_at()


class InternshipEnrollment(Base):
    __tablename__ = "internship_enrollments"
    __table_args__ = (UniqueConstraint("cohort_id", "mentee_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    cohort_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internship_cohorts.id", ondelete="CASCADE"), index=True)
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mentor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    phone: Mapped[str | None] = mapped_column(String(40), default=None)
    roll_number: Mapped[str | None] = mapped_column(String(60), default=None)
    status: Mapped[str] = mapped_column(String(20), default="Active")  # Active / Completed
    started_on: Mapped[date]
    created_at: Mapped[datetime] = created_at()


class InternTask(Base):
    __tablename__ = "intern_tasks"

    id: Mapped[uuid.UUID] = uuid_pk()
    cohort_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internship_cohorts.id", ondelete="CASCADE"), index=True)
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mentor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    acceptance_criteria: Mapped[str] = mapped_column(Text, default="")
    skill_area: Mapped[str] = mapped_column(String(80), default="General")
    skill_tags: Mapped[list[Any]] = mapped_column(default=list)
    priority: Mapped[str] = mapped_column(String(10), default="Medium")
    status: Mapped[TaskStatus] = mapped_column(str_enum(TaskStatus), default=TaskStatus.assigned)
    due_date: Mapped[date | None] = mapped_column(default=None)
    week_number: Mapped[int] = mapped_column(default=1)
    mentor_feedback: Mapped[str | None] = mapped_column(Text, default=None)
    flagged_blocked_at: Mapped[datetime | None] = mapped_column(default=None)
    last_activity_at: Mapped[datetime] = mapped_column(default=utcnow)
    created_at: Mapped[datetime] = created_at()


class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    id: Mapped[uuid.UUID] = uuid_pk()
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("intern_tasks.id", ondelete="CASCADE"), index=True)
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    submission_url: Mapped[str | None] = mapped_column(String(500), default=None)
    filename: Mapped[str | None] = mapped_column(String(200), default=None)
    language: Mapped[str | None] = mapped_column(String(30), default=None)
    # Policy 6.8: code is stored encrypted at rest; graph state only ever holds the submission id.
    code_enc: Mapped[str | None] = mapped_column(Text, default=None, info={"audit": False})
    ai_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    review_status: Mapped[str] = mapped_column(String(30), default="none")
    # none / blocked_secrets / not_consented / pending_review / awaiting_mentor / published / rejected
    created_at: Mapped[datetime] = created_at()


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id: Mapped[uuid.UUID] = uuid_pk()
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    cohort_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internship_cohorts.id", ondelete="CASCADE"), index=True)
    work_date: Mapped[date] = mapped_column(index=True)  # organisation-time-zone day of punch-in
    punch_in_at: Mapped[datetime]
    punch_out_at: Mapped[datetime | None] = mapped_column(default=None)
    auto_closed: Mapped[bool] = mapped_column(Boolean, default=False)  # forgotten punch-out -> needs correction
    note: Mapped[str | None] = mapped_column(Text, default=None)
    corrected_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    correction_note: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = created_at()


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id: Mapped[uuid.UUID] = uuid_pk()
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mentor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    start_date: Mapped[date]
    end_date: Mapped[date]
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="Pending")  # Pending / Approved / Rejected
    decided_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()


class StandupEntry(Base):
    __tablename__ = "standup_entries"
    __table_args__ = (UniqueConstraint("mentee_id", "entry_date"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    entry_date: Mapped[date]
    yesterday: Mapped[str] = mapped_column(Text, default="")
    today: Mapped[str] = mapped_column(Text, default="")
    blockers: Mapped[str] = mapped_column(Text, default="")
    task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("intern_tasks.id", ondelete="SET NULL"), default=None)
    created_at: Mapped[datetime] = created_at()


class CohortDoc(Base):
    """Mentor-curated project/setup docs the Blocker Co-Pilot is allowed to answer from."""

    __tablename__ = "cohort_docs"

    id: Mapped[uuid.UUID] = uuid_pk()
    cohort_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internship_cohorts.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    created_at: Mapped[datetime] = created_at()


class BlockerQuestion(Base):
    """One Blocker Co-Pilot exchange. Answers are live (approval exception, 6.10); mentors see every one."""

    __tablename__ = "blocker_questions"

    id: Mapped[uuid.UUID] = uuid_pk()
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("intern_tasks.id", ondelete="SET NULL"), default=None)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text, default="")
    citations: Mapped[list[Any]] = mapped_column(default=list)
    escalated: Mapped[bool] = mapped_column(Boolean, default=False)
    run_id: Mapped[uuid.UUID | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()


class StallAlert(Base):
    __tablename__ = "stall_alerts"

    id: Mapped[uuid.UUID] = uuid_pk()
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mentor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("intern_tasks.id", ondelete="CASCADE"), default=None)
    source: Mapped[str] = mapped_column(String(20), default="auto")  # auto / self_flag / blocker_chat
    reason: Mapped[str] = mapped_column(Text)
    acknowledged_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()


class AgentDraft(Base):
    """Mentor approval inbox. Each pending row is a LangGraph thread paused at interrupt()."""

    __tablename__ = "agent_drafts"

    id: Mapped[uuid.UUID] = uuid_pk()
    agent: Mapped[str] = mapped_column(String(40), index=True)  # code_review / weekly_quiz / appraisal
    thread_id: Mapped[str] = mapped_column(String(80), unique=True)
    mentor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject_type: Mapped[str] = mapped_column(String(40))
    subject_id: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(240))
    status: Mapped[DraftStatus] = mapped_column(str_enum(DraftStatus), default=DraftStatus.pending, index=True)
    content: Mapped[dict[str, Any]] = mapped_column(default=dict)
    final_content: Mapped[dict[str, Any] | None] = mapped_column(default=None)
    mentor_note: Mapped[str | None] = mapped_column(Text, default=None)
    edited: Mapped[bool] = mapped_column(Boolean, default=False)
    run_id: Mapped[uuid.UUID | None] = mapped_column(default=None)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    decided_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()


class CodeReview(Base):
    __tablename__ = "code_reviews"

    id: Mapped[uuid.UUID] = uuid_pk()
    submission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("task_submissions.id", ondelete="CASCADE"), unique=True
    )
    findings: Mapped[list[Any]] = mapped_column(default=list)  # deterministic checks
    metrics: Mapped[dict[str, Any]] = mapped_column(default=dict)  # deterministic numbers (lines, issues...)
    review: Mapped[dict[str, Any] | None] = mapped_column(default=None)  # mentor-approved content only
    status: Mapped[str] = mapped_column(String(20), default="awaiting_mentor")  # awaiting_mentor/published/rejected
    published_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()


class WeeklyQuiz(Base):
    __tablename__ = "weekly_quizzes"
    __table_args__ = (UniqueConstraint("mentee_id", "cohort_id", "week_number"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    cohort_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internship_cohorts.id", ondelete="CASCADE"), index=True)
    week_number: Mapped[int]
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="drafting")
    # drafting / awaiting_mentor / available / submitted / rejected
    questions: Mapped[list[Any]] = mapped_column(default=list)  # incl. correct keys; never sent to the intern
    duration_min: Mapped[int] = mapped_column(default=15)
    answers: Mapped[dict[str, Any] | None] = mapped_column(default=None)
    score_pct: Mapped[float | None] = mapped_column(default=None)
    results: Mapped[dict[str, Any] | None] = mapped_column(default=None)
    released_at: Mapped[datetime | None] = mapped_column(default=None)
    submitted_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()


class SkillScore(Base):
    __tablename__ = "skill_scores"
    __table_args__ = (UniqueConstraint("mentee_id", "skill"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    skill: Mapped[str] = mapped_column(String(80))
    score_pct: Mapped[float] = mapped_column(default=0.0)
    n_questions: Mapped[int] = mapped_column(default=0)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow)


class Appraisal(Base):
    __tablename__ = "appraisals"
    __table_args__ = (UniqueConstraint("mentee_id", "cohort_id", "milestone_day"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    mentee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    cohort_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internship_cohorts.id", ondelete="CASCADE"), index=True)
    milestone_day: Mapped[int]  # 30 / 60 / 90
    metrics: Mapped[dict[str, Any]] = mapped_column(default=dict)  # deterministic
    content: Mapped[dict[str, Any] | None] = mapped_column(default=None)  # mentor-approved text only
    status: Mapped[str] = mapped_column(String(20), default="drafting")
    # drafting / awaiting_mentor / published / acknowledged / rejected
    mentee_comment: Mapped[str | None] = mapped_column(Text, default=None)
    published_at: Mapped[datetime | None] = mapped_column(default=None)
    acknowledged_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()
