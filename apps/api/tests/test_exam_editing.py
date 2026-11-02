"""Assessment settings and in-assessment question edits are persisted server-side."""

from sqlalchemy import select

from app.models import ExamAssignment, ExamQuestion, Question
from app.services.sessions import open_session
from tests import test_phase2_exams as p2
from tests.conftest import auth

topic = p2.topic  # re-use the pytest fixture

Q = {
    "body": "What does an index speed up?",
    "difficulty": 2,
    "marks": 2,
    "subtopic": "Indexing",
    "explanation": "Lookups by key.",
    "options": [
        {"key": "A", "text": "Reads by key", "is_correct": True},
        {"key": "B", "text": "Bulk inserts", "is_correct": False},
        {"key": "C", "text": "Schema changes", "is_correct": False},
    ],
}


def _exam_with_question(client, mentor, course):
    exam = p2.create_exam(client, mentor, course)
    res = client.post(f"/api/v1/exams/{exam['id']}/import-questions", headers=auth(mentor), json={"questions": [Q]})
    assert res.status_code == 200, res.text
    return exam, res.json()["questions"][0]


def test_settings_are_saved_including_pass_mark(client, mentor, course):
    exam = p2.create_exam(client, mentor, course)
    res = client.patch(
        f"/api/v1/exams/{exam['id']}",
        headers=auth(mentor),
        json={"title": "Renamed", "duration_min": 45, "flag_threshold_s": 4, "shuffle": True, "pass_pct": 65},
    )
    assert res.status_code == 200, res.text
    detail = client.get(f"/api/v1/exams/{exam['id']}", headers=auth(mentor)).json()
    assert (detail["title"], detail["duration_min"], detail["flag_threshold_s"], detail["shuffle"], detail["pass_pct"]) == (
        "Renamed", 45, 4, True, 65,
    )
    bad = client.patch(f"/api/v1/exams/{exam['id']}", headers=auth(mentor), json={"pass_pct": 0})
    assert bad.status_code == 422


def test_edit_updates_question_in_place_without_duplicating(client, db, mentor, course):
    exam, q = _exam_with_question(client, mentor, course)
    edited = Q | {
        "body": "What does a B-tree index speed up?",
        "options": [
            {"key": "A", "text": "Bulk inserts", "is_correct": False},
            {"key": "B", "text": "Range and key lookups", "is_correct": True},
        ],
    }
    res = client.put(f"/api/v1/exams/{exam['id']}/questions/{q['id']}", headers=auth(mentor), json=edited)
    assert res.status_code == 200, res.text
    qs = res.json()["questions"]
    assert len(qs) == 1 and qs[0]["id"] == q["id"]  # same question, no duplicate
    assert qs[0]["body"] == "What does a B-tree index speed up?"
    assert [o["key"] for o in qs[0]["options"] if o["is_correct"]] == ["B"]


def test_edit_validation(client, mentor, course):
    exam, q = _exam_with_question(client, mentor, course)
    url = f"/api/v1/exams/{exam['id']}/questions/{q['id']}"
    two_correct = Q | {"options": [{"key": "A", "text": "x", "is_correct": True}, {"key": "B", "text": "y", "is_correct": True}]}
    assert client.put(url, headers=auth(mentor), json=two_correct).status_code == 422
    assert client.put(url, headers=auth(mentor), json=Q | {"body": "  "}).status_code == 422


def test_edit_refused_after_a_candidate_started(client, db, mentor, course, candidate):
    exam, q = _exam_with_question(client, mentor, course)
    client.put(f"/api/v1/exams/{exam['id']}/assignments", headers=auth(mentor), json={"candidate_ids": [str(candidate.id)]})
    assignment = db.scalar(select(ExamAssignment))
    session = open_session(db, assignment)
    db.commit()

    url = f"/api/v1/exams/{exam['id']}/questions/{q['id']}"
    # opened but not started: text edits are fine, adding/removing options is not
    assert client.put(url, headers=auth(mentor), json=Q | {"body": "Reworded?"}).status_code == 200
    fewer = Q | {"options": Q["options"][:2]}
    assert client.put(url, headers=auth(mentor), json=fewer).status_code == 409

    from app.models.base import utcnow

    session.started_at = utcnow()
    db.commit()
    assert client.put(url, headers=auth(mentor), json=Q | {"body": "Again?"}).status_code == 409


def test_shared_question_is_copied_so_other_assessment_is_unchanged(client, db, mentor, course):
    exam_a, q = _exam_with_question(client, mentor, course)
    exam_b = p2.create_exam(client, mentor, course)
    client.put(f"/api/v1/exams/{exam_b['id']}/questions", headers=auth(mentor), json={"question_ids": [q["id"]]})

    res = client.put(
        f"/api/v1/exams/{exam_a['id']}/questions/{q['id']}", headers=auth(mentor), json=Q | {"body": "Only in A?"}
    )
    assert res.status_code == 200, res.text
    new_id = res.json()["questions"][0]["id"]
    assert new_id != q["id"]
    assert db.get(Question, q["id"]).body == Q["body"]  # exam B still has the original
    assert db.scalar(select(ExamQuestion.question_id).where(ExamQuestion.exam_id == exam_b["id"])).hex == q["id"].replace("-", "")
