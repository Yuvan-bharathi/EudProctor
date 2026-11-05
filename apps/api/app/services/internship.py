"""Deterministic internship logic: access, calendar, attendance, code checks, quiz scoring, skills, metrics.

Nothing here calls an LLM (platform rule 7: scores, statuses and classifications are code with unit tests).
"""

import base64
import hashlib
import re
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    AttendanceSession,
    InternshipCohort,
    InternshipEnrollment,
    InternTask,
    LeaveRequest,
    Role,
    SkillScore,
    TaskStatus,
    User,
)
from app.models.base import utcnow

# ============================================================== access


def active_enrollment(db: Session, mentee_id: uuid.UUID) -> InternshipEnrollment | None:
    return db.scalar(
        select(InternshipEnrollment)
        .where(InternshipEnrollment.mentee_id == mentee_id, InternshipEnrollment.status == "Active")
        .order_by(InternshipEnrollment.created_at.desc())
    )


def require_enrollment(db: Session, mentee_id: uuid.UUID) -> InternshipEnrollment:
    e = active_enrollment(db, mentee_id)
    if e is None:
        raise HTTPException(404, "You are not enrolled in an active internship cohort.")
    return e


def mentee_ids_for(db: Session, user: User) -> list[uuid.UUID]:
    """Mentees the user may see: admin = all, mentor = own, candidate = self."""
    if user.role == Role.candidate:
        return [user.id]
    q = select(InternshipEnrollment.mentee_id)
    if user.role == Role.mentor:
        q = q.where(InternshipEnrollment.mentor_id == user.id)
    return list(db.scalars(q))


def require_access_to_mentee(db: Session, user: User, mentee_id: uuid.UUID) -> InternshipEnrollment:
    e = active_enrollment(db, mentee_id) or db.scalar(
        select(InternshipEnrollment).where(InternshipEnrollment.mentee_id == mentee_id)
    )
    if e is None:
        raise HTTPException(404, "Intern not found")
    if user.role == Role.admin:
        return e
    if user.role == Role.mentor and e.mentor_id == user.id:
        return e
    if user.role == Role.candidate and e.mentee_id == user.id:
        return e
    raise HTTPException(404, "Intern not found")


# ============================================================== calendar


def cohort_tz(cohort: InternshipCohort | None) -> ZoneInfo:
    return ZoneInfo((cohort.timezone if cohort else None) or get_settings().internship_timezone)


def local_today(tz: ZoneInfo, now: datetime | None = None) -> date:
    return (now or utcnow()).astimezone(tz).date()


