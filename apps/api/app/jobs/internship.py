"""Scheduled internship jobs (run every INTERNSHIP_SCHEDULER_INTERVAL_S by the API process).

1. Close attendance sessions left open past the end of their day (marked 'needs correction').
2. Stall scan: in-progress task + intern punched in + no activity for STALL_HOURS -> one mentor alert.
3. Fridays (cohort time zone): draft the week's quiz for each active intern (mentor approves before release).
4. Day 30/60/90: draft the milestone appraisal (mentor approves before the intern sees it).
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import (
    Appraisal,
    AttendanceSession,
    InternshipCohort,
    InternshipEnrollment,
    InternTask,
    StallAlert,
    TaskStatus,
    WeeklyQuiz,
)
from app.models.base import utcnow
from app.services import internship as svc

log = logging.getLogger(__name__)


def stall_scan(db: Session, now: datetime | None = None) -> int:
    now = now or utcnow()
    limit = timedelta(hours=get_settings().stall_hours)
    created = 0
    tasks = db.scalars(select(InternTask).where(InternTask.status == TaskStatus.in_progress))
    for t in tasks:
        if now - t.last_activity_at < limit:
            continue
        punched_in = db.scalar(select(AttendanceSession.id).where(
            AttendanceSession.mentee_id == t.mentee_id, AttendanceSession.punch_out_at.is_(None)).limit(1))
        if not punched_in:
            continue
        recent = db.scalar(select(StallAlert.id).where(
            StallAlert.task_id == t.id, StallAlert.created_at >= now - limit).limit(1))
        if recent:
            continue
        hours = int((now - t.last_activity_at).total_seconds() // 3600)
        db.add(StallAlert(mentee_id=t.mentee_id, mentor_id=t.mentor_id, task_id=t.id, source="auto",
                          reason=f"No updates on '{t.title}' for about {hours} hours while punched in."))
        created += 1
    return created


def run_internship_jobs(db: Session, now: datetime | None = None) -> dict[str, int]:
    from app.agent.internship import agents

    now = now or utcnow()
    out = {"auto_closed": svc.auto_close_sessions(db, now), "stall_alerts": stall_scan(db, now),
           "quizzes": 0, "appraisals": 0}
    db.commit()
    for e in list(db.scalars(select(InternshipEnrollment).where(InternshipEnrollment.status == "Active"))):
        cohort = db.get(InternshipCohort, e.cohort_id)
        today = svc.local_today(svc.cohort_tz(cohort), now)
        if today < e.started_on:
            continue
        try:
            if today.weekday() == 4:  # Friday
                week = svc.week_number(e, today)
                exists = db.scalar(select(WeeklyQuiz.id).where(WeeklyQuiz.mentee_id == e.mentee_id,
                                                               WeeklyQuiz.cohort_id == e.cohort_id,
                                                               WeeklyQuiz.week_number == week))
                if not exists:
                    agents.start_weekly_quiz(db, e, week, triggered_by="scheduler")
                    out["quizzes"] += 1
            for day in agents.due_milestones(e, today):
                exists = db.scalar(select(Appraisal.id).where(Appraisal.mentee_id == e.mentee_id,
                                                              Appraisal.cohort_id == e.cohort_id,
                                                              Appraisal.milestone_day == day))
                if not exists:
                    agents.start_appraisal(db, e, day, triggered_by="scheduler")
                    out["appraisals"] += 1
            db.commit()
        except Exception:  # one intern's failure must not stop the others
            db.rollback()
            log.exception("internship job failed for enrolment %s", e.id)
    return out
