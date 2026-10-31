import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import candidate_only
from app.models import Course, Exam, ExamAssignment, ExamQuestion, Question, QuestionType, User
from app.models.base import utcnow
from app.models.session import Answer, ExamSession, SessionStatus, SubmitReason
from app.schemas.sessions import (
    AnswerAck,
    AnswersIn,
    AnswersOut,
    CandidateOption,
    CandidateQuestion,
    MyAssessment,
    SavedAnswer,
    SessionOut,
)
from app.scoring.service import recompute_exam, score_session
from app.services import sessions as svc
from app.services.identity import next_random_check_in

router = APIRouter(tags=["candidate sessions"], dependencies=[Depends(candidate_only)])

MAX_TEXT = 10_000


def session_out(db: Session, sess: ExamSession) -> SessionOut:
    exam = sess.exam
    questions = []
    for i, q in enumerate(svc.questions_for(db, sess), start=1):
        by_key = {o.key: o for o in q.options}
        order = sess.option_order.get(str(q.id)) or list(by_key)
        questions.append(
            CandidateQuestion(
                id=q.id,
                number=i,
                type=q.type.value,
                body=q.body,
                marks=q.marks,
                options=[CandidateOption(key=k, text=by_key[k].text) for k in order if k in by_key],
            )
        )
    answers = {str(a.question_id): SavedAnswer(value=a.value, client_seq=a.client_seq) for a in sess.answers}
    show_questions = sess.status == SessionStatus.in_progress
    return SessionOut(
        id=sess.id,
        exam_id=exam.id,
        exam_title=exam.title,
        duration_min=exam.duration_min,
        status=sess.status,
        started_at=sess.started_at,
        deadline_at=sess.deadline_at,
        submitted_at=sess.submitted_at,
        server_now=utcnow(),
        max_flags=exam.max_flags,
        flag_count=min(sess.flag_count, exam.max_flags),
        questions=questions if show_questions else [],
        answers=answers if show_questions else {},
        next_identity_check_in_s=next_random_check_in(sess),
    )


