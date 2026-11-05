"""Internship flow, Sprints 0-6: enrolment, tasks, attendance (8-hour rule), the four LangGraph agents with
mentor approval, deterministic scoring, scheduled jobs and role isolation. Runs with the mock LLM."""

import re
import uuid
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import select

from app.agent.internship import infra
from app.core.config import get_settings
from app.models import (
    AgentRun,
    AttendanceSession,
    InternshipEnrollment,
    InternTask,
    Role,
    StallAlert,
    TaskStatus,
    User,
)
from app.models.base import utcnow
from app.services import internship as svc
from app.services import mailer
from tests.conftest import auth, make_user

API = "/api/v1/internship"


@pytest.fixture(autouse=True)
def _mock_llm(monkeypatch):
    monkeypatch.setenv("AGENT_LLM", "mock")
    get_settings.cache_clear()
    infra.reset_checkpointer()
    yield
    get_settings.cache_clear()


@pytest.fixture
def admin(db) -> User:
    return make_user(db, Role.admin)


@pytest.fixture
def cohort(client, admin):
    start = date.today() - timedelta(days=40)
    res = client.post(f"{API}/cohorts", headers=auth(admin), json={
        "name": "MERN Winter", "track": "MERN", "start_date": start.isoformat(),
        "end_date": (start + timedelta(days=90)).isoformat(), "timezone": "UTC"})
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture
def intern(client, db, admin, mentor, cohort):
    mailer.OUTBOX.clear()
    res = client.post(f"{API}/cohorts/{cohort['id']}/mentees", headers=auth(admin),
                      json={"name": "Asha Rao", "email": "asha.intern@example.com", "mentor_id": str(mentor.id)})
    assert res.status_code == 201, res.text
    return db.scalar(select(User).where(User.email == "asha.intern@example.com"))


def _task(client, mentor, intern, **kw):
    body = {"mentee_id": str(intern.id), "title": "Build login API", "skill_area": "Backend APIs",
            "skill_tags": ["Authentication"], "acceptance_criteria": "JWT login works"} | kw
    res = client.post(f"{API}/tasks", headers=auth(mentor), json=body)
    assert res.status_code == 201, res.text
    return res.json()


def _pending(client, mentor, agent):
    rows = client.get(f"{API}/approvals", headers=auth(mentor), params={"agent": agent}).json()
    assert rows, f"no pending {agent} draft"
    return rows[0]


# ---------------------------------------------------------------- Sprint 0


def test_enrolment_emails_unique_credentials_and_caps_mentees(client, db, admin, mentor, cohort, intern):
    mail = mailer.OUTBOX[-1]
    assert mail.to == "asha.intern@example.com"
    username = re.search(r"Username: (\S+)", mail.body).group(1)
    password = re.search(r"Password: (\S+)", mail.body).group(1)
    assert username == "asha.rao"
    assert client.post("/api/v1/auth/login", json={"email": username, "password": password}).status_code == 200

    client.post(f"{API}/cohorts/{cohort['id']}/mentees", headers=auth(admin),
                json={"name": "Second", "email": "second@example.com", "mentor_id": str(mentor.id)})
    third = client.post(f"{API}/cohorts/{cohort['id']}/mentees", headers=auth(admin),
                        json={"name": "Third", "email": "third@example.com", "mentor_id": str(mentor.id)})
    assert third.status_code == 409  # 2 interns per mentor
    # the cap also applies when moving an intern to a full mentor
    other = make_user(db, Role.mentor)
    moved = client.post(f"{API}/cohorts/{cohort['id']}/mentees", headers=auth(admin),
                        json={"name": "Fourth", "email": "fourth@example.com", "mentor_id": str(other.id)}).json()
    assert client.patch(f"{API}/enrollments/{moved['enrollment_id']}", headers=auth(admin),
                        json={"mentor_id": str(mentor.id)}).status_code == 409


