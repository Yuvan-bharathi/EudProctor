"""Internship flow API (Sprints 0-5 of the reviewed implementation plan).

Roles: admin sets up cohorts and enrolments; a mentor manages only their own interns; an intern
(role=candidate) sees only their own data. Every AI output reaches the intern only after the mentor
approves it in /internship/approvals, except live Blocker Co-Pilot answers (plan section 6.10).
"""

import uuid
from datetime import date, datetime, timedelta
from typing import Any, Literal

import jsonschema
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agent.internship import agents
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import any_user, candidate_only, require_roles
from app.core.security import make_unusable_password
from app.models import (
    AgentDraft,
    Appraisal,
    AttendanceSession,
    BlockerQuestion,
    CodeReview,
    CohortDoc,
    DraftStatus,
    InternshipCohort,
    InternshipEnrollment,
    InternTask,
    LeaveRequest,
    Role,
    StallAlert,
    StandupEntry,
    TaskStatus,
    TaskSubmission,
    User,
    WeeklyQuiz,
)
from app.models.base import utcnow
from app.services import internship as svc
from app.services.credentials import ensure_candidate_password, ensure_username, issue_password, make_username
from app.services.mailer import send_mail

router = APIRouter(prefix="/internship", tags=["internship"], dependencies=[Depends(any_user)])
staff = require_roles(Role.mentor, Role.admin)
admin = require_roles(Role.admin)


# ============================================================== helpers & serialisers


def _iso(v: Any) -> Any:
    return v.isoformat() if isinstance(v, (date, datetime)) else v


def _user(db: Session, uid: uuid.UUID | None) -> User | None:
    return db.get(User, uid) if uid else None


def _cohort_or_404(db: Session, cohort_id: uuid.UUID) -> InternshipCohort:
    c = db.get(InternshipCohort, cohort_id)
    if c is None:
        raise HTTPException(404, "Cohort not found")
    return c


def _today(db: Session, enr: InternshipEnrollment) -> date:
    return svc.local_today(svc.cohort_tz(db.get(InternshipCohort, enr.cohort_id)))


def cohort_out(db: Session, c: InternshipCohort) -> dict[str, Any]:
    enrs = list(db.scalars(select(InternshipEnrollment).where(InternshipEnrollment.cohort_id == c.id)))
    return {
        "id": str(c.id), "name": c.name, "track": c.track, "start_date": _iso(c.start_date),
        "end_date": _iso(c.end_date), "timezone": c.timezone, "ai_review_enabled": c.ai_review_enabled,
        "mentee_count": len(enrs), "mentor_count": len({e.mentor_id for e in enrs}),
    }


def mentee_out(db: Session, e: InternshipEnrollment, with_stats: bool = True) -> dict[str, Any]:
    u, mentor, cohort = db.get(User, e.mentee_id), db.get(User, e.mentor_id), db.get(InternshipCohort, e.cohort_id)
    today = _today(db, e)
    week = svc.week_number(e, today)
    out: dict[str, Any] = {
        "id": str(u.id), "enrollment_id": str(e.id), "name": u.name, "email": u.email, "username": u.username,
        "phone": e.phone, "roll_number": e.roll_number, "cohort_id": str(cohort.id), "cohort_name": cohort.name,
        "track": cohort.track, "mentor_id": str(mentor.id), "mentor_name": mentor.name, "status": e.status,
        "started_on": _iso(e.started_on), "current_week": week, "current_month": svc.month_number(week),
    }
    if with_stats:
        tasks = list(db.scalars(select(InternTask).where(InternTask.mentee_id == u.id, InternTask.cohort_id == cohort.id)))
        days = svc.attendance_days(db, u.id, e.started_on, today) if today >= e.started_on else []
        today_row = next((d for d in days if d["date"] == today.isoformat()), None)
        out.update({
            "attendance_rate_pct": svc.attendance_rate(days),
            "today_status": today_row["status"] if today_row else "Absent",
            "online": bool(today_row and today_row["open"]),
            "tasks_total": len(tasks),
            "tasks_done": sum(1 for t in tasks if t.status == TaskStatus.done),
            "tasks_in_review": sum(1 for t in tasks if t.status == TaskStatus.review),
            "skills": svc.skills_for(db, u.id),
        })
    return out


def task_out(db: Session, t: InternTask) -> dict[str, Any]:
    latest = db.scalar(select(TaskSubmission).where(TaskSubmission.task_id == t.id)
                       .order_by(TaskSubmission.created_at.desc()))
    mentee = db.get(User, t.mentee_id)
    return {
        "id": str(t.id), "cohort_id": str(t.cohort_id), "mentee_id": str(t.mentee_id),
        "mentee_name": mentee.name if mentee else "", "mentor_id": str(t.mentor_id), "title": t.title,
        "description": t.description, "acceptance_criteria": t.acceptance_criteria, "skill_area": t.skill_area,
        "skill_tags": t.skill_tags or [], "priority": t.priority, "status": t.status.value,
        "due_date": _iso(t.due_date), "week_number": t.week_number, "month_number": svc.month_number(t.week_number),
        "mentor_feedback": t.mentor_feedback, "flagged_blocked_at": _iso(t.flagged_blocked_at),
        "last_activity_at": _iso(t.last_activity_at), "created_at": _iso(t.created_at),
        "latest_submission": (
            {"id": str(latest.id), "review_status": latest.review_status, "created_at": _iso(latest.created_at),
             "submission_url": latest.submission_url, "notes": latest.notes}
            if latest else None
        ),
    }


def submission_out(db: Session, s: TaskSubmission, viewer: User) -> dict[str, Any]:
    review = db.scalar(select(CodeReview).where(CodeReview.submission_id == s.id))
    is_staff = viewer.role in (Role.mentor, Role.admin)
    rv = None
    if review and (is_staff or review.status == "published"):
        rv = {"status": review.status, "findings": review.findings, "metrics": review.metrics,
              "review": review.review, "published_at": _iso(review.published_at)}
    return {
        "id": str(s.id), "task_id": str(s.task_id), "notes": s.notes, "submission_url": s.submission_url,
        "filename": s.filename, "language": s.language, "ai_consent": s.ai_consent,
        "review_status": s.review_status if (is_staff or s.review_status in ("published", "none", "not_consented"))
        else "in_review",
        "code": svc.decrypt_code(s.code_enc), "created_at": _iso(s.created_at), "review": rv,
    }