def week_number(enrollment: InternshipEnrollment, on: date) -> int:
    days = (on - enrollment.started_on).days
    return max(1, min(12, days // 7 + 1))


def month_number(week: int) -> int:
    return max(1, min(3, (week - 1) // 4 + 1))


def day_bounds_utc(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=tz)
    return start.astimezone(UTC), (start + timedelta(days=1)).astimezone(UTC)


# ============================================================== attendance (section 6.9)


def _hours(s: AttendanceSession, now: datetime) -> float:
    if s.auto_closed:
        return 0.0  # forgotten punch-out: excluded until a mentor corrects it
    end = s.punch_out_at or now
    return max(0.0, (end - s.punch_in_at).total_seconds() / 3600)


def classify_day(sessions: list[AttendanceSession], on_leave: bool, now: datetime | None = None) -> dict[str, Any]:
    """Status and hours for one organisation day. Breaks are excluded because only sessions count."""
    s = get_settings()
    now = now or utcnow()
    hours = round(sum(_hours(x, now) for x in sessions), 2)
    open_now = any(x.punch_out_at is None for x in sessions)
    needs_fix = any(x.auto_closed for x in sessions)
    if needs_fix:
        status = "Needs Correction"
    elif open_now:
        status = "In Progress"
    elif hours >= s.full_day_hours:
        status = "Present"
    elif hours >= s.half_day_hours:
        status = "Half Day"
    elif sessions:
        status = "Short"
    elif on_leave:
        status = "Leave"
    else:
        status = "Absent"
    return {
        "status": status,
        "total_hours": hours,
        "overtime_hours": round(max(0.0, hours - s.full_day_hours), 2),
        "open": open_now,
    }


def auto_close_sessions(db: Session, now: datetime | None = None) -> int:
    """Close sessions left open past the end of their organisation day; mark them 'needs correction'."""
    now = now or utcnow()
    n = 0
    for sess in db.scalars(select(AttendanceSession).where(AttendanceSession.punch_out_at.is_(None))):
        cohort = db.get(InternshipCohort, sess.cohort_id)
        tz = cohort_tz(cohort)
        _, day_end = day_bounds_utc(sess.work_date, tz)
        if now >= day_end:
            sess.punch_out_at = day_end
            sess.auto_closed = True
            n += 1
    return n


def approved_leave_days(db: Session, mentee_id: uuid.UUID, start: date, end: date) -> set[date]:
    days: set[date] = set()
    for lr in db.scalars(
        select(LeaveRequest).where(
            LeaveRequest.mentee_id == mentee_id,
            LeaveRequest.status == "Approved",
            LeaveRequest.end_date >= start,
            LeaveRequest.start_date <= end,
        )
    ):
        d = max(lr.start_date, start)
        while d <= min(lr.end_date, end):
            days.add(d)
            d += timedelta(days=1)
    return days


def attendance_days(db: Session, mentee_id: uuid.UUID, start: date, end: date) -> list[dict[str, Any]]:
    """One row per calendar day in [start, end] (weekends included only when worked)."""
    sessions = list(
        db.scalars(
            select(AttendanceSession)
            .where(
                AttendanceSession.mentee_id == mentee_id,
                AttendanceSession.work_date >= start,
                AttendanceSession.work_date <= end,
            )
            .order_by(AttendanceSession.punch_in_at)
        )
    )
    by_day: dict[date, list[AttendanceSession]] = defaultdict(list)
    for x in sessions:
        by_day[x.work_date].append(x)
    leave = approved_leave_days(db, mentee_id, start, end)
    out = []
    d = start
    while d <= end:
        if d.weekday() < 5 or by_day.get(d):
            day = by_day.get(d, [])
            info = classify_day(day, d in leave)
            out.append(
                {
                    "date": d.isoformat(),
                    **info,
                    "sessions": [
                        {
                            "id": str(x.id),
                            "punch_in_at": x.punch_in_at.isoformat(),
                            "punch_out_at": x.punch_out_at.isoformat() if x.punch_out_at else None,
                            "auto_closed": x.auto_closed,
                            "corrected": x.corrected_by is not None,
                            "note": x.note,
                        }
                        for x in day
                    ],
                }
            )
        d += timedelta(days=1)
    return out


def attendance_rate(days: list[dict[str, Any]]) -> float | None:
    """Share of working days that were full days (leave days excluded). None when no working days yet."""
    counted = [d for d in days if d["status"] not in ("Leave", "In Progress")]
    if not counted:
        return None
    full = sum(1 for d in counted if d["status"] == "Present")
    half = sum(1 for d in counted if d["status"] == "Half Day")
    return round((full + 0.5 * half) / len(counted) * 100, 1)


# ============================================================== submitted code (policy 6.8)


def _code_fernet() -> Fernet:
    key = hashlib.sha256(f"submission-code:{get_settings().jwt_secret}".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_code(code: str) -> str:
    return _code_fernet().encrypt(code.encode()).decode()


def decrypt_code(token: str | None) -> str | None:
    if not token:
        return None
    try:
        return _code_fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None


SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    ("Anthropic/OpenAI key", re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_\-]{20,}\b")),
    ("JWT", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
    ("Credentials in a connection string", re.compile(r"[a-zA-Z][a-zA-Z0-9+.-]*://[^\s:/@]+:[^\s@/]{3,}@[^\s]+")),
    (
        "Hard-coded secret",
        re.compile(
            r"(?i)\b(?:api[_-]?key|secret|token|passwd|password|pwd|access[_-]?key)\b\s*[:=]\s*['\"][^'\"\s]{8,}['\"]"
        ),
    ),
]


def scan_secrets(code: str, filename: str | None = None) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    if filename and (filename.lower().endswith(".env") or filename.lower().startswith(".env")):
        hits.append({"line": 0, "kind": ".env file", "message": ".env files must never be submitted."})
    for i, line in enumerate(code.splitlines(), start=1):
        for kind, pat in SECRET_PATTERNS:
            if pat.search(line):
                hits.append({"line": i, "kind": kind, "message": f"Possible {kind.lower()} on line {i}."})
                break
    return hits


_RULES: list[tuple[str, str, re.Pattern[str], str]] = [
    (
        "sql-concat",
        "high",
        re.compile(
            r"(execute|query|raw)\s*\(\s*f?['\"].*\b(select|insert|update|delete)\b.*['\"]\s*(\+|%|\.format)"
            r"|\bf['\"]\s*(select|insert|update|delete)\b.*\{",
            re.IGNORECASE,
        ),
        "SQL built from string pieces: risk of SQL injection; use parameters.",
    ),
    ("eval", "high", re.compile(r"\beval\s*\("), "eval() runs arbitrary code."),
    ("bare-except", "medium", re.compile(r"^\s*except\s*:\s*$"), "Bare except hides real errors."),
    ("empty-catch", "medium", re.compile(r"catch\s*\([^)]*\)\s*\{\s*\}"), "Empty catch block swallows errors."),
    ("debug-print", "low", re.compile(r"^\s*(print\s*\(|console\.log\s*\()"), "Debug output left in code."),
    ("todo", "low", re.compile(r"(?i)\b(TODO|FIXME|HACK)\b"), "Unfinished work marker."),
    ("long-line", "low", re.compile(r"^.{121,}$"), "Line longer than 120 characters."),
]


def static_checks(code: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    lines = code.splitlines()
    for i, line in enumerate(lines, start=1):
        for rule, severity, pat, msg in _RULES:
            if pat.search(line):
                findings.append({"line": i, "rule": rule, "severity": severity, "message": msg})
    counts = {sev: sum(1 for f in findings if f["severity"] == sev) for sev in ("high", "medium", "low")}
    metrics = {
        "lines": len(lines),
        "non_empty_lines": sum(1 for ln in lines if ln.strip()),
        "findings_total": len(findings),
        **{f"findings_{k}": v for k, v in counts.items()},
    }
    return findings[:60], metrics


# ============================================================== weekly quiz scoring & skills (6.3)


def score_quiz(questions: list[dict[str, Any]], answers: dict[str, str]) -> dict[str, Any]:
    per_skill: dict[str, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})
    misconception_hits: dict[str, int] = defaultdict(int)
    detail = []
    correct_n = 0
    for q in questions:
        chosen = (answers.get(q["id"]) or "").upper()
        ok = chosen == q["correct_key"]
        correct_n += ok
        per_skill[q["skill"]]["total"] += 1
        per_skill[q["skill"]]["correct"] += ok
        if not ok and chosen:
            for o in q["options"]:
                if o["key"] == chosen and o.get("misconception"):
                    misconception_hits[o["misconception"]] += 1
        detail.append(
            {"id": q["id"], "chosen": chosen or None, "correct_key": q["correct_key"], "correct": ok,
             "explanation": q.get("explanation", "")}
        )
    total = len(questions) or 1
    s = get_settings()
    skills = []
    for skill, v in per_skill.items():
        pct = round(v["correct"] / v["total"] * 100, 1)
        skills.append({"skill": skill, "correct": v["correct"], "total": v["total"], "score_pct": pct})
    return {
        "score_pct": round(correct_n / total * 100, 1),
        "correct": correct_n,
        "total": len(questions),
        "skills": skills,
        # same rule as assessments: the same misconception chosen 2+ times
        "misconceptions": [m for m, n in misconception_hits.items() if n >= 2],
        "detail": detail,
        "min_questions_per_skill": s.min_questions_per_skill,
    }


def update_skill_scores(db: Session, mentee_id: uuid.UUID, skills: list[dict[str, Any]]) -> None:
    """Question-weighted running average per skill. Only skills present in this quiz change."""
    for item in skills:
        row = db.scalar(select(SkillScore).where(SkillScore.mentee_id == mentee_id, SkillScore.skill == item["skill"]))
        if row is None:
            row = SkillScore(mentee_id=mentee_id, skill=item["skill"], score_pct=0.0, n_questions=0)
            db.add(row)
        n_old, n_new = row.n_questions, item["total"]
        row.score_pct = round((row.score_pct * n_old + item["score_pct"] * n_new) / (n_old + n_new), 1)
        row.n_questions = n_old + n_new
        row.updated_at = utcnow()


def skill_level(score_pct: float, n_questions: int) -> int | None:
    """1..5 for the radar chart; None = insufficient data (fewer than min_questions_per_skill)."""
    if n_questions < get_settings().min_questions_per_skill:
        return None
    return max(1, min(5, int(score_pct // 20) + 1))


def skills_for(db: Session, mentee_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = db.scalars(select(SkillScore).where(SkillScore.mentee_id == mentee_id).order_by(SkillScore.skill))
    return [
        {
            "skill": r.skill,
            "score_pct": r.score_pct,
            "n_questions": r.n_questions,
            "level": skill_level(r.score_pct, r.n_questions),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


# ============================================================== appraisal metrics (deterministic)

DEFAULT_WEIGHTS = {"mcq": 0.25, "coding": 0.30, "comm": 0.20, "tasks": 0.20, "attendance": 0.05}


def appraisal_metrics(db: Session, enrollment: InternshipEnrollment, milestone_day: int) -> dict[str, Any]:
    from app.models import BlockerQuestion, CodeReview, StallAlert, TaskSubmission, WeeklyQuiz

    start = enrollment.started_on
    end = min(start + timedelta(days=milestone_day - 1), local_today(cohort_tz(db.get(InternshipCohort, enrollment.cohort_id))))
    mentee = enrollment.mentee_id

    days = attendance_days(db, mentee, start, end)
    worked = [d for d in days if d["total_hours"] > 0]
    tasks = list(db.scalars(select(InternTask).where(InternTask.mentee_id == mentee, InternTask.cohort_id == enrollment.cohort_id)))
    done = [t for t in tasks if t.status == TaskStatus.done]
    quizzes = list(
        db.scalars(
            select(WeeklyQuiz).where(
                WeeklyQuiz.mentee_id == mentee, WeeklyQuiz.cohort_id == enrollment.cohort_id,
                WeeklyQuiz.status == "submitted",
            )
        )
    )
    n_reviews = len(
        list(
            db.scalars(
                select(CodeReview.id)
                .join(TaskSubmission, TaskSubmission.id == CodeReview.submission_id)
                .where(TaskSubmission.mentee_id == mentee, CodeReview.status == "published")
            )
        )
    )
    blockers = len(list(db.scalars(select(BlockerQuestion.id).where(BlockerQuestion.mentee_id == mentee))))
    stalls = len(list(db.scalars(select(StallAlert.id).where(StallAlert.mentee_id == mentee))))

    att = attendance_rate(days)
    tasks_pct = round(len(done) / len(tasks) * 100, 1) if tasks else None
    mcq = round(sum(q.score_pct or 0 for q in quizzes) / len(quizzes), 1) if quizzes else None
    components = {"mcq": mcq, "tasks": tasks_pct, "attendance": att, "coding": None, "comm": None}
    available = {k: v for k, v in components.items() if v is not None}
    if available:
        wsum = sum(DEFAULT_WEIGHTS[k] for k in available)
        composite = round(sum(DEFAULT_WEIGHTS[k] * v for k, v in available.items()) / wsum, 1)
    else:
        composite = None
    return {
        "window": {"start": start.isoformat(), "end": end.isoformat(), "milestone_day": milestone_day},
        "attendance": {
            "rate_pct": att,
            "days_worked": len(worked),
            "avg_hours_on_worked_days": round(sum(d["total_hours"] for d in worked) / len(worked), 2) if worked else 0,
            "needs_correction_days": sum(1 for d in days if d["status"] == "Needs Correction"),
        },
        "tasks": {"assigned": len(tasks), "done": len(done), "done_pct": tasks_pct,
                  "in_review": sum(1 for t in tasks if t.status == TaskStatus.review)},
        "quizzes": {"taken": len(quizzes), "avg_score_pct": mcq},
        "code_reviews_published": n_reviews,
        "blocker_questions": blockers,
        "stall_alerts": stalls,
        "skills": skills_for(db, mentee),
        "breakdown": {
            "mcqScorePct": mcq, "codingScorePct": None, "commScorePct": None,
            "tasksScorePct": tasks_pct, "attendanceScorePct": att,
        },
        "composite_score_pct": composite,
        "composite_note": "Weighted over available components only; coding and communication are assessed by the mentor, not computed.",
    }