def test_role_isolation(client, db, mentor, intern):
    other_mentor = make_user(db, Role.mentor)
    task = _task(client, mentor, intern)
    assert client.get(f"{API}/mentees/{intern.id}", headers=auth(other_mentor)).status_code == 404
    assert client.get(f"{API}/tasks", headers=auth(other_mentor)).json() == []
    assert client.post(f"{API}/tasks", headers=auth(intern), json={"mentee_id": str(intern.id), "title": "x"}).status_code == 403
    assert client.get(f"{API}/approvals", headers=auth(intern)).status_code == 403
    mine = client.get(f"{API}/tasks", headers=auth(intern)).json()
    assert [t["id"] for t in mine] == [task["id"]]


# ---------------------------------------------------------------- Sprint 1: attendance


def _session(db, intern, day, hours, open_=False):
    e = svc.active_enrollment(db, intern.id)
    start = datetime(day.year, day.month, day.day, 9, tzinfo=utcnow().tzinfo)
    db.add(AttendanceSession(mentee_id=intern.id, cohort_id=e.cohort_id, work_date=day, punch_in_at=start,
                             punch_out_at=None if open_ else start + timedelta(hours=hours)))
    db.commit()


def test_attendance_eight_hour_rule_breaks_and_forgotten_punch_out(client, db, mentor, intern):
    base = date.today() - timedelta(days=14)
    monday = base - timedelta(days=base.weekday())
    _session(db, intern, monday, 5)
    _session(db, intern, monday, 3.5)  # two sessions with a break between = 8.5 h
    _session(db, intern, monday + timedelta(days=1), 5)
    _session(db, intern, monday + timedelta(days=2), 1)
    _session(db, intern, monday + timedelta(days=3), 0, open_=True)  # forgot to punch out
    svc.auto_close_sessions(db)
    db.commit()
    res = client.get(f"{API}/attendance/me", headers=auth(intern),
                     params={"start": monday.isoformat(), "end": (monday + timedelta(days=4)).isoformat()}).json()
    status = {d["date"]: d["status"] for d in res["days"]}
    assert status[monday.isoformat()] == "Present"
    assert status[(monday + timedelta(days=1)).isoformat()] == "Half Day"
    assert status[(monday + timedelta(days=2)).isoformat()] == "Short"
    assert status[(monday + timedelta(days=3)).isoformat()] == "Needs Correction"
    assert status[(monday + timedelta(days=4)).isoformat()] == "Absent"
    assert res["rules"]["full_day_hours"] == 8

    fix = db.scalar(select(AttendanceSession).where(AttendanceSession.auto_closed.is_(True)))
    out = client.post(f"{API}/attendance/sessions/{fix.id}/correct", headers=auth(mentor), json={
        "punch_out_at": (fix.punch_in_at + timedelta(hours=8)).isoformat(), "note": "Confirmed with intern"}).json()
    assert out["day"]["status"] == "Present"  # the corrected day, not today


def test_punch_in_out(client, intern):
    assert client.post(f"{API}/attendance/punch-in", headers=auth(intern), json={}).status_code == 200
    assert client.post(f"{API}/attendance/punch-in", headers=auth(intern), json={}).status_code == 409
    out = client.post(f"{API}/attendance/punch-out", headers=auth(intern), json={"note": "done"}).json()
    assert out["today"]["status"] == "Short" and out["today"]["open"] is False


# ---------------------------------------------------------------- Sprint 2: standup & Blocker Co-Pilot