def quiz_out(q: WeeklyQuiz, viewer: User, mentee_name: str = "") -> dict[str, Any]:
    is_staff = viewer.role in (Role.mentor, Role.admin)
    reveal = is_staff or q.status == "submitted"
    questions = []
    if is_staff or q.status in ("available", "submitted"):
        for item in q.questions or []:
            qq = {"id": item["id"], "skill": item["skill"], "body": item["body"],
                  "options": [{"key": o["key"], "text": o["text"]} for o in item["options"]]}
            if reveal:
                qq["correct_key"] = item["correct_key"]
                qq["explanation"] = item.get("explanation", "")
                if is_staff:
                    qq["options"] = item["options"]
            questions.append(qq)
    return {
        "id": str(q.id), "mentee_id": str(q.mentee_id), "mentee_name": mentee_name, "week_number": q.week_number,
        "month_number": svc.month_number(q.week_number), "title": q.title, "status": q.status,
        "duration_min": q.duration_min, "question_count": len(q.questions or []), "questions": questions,
        "answers": q.answers if reveal else None, "score_pct": q.score_pct, "results": q.results if reveal else None,
        "released_at": _iso(q.released_at), "submitted_at": _iso(q.submitted_at),
    }


def appraisal_out(db: Session, a: Appraisal, viewer: User) -> dict[str, Any]:
    mentee = db.get(User, a.mentee_id)
    content = a.content
    if content and viewer.role == Role.candidate:
        # mentor_brief is the mentor's private 1:1 prep note: never sent to the intern
        content = {k: v for k, v in content.items() if k != "mentor_brief"}
    return {
        "id": str(a.id), "mentee_id": str(a.mentee_id), "mentee_name": mentee.name if mentee else "",
        "milestone_day": a.milestone_day, "month_number": a.milestone_day // 30, "status": a.status,
        "metrics": a.metrics, "content": content, "mentee_comment": a.mentee_comment,
        "published_at": _iso(a.published_at), "acknowledged_at": _iso(a.acknowledged_at), "created_at": _iso(a.created_at),
    }


def draft_out(db: Session, d: AgentDraft) -> dict[str, Any]:
    mentee = db.get(User, d.mentee_id)
    return {
        "id": str(d.id), "agent": d.agent, "title": d.title, "status": d.status.value, "subject_type": d.subject_type,
        "subject_id": d.subject_id, "mentee_id": str(d.mentee_id), "mentee_name": mentee.name if mentee else "",
        "content": d.content, "final_content": d.final_content, "edited": d.edited, "mentor_note": d.mentor_note,
        "created_at": _iso(d.created_at), "decided_at": _iso(d.decided_at),
    }


def _visible_mentees(db: Session, user: User) -> list[uuid.UUID]:
    return svc.mentee_ids_for(db, user)


# ============================================================== Sprint 0: cohorts, mentors, enrolment


class CohortIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    track: str = Field(default="MERN", max_length=40)
    start_date: date
    end_date: date
    timezone: str | None = None
    ai_review_enabled: bool = True


