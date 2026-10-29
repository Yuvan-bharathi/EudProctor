from datetime import timedelta

import pytest
from sqlalchemy import select

from app.models import (
    AuditLog,
    ExamQuestion,
    Misconception,
    Question,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
    Role,
    SessionStatus,
    Topic,
)
from app.models.base import utcnow
from app.models.results import Result, TopicResult
from app.services.sessions import sweep_deadlines
from tests.conftest import auth, make_user
from tests.factories import build_exam, build_session


def add_q(db, exam, topic, *, qtype=QuestionType.mcq, marks=1.0, misc=None, order=100):
    q = Question(
        course_id=exam.course_id,
        topic_id=topic.id,
        type=qtype,
        body=f"{topic.name} q{order}",
        marks=marks,
        status=QuestionStatus.approved,
        source=QuestionSource.mentor,
        answer_text="model answer" if qtype == QuestionType.short else None,
    )
    if qtype == QuestionType.mcq:
        q.options = [
            QuestionOption(key="A", text="right", is_correct=True),
            QuestionOption(key="B", text="wrong", misconception_id=misc.id if misc else None),
            QuestionOption(key="C", text="wrong 2"),
        ]
    db.add(q)
    db.flush()
    exam.questions.append(ExamQuestion(question_id=q.id, order=order))
    return q


@pytest.fixture
def setup(db, mentor, course, candidate):
    """First law: 4 MCQs (one shared misconception) · Cycles: 2 MCQs (insufficient) · Essay topic: 3 short answers."""
    exam = build_exam(db, course, mentor, n_questions=0, duration_min=60)
    first = Topic(course_id=course.id, name="First law")
    cycles = Topic(course_id=course.id, name="Cycles")
    essay = Topic(course_id=course.id, name="Entropy")
    db.add_all([first, cycles, essay])
    db.flush()
    misc = Misconception(topic_id=first.id, description="Mixes up heat and work sign convention")
    db.add(misc)
    db.flush()
    qs = {
        "f": [add_q(db, exam, first, misc=misc, order=i) for i in range(4)],
        "c": [add_q(db, exam, cycles, order=10 + i) for i in range(2)],
        "e": [add_q(db, exam, essay, qtype=QuestionType.short, marks=2, order=20 + i) for i in range(3)],
    }
    db.commit()
    sess = build_session(db, exam, candidate)
    return exam, sess, qs, misc


def answer(client, cand, sess, qid, value, seq=1):
    res = client.put(
        f"/api/v1/sessions/{sess.id}/answers",
        headers=auth(cand),
        json={"answers": [{"question_id": str(qid), "value": value, "client_seq": seq}]},
    )
    assert res.status_code == 200, res.text


def test_known_answers_produce_expected_topic_scores(client, db, mentor, candidate, setup):
    exam, sess, qs, misc = setup
    # First law: right, wrong(misc), wrong(misc), right -> 50% weak, misconception detected (2x)
    for q, key in zip(qs["f"], ["A", "B", "B", "A"], strict=True):
        answer(client, candidate, sess, q.id, {"option_key": key})
    for q in qs["c"]:  # cycles 2/2 but only 2 questions -> insufficient
        answer(client, candidate, sess, q.id, {"option_key": "A"})
    answer(client, candidate, sess, qs["e"][0].id, {"text": "Entropy measures disorder"})
    answer(client, candidate, sess, qs["e"][1].id, {"text": "dS = dQ/T"})
    # third essay left blank -> 0 marks, no marking needed
    assert (
        client.post(f"/api/v1/sessions/{sess.id}/submit", headers=auth(candidate)).json()["status"]
        == "scored"
    )

    res = client.get(f"/api/v1/mentor/sessions/{sess.id}/result", headers=auth(mentor)).json()
    topics = {t["name"]: t for t in res["topics"]}
    assert (topics["First law"]["score_pct"], topics["First law"]["cls"]) == (50.0, "weak")
    assert topics["First law"]["priority"] == 30.0  # mastery 80 - 50
    assert (topics["Cycles"]["score_pct"], topics["Cycles"]["cls"]) == (100.0, "insufficient")
    assert (
        topics["Entropy"]["n_unmarked"] == 2 and topics["Entropy"]["score_pct"] == 0.0
    )  # only the blank one is marked
    assert res["n_unmarked"] == 2
    assert [m["description"] for m in res["misconceptions"]] == [misc.description]

    # mentor marks both essays -> rescored
    queue = client.get(f"/api/v1/exams/{exam.id}/marking-queue", headers=auth(mentor)).json()
    assert len(queue) == 2 and queue[0]["model_answer"] == "model answer"
    for item, marks in zip(queue, [2, 1], strict=True):
        r = client.post(
            f"/api/v1/mentor/answers/{item['answer_id']}/mark", headers=auth(mentor), json={"marks": marks}
        )
        assert r.status_code == 204
    res = client.get(f"/api/v1/mentor/sessions/{sess.id}/result", headers=auth(mentor)).json()
    topics = {t["name"]: t for t in res["topics"]}
    assert (topics["Entropy"]["score_pct"], topics["Entropy"]["cls"]) == (50.0, "weak")
    assert res["n_unmarked"] == 0
    assert db.scalar(select(AuditLog).where(AuditLog.action == "answer.mark")).actor_id == str(mentor.id)
    assert client.get(f"/api/v1/exams/{exam.id}/marking-queue", headers=auth(mentor)).json() == []