def test_blocker_copilot_answers_from_docs_and_escalates_otherwise(client, db, mentor, intern):
    ok = client.post(f"{API}/blocker/ask", headers=auth(intern),
                     json={"question": "uvicorn says port 8000 already in use, address already bound"}).json()
    assert ok["escalated"] is False
    assert ok["citations"][0]["id"] == "builtin:port-in-use"

    unknown = client.post(f"{API}/blocker/ask", headers=auth(intern),
                          json={"question": "Which colour should the quarterly marketing banner be?"}).json()
    assert unknown["escalated"] is True
    alerts = client.get(f"{API}/stall-alerts", headers=auth(mentor)).json()
    assert any(a["source"] == "blocker_chat" for a in alerts)
    # mentors can read every transcript
    assert len(client.get(f"{API}/blocker/history", headers=auth(mentor)).json()) == 2


def test_standup_with_blocker_triggers_copilot(client, intern):
    res = client.post(f"{API}/standup", headers=auth(intern), json={
        "yesterday": "Set up repo", "today": "Login API", "blockers": "alembic migration conflict, multiple heads"}).json()
    assert res["entry"]["today"] == "Login API"
    assert res["copilot"]["citations"][0]["id"] == "builtin:alembic"


def test_stall_scan_alerts_mentor_once(client, db, mentor, intern):
    task = _task(client, mentor, intern)
    client.post(f"{API}/tasks/{task['id']}/start", headers=auth(intern))
    client.post(f"{API}/attendance/punch-in", headers=auth(intern), json={})
    t = db.get(InternTask, uuid.UUID(task["id"]))
    t.last_activity_at = utcnow() - timedelta(hours=get_settings().stall_hours + 1)
    db.commit()
    assert client.post(f"{API}/stall/scan", headers=auth(mentor)).json()["created"] == 1
    assert client.post(f"{API}/stall/scan", headers=auth(mentor)).json()["created"] == 0
    alert = client.get(f"{API}/stall-alerts", headers=auth(mentor)).json()[0]
    client.post(f"{API}/stall-alerts/{alert['id']}/ack", headers=auth(mentor))
    assert client.get(f"{API}/stall-alerts", headers=auth(mentor)).json() == []


# ---------------------------------------------------------------- Sprint 3: code review


CODE = '''def find_user(cur, name):
    cur.execute("SELECT * FROM users WHERE name = '" + name + "'")
    try:
        return cur.fetchone()
    except:
        print("failed")
'''


def test_code_with_secrets_is_rejected_and_not_stored(client, db, mentor, intern):
    task = _task(client, mentor, intern)
    res = client.post(f"{API}/tasks/{task['id']}/submit", headers=auth(intern),
                      json={"code": 'API_KEY = "sk-ant-abcdefghijklmnopqrstuvwxyz"\n', "ai_consent": True})
    assert res.status_code == 422
    assert client.get(f"{API}/tasks/{task['id']}/submissions", headers=auth(intern)).json() == []


def test_code_review_waits_for_mentor_then_publishes(client, db, mentor, intern):
    task = _task(client, mentor, intern)
    res = client.post(f"{API}/tasks/{task['id']}/submit", headers=auth(intern),
                      json={"code": CODE, "language": "python", "filename": "users.py", "ai_consent": True})
    assert res.status_code == 200, res.text
    assert res.json()["task"]["status"] == "Review"
    # intern sees no AI text before approval
    sub = client.get(f"{API}/tasks/{task['id']}/submissions", headers=auth(intern)).json()[0]
    assert sub["review"] is None and sub["review_status"] == "in_review"

    draft = _pending(client, mentor, "code_review")
    detail = client.get(f"{API}/approvals/{draft['id']}", headers=auth(mentor)).json()
    rules = {f["rule"] for f in detail["submission"]["review"]["findings"]}
    assert {"sql-concat", "bare-except", "debug-print"} <= rules  # deterministic checks
    edited = dict(draft["content"], summary="Mentor-edited summary.")
    out = client.post(f"{API}/approvals/{draft['id']}/decide", headers=auth(mentor),
                      json={"action": "approve", "content": edited}).json()
    assert out["status"] == "approved" and out["edited"] is True

    sub = client.get(f"{API}/tasks/{task['id']}/submissions", headers=auth(intern)).json()[0]
    assert sub["review_status"] == "published"
    assert sub["review"]["review"]["summary"] == "Mentor-edited summary."
    run = db.scalar(select(AgentRun).where(AgentRun.agent == "code_review"))
    assert run.status == "succeeded"
    assert [s.tool for s in run.steps][:4] == ["deterministic_checks", "intern_code_review", "draft_review",
                                               "create_mentor_draft"]


