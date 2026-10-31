from datetime import timedelta

from sqlalchemy import select

from app.models import Answer, ExamAssignment, Role, SessionStatus
from app.models.base import utcnow
from app.services.sessions import sweep_deadlines
from tests.conftest import auth, make_user
from tests.factories import build_exam, build_session


def _put(client, cand, sess, *answers):
    return client.put(
        f"/api/v1/sessions/{sess.id}/answers",
        headers=auth(cand),
        json={"answers": [dict(a) for a in answers]},
    )


def test_session_hides_answer_key_and_follows_server_deadline(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor, duration_min=20)
    sess = build_session(db, exam, candidate)
    body = client.get(f"/api/v1/sessions/{sess.id}", headers=auth(candidate)).json()
    assert body["status"] == "in_progress"
    assert len(body["questions"]) == 3
    text = str(body)
    for forbidden in ("is_correct", "misconception", "glance", "snapshot", "integrity"):
        assert forbidden not in text
    # reconnect: deadline unchanged, not reset
    again = client.get(f"/api/v1/sessions/{sess.id}", headers=auth(candidate)).json()
    assert again["deadline_at"] == body["deadline_at"]


def test_other_candidate_cannot_read_session(client, db, mentor, course, candidate):
    sess = build_session(db, build_exam(db, course, mentor), candidate)
    other = make_user(db, Role.candidate)
    assert client.get(f"/api/v1/sessions/{sess.id}", headers=auth(other)).status_code == 404


def test_duplicate_autosaves_are_idempotent(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor)
    sess = build_session(db, exam, candidate)
    q1 = sess.question_order[0]
    a1 = {"question_id": q1, "value": {"option_key": "B"}, "client_seq": 1}
    a2 = {"question_id": q1, "value": {"option_key": "A"}, "client_seq": 2}
    assert _put(client, candidate, sess, a1).status_code == 200
    assert _put(client, candidate, sess, a2).json()["acks"][0]["client_seq"] == 2
    # replaying an older batch (retry after a lost response) must not overwrite the newer answer
    res = _put(client, candidate, sess, a1, a1)
    assert res.status_code == 200
    assert all(ack["accepted"] for ack in res.json()["acks"])  # acknowledged, nothing lost
    db.expire_all()
    rows = list(db.scalars(select(Answer).where(Answer.session_id == sess.id)))
    assert len(rows) == 1 and rows[0].value == {"option_key": "A"} and rows[0].client_seq == 2


def test_invalid_answers_rejected(client, db, mentor, course, candidate):
    sess = build_session(db, build_exam(db, course, mentor), candidate)
    q1 = sess.question_order[0]
    bad = {"question_id": q1, "value": {"option_key": "Z"}, "client_seq": 1}
    assert _put(client, candidate, sess, bad).status_code == 422


def test_offline_five_minutes_loses_no_answers(client, db, mentor, course, candidate):
    """Answers buffered for 5 minutes are synced in one batch, in any order, and all kept."""
    exam = build_exam(db, course, mentor, n_questions=3, duration_min=60)
    sess = build_session(db, exam, candidate)
    started = utcnow()
    buffered = []
    # the client buffered edits for 5 minutes (several edits per question)
    for minute in range(5):
        for i, qid in enumerate(sess.question_order):
            key = "ABC"[(minute + i) % 3]
            buffered.append(
                {
                    "question_id": qid,
                    "value": {"option_key": key},
                    "client_seq": minute + 1,
                    "answered_at": (started + timedelta(minutes=minute)).isoformat(),
                }
            )
    final = {b["question_id"]: b["value"] for b in buffered}
    res = _put(client, candidate, sess, *reversed(buffered))  # arrival order does not matter
    assert res.status_code == 200
    db.expire_all()
    stored = {
        str(a.question_id): a.value for a in db.scalars(select(Answer).where(Answer.session_id == sess.id))
    }
    assert stored == final


