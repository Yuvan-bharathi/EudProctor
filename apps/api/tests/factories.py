"""Builders for assessments and sessions shared by Phase 3+ tests."""

from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    Exam,
    ExamAssignment,
    ExamQuestion,
    ExamSession,
    Question,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
    SessionStatus,
    Topic,
    User,
)
from app.models.base import utcnow
from app.services.sessions import begin, open_session


def build_exam(db: Session, course, mentor: User, n_questions: int = 3, shuffle: bool = False, **kw) -> Exam:
    s = get_settings()
    topic = Topic(course_id=course.id, name=kw.pop("topic_name", "First law"))
    db.add(topic)
    db.flush()
    now = utcnow()
    exam = Exam(
        course_id=course.id,
        mentor_id=mentor.id,
        title=kw.pop("title", "Unit test"),
        duration_min=kw.pop("duration_min", 30),
        window_start=now - timedelta(hours=1),
        window_end=kw.pop("window_end", now + timedelta(days=1)),
        shuffle=shuffle,
        flag_threshold_s=s.flag_threshold_s,
        glance_min_s=s.glance_min_s,
        max_flags=s.max_flags,
    )
    db.add(exam)
    db.flush()
    for i in range(n_questions):
        q = Question(
            course_id=course.id,
            topic_id=topic.id,
            type=QuestionType.mcq,
            body=f"Question {i + 1}?",
            marks=1,
            status=QuestionStatus.approved,
            source=QuestionSource.mentor,
            options=[
                QuestionOption(key="A", text="right", is_correct=True),
                QuestionOption(key="B", text="wrong"),
                QuestionOption(key="C", text="also wrong"),
            ],
        )
        db.add(q)
        db.flush()
        exam.questions.append(ExamQuestion(question_id=q.id, order=i))
    db.commit()
    return exam


def build_session(
    db: Session, exam: Exam, candidate: User, status: SessionStatus = SessionStatus.in_progress
) -> ExamSession:
    a = ExamAssignment(exam_id=exam.id, candidate_id=candidate.id, link_used_at=utcnow())
    db.add(a)
    db.flush()
    sess = open_session(db, a)
    if status == SessionStatus.in_progress:
        sess.status = SessionStatus.calibrating
        begin(db, sess)
    else:
        sess.status = status
    db.commit()
    return sess
