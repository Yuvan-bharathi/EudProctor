import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import mentor_only, mentor_or_admin
from app.models import (
    Topic,
    QuestionOption,
    Role,
    Course,
    CourseMember,
    Exam,
    ExamAssignment,
    ExamQuestion,
    ExamStatus,
    MemberRole,
    Question,
    QuestionStatus,
    QuestionType,
    QuestionSource,
    User,
)
from app.routers.courses import mentor_course_ids, require_course_mentor
from app.schemas.exams import (
    ImportQuestionsIn,
    ImportCandidatesIn,
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

router = APIRouter(prefix="/exams", tags=["assessments"], dependencies=[Depends(mentor_or_admin)])


def own_exam(db: Session, user: User, exam_id: uuid.UUID) -> Exam:
    """Admins can access any assessment; mentors access assessments they created or mentor in their courses."""
    exam = db.get(Exam, exam_id)
    if exam is None:
        raise HTTPException(404, "Assessment not found")
    if user.role == Role.admin:
        return exam
    if exam.mentor_id == user.id:
        return exam
    if exam.course_id in mentor_course_ids(db, user):
        return exam
    raise HTTPException(404, "Assessment not found")


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
    meta = a.accommodations or {}
    now = utcnow()

    expires_at = a.link_expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if a.link_used_at is not None:
        status_val = "Accepted"
    elif meta.get("revoked"):
        status_val = "Revoked"
    elif expires_at and expires_at <= now and a.link_sent_at is not None:
        status_val = "Expired"
    elif meta.get("invitation_status"):
        status_val = meta["invitation_status"]
    elif a.link_sent_at is not None:
        status_val = "Sent"
    else:
        status_val = "Not Sent"

    del_status = None
    if isinstance(meta.get("delivery_metadata"), dict):
        del_status = meta["delivery_metadata"].get("status")

    return AssignmentOut(
        id=a.id,
        candidate_id=c.id,
        candidate_name=c.name,
        candidate_email=c.email,
        link_sent_at=a.link_sent_at,
        link_used_at=a.link_used_at,
        link_expires_at=a.link_expires_at,
        accommodations=meta,
        invitation_status=status_val,
        delivery_status=del_status,
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


def _to_exam_out(db: Session, e: Exam) -> ExamOut:
    course = db.get(Course, e.course_id)
    mentor = db.get(User, e.mentor_id)
    q_count = len(e.questions) if e.questions else 0
    cand_count = db.scalar(select(func.count(ExamAssignment.id)).where(ExamAssignment.exam_id == e.id)) or 0
    return ExamOut(
        id=e.id,
        course_id=e.course_id,
        title=e.title,
        duration_min=e.duration_min,
        window_start=e.window_start,
        window_end=e.window_end,
        shuffle=e.shuffle,
        flag_threshold_s=e.flag_threshold_s,
        glance_min_s=e.glance_min_s,
        max_flags=e.max_flags,
        status=e.status,
        course_name=course.name if course else "Course",
        created_by=mentor.name if mentor else "Mentor",
        question_count=q_count,
        candidates_count=cand_count,
        created_at=e.created_at,
    )


@router.get("", response_model=list[ExamOut])
def list_exams(db: Session = Depends(get_db), user: User = Depends(mentor_or_admin)):
    load_opts = (selectinload(Exam.questions),)
    if user.role == Role.admin:
        exams = db.scalars(select(Exam).options(*load_opts).order_by(Exam.created_at.desc())).all()
    else:
        cids = mentor_course_ids(db, user)
        if cids:
            query = select(Exam).options(*load_opts).where((Exam.mentor_id == user.id) | (Exam.course_id.in_(cids)))
        else:
            query = select(Exam).options(*load_opts).where(Exam.mentor_id == user.id)
        exams = db.scalars(query.order_by(Exam.created_at.desc())).all()
    return [_to_exam_out(db, e) for e in exams]


@router.post("", response_model=ExamOut, status_code=201)
def create_exam(body: ExamIn, db: Session = Depends(get_db), user: User = Depends(mentor_or_admin)):
    if user.role != Role.admin:
        require_course_mentor(db, user, body.course_id)
    s = get_settings()
    exam = Exam(
        course_id=body.course_id,
        mentor_id=user.id,
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
    db.refresh(exam)
    return _to_exam_out(db, exam)


@router.get("/{exam_id}", response_model=ExamDetailOut)
def get_exam(exam_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_or_admin)):
    return _detail(db, own_exam(db, mentor, exam_id))


@router.patch("/{exam_id}", response_model=ExamOut)
def patch_exam(
    exam_id: uuid.UUID, body: ExamPatch, db: Session = Depends(get_db), mentor: User = Depends(mentor_or_admin)
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
    mentor: User = Depends(mentor_or_admin),
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
    mentor: User = Depends(mentor_or_admin),
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
    exam_id: uuid.UUID,
    body: SendLinksIn,
    db: Session = Depends(get_db),
    mentor: User = Depends(mentor_or_admin),
):
    """Assessment Invitation & Notification Agent (LangGraph Workflow).

    Dispatches personalized assessment invitation emails to all enrolled, eligible candidates
    and tracks delivery statuses in the mentor workspace.
    """
    exam = own_exam(db, mentor, exam_id)
    if not exam.questions:
        raise HTTPException(409, "Add questions before sending links")

    from app.agent.invitation_agent import run_invitation_agent

    if exam.status == ExamStatus.draft:
        exam.status = ExamStatus.scheduled
        db.commit()

    cand_filter = [str(cid) for cid in body.candidate_ids] if body.candidate_ids else None
    result = run_invitation_agent(
        db=db,
        exam_id=exam.id,
        mentor=mentor,
        force_resend=body.force_resend,
        candidate_filter_ids=cand_filter,
        test_mode=body.test_mode or False,
        test_recipient_override=body.test_recipient,
    )

    if result.get("error"):
        raise HTTPException(400, result["error"])

    db.commit()
    return _assignments(db, exam)


@router.post("/{exam_id}/candidates/{candidate_id}/resend-invitation", response_model=AssignmentOut)
def resend_candidate_invitation(
    exam_id: uuid.UUID,
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    mentor: User = Depends(mentor_or_admin),
):
    """Resends assessment invitation to a single enrolled candidate via the Invitation Agent."""
    exam = own_exam(db, mentor, exam_id)
    from app.agent.invitation_agent import run_invitation_agent

    run_invitation_agent(
        db=db,
        exam_id=exam.id,
        mentor=mentor,
        force_resend=True,
        candidate_filter_ids=[str(candidate_id)],
    )

    a = db.scalar(
        select(ExamAssignment).where(
            ExamAssignment.exam_id == exam.id, ExamAssignment.candidate_id == candidate_id
        )
    )
    c = db.get(User, candidate_id)
    if not a or not c:
        raise HTTPException(404, "Candidate assignment not found")
    return _assignment_out(a, c)


@router.post("/{exam_id}/candidates/{candidate_id}/revoke-invitation", response_model=AssignmentOut)
def revoke_candidate_invitation(
    exam_id: uuid.UUID,
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    mentor: User = Depends(mentor_or_admin),
):
    """Revokes an outstanding assessment invitation."""
    exam = own_exam(db, mentor, exam_id)
    a = db.scalar(
        select(ExamAssignment).where(
            ExamAssignment.exam_id == exam.id, ExamAssignment.candidate_id == candidate_id
        )
    )
    c = db.get(User, candidate_id)
    if not a or not c:
        raise HTTPException(404, "Candidate assignment not found")

    meta = dict(a.accommodations or {})
    meta["revoked"] = True
    meta["invitation_status"] = "Revoked"
    a.accommodations = meta
    a.link_token_hash = None
    db.commit()
    return _assignment_out(a, c)



@router.post("/{exam_id}/import-questions", response_model=ExamDetailOut)
def import_exam_questions(
    exam_id: uuid.UUID,
    body: ImportQuestionsIn,
    db: Session = Depends(get_db),
    user: User = Depends(mentor_or_admin),
):
    """Persist imported or custom created questions directly into TiDB Cloud."""
    exam = own_exam(db, user, exam_id)
    topic = db.scalar(select(Topic).where(Topic.course_id == exam.course_id))
    if topic is None:
        topic = Topic(course_id=exam.course_id, name="General Technical Assessment")
        db.add(topic)
        db.flush()

    from app.models import QuestionSource
    next_order = len(exam.questions)
    for item in body.questions:
        q = Question(
            course_id=exam.course_id,
            topic_id=topic.id,
            subtopic=item.subtopic or (exam.course.name if exam.course else "General"),
            type=QuestionType.mcq,
            difficulty=item.difficulty,
            marks=item.marks,
            body=item.body,
            answer_text=item.explanation,
            status=QuestionStatus.approved,
            source=QuestionSource.mentor,
            created_by=user.id,
        )
        db.add(q)
        db.flush()
        for opt in item.options:
            db.add(QuestionOption(
                question_id=q.id,
                key=opt.key,
                text=opt.text,
                is_correct=opt.is_correct,
            ))
        db.flush()
        exam.questions.append(ExamQuestion(question_id=q.id, order=next_order))
        next_order += 1

    db.commit()
    return _detail(db, exam)


@router.post("/{exam_id}/import-candidates", response_model=list[AssignmentOut])
def import_exam_candidates(
    exam_id: uuid.UUID,
    body: ImportCandidatesIn,
    db: Session = Depends(get_db),
    user: User = Depends(mentor_or_admin),
):
    """Persist imported candidates into TiDB Cloud (User, Course,
    CourseMember, ExamAssignment)."""
    exam = own_exam(db, user, exam_id)
    from app.core.security import hash_password
    pw_hash = hash_password("candidatepassword")

    for cand in body.candidates:
        email_clean = cand.email.strip().lower()
        if not email_clean:
            continue
        u = db.scalar(select(User).where(User.email == email_clean))
        if u is None:
            u = User(
                role=Role.candidate,
                email=email_clean,
                name=cand.name.strip() or "Candidate",
                password_hash=pw_hash,
                is_active=True,
            )
            db.add(u)
            db.flush()

        cm = db.scalar(
            select(CourseMember).where(
                CourseMember.course_id == exam.course_id,
                CourseMember.user_id == u.id,
            )
        )
        if cm is None:
            db.add(CourseMember(course_id=exam.course_id, user_id=u.id, role=MemberRole.candidate))
            db.flush()

        ea = db.scalar(
            select(ExamAssignment).where(
                ExamAssignment.exam_id == exam.id,
                ExamAssignment.candidate_id == u.id,
            )
        )
        if ea is None:
            db.add(ExamAssignment(exam_id=exam.id, candidate_id=u.id))

    db.commit()
    return _assignments(db, exam)