def test_auto_submit_only_at_deadline_and_late_offline_sync_accepted(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor, duration_min=10)
    sess = build_session(db, exam, candidate)
    q1 = sess.question_order[0]
    # before the deadline the sweep does nothing
    assert sweep_deadlines(db) == 0
    db.refresh(sess)
    assert sess.status == SessionStatus.in_progress
    # move the deadline into the past: the sweep auto-submits
    sess.deadline_at = utcnow() - timedelta(seconds=30)
    sess.started_at = utcnow() - timedelta(minutes=10)
    db.commit()
    assert sweep_deadlines(db) == 1
    db.refresh(sess)
    assert (
        sess.status == SessionStatus.scored and sess.submit_reason.value == "deadline"
    )  # submitted, then scored
    # an answer made before the deadline while offline is still accepted
    before = (sess.deadline_at - timedelta(minutes=1)).isoformat()
    ok = _put(
        client,
        candidate,
        sess,
        {"question_id": q1, "value": {"option_key": "A"}, "client_seq": 1, "answered_at": before},
    )
    assert ok.json()["acks"][0]["accepted"] is True
    # but not one claiming to be made after the deadline
    after = (sess.deadline_at + timedelta(seconds=5)).isoformat()
    late = _put(
        client,
        candidate,
        sess,
        {"question_id": q1, "value": {"option_key": "B"}, "client_seq": 2, "answered_at": after},
    )
    assert late.json()["acks"][0]["accepted"] is False


def test_manual_submit_is_idempotent_and_stops_answers(client, db, mentor, course, candidate):
    sess = build_session(db, build_exam(db, course, mentor), candidate)
    assert (
        client.post(f"/api/v1/sessions/{sess.id}/submit", headers=auth(candidate)).json()["status"]
        == "scored"
    )
    assert client.post(f"/api/v1/sessions/{sess.id}/submit", headers=auth(candidate)).status_code == 200
    q1 = sess.question_order[0]
    res = _put(client, candidate, sess, {"question_id": q1, "value": {"option_key": "A"}, "client_seq": 9})
    assert res.json()["acks"][0]["accepted"] is False


def test_start_requires_calibration(client, db, mentor, course, candidate):
    sess = build_session(db, build_exam(db, course, mentor), candidate, status=SessionStatus.link_opened)
    assert client.post(f"/api/v1/sessions/{sess.id}/start", headers=auth(candidate)).status_code == 409


def test_deadline_capped_by_window_end(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor, duration_min=120, window_end=utcnow() + timedelta(minutes=15))
    sess = build_session(db, exam, candidate)
    assert sess.deadline_at <= exam.window_end


def test_shuffle_is_stable_per_candidate(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor, n_questions=6, shuffle=True)
    sess = build_session(db, exam, candidate)
    first = client.get(f"/api/v1/sessions/{sess.id}", headers=auth(candidate)).json()
    second = client.get(f"/api/v1/sessions/{sess.id}", headers=auth(candidate)).json()
    assert [q["id"] for q in first["questions"]] == [q["id"] for q in second["questions"]]


def test_my_assessments_lists_assignments(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor, title="Optics quiz")
    build_session(db, exam, candidate)
    res = client.get("/api/v1/candidates/me/assessments", headers=auth(candidate)).json()
    assert res[0]["title"] == "Optics quiz" and res[0]["session_status"] == "in_progress"


def test_my_assessments_newest_first_with_counts(client, db, mentor, course, candidate):
    older = build_exam(db, course, mentor, title="Older", n_questions=2)
    newer = build_exam(db, course, mentor, title="Newer", n_questions=4)
    newer.window_start = older.window_start + timedelta(hours=2)
    for e in (older, newer):
        db.add(ExamAssignment(exam_id=e.id, candidate_id=candidate.id))
    db.commit()
    res = client.get("/api/v1/candidates/me/assessments", headers=auth(candidate)).json()
    assert [(a["title"], a["questions_count"]) for a in res] == [("Newer", 4), ("Older", 2)]
    assert res[0]["course_name"] == course.name and res[0]["session_id"] is None