def test_marking_rules(client, db, mentor, candidate, setup):
    exam, sess, qs, _ = setup
    answer(client, candidate, sess, qs["e"][0].id, {"text": "something"})
    client.post(f"/api/v1/sessions/{sess.id}/submit", headers=auth(candidate))
    item = client.get(f"/api/v1/exams/{exam.id}/marking-queue", headers=auth(mentor)).json()[0]
    over = client.post(
        f"/api/v1/mentor/answers/{item['answer_id']}/mark", headers=auth(mentor), json={"marks": 3}
    )
    assert over.status_code == 422
    other = make_user(db, Role.mentor)
    assert (
        client.post(
            f"/api/v1/mentor/answers/{item['answer_id']}/mark", headers=auth(other), json={"marks": 1}
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/mentor/answers/{item['answer_id']}/mark", headers=auth(candidate), json={"marks": 1}
        ).status_code
        == 403
    )


def test_class_analytics_and_item_analysis(client, db, mentor, course):
    exam = build_exam(db, course, mentor, n_questions=4)
    keys_by_candidate = [["A"] * 4, ["A", "A", "A", "B"], ["A", "B", "B", "B"], ["C", "B", "B", "B"]]
    for keys in keys_by_candidate:
        cand = make_user(db, Role.candidate)
        sess = build_session(db, exam, cand)
        for qid, k in zip(sess.question_order, keys, strict=True):
            answer(client, cand, sess, qid, {"option_key": k})
        client.post(f"/api/v1/sessions/{sess.id}/submit", headers=auth(cand))

    results = client.get(f"/api/v1/exams/{exam.id}/results", headers=auth(mentor)).json()
    assert sorted(r["score_pct"] for r in results) == [0.0, 25.0, 75.0, 100.0]
    assert sorted(r["percentile"] for r in results) == [12.5, 37.5, 62.5, 87.5]
    analytics = client.get(f"/api/v1/exams/{exam.id}/analytics", headers=auth(mentor)).json()
    assert analytics["n_scored"] == 4 and analytics["average_pct"] == 50.0
    t0 = analytics["topics"][0]
    assert (t0["strong"], t0["developing"], t0["weak"]) == (1, 1, 2)  # 100 / 75 / 25, 0
    items = client.get(f"/api/v1/exams/{exam.id}/item-analysis", headers=auth(mentor)).json()
    assert len(items) == 4 and all(i["n_attempted"] == 4 for i in items)
    assert items[0]["p"] == 0.75 and items[0]["correct_key"] == "A"
    assert set(items[0]["distractor_shares"]) == {"A", "B", "C"}


def test_late_offline_answers_rescore_after_deadline(client, db, mentor, course, candidate):
    exam = build_exam(db, course, mentor, n_questions=3)
    sess = build_session(db, exam, candidate)
    sess.started_at = utcnow() - timedelta(minutes=20)
    sess.deadline_at = utcnow() - timedelta(seconds=5)
    db.commit()
    sweep_deadlines(db)
    db.refresh(sess)
    assert sess.status == SessionStatus.scored
    assert db.get(Result, sess.id).score_pct == 0.0
    before_deadline = (sess.deadline_at - timedelta(minutes=2)).isoformat()
    res = client.put(
        f"/api/v1/sessions/{sess.id}/answers",
        headers=auth(candidate),
        json={
            "answers": [
                {
                    "question_id": q,
                    "value": {"option_key": "A"},
                    "client_seq": 1,
                    "answered_at": before_deadline,
                }
                for q in sess.question_order
            ]
        },
    )
    assert all(a["accepted"] for a in res.json()["acks"])
    db.expire_all()
    assert db.get(Result, sess.id).score_pct == 100.0
    assert db.scalar(select(TopicResult).where(TopicResult.session_id == sess.id)).cls == "strong"


def test_candidate_cannot_reach_results_or_marking(client, db, mentor, candidate, setup):
    exam, sess, _, _ = setup
    client.post(f"/api/v1/sessions/{sess.id}/submit", headers=auth(candidate))
    for path in (
        f"/exams/{exam.id}/results",
        f"/exams/{exam.id}/analytics",
        f"/mentor/sessions/{sess.id}/result",
    ):
        assert client.get(f"/api/v1{path}", headers=auth(candidate)).status_code == 403


def test_topic_average_is_insufficient_when_no_candidate_could_be_classified(client, db, mentor, course):
    exam = build_exam(db, course, mentor, n_questions=2)  # 2 questions < MIN_QUESTIONS_PER_TOPIC
    cand = make_user(db, Role.candidate)
    sess = build_session(db, exam, cand)
    for qid in sess.question_order:
        answer(client, cand, sess, qid, {"option_key": "B"})
    client.post(f"/api/v1/sessions/{sess.id}/submit", headers=auth(cand))
    topic = client.get(f"/api/v1/exams/{exam.id}/analytics", headers=auth(mentor)).json()["topics"][0]
    assert topic["average_pct"] == 0.0 and topic["average_cls"] == "insufficient"