def test_no_ai_review_without_consent(client, mentor, intern):
    task = _task(client, mentor, intern)
    res = client.post(f"{API}/tasks/{task['id']}/submit", headers=auth(intern), json={"code": CODE, "ai_consent": False})
    assert res.json()["submission"]["review_status"] == "not_consented"
    assert client.get(f"{API}/approvals", headers=auth(mentor)).json() == []


def test_approval_survives_lost_checkpoint(client, mentor, intern):
    task = _task(client, mentor, intern)
    client.post(f"{API}/tasks/{task['id']}/submit", headers=auth(intern), json={"code": CODE, "ai_consent": True})
    draft = _pending(client, mentor, "code_review")
    infra.reset_checkpointer()  # e.g. the checkpoint store was wiped
    assert client.post(f"{API}/approvals/{draft['id']}/decide", headers=auth(mentor),
                       json={"action": "approve"}).status_code == 200
    sub = client.get(f"{API}/tasks/{task['id']}/submissions", headers=auth(intern)).json()[0]
    assert sub["review_status"] == "published"


# ---------------------------------------------------------------- Sprint 4: weekly quiz & skills


def test_weekly_quiz_needs_approval_hides_answers_and_updates_skills(client, db, mentor, intern):
    _task(client, mentor, intern, week_number=6)
    quiz = client.post(f"{API}/weekly-quizzes/generate", headers=auth(mentor),
                       json={"mentee_id": str(intern.id), "week_number": 6}).json()
    assert quiz["status"] == "awaiting_mentor"
    assert client.get(f"{API}/weekly-quizzes", headers=auth(intern)).json() == []

    draft = _pending(client, mentor, "weekly_quiz")
    client.post(f"{API}/approvals/{draft['id']}/decide", headers=auth(mentor), json={"action": "approve"})
    mine = client.get(f"{API}/weekly-quizzes/{quiz['id']}", headers=auth(intern)).json()
    assert mine["status"] == "available"
    assert all("correct_key" not in q for q in mine["questions"])

    answers = {q["id"]: "A" for q in mine["questions"]}  # mock key is A
    answers[mine["questions"][0]["id"]] = "B"
    done = client.post(f"{API}/weekly-quizzes/{quiz['id']}/submit", headers=auth(intern), json={"answers": answers}).json()
    n = len(mine["questions"])
    assert done["score_pct"] == round((n - 1) / n * 100, 1)
    assert client.post(f"{API}/weekly-quizzes/{quiz['id']}/submit", headers=auth(intern),
                       json={"answers": answers}).status_code == 409
    skills = {s["skill"]: s for s in client.get(f"{API}/skills", headers=auth(intern)).json()["skills"]}
    assert set(skills) <= {"Backend APIs", "Authentication"}
    assert sum(s["n_questions"] for s in skills.values()) == n


def test_mentor_edit_of_quiz_is_validated(client, mentor, intern):
    _task(client, mentor, intern)
    client.post(f"{API}/weekly-quizzes/generate", headers=auth(mentor), json={"mentee_id": str(intern.id)})
    draft = _pending(client, mentor, "weekly_quiz")
    bad = {"questions": [dict(draft["content"]["questions"][0], correct_key="E")]}
    assert client.post(f"{API}/approvals/{draft['id']}/decide", headers=auth(mentor),
                       json={"action": "approve", "content": bad}).status_code == 422


# ---------------------------------------------------------------- Sprint 5: appraisal


