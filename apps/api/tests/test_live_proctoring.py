"""Starting from the assessments page, mentor started/completed counts, and the polled live proctoring state."""

import uuid
from datetime import timedelta

from app.models import ExamAssignment, ExamSession, Role, SessionStatus
from app.models.base import utcnow
from tests.conftest import auth, make_user
from tests.factories import build_exam, build_session


def assign(db, exam, candidate):
    db.add(ExamAssignment(exam_id=exam.id, candidate_id=candidate.id))
    db.commit()


def start(client, candidate, exam):
    return client.post("/api/v1/sessions/start", headers=auth(candidate), json={"exam_id": str(exam.id)})


def test_start_from_assessments_page_opens_an_in_progress_session(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor)
    assign(db, exam, candidate)
    res = start(client, candidate, exam)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "in_progress" and body["flag_count"] == 0
    assert len(body["questions"]) == 3 and body["deadline_at"]
    again = start(client, candidate, exam)  # resuming returns the same attempt
    assert again.json()["id"] == body["id"]


def test_start_requires_an_assignment(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor)
    assert start(client, candidate, exam).status_code == 404


def test_start_never_skips_a_pending_identity_review(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor)
    build_session(db, exam, candidate, status=SessionStatus.identity_review)
    assert start(client, candidate, exam).status_code == 409


def test_mentor_sees_started_and_completed_counts(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor)
    other = make_user(db, Role.candidate, email="other@example.com")
    assign(db, exam, candidate)
    assign(db, exam, other)
    sid = start(client, candidate, exam).json()["id"]

    detail = client.get(f"/api/v1/exams/{exam.id}", headers=auth(mentor)).json()
    assert detail["sessions_count"] == 1 and detail["completed_count"] == 0
    statuses = {a["candidate_email"]: a["status"] for a in detail["assignments"]}
    assert statuses[candidate.email] == "In progress" and statuses[other.email] == "Not started"

    client.post(f"/api/v1/sessions/{sid}/submit", headers=auth(candidate))
    listed = next(e for e in client.get("/api/v1/exams", headers=auth(mentor)).json() if e["id"] == str(exam.id))
    assert listed["sessions_count"] == 1 and listed["completed_count"] == 1


def test_live_rows_carry_ongoing_look_away_and_recent_alerts(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor, duration_min=60)
    sess = build_session(db, exam, candidate)
    sess.started_at = utcnow() - timedelta(minutes=5)
    db.commit()

    def ev(kind, seconds, offset_s, **extra):
        started = sess.started_at + timedelta(seconds=offset_s)
        return {
            "client_event_id": uuid.uuid4().hex,
            "type": kind,
            "started_at": started.isoformat(),
            "duration_ms": round(seconds * 1000),
            **extra,
        }

    url = f"/api/v1/sessions/{sess.id}/events"
    progress = ev("LOOK_AWAY_PROGRESS", 1.5, 200, source="head", direction="left")
    client.post(url, headers=auth(candidate), json={"events": [progress]})
    row = client.get(f"/api/v1/mentor/exams/{exam.id}/live", headers=auth(mentor)).json()[0]
    assert row["looking_away"]["direction"] == "left" and row["started_at"]

    finished = ev("LOOK_AWAY", 4, 200, source="head", direction="left")
    tab = ev("TAB_SWITCH", 5, 230)
    res = client.post(url, headers=auth(candidate), json={"events": [finished, tab]})
    assert res.json()["flag_count"] == 2  # look-away flag + tab-switch flag

    row = client.get(f"/api/v1/mentor/exams/{exam.id}/live", headers=auth(mentor)).json()[0]
    assert row["looking_away"] is None
    assert [a["kind"] for a in row["recent_alerts"]] == ["red_flag", "red_flag"]
    assert row["flag_count"] == 2 and row["other_alerts"] == 1
    db.expire_all()
    assert db.get(ExamSession, sess.id).status == SessionStatus.in_progress  # rule 1: proctoring never changes it


def test_tab_switch_raises_capped_red_flags(client, db, mentor, course, candidate):
    from app.core.config import get_settings

    exam = build_exam(db, course, mentor, duration_min=60)
    sess = build_session(db, exam, candidate)
    sess.started_at = utcnow() - timedelta(minutes=10)
    db.commit()
    min_ms = int(get_settings().tab_switch_s * 1000)

    def tab(ms, offset_s):
        started = sess.started_at + timedelta(seconds=offset_s)
        return {"client_event_id": uuid.uuid4().hex, "type": "TAB_SWITCH", "started_at": started.isoformat(), "duration_ms": ms}

    url = f"/api/v1/sessions/{sess.id}/events"
    res = client.post(url, headers=auth(candidate), json={"events": [tab(min_ms - 1, 10)]})
    assert res.json()["flag_count"] == 0  # too short: not stored, no flag
    res = client.post(url, headers=auth(candidate), json={"events": [tab(min_ms + 1000, 20 + i * 20) for i in range(4)]})
    assert res.json() == {"flag_count": 3, "max_flags": 3}  # 4th is logged after the limit

    details = client.get(f"/api/v1/mentor/sessions/{sess.id}/details", headers=auth(mentor)).json()
    kinds = [(i["kind"], i["flag_no"], i["candidate_notified"]) for i in details["timeline"]]
    assert kinds == [("red_flag", 1, True), ("red_flag", 2, True), ("red_flag", 3, True), ("post_limit", None, False)]
    assert details["summary"]["red_flags"] == 3 and details["summary"]["post_limit"] == 1
    db.expire_all()
    assert db.get(ExamSession, sess.id).status == SessionStatus.in_progress  # rule 1: never pauses or submits
