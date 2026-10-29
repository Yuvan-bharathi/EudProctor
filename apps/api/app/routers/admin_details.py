"""Admin detail views for users and courses."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import admin_only
from app.models import (
    Course,
    CourseMember,
    EvaluationSummary,
    Exam,
    ExamAssignment,
    ExamSession,
    FaceProfile,
    MemberRole,
    Note,
    Question,
    QuestionStatus,
    Role,
    Topic,
    User,
)
from app.models.results import Result
from app.schemas.users import UserOut

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_only)])


class Membership(BaseModel):
    course_id: uuid.UUID
    course_name: str
    course_code: str
    role: MemberRole


class AttemptRow(BaseModel):
    exam_id: uuid.UUID
    exam_title: str
    course_name: str
    status: str
    submitted_at: datetime | None
    score_pct: float | None
    red_flags: int
    max_flags: int
    summary_status: str | None


class MentorExamRow(BaseModel):
    exam_id: uuid.UUID
    title: str
    course_name: str
    window_end: datetime
    candidates: int


class UserDetails(BaseModel):
    user: UserOut
    consent_version: str | None
    consent_at: datetime | None
    face_enrolled: bool
    created_at: datetime
    memberships: list[Membership]
    assessments_assigned: int
    attempts: list[AttemptRow]
    mentor_exams: list[MentorExamRow]


@router.get("/users/{user_id}", response_model=UserDetails)
def user_details(user_id: uuid.UUID, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    memberships = [
        Membership(course_id=c.id, course_name=c.name, course_code=c.code, role=m.role)
        for m, c in db.execute(
            select(CourseMember, Course)
            .join(Course, Course.id == CourseMember.course_id)
            .where(CourseMember.user_id == user.id)
            .order_by(Course.name)
        )
    ]
    attempts: list[AttemptRow] = []
    assigned = 0
    mentor_exams: list[MentorExamRow] = []
    if user.role == Role.candidate:
        assigned = db.scalar(
            select(func.count()).select_from(ExamAssignment).where(ExamAssignment.candidate_id == user.id)
        )
        rows = db.execute(
            select(ExamSession, Exam, Course, Result, EvaluationSummary)
            .join(Exam, Exam.id == ExamSession.exam_id)
            .join(Course, Course.id == Exam.course_id)
            .outerjoin(Result, Result.session_id == ExamSession.id)
            .outerjoin(EvaluationSummary, EvaluationSummary.session_id == ExamSession.id)
            .where(ExamSession.candidate_id == user.id)
            .order_by(ExamSession.created_at.desc())
        )
        attempts = [
            AttemptRow(
                exam_id=e.id,
                exam_title=e.title,
                course_name=c.name,
                status=s.status.value,
                submitted_at=s.submitted_at,
                score_pct=r.score_pct if r else None,
                red_flags=min(s.flag_count, e.max_flags),
                max_flags=e.max_flags,
                summary_status=summ.status.value if summ else None,
            )
            for s, e, c, r, summ in rows
        ]
    elif user.role == Role.mentor:
        rows = db.execute(
            select(Exam, Course, func.count(ExamAssignment.id))
            .join(Course, Course.id == Exam.course_id)
            .outerjoin(ExamAssignment, ExamAssignment.exam_id == Exam.id)
            .where(Exam.mentor_id == user.id)
            .group_by(Exam.id, Course.id)
            .order_by(Exam.window_end.desc())
        )
        mentor_exams = [
            MentorExamRow(
                exam_id=e.id, title=e.title, course_name=c.name, window_end=e.window_end, candidates=n
            )
            for e, c, n in rows
        ]
    return UserDetails(
        user=UserOut.model_validate(user),
        consent_version=user.consent_version,
        consent_at=user.consent_at,
        face_enrolled=db.get(FaceProfile, user.id) is not None,
        created_at=user.created_at,
        memberships=memberships,
        assessments_assigned=assigned,
        attempts=attempts,
        mentor_exams=mentor_exams,
    )


class TopicRow(BaseModel):
    topic_id: uuid.UUID
    name: str
    questions: int
    approved_notes: int


class MemberRow(BaseModel):
    user: UserOut
    role: MemberRole


class CourseDetails(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    mentors: list[MemberRow]
    candidates: list[MemberRow]
    topics: list[TopicRow]
    assessments: int


@router.get("/courses/{course_id}", response_model=CourseDetails)
def course_details(course_id: uuid.UUID, db: Session = Depends(get_db)):
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(404, "Course not found")
    members = [
        MemberRow(user=UserOut.model_validate(u), role=m.role)
        for m, u in db.execute(
            select(CourseMember, User)
            .join(User, User.id == CourseMember.user_id)
            .where(CourseMember.course_id == course.id)
            .order_by(User.name)
        )
    ]
    q_counts = dict(
        db.execute(
            select(Question.topic_id, func.count())
            .where(Question.course_id == course.id, Question.status == QuestionStatus.approved)
            .group_by(Question.topic_id)
        ).all()
    )
    n_counts = dict(
        db.execute(
            select(Note.topic_id, func.count())
            .join(Topic, Topic.id == Note.topic_id)
            .where(Topic.course_id == course.id, Note.approved.is_(True))
            .group_by(Note.topic_id)
        ).all()
    )
    topics = [
        TopicRow(
            topic_id=t.id, name=t.name, questions=q_counts.get(t.id, 0), approved_notes=n_counts.get(t.id, 0)
        )
        for t in db.scalars(select(Topic).where(Topic.course_id == course.id).order_by(Topic.name))
    ]
    return CourseDetails(
        id=course.id,
        name=course.name,
        code=course.code,
        mentors=[m for m in members if m.role == MemberRole.mentor],
        candidates=[m for m in members if m.role == MemberRole.candidate],
        topics=topics,
        assessments=db.scalar(select(func.count()).select_from(Exam).where(Exam.course_id == course.id)),
    )