@router.get("/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    sess = svc.own_session(db, session_id, user.id)
    db.commit()
    return session_out(db, sess)


@router.post("/sessions/{session_id}/start", response_model=SessionOut)
def start_session(session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    sess = svc.own_session(db, session_id, user.id, lock=True)
    if sess.status == SessionStatus.in_progress:
        return session_out(db, sess)
    if sess.status != SessionStatus.calibrating:
        raise HTTPException(409, "Finish identity verification and calibration first.")
    svc.begin(db, sess)
    db.commit()
    return session_out(db, sess)


class StartIn(BaseModel):
    exam_id: uuid.UUID


@router.post("/sessions/start", response_model=SessionOut)
def start_exam_session(body: StartIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    """Open (or resume) the candidate's attempt from the assessments page. There the browser camera-setup step is
    the pre-start check, so the session moves straight to in_progress; the join-link flow keeps its server-side
    identity steps. A session waiting on a mentor identity decision is never skipped."""
    assignment = db.scalar(
        select(ExamAssignment).where(ExamAssignment.exam_id == body.exam_id, ExamAssignment.candidate_id == user.id)
    )
    if assignment is None:
        raise HTTPException(404, "This assessment is not assigned to you.")
    opened = svc.open_session(db, assignment)
    sess = svc.own_session(db, opened.id, user.id, lock=True)
    pre_start = {SessionStatus.link_opened: SessionStatus.identity_check, SessionStatus.identity_check: SessionStatus.calibrating}
    while sess.status in pre_start:
        svc.transition(db, sess, pre_start[sess.status], "browser camera setup completed")
    if sess.status == SessionStatus.calibrating:
        svc.begin(db, sess)
    elif sess.status in (SessionStatus.identity_review, SessionStatus.identity_blocked):
        db.commit()
        raise HTTPException(409, "Your identity check is with your mentor. Please contact them before starting.")
    db.commit()
    return session_out(db, sess)


def _valid_value(q: Question, value: dict) -> bool:
    if value == {}:
        return True  # cleared answer
    if q.type == QuestionType.mcq:
        return set(value) == {"option_key"} and value["option_key"] in {o.key for o in q.options}
    return set(value) == {"text"} and isinstance(value["text"], str) and len(value["text"]) <= MAX_TEXT


@router.put("/sessions/{session_id}/answers", response_model=AnswersOut)
def save_answers(
    session_id: uuid.UUID,
    body: AnswersIn,
    db: Session = Depends(get_db),
    user: User = Depends(candidate_only),
):
    """Idempotent autosave: an answer is stored only if its client_seq is newer than the stored one."""
    sess = svc.own_session(db, session_id, user.id, lock=True)
    allowed = {uuid.UUID(q) for q in sess.question_order}
    questions = {q.id: q for q in svc.questions_for(db, sess)}
    existing = {a.question_id: a for a in sess.answers}
    acks: list[AnswerAck] = []
    late_accepted = False
    for item in body.answers:
        q = questions.get(item.question_id)
        if item.question_id not in allowed or q is None or not _valid_value(q, item.value):
            raise HTTPException(422, "Invalid answer")
        current = existing.get(item.question_id)
        accepted = False
        if svc.can_accept_answers(sess, item.answered_at) and (
            current is None or item.client_seq > current.client_seq
        ):
            if current is None:
                current = Answer(session_id=sess.id, question_id=q.id)
                sess.answers.append(current)
                existing[q.id] = current
            current.value = item.value
            current.client_seq = item.client_seq
            current.answered_at = item.answered_at
            current.saved_at = utcnow()
            accepted = True
        held = current.client_seq if current else 0
        # a duplicate/older seq is acknowledged (nothing lost) but not applied
        acks.append(
            AnswerAck(question_id=q.id, client_seq=held, accepted=accepted or held >= item.client_seq)
        )
        late_accepted = late_accepted or (accepted and sess.status != SessionStatus.in_progress)
    if late_accepted:  # answers buffered offline before the deadline arrived after auto-submit: re-score
        score_session(db, sess)
        recompute_exam(db, sess.exam)
    db.commit()
    return AnswersOut(acks=acks, status=sess.status, deadline_at=sess.deadline_at, server_now=utcnow())


@router.post("/sessions/{session_id}/submit", response_model=SessionOut)
def submit_session(
    session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(candidate_only)
):
    sess = svc.own_session(db, session_id, user.id, lock=True)
    if sess.status not in (
        SessionStatus.in_progress,
        SessionStatus.submitted,
        SessionStatus.scored,
        SessionStatus.analysed,
    ):
        raise HTTPException(409, "This assessment has not started.")
    svc.submit(db, sess, SubmitReason.manual)
    db.commit()
    return session_out(db, sess)


@router.get("/candidates/me/assessments", response_model=list[MyAssessment])
def my_assessments(db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    """Newest first: latest scheduled start, then most recently assigned. One query (no per-row lookups)."""
    q_counts = (
        select(ExamQuestion.exam_id, func.count().label("n")).group_by(ExamQuestion.exam_id).subquery()
    )
    rows = db.execute(
        select(
            Exam.id,
            Exam.title,
            Exam.duration_min,
            Exam.window_start,
            Exam.window_end,
            Course.name,
            ExamSession.id,
            ExamSession.status,
            func.coalesce(q_counts.c.n, 0),
        )
        .select_from(ExamAssignment)
        .join(Exam, Exam.id == ExamAssignment.exam_id)
        .outerjoin(Course, Course.id == Exam.course_id)
        .outerjoin(ExamSession, ExamSession.assignment_id == ExamAssignment.id)
        .outerjoin(q_counts, q_counts.c.exam_id == Exam.id)
        .where(ExamAssignment.candidate_id == user.id)
        .order_by(Exam.window_start.desc(), ExamAssignment.created_at.desc())
    )
    return [
        MyAssessment(
            exam_id=exam_id,
            title=title,
            duration_min=duration_min,
            window_start=window_start,
            window_end=window_end,
            session_id=session_id,
            session_status=session_status,
            course_name=course_name or "Full Stack Development",
            questions_count=n,
        )
        for exam_id, title, duration_min, window_start, window_end, course_name, session_id, session_status, n in rows
    ]