def test_appraisal_is_mentor_approved_before_intern_sees_it(client, mentor, intern):
    ap = client.post(f"{API}/appraisals/generate", headers=auth(mentor),
                     json={"mentee_id": str(intern.id), "milestone_day": 30}).json()
    assert ap["status"] == "awaiting_mentor"
    assert ap["metrics"]["breakdown"]["codingScorePct"] is None  # never computed by AI
    assert client.get(f"{API}/appraisals", headers=auth(intern)).json() == []
    draft = _pending(client, mentor, "appraisal")
    client.post(f"{API}/approvals/{draft['id']}/decide", headers=auth(mentor), json={"action": "approve"})
    mine = client.get(f"{API}/appraisals", headers=auth(intern)).json()
    assert mine[0]["status"] == "published" and mine[0]["content"]["qualitative_summary"]
    assert "mentor_brief" not in mine[0]["content"]  # mentor's private 1:1 note never reaches the intern
    staff_view = client.get(f"{API}/appraisals", headers=auth(mentor)).json()
    assert "mentor_brief" in staff_view[0]["content"]
    ack = client.post(f"{API}/appraisals/{mine[0]['id']}/acknowledge", headers=auth(intern),
                      json={"comment": "Thanks!"}).json()
    assert ack["status"] == "acknowledged"
    assert client.post(f"{API}/appraisals/{mine[0]['id']}/acknowledge", headers=auth(intern),
                       json={"comment": "again"}).status_code == 409


def test_rejected_draft_never_reaches_intern(client, mentor, intern):
    client.post(f"{API}/appraisals/generate", headers=auth(mentor), json={"mentee_id": str(intern.id), "milestone_day": 30})
    draft = _pending(client, mentor, "appraisal")
    client.post(f"{API}/approvals/{draft['id']}/decide", headers=auth(mentor), json={"action": "reject", "note": "redo"})
    assert client.get(f"{API}/appraisals", headers=auth(intern)).json() == []


# ---------------------------------------------------------------- Sprint 6: scheduler


def test_scheduler_drafts_due_milestones(client, db, mentor, intern):
    from app.jobs.internship import run_internship_jobs

    out = run_internship_jobs(db)
    assert out["appraisals"] == 1  # cohort started 40 days ago -> day-30 draft only
    assert len(client.get(f"{API}/approvals", headers=auth(mentor), params={"agent": "appraisal"}).json()) == 1
    again = run_internship_jobs(db)
    assert again["appraisals"] == 0


def test_task_status_flow(client, db, mentor, intern):
    task = _task(client, mentor, intern)
    assert client.post(f"{API}/tasks/{task['id']}/start", headers=auth(intern)).json()["status"] == "In Progress"
    client.post(f"{API}/tasks/{task['id']}/submit", headers=auth(intern), json={"notes": "Done, see PR",
                                                                                 "submission_url": "https://x"})
    done = client.patch(f"{API}/tasks/{task['id']}", headers=auth(mentor),
                        json={"status": "Done", "mentor_feedback": "Nice"}).json()
    assert done["status"] == "Done"
    assert db.get(InternTask, uuid.UUID(task["id"])).status == TaskStatus.done
    assert db.scalar(select(StallAlert)) is None
    assert db.scalar(select(InternshipEnrollment)).mentor_id == mentor.id


def test_copilot_failure_falls_back_to_mentor(client, mentor, intern):
    from app.agent.llm import set_llm_factory

    def broken():
        raise RuntimeError("402 out of credit")

    set_llm_factory(broken)
    try:
        res = client.post(f"{API}/blocker/ask", headers=auth(intern),
                          json={"question": "uvicorn says port 8000 already in use, address already bound"})
    finally:
        set_llm_factory(None)
    assert res.status_code == 200
    assert res.json()["escalated"] is True
    assert any(a["source"] == "blocker_chat" for a in client.get(f"{API}/stall-alerts", headers=auth(mentor)).json())
