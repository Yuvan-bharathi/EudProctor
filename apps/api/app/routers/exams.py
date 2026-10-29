import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import mentor_only
from app.models import (
    CourseMember,
    Exam,
    ExamAssignment,
    ExamQuestion,
    ExamStatus,
    MemberRole,
    Question,
    QuestionStatus,
    User,
)
from app.routers.courses import require_course_mentor
from app.schemas.exams import (
    AssignmentOut,
    AssignmentsIn,
    ExamDetailOut,
    ExamIn,
    ExamOut,
    ExamPatch,
    ExamQuestionsIn,
    QuestionOut,
    SendLinksIn,
)
from app.services.links import issue_link

router = APIRouter(prefix="/exams", tags=["assessments"], dependencies=[Depends(mentor_only)])


def own_exam(db: Session, mentor: User, exam_id: uuid.UUID) -> Exam:
    """Mentors only see their own assessments (PRD section 2)."""
    exam = db.get(Exam, exam_id)
    if exam is None or exam.mentor_id != mentor.id:
        raise HTTPException(404, "Assessment not found")
    return exam


def _check_threshold(value: float) -> float:
    s = get_settings()
    if not s.flag_threshold_min_s <= value <= s.flag_threshold_max_s:
        raise HTTPException(
            422, f"Flag threshold must be between {s.flag_threshold_min_s} and {s.flag_threshold_max_s} s"
        )
    return value


def set_exam_questions(db: Session, exam: Exam, question_ids: list[uuid.UUID]) -> None:
    """The only way questions enter an assessment. Draft (AI-suggested, not accepted) questions are rejected."""
    if len(set(question_ids)) != len(question_ids):
        raise HTTPException(422, "Duplicate questions")
    questions = {q.id: q for q in db.scalars(select(Question).where(Question.id.in_(question_ids)))}
    for qid in question_ids:
        q = questions.get(qid)
        if q is None or q.course_id != exam.course_id:
            raise HTTPException(422, "Question not found in this course")
        if q.status != QuestionStatus.approved:
            raise HTTPException(422, "Draft or skipped questions cannot be added; accept them first")
    exam.questions.clear()
    db.flush()
    exam.questions.extend(ExamQuestion(question_id=qid, order=i) for i, qid in enumerate(question_ids))


def _assignment_out(a: ExamAssignment, c: User) -> AssignmentOut:
    return AssignmentOut(
        id=a.id,
        candidate_id=c.id,
        candidate_name=c.name,
        candidate_email=c.email,
        link_sent_at=a.link_sent_at,
        link_used_at=a.link_used_at,
        link_expires_at=a.link_expires_at,
        accommodations=a.accommodations or {},
    )


def _assignments(db: Session, exam: Exam) -> list[AssignmentOut]:
    rows = db.execute(
        select(ExamAssignment, User)
        .join(User, User.id == ExamAssignment.candidate_id)
        .where(ExamAssignment.exam_id == exam.id)
        .order_by(User.name)
    )
    return [_assignment_out(a, c) for a, c in rows]


def _detail(db: Session, exam: Exam) -> ExamDetailOut:
    qs = [
        QuestionOut.model_validate(eq.question)
        for eq in db.scalars(
            select(ExamQuestion)
            .where(ExamQuestion.exam_id == exam.id)
            .order_by(ExamQuestion.order)
            .options(selectinload(ExamQuestion.question).selectinload(Question.options))
        )
    ]
    return ExamDetailOut(
        **ExamOut.model_validate(exam).model_dump(), questions=qs, assignments=_assignments(db, exam)
    )


@router.get("", response_model=list[ExamOut])
def list_exams(db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    return list(
        db.scalars(select(Exam).where(Exam.mentor_id == mentor.id).order_by(Exam.window_start.desc()))
    )


@router.post("", response_model=ExamOut, status_code=201)
def create_exam(body: ExamIn, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    require_course_mentor(db, mentor, body.course_id)
    s = get_settings()
    exam = Exam(
        course_id=body.course_id,
        mentor_id=mentor.id,
        title=body.title,
        duration_min=body.duration_min,
        window_start=body.window_start,
        window_end=body.window_end,
        shuffle=body.shuffle,
        flag_threshold_s=_check_threshold(body.flag_threshold_s or s.flag_threshold_s),
        glance_min_s=s.glance_min_s,
        max_flags=s.max_flags,
    )
    db.add(exam)
    db.commit()
    return exam


@router.get("/{exam_id}", response_model=ExamDetailOut)
def get_exam(exam_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    return _detail(db, own_exam(db, mentor, exam_id))


@router.patch("/{exam_id}", response_model=ExamOut)
def patch_exam(
    exam_id: uuid.UUID, body: ExamPatch, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    exam = own_exam(db, mentor, exam_id)
    data = body.model_dump(exclude_none=True)
    if "flag_threshold_s" in data:
        _check_threshold(data["flag_threshold_s"])
    for k, v in data.items():
        setattr(exam, k, v)
    if exam.window_end <= exam.window_start:
        raise HTTPException(422, "window_end must be after window_start")
    db.commit()
    return exam


@router.put("/{exam_id}/questions", response_model=ExamDetailOut)
def put_exam_questions(
    exam_id: uuid.UUID,
    body: ExamQuestionsIn,
    db: Session = Depends(get_db),
    mentor: User = Depends(mentor_only),
):
    exam = own_exam(db, mentor, exam_id)
    set_exam_questions(db, exam, body.question_ids)
    db.commit()
    return _detail(db, exam)


@router.put("/{exam_id}/assignments", response_model=list[AssignmentOut])
def put_assignments(
    exam_id: uuid.UUID,
    body: AssignmentsIn,
    db: Session = Depends(get_db),
    mentor: User = Depends(mentor_only),
):
    exam = own_exam(db, mentor, exam_id)
    members = set(
        db.scalars(
            select(CourseMember.user_id).where(
                CourseMember.course_id == exam.course_id, CourseMember.role == MemberRole.candidate
            )
        )
    )
    if not set(body.candidate_ids) <= members:
        raise HTTPException(422, "Every candidate must be a member of the course")
    existing = {
        a.candidate_id: a for a in db.scalars(select(ExamAssignment).where(ExamAssignment.exam_id == exam.id))
    }
    for cid in body.candidate_ids:
        a = existing.get(cid)
        if a is None:
            db.add(ExamAssignment(exam_id=exam.id, candidate_id=cid, accommodations=body.accommodations))
        elif body.accommodations:
            a.accommodations = body.accommodations
    for cid, a in existing.items():
        if cid not in body.candidate_ids and a.link_used_at is None:
            db.delete(a)
    db.commit()
    return _assignments(db, exam)


@router.post("/{exam_id}/send-links", response_model=list[AssignmentOut])
def send_links(
    exam_id: uuid.UUID, body: SendLinksIn, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    exam = own_exam(db, mentor, exam_id)
    if not exam.questions:
        raise HTTPException(409, "Add questions before sending links")
    q = (
        select(ExamAssignment, User)
        .join(User, User.id == ExamAssignment.candidate_id)
        .where(ExamAssignment.exam_id == exam.id, ExamAssignment.link_used_at.is_(None))
    )
    if body.candidate_ids:
        q = q.where(ExamAssignment.candidate_id.in_(body.candidate_ids))
    rows = list(db.execute(q))
    if not rows:
        raise HTTPException(409, "No candidates are waiting for a link")
    for a, c in rows:
        issue_link(db, exam, a, c)
    exam.status = ExamStatus.scheduled
    db.commit()
    return _assignments(db, exam)