class CohortPatch(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    track: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    timezone: str | None = None
    ai_review_enabled: bool | None = None


class EnrollIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    mentor_id: uuid.UUID
    phone: str | None = None
    roll_number: str | None = None
    started_on: date | None = None


class EnrollmentPatch(BaseModel):
    mentor_id: uuid.UUID | None = None
    status: Literal["Active", "Completed"] | None = None


@router.get("/me")
def my_internship(db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    e = svc.active_enrollment(db, user.id)
    if e is None:
        return {"enrolled": False}
    pending_quizzes = db.scalar(select(func.count(WeeklyQuiz.id)).where(
        WeeklyQuiz.mentee_id == user.id, WeeklyQuiz.status == "available")) or 0
    return {"enrolled": True, **mentee_out(db, e), "pending_quizzes": pending_quizzes,
            "rules": {"full_day_hours": get_settings().full_day_hours, "half_day_hours": get_settings().half_day_hours}}


@router.get("/mentors")
def list_mentors(db: Session = Depends(get_db), _: User = Depends(admin)):
    rows = []
    for m in db.scalars(select(User).where(User.role == Role.mentor, User.is_active.is_(True)).order_by(User.name)):
        n = db.scalar(select(func.count(InternshipEnrollment.id)).where(
            InternshipEnrollment.mentor_id == m.id, InternshipEnrollment.status == "Active")) or 0
        rows.append({"id": str(m.id), "name": m.name, "email": m.email, "active_mentees": n})
    return rows


@router.get("/cohorts")
def list_cohorts(db: Session = Depends(get_db), user: User = Depends(any_user)):
    q = select(InternshipCohort).order_by(InternshipCohort.start_date.desc())
    if user.role != Role.admin:
        ids = set(db.scalars(select(InternshipEnrollment.cohort_id).where(
            (InternshipEnrollment.mentor_id == user.id) | (InternshipEnrollment.mentee_id == user.id))))
        q = q.where(InternshipCohort.id.in_(ids or {uuid.uuid4()}))
    return [cohort_out(db, c) for c in db.scalars(q)]


@router.post("/cohorts", status_code=201)
def create_cohort(body: CohortIn, db: Session = Depends(get_db), user: User = Depends(admin)):
    if body.end_date <= body.start_date:
        raise HTTPException(422, "End date must be after the start date")
    c = InternshipCohort(name=body.name.strip(), track=body.track, start_date=body.start_date, end_date=body.end_date,
                         timezone=body.timezone or get_settings().internship_timezone,
                         ai_review_enabled=body.ai_review_enabled, created_by=user.id)
    db.add(c)
    db.commit()
    return cohort_out(db, c)


@router.patch("/cohorts/{cohort_id}")
def patch_cohort(cohort_id: uuid.UUID, body: CohortPatch, db: Session = Depends(get_db), _: User = Depends(admin)):
    c = _cohort_or_404(db, cohort_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    if c.end_date <= c.start_date:
        raise HTTPException(422, "End date must be after the start date")
    db.commit()
    return cohort_out(db, c)


@router.get("/mentees")
def list_mentees(cohort_id: uuid.UUID | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    q = select(InternshipEnrollment).order_by(InternshipEnrollment.created_at)
    if user.role == Role.mentor:
        q = q.where(InternshipEnrollment.mentor_id == user.id)
    if cohort_id:
        q = q.where(InternshipEnrollment.cohort_id == cohort_id)
    return [mentee_out(db, e) for e in db.scalars(q)]


@router.get("/mentees/{mentee_id}")
def get_mentee(mentee_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    return mentee_out(db, svc.require_access_to_mentee(db, user, mentee_id))


@router.post("/cohorts/{cohort_id}/mentees", status_code=201)
def enroll_mentee(cohort_id: uuid.UUID, body: EnrollIn, db: Session = Depends(get_db), user: User = Depends(admin)):
    """Create (or reuse) the intern's account, enrol them with a mentor and email their login credentials."""
    s = get_settings()
    cohort = _cohort_or_404(db, cohort_id)
    mentor = db.get(User, body.mentor_id)
    if mentor is None or mentor.role != Role.mentor:
        raise HTTPException(422, "Choose a mentor account")
    active = db.scalar(select(func.count(InternshipEnrollment.id)).where(
        InternshipEnrollment.mentor_id == mentor.id, InternshipEnrollment.status == "Active")) or 0
    if active >= s.max_mentees_per_mentor:
        raise HTTPException(409, f"{mentor.name} already mentors {active} interns (limit {s.max_mentees_per_mentor}).")
    email = body.email.strip().lower()
    u = db.scalar(select(User).where(User.email == email))
    password: str | None
    if u is None:
        u = User(role=Role.candidate, email=email, name=body.name.strip(), username=make_username(db, body.name),
                 password_hash=make_unusable_password(), is_active=True)
        password = issue_password(u)
        db.add(u)
        db.flush()
    else:
        if u.role != Role.candidate:
            raise HTTPException(422, f"{email} belongs to a {u.role.value} account and cannot be enrolled as an intern.")
        ensure_username(db, u)
        password = ensure_candidate_password(u)
    if db.scalar(select(InternshipEnrollment).where(InternshipEnrollment.cohort_id == cohort.id,
                                                    InternshipEnrollment.mentee_id == u.id)):
        raise HTTPException(409, f"{email} is already enrolled in this cohort")
    e = InternshipEnrollment(cohort_id=cohort.id, mentee_id=u.id, mentor_id=mentor.id, phone=body.phone,
                             roll_number=body.roll_number, started_on=body.started_on or cohort.start_date)
    db.add(e)
    db.commit()
    login = f"{s.web_base_url}/login"
    pw_line = f"Password: {password}" if password else "Password: your existing EduProctor password"
    result = send_mail(
        u.email, f"Welcome to the {cohort.name} internship",
        f"Hello {u.name},\n\nYou have been enrolled in the {cohort.name} internship ({cohort.track}). "
        f"Your mentor is {mentor.name}.\n\nYOUR LOGIN CREDENTIALS\n  Username: {u.username}\n  {pw_line}\n"
        f"(You can also sign in with your email address.)\n\nSign in: {login}\n"
        f"Forgot your password? {s.web_base_url}/forgot-password\n\nIn your workspace you will punch in/out, "
        "see your tasks, submit work, and take a short weekly check.\n",
        candidate_name=u.name,
    )
    return {**mentee_out(db, e), "welcome_email": {"delivered": result["delivered"], "error": result.get("error")}}


def _check_mentor_capacity(db: Session, mentor_id: uuid.UUID, exclude_enrollment: uuid.UUID | None = None) -> None:
    limit = get_settings().max_mentees_per_mentor
    q = select(func.count(InternshipEnrollment.id)).where(
        InternshipEnrollment.mentor_id == mentor_id, InternshipEnrollment.status == "Active")
    if exclude_enrollment:
        q = q.where(InternshipEnrollment.id != exclude_enrollment)
    active = db.scalar(q) or 0
    if active >= limit:
        mentor = db.get(User, mentor_id)
        raise HTTPException(409, f"{mentor.name if mentor else 'This mentor'} already mentors {active} interns (limit {limit}).")


@router.patch("/enrollments/{enrollment_id}")
def patch_enrollment(enrollment_id: uuid.UUID, body: EnrollmentPatch, db: Session = Depends(get_db),
                     _: User = Depends(admin)):
    e = db.get(InternshipEnrollment, enrollment_id)
    if e is None:
        raise HTTPException(404, "Enrolment not found")
    target_mentor = body.mentor_id or e.mentor_id
    becomes_active = (body.status or e.status) == "Active"
    if becomes_active and (body.mentor_id and body.mentor_id != e.mentor_id or e.status != "Active"):
        _check_mentor_capacity(db, target_mentor, exclude_enrollment=e.id)
    if body.mentor_id:
        m = db.get(User, body.mentor_id)
        if m is None or m.role != Role.mentor:
            raise HTTPException(422, "Choose a mentor account")
        e.mentor_id = m.id
        for t in db.scalars(select(InternTask).where(InternTask.mentee_id == e.mentee_id,
                                                     InternTask.cohort_id == e.cohort_id)):
            t.mentor_id = m.id
    if body.status:
        e.status = body.status
    db.commit()
    return mentee_out(db, e)


# ---- cohort docs (the only sources the Blocker Co-Pilot may answer from, plus built-in setup docs)


class DocIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20000)


def _staff_cohort(db: Session, user: User, cohort_id: uuid.UUID) -> InternshipCohort:
    c = _cohort_or_404(db, cohort_id)
    if user.role == Role.mentor and not db.scalar(select(InternshipEnrollment.id).where(
            InternshipEnrollment.cohort_id == c.id, InternshipEnrollment.mentor_id == user.id).limit(1)):
        raise HTTPException(404, "Cohort not found")
    return c


@router.get("/cohorts/{cohort_id}/docs")
def list_docs(cohort_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    c = _staff_cohort(db, user, cohort_id)
    docs = db.scalars(select(CohortDoc).where(CohortDoc.cohort_id == c.id).order_by(CohortDoc.created_at.desc()))
    return {"docs": [{"id": str(d.id), "title": d.title, "body": d.body, "created_at": _iso(d.created_at)} for d in docs],
            "builtin": [{"id": d["id"], "title": d["title"]} for d in agents.BUILTIN_DOCS]}


@router.post("/cohorts/{cohort_id}/docs", status_code=201)
def add_doc(cohort_id: uuid.UUID, body: DocIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    c = _staff_cohort(db, user, cohort_id)
    d = CohortDoc(cohort_id=c.id, title=body.title.strip(), body=body.body.strip(), created_by=user.id)
    db.add(d)
    db.commit()
    return {"id": str(d.id), "title": d.title, "body": d.body, "created_at": _iso(d.created_at)}


@router.delete("/docs/{doc_id}", status_code=204)
def delete_doc(doc_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    d = db.get(CohortDoc, doc_id)
    if d is None:
        raise HTTPException(404, "Doc not found")
    _staff_cohort(db, user, d.cohort_id)
    db.delete(d)
    db.commit()


# ============================================================== Sprint 0: tasks & submissions


class TaskIn(BaseModel):
    mentee_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    acceptance_criteria: str = ""
    skill_area: str = Field(default="General", max_length=80)
    skill_tags: list[str] = Field(default_factory=list, max_length=8)
    priority: Literal["High", "Medium", "Low"] = "Medium"
    due_date: date | None = None
    week_number: int | None = Field(default=None, ge=1, le=12)


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    acceptance_criteria: str | None = None
    skill_area: str | None = None
    skill_tags: list[str] | None = None
    priority: Literal["High", "Medium", "Low"] | None = None
    due_date: date | None = None
    week_number: int | None = Field(default=None, ge=1, le=12)
    status: Literal["Assigned", "In Progress", "Review", "Done", "Rework"] | None = None
    mentor_feedback: str | None = None


class SubmitIn(BaseModel):
    notes: str = Field(default="", max_length=5000)
    submission_url: str | None = Field(default=None, max_length=500)
    code: str | None = None
    filename: str | None = Field(default=None, max_length=200)
    language: str | None = Field(default=None, max_length=30)
    ai_consent: bool = False


class FlagIn(BaseModel):
    reason: str = Field(default="", max_length=1000)


def _task_for(db: Session, user: User, task_id: uuid.UUID) -> InternTask:
    t = db.get(InternTask, task_id)
    if t is None or t.mentee_id not in _visible_mentees(db, user):
        raise HTTPException(404, "Task not found")
    return t


@router.get("/tasks")
def list_tasks(mentee_id: uuid.UUID | None = None, status: str | None = None, db: Session = Depends(get_db),
               user: User = Depends(any_user)):
    ids = _visible_mentees(db, user)
    if mentee_id:
        ids = [i for i in ids if i == mentee_id]
    q = select(InternTask).where(InternTask.mentee_id.in_(ids or [uuid.uuid4()]))
    if status:
        q = q.where(InternTask.status == status)
    return [task_out(db, t) for t in db.scalars(q.order_by(InternTask.week_number, InternTask.created_at))]


@router.post("/tasks", status_code=201)
def create_task(body: TaskIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    e = svc.require_access_to_mentee(db, user, body.mentee_id)
    week = body.week_number or svc.week_number(e, _today(db, e))
    t = InternTask(cohort_id=e.cohort_id, mentee_id=e.mentee_id, mentor_id=e.mentor_id, title=body.title.strip(),
                   description=body.description, acceptance_criteria=body.acceptance_criteria,
                   skill_area=body.skill_area.strip() or "General",
                   skill_tags=[s.strip() for s in body.skill_tags if s.strip()], priority=body.priority,
                   due_date=body.due_date, week_number=week)
    db.add(t)
    db.commit()
    return task_out(db, t)


@router.patch("/tasks/{task_id}")
def patch_task(task_id: uuid.UUID, body: TaskPatch, db: Session = Depends(get_db), user: User = Depends(staff)):
    t = _task_for(db, user, task_id)
    data = body.model_dump(exclude_unset=True)
    required = {"title", "skill_area", "priority", "week_number", "status", "description", "acceptance_criteria",
                "skill_tags"}
    blank = [k for k in required if k in data and (data[k] is None or (isinstance(data[k], str) and not data[k].strip()
                                                                       and k in ("title", "skill_area")))]
    if blank:
        raise HTTPException(422, f"These fields can't be empty: {', '.join(sorted(blank))}")
    if "status" in data and data["status"]:
        t.status = TaskStatus(data.pop("status"))
    for k, v in data.items():
        if k == "skill_tags" and v is not None:
            v = [s.strip() for s in v if s.strip()]
        setattr(t, k, v)
    t.last_activity_at = utcnow()
    db.commit()
    return task_out(db, t)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    t = _task_for(db, user, task_id)
    if db.scalar(select(TaskSubmission.id).where(TaskSubmission.task_id == t.id).limit(1)):
        raise HTTPException(409, "This task already has submissions; mark it Done instead of deleting it.")
    db.delete(t)
    db.commit()


@router.post("/tasks/{task_id}/start")
def start_task(task_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    t = _task_for(db, user, task_id)
    if t.status in (TaskStatus.assigned, TaskStatus.rework):
        t.status = TaskStatus.in_progress
    t.last_activity_at = utcnow()
    db.commit()
    return task_out(db, t)


@router.post("/tasks/{task_id}/flag-blocked")
def flag_blocked(task_id: uuid.UUID, body: FlagIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    t = _task_for(db, user, task_id)
    t.flagged_blocked_at = utcnow()
    db.add(StallAlert(mentee_id=user.id, mentor_id=t.mentor_id, task_id=t.id, source="self_flag",
                      reason=body.reason.strip() or f"{user.name} flagged '{t.title}' as blocked."))
    db.commit()
    return task_out(db, t)


@router.post("/tasks/{task_id}/submit")
def submit_task(task_id: uuid.UUID, body: SubmitIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    """Submit work for review. Code is secret-scanned first (policy 6.8) and never stored if it contains secrets."""
    s = get_settings()
    t = _task_for(db, user, task_id)
    if t.status == TaskStatus.done:
        raise HTTPException(409, "This task is already done.")
    code = body.code if body.code and body.code.strip() else None
    if not (code or body.notes.strip() or body.submission_url):
        raise HTTPException(422, "Add notes, a link or code to submit.")
    if code:
        if len(code.encode()) > s.max_submission_bytes or len(code.splitlines()) > s.max_submission_lines:
            raise HTTPException(422, f"Code is too large (max {s.max_submission_lines} lines / {s.max_submission_bytes // 1000} KB).")
        hits = svc.scan_secrets(code, body.filename)
        if hits:
            raise HTTPException(422, {
                "message": "Your code seems to contain secrets (keys, tokens or passwords). Remove them and submit "
                           "again; the code was not saved.",
                "findings": hits,
            })
    sub = TaskSubmission(task_id=t.id, mentee_id=user.id, notes=body.notes.strip(), submission_url=body.submission_url,
                         filename=body.filename, language=body.language, ai_consent=body.ai_consent,
                         code_enc=svc.encrypt_code(code) if code else None)
    db.add(sub)
    t.status = TaskStatus.review
    t.last_activity_at = utcnow()
    db.flush()
    cohort = db.get(InternshipCohort, t.cohort_id)
    if code and body.ai_consent and cohort.ai_review_enabled:
        agents.start_code_review(db, sub, triggered_by=f"user:{user.id}")
    elif code:
        sub.review_status = "not_consented" if not body.ai_consent else "ai_disabled"
    db.commit()
    return {"task": task_out(db, t), "submission": submission_out(db, sub, user)}


@router.get("/tasks/{task_id}/submissions")
def task_submissions(task_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(any_user)):
    t = _task_for(db, user, task_id)
    subs = db.scalars(select(TaskSubmission).where(TaskSubmission.task_id == t.id).order_by(TaskSubmission.created_at.desc()))
    return [submission_out(db, s, user) for s in subs]


@router.post("/submissions/{submission_id}/request-ai-review")
def request_ai_review(submission_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    """Mentor re-runs the AI draft (e.g. after the agent was unavailable). Requires the intern's consent."""
    sub = db.get(TaskSubmission, submission_id)
    if sub is None:
        raise HTTPException(404, "Submission not found")
    _task_for(db, user, sub.task_id)
    if not sub.code_enc or not sub.ai_consent:
        raise HTTPException(409, "AI review needs submitted code and the intern's consent.")
    if sub.review_status in ("awaiting_mentor", "published"):
        raise HTTPException(409, "This submission already has an AI review.")
    agents.start_code_review(db, sub, triggered_by=f"user:{user.id}")
    db.commit()
    return submission_out(db, sub, user)


# ============================================================== Sprint 1: attendance (8-hour rule) & leave


class PunchIn(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class CorrectIn(BaseModel):
    punch_in_at: datetime | None = None
    punch_out_at: datetime
    note: str = Field(min_length=1, max_length=1000)


class LeaveIn(BaseModel):
    start_date: date
    end_date: date
    reason: str = Field(min_length=1, max_length=2000)


class DecideLeaveIn(BaseModel):
    approve: bool


def _attendance_payload(db: Session, e: InternshipEnrollment, start: date, end: date) -> dict[str, Any]:
    s = get_settings()
    cohort = db.get(InternshipCohort, e.cohort_id)
    today = svc.local_today(svc.cohort_tz(cohort))
    days = svc.attendance_days(db, e.mentee_id, start, end)
    today_row = next((d for d in days if d["date"] == today.isoformat()), None) or {
        "date": today.isoformat(), **svc.classify_day([], False), "sessions": []}
    return {"today": today_row, "days": days, "rate_pct": svc.attendance_rate(days),
            "rules": {"full_day_hours": s.full_day_hours, "half_day_hours": s.half_day_hours, "timezone": cohort.timezone}}


@router.post("/attendance/punch-in")
def punch_in(body: PunchIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    e = svc.require_enrollment(db, user.id)
    svc.auto_close_sessions(db)
    if db.scalar(select(AttendanceSession.id).where(AttendanceSession.mentee_id == user.id,
                                                   AttendanceSession.punch_out_at.is_(None))):
        raise HTTPException(409, "You're already punched in.")
    today = _today(db, e)
    db.add(AttendanceSession(mentee_id=user.id, cohort_id=e.cohort_id, work_date=today, punch_in_at=utcnow(),
                             note=body.note))
    db.commit()
    return _attendance_payload(db, e, today, today)


@router.post("/attendance/punch-out")
def punch_out(body: PunchIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    e = svc.require_enrollment(db, user.id)
    sess = db.scalar(select(AttendanceSession).where(AttendanceSession.mentee_id == user.id,
                                                    AttendanceSession.punch_out_at.is_(None)))
    if sess is None:
        raise HTTPException(409, "You're not punched in.")
    sess.punch_out_at = utcnow()
    if body.note:
        sess.note = ((sess.note or "") + "\n" + body.note).strip()
    db.commit()
    return _attendance_payload(db, e, sess.work_date, sess.work_date)


@router.get("/attendance/me")
def my_attendance(start: date | None = None, end: date | None = None, db: Session = Depends(get_db),
                  user: User = Depends(candidate_only)):
    e = svc.require_enrollment(db, user.id)
    today = _today(db, e)
    end = min(end or today, today)
    start = max(start or end.replace(day=1), e.started_on)
    return _attendance_payload(db, e, start, end) if start <= end else _attendance_payload(db, e, today, today)


@router.get("/attendance/mentees")
def mentees_attendance(on: date | None = None, db: Session = Depends(get_db), user: User = Depends(staff)):
    rows = []
    q = select(InternshipEnrollment).where(InternshipEnrollment.status == "Active")
    if user.role == Role.mentor:
        q = q.where(InternshipEnrollment.mentor_id == user.id)
    for e in db.scalars(q):
        day = on or _today(db, e)
        d = (svc.attendance_days(db, e.mentee_id, day, day) or [{"date": day.isoformat(), **svc.classify_day([], False),
                                                                 "sessions": []}])[0]
        u = db.get(User, e.mentee_id)
        rows.append({"mentee_id": str(u.id), "name": u.name, **d})
    return rows


@router.get("/attendance/mentees/{mentee_id}")
def mentee_attendance(mentee_id: uuid.UUID, start: date | None = None, end: date | None = None,
                      db: Session = Depends(get_db), user: User = Depends(staff)):
    e = svc.require_access_to_mentee(db, user, mentee_id)
    today = _today(db, e)
    end = min(end or today, today)
    start = max(start or end.replace(day=1), e.started_on)
    return _attendance_payload(db, e, start, end) if start <= end else _attendance_payload(db, e, today, today)


@router.post("/attendance/sessions/{session_id}/correct")
def correct_session(session_id: uuid.UUID, body: CorrectIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    sess = db.get(AttendanceSession, session_id)
    if sess is None:
        raise HTTPException(404, "Session not found")
    e = svc.require_access_to_mentee(db, user, sess.mentee_id)
    pin = body.punch_in_at or sess.punch_in_at
    if body.punch_out_at <= pin:
        raise HTTPException(422, "Punch-out must be after punch-in")
    if body.punch_out_at - pin > timedelta(hours=16):
        raise HTTPException(422, "A single session can't be longer than 16 hours")
    sess.punch_in_at, sess.punch_out_at = pin, body.punch_out_at
    sess.auto_closed = False
    sess.corrected_by = user.id
    sess.correction_note = body.note
    db.commit()
    payload = _attendance_payload(db, e, sess.work_date, sess.work_date)
    return {**payload, "day": payload["days"][0] if payload["days"] else None}


@router.post("/leave", status_code=201)
def request_leave(body: LeaveIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    e = svc.require_enrollment(db, user.id)
    if body.end_date < body.start_date:
        raise HTTPException(422, "End date can't be before the start date")
    lr = LeaveRequest(mentee_id=user.id, mentor_id=e.mentor_id, start_date=body.start_date, end_date=body.end_date,
                      reason=body.reason.strip())
    db.add(lr)
    db.commit()
    return _leave_out(db, lr)


def _leave_out(db: Session, lr: LeaveRequest) -> dict[str, Any]:
    u = db.get(User, lr.mentee_id)
    return {"id": str(lr.id), "mentee_id": str(lr.mentee_id), "mentee_name": u.name if u else "",
            "mentor_id": str(lr.mentor_id), "start_date": _iso(lr.start_date), "end_date": _iso(lr.end_date),
            "reason": lr.reason, "status": lr.status, "submitted_at": _iso(lr.created_at),
            "decided_at": _iso(lr.decided_at)}


@router.get("/leave")
def list_leave(db: Session = Depends(get_db), user: User = Depends(any_user)):
    ids = _visible_mentees(db, user)
    q = select(LeaveRequest).where(LeaveRequest.mentee_id.in_(ids or [uuid.uuid4()])).order_by(LeaveRequest.created_at.desc())
    return [_leave_out(db, lr) for lr in db.scalars(q)]


@router.post("/leave/{leave_id}/decide")
def decide_leave(leave_id: uuid.UUID, body: DecideLeaveIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    lr = db.get(LeaveRequest, leave_id)
    if lr is None:
        raise HTTPException(404, "Leave request not found")
    svc.require_access_to_mentee(db, user, lr.mentee_id)
    if lr.status != "Pending":
        raise HTTPException(409, "This request was already decided")
    lr.status = "Approved" if body.approve else "Rejected"
    lr.decided_at = utcnow()
    db.commit()
    return _leave_out(db, lr)


# ============================================================== Sprint 2: standup & Blocker Co-Pilot


class StandupIn(BaseModel):
    yesterday: str = Field(default="", max_length=2000)
    today: str = Field(default="", max_length=2000)
    blockers: str = Field(default="", max_length=2000)
    task_id: uuid.UUID | None = None


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=4000)
    task_id: uuid.UUID | None = None


def _standup_out(db: Session, s: StandupEntry) -> dict[str, Any]:
    u = db.get(User, s.mentee_id)
    task = db.get(InternTask, s.task_id) if s.task_id else None
    return {"id": str(s.id), "mentee_id": str(s.mentee_id), "mentee_name": u.name if u else "",
            "date": _iso(s.entry_date), "yesterday": s.yesterday, "today": s.today, "blockers": s.blockers,
            "task_id": str(s.task_id) if s.task_id else None, "task_title": task.title if task else None,
            "created_at": _iso(s.created_at)}


def _blocker_out(db: Session, b: BlockerQuestion) -> dict[str, Any]:
    u = db.get(User, b.mentee_id)
    return {"id": str(b.id), "mentee_id": str(b.mentee_id), "mentee_name": u.name if u else "",
            "task_id": str(b.task_id) if b.task_id else None, "question": b.question, "answer": b.answer,
            "citations": b.citations, "escalated": b.escalated, "created_at": _iso(b.created_at)}


@router.get("/standup/today")
def standup_today(db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    e = svc.require_enrollment(db, user.id)
    today = _today(db, e)
    entry = db.scalar(select(StandupEntry).where(StandupEntry.mentee_id == user.id, StandupEntry.entry_date == today))
    prev = db.scalar(select(StandupEntry).where(StandupEntry.mentee_id == user.id, StandupEntry.entry_date < today)
                     .order_by(StandupEntry.entry_date.desc()))
    current = db.scalar(select(InternTask).where(InternTask.mentee_id == user.id,
                                                 InternTask.status == TaskStatus.in_progress)
                        .order_by(InternTask.last_activity_at.desc()))
    return {"entry": _standup_out(db, entry) if entry else None,
            "suggested": {"yesterday": prev.today if prev else "",
                          "task_id": str(current.id) if current else None,
                          "task_title": current.title if current else None}}


@router.post("/standup")
def submit_standup(body: StandupIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    e = svc.require_enrollment(db, user.id)
    today = _today(db, e)
    if body.task_id:
        _task_for(db, user, body.task_id).last_activity_at = utcnow()
    entry = db.scalar(select(StandupEntry).where(StandupEntry.mentee_id == user.id, StandupEntry.entry_date == today))
    if entry is None:
        entry = StandupEntry(mentee_id=user.id, entry_date=today)
        db.add(entry)
    entry.yesterday, entry.today, entry.blockers = body.yesterday.strip(), body.today.strip(), body.blockers.strip()
    entry.task_id = body.task_id
    db.flush()
    answer = None
    if entry.blockers:
        answer = _blocker_out(db, agents.ask_blocker(db, user, entry.blockers, body.task_id))
    db.commit()
    return {"entry": _standup_out(db, entry), "copilot": answer}


@router.get("/standups")
def list_standups(on: date | None = None, mentee_id: uuid.UUID | None = None, db: Session = Depends(get_db),
                  user: User = Depends(staff)):
    ids = _visible_mentees(db, user)
    if mentee_id:
        ids = [i for i in ids if i == mentee_id]
    q = select(StandupEntry).where(StandupEntry.mentee_id.in_(ids or [uuid.uuid4()]))
    if on:
        q = q.where(StandupEntry.entry_date == on)
    return [_standup_out(db, s) for s in db.scalars(q.order_by(StandupEntry.entry_date.desc()).limit(200))]


@router.post("/blocker/ask")
def blocker_ask(body: AskIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    svc.require_enrollment(db, user.id)
    if body.task_id:
        _task_for(db, user, body.task_id)
    bq = agents.ask_blocker(db, user, body.question, body.task_id)
    db.commit()
    return _blocker_out(db, bq)


@router.get("/blocker/history")
def blocker_history(mentee_id: uuid.UUID | None = None, db: Session = Depends(get_db), user: User = Depends(any_user)):
    ids = _visible_mentees(db, user)
    if mentee_id:
        ids = [i for i in ids if i == mentee_id]
    q = select(BlockerQuestion).where(BlockerQuestion.mentee_id.in_(ids or [uuid.uuid4()]))
    return [_blocker_out(db, b) for b in db.scalars(q.order_by(BlockerQuestion.created_at.desc()).limit(100))]


@router.get("/stall-alerts")
def list_stall_alerts(open_only: bool = True, db: Session = Depends(get_db), user: User = Depends(staff)):
    q = select(StallAlert).order_by(StallAlert.created_at.desc())
    if user.role == Role.mentor:
        q = q.where(StallAlert.mentor_id == user.id)
    if open_only:
        q = q.where(StallAlert.acknowledged_at.is_(None))
    out = []
    for a in db.scalars(q.limit(200)):
        u, t = db.get(User, a.mentee_id), db.get(InternTask, a.task_id) if a.task_id else None
        out.append({"id": str(a.id), "mentee_id": str(a.mentee_id), "mentee_name": u.name if u else "",
                    "task_id": str(a.task_id) if a.task_id else None, "task_title": t.title if t else None,
                    "source": a.source, "reason": a.reason, "created_at": _iso(a.created_at),
                    "acknowledged_at": _iso(a.acknowledged_at)})
    return out


@router.post("/stall-alerts/{alert_id}/ack")
def ack_stall(alert_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    a = db.get(StallAlert, alert_id)
    if a is None or (user.role == Role.mentor and a.mentor_id != user.id):
        raise HTTPException(404, "Alert not found")
    a.acknowledged_at = utcnow()
    db.commit()
    return {"id": str(a.id), "acknowledged_at": _iso(a.acknowledged_at)}


@router.post("/stall/scan")
def run_stall_scan(db: Session = Depends(get_db), user: User = Depends(staff)):
    from app.jobs.internship import stall_scan

    n = stall_scan(db)
    db.commit()
    return {"created": n}


# ============================================================== mentor approval inbox (all agents)


class DecisionIn(BaseModel):
    action: Literal["approve", "reject"]
    content: dict[str, Any] | None = None
    note: str | None = Field(default=None, max_length=2000)


def _draft_for(db: Session, user: User, draft_id: uuid.UUID) -> AgentDraft:
    d = db.get(AgentDraft, draft_id)
    if d is None or (user.role == Role.mentor and d.mentor_id != user.id):
        raise HTTPException(404, "Draft not found")
    return d


@router.get("/approvals")
def list_approvals(status: str = "pending", agent: str | None = None, db: Session = Depends(get_db),
                   user: User = Depends(staff)):
    q = select(AgentDraft).order_by(AgentDraft.created_at.desc())
    if user.role == Role.mentor:
        q = q.where(AgentDraft.mentor_id == user.id)
    if status != "all":
        q = q.where(AgentDraft.status == status)
    if agent:
        q = q.where(AgentDraft.agent == agent)
    return [draft_out(db, d) for d in db.scalars(q.limit(200))]


@router.get("/approvals/{draft_id}")
def get_approval(draft_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(staff)):
    d = _draft_for(db, user, draft_id)
    out = draft_out(db, d)
    if d.agent == "code_review":
        sub = db.get(TaskSubmission, uuid.UUID(d.subject_id))
        out["submission"] = submission_out(db, sub, user)
        out["task"] = task_out(db, db.get(InternTask, sub.task_id))
    return out


def _validate_edit(d: AgentDraft, content: dict[str, Any]) -> dict[str, Any]:
    try:
        if d.agent == "code_review":
            jsonschema.validate(content, agents.REVIEW_SCHEMA)
        elif d.agent == "weekly_quiz":
            content = {**content, "questions": agents.validate_quiz_questions(
                content.get("questions") or [], d.content.get("allowed_skills") or ["General Engineering"])}
            if not content["questions"]:
                raise ValueError("Keep at least one question")
        elif d.agent == "appraisal":
            jsonschema.validate({k: v for k, v in content.items() if k != "metrics"}, agents.APPRAISAL_SCHEMA)
    except jsonschema.ValidationError as exc:
        raise HTTPException(422, f"Edited content is not valid: {exc.message}") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return content


@router.post("/approvals/{draft_id}/decide")
def decide(draft_id: uuid.UUID, body: DecisionIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    d = _draft_for(db, user, draft_id)
    if d.status != DraftStatus.pending:
        raise HTTPException(409, "This draft was already decided")
    decision: dict[str, Any] = {"action": body.action, "note": body.note, "edited": False}
    if body.action == "approve" and body.content is not None:
        content = _validate_edit(d, body.content)
        decision["content"] = content
        decision["edited"] = content != d.content
    agents.decide_draft(db, d, decision, user.id)
    db.commit()
    return draft_out(db, d)


# ============================================================== Sprint 4: weekly quizzes & skills


class GenerateQuizIn(BaseModel):
    mentee_id: uuid.UUID
    week_number: int | None = Field(default=None, ge=1, le=12)


class AnswersIn(BaseModel):
    answers: dict[str, str]


@router.post("/weekly-quizzes/generate")
def generate_quiz(body: GenerateQuizIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    e = svc.require_access_to_mentee(db, user, body.mentee_id)
    week = body.week_number or svc.week_number(e, _today(db, e))
    quiz = agents.start_weekly_quiz(db, e, week, triggered_by=f"user:{user.id}")
    db.commit()
    return quiz_out(quiz, user, db.get(User, quiz.mentee_id).name)


@router.get("/weekly-quizzes")
def list_quizzes(mentee_id: uuid.UUID | None = None, db: Session = Depends(get_db), user: User = Depends(any_user)):
    ids = _visible_mentees(db, user)
    if mentee_id:
        ids = [i for i in ids if i == mentee_id]
    q = select(WeeklyQuiz).where(WeeklyQuiz.mentee_id.in_(ids or [uuid.uuid4()]))
    if user.role == Role.candidate:
        q = q.where(WeeklyQuiz.status.in_(["available", "submitted"]))
    names = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(ids or [uuid.uuid4()])))}
    return [quiz_out(x, user, names.get(x.mentee_id, "")) for x in db.scalars(q.order_by(WeeklyQuiz.week_number.desc()))]


@router.get("/weekly-quizzes/{quiz_id}")
def get_quiz(quiz_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(any_user)):
    q = db.get(WeeklyQuiz, quiz_id)
    if q is None or q.mentee_id not in _visible_mentees(db, user):
        raise HTTPException(404, "Quiz not found")
    if user.role == Role.candidate and q.status not in ("available", "submitted"):
        raise HTTPException(404, "Quiz not found")
    return quiz_out(q, user, db.get(User, q.mentee_id).name)


@router.post("/weekly-quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: uuid.UUID, body: AnswersIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    q = db.get(WeeklyQuiz, quiz_id)
    if q is None or q.mentee_id != user.id or q.status not in ("available", "submitted"):
        raise HTTPException(404, "Quiz not found")
    if q.status == "submitted":
        raise HTTPException(409, "You already submitted this quiz")
    results = svc.score_quiz(q.questions, body.answers)
    q.answers = {k: v.upper() for k, v in body.answers.items()}
    q.results = results
    q.score_pct = results["score_pct"]
    q.status = "submitted"
    q.submitted_at = utcnow()
    svc.update_skill_scores(db, user.id, results["skills"])
    db.commit()
    return quiz_out(q, user, user.name)


@router.get("/skills")
def get_skills(mentee_id: uuid.UUID | None = None, db: Session = Depends(get_db), user: User = Depends(any_user)):
    target = mentee_id or user.id
    if target not in _visible_mentees(db, user):
        raise HTTPException(404, "Intern not found")
    return {"mentee_id": str(target), "skills": svc.skills_for(db, target),
            "min_questions_per_skill": get_settings().min_questions_per_skill}


# ============================================================== Sprint 5: 30/60/90 appraisals


class GenerateAppraisalIn(BaseModel):
    mentee_id: uuid.UUID
    milestone_day: Literal[30, 60, 90]


class AckIn(BaseModel):
    comment: str = Field(default="", max_length=4000)


@router.post("/appraisals/generate")
def generate_appraisal(body: GenerateAppraisalIn, db: Session = Depends(get_db), user: User = Depends(staff)):
    e = svc.require_access_to_mentee(db, user, body.mentee_id)
    ap = agents.start_appraisal(db, e, body.milestone_day, triggered_by=f"user:{user.id}")
    db.commit()
    return appraisal_out(db, ap, user)


@router.get("/appraisals")
def list_appraisals(mentee_id: uuid.UUID | None = None, db: Session = Depends(get_db), user: User = Depends(any_user)):
    ids = _visible_mentees(db, user)
    if mentee_id:
        ids = [i for i in ids if i == mentee_id]
    q = select(Appraisal).where(Appraisal.mentee_id.in_(ids or [uuid.uuid4()]))
    if user.role == Role.candidate:
        q = q.where(Appraisal.status.in_(["published", "acknowledged"]))
    return [appraisal_out(db, a, user) for a in db.scalars(q.order_by(Appraisal.milestone_day))]


@router.post("/appraisals/{appraisal_id}/acknowledge")
def acknowledge_appraisal(appraisal_id: uuid.UUID, body: AckIn, db: Session = Depends(get_db),
                          user: User = Depends(candidate_only)):
    a = db.get(Appraisal, appraisal_id)
    if a is None or a.mentee_id != user.id or a.status not in ("published", "acknowledged"):
        raise HTTPException(404, "Appraisal not found")
    if a.status == "acknowledged":
        raise HTTPException(409, "You already acknowledged this review")
    a.status = "acknowledged"
    a.acknowledged_at = utcnow()
    a.mentee_comment = body.comment.strip() or None
    db.commit()
    return appraisal_out(db, a, user)


# ============================================================== overview (mentor hub / admin dashboard)


@router.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(staff)):
    enr_q = select(InternshipEnrollment).where(InternshipEnrollment.status == "Active")
    if user.role == Role.mentor:
        enr_q = enr_q.where(InternshipEnrollment.mentor_id == user.id)
    enrs = list(db.scalars(enr_q))
    ids = [e.mentee_id for e in enrs] or [uuid.uuid4()]
    online = 0
    for e in enrs:
        day = _today(db, e)
        rows = svc.attendance_days(db, e.mentee_id, day, day)
        online += bool(rows and rows[0]["open"])
    drafts = select(func.count(AgentDraft.id)).where(AgentDraft.status == DraftStatus.pending)
    alerts = select(func.count(StallAlert.id)).where(StallAlert.acknowledged_at.is_(None))
    if user.role == Role.mentor:
        drafts = drafts.where(AgentDraft.mentor_id == user.id)
        alerts = alerts.where(StallAlert.mentor_id == user.id)
    return {
        "active_interns": len(enrs),
        "online_now": online,
        "pending_approvals": db.scalar(drafts) or 0,
        "open_stall_alerts": db.scalar(alerts) or 0,
        "tasks_in_review": db.scalar(select(func.count(InternTask.id)).where(
            InternTask.mentee_id.in_(ids), InternTask.status == TaskStatus.review)) or 0,
        "pending_leave": db.scalar(select(func.count(LeaveRequest.id)).where(
            LeaveRequest.mentee_id.in_(ids), LeaveRequest.status == "Pending")) or 0,
        "cohorts": db.scalar(select(func.count(InternshipCohort.id))) or 0,
    }
