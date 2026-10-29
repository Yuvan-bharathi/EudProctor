import re
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.agent.llm import set_llm_factory
from app.models import (
    AgentRun,
    AgentStep,
    AuditLog,
    ExamAssignment,
    Misconception,
    Question,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
    Role,
    Topic,
)
from app.models.base import utcnow
from app.services import mailer
from tests.conftest import auth, make_user
from tests.fakes import FakeLLM, response, text, tool_use


@pytest.fixture
def topic(db, course) -> Topic:
    t = Topic(course_id=course.id, name="First law")
    db.add(t)
    db.commit()
    return t


@pytest.fixture
def misconception(db, topic) -> Misconception:
    m = Misconception(topic_id=topic.id, description="Mixes up heat and work sign convention")
    db.add(m)
    db.commit()
    return m


def make_question(
    db, topic, status=QuestionStatus.approved, source=QuestionSource.mentor, body=None
) -> Question:
    q = Question(
        course_id=topic.course_id,
        topic_id=topic.id,
        type=QuestionType.mcq,
        body=body or f"What is {uuid.uuid4().hex[:6]}?",
        status=status,
        source=source,
        options=[QuestionOption(key="A", text="x", is_correct=True), QuestionOption(key="B", text="y")],
    )
    db.add(q)
    db.commit()
    return q


def create_exam(client, mentor, course, **kw):
    now = utcnow()
    body = {
        "course_id": str(course.id),
        "title": "Unit test 2",
        "duration_min": 30,
        "window_start": (now - timedelta(hours=1)).isoformat(),
        "window_end": (now + timedelta(days=2)).isoformat(),
    } | kw
    res = client.post("/api/v1/exams", json=body, headers=auth(mentor))
    assert res.status_code == 201, res.text
    return res.json()


@pytest.fixture(autouse=True)
def _reset():
    mailer.OUTBOX.clear()
    yield
    set_llm_factory(None)


# ---------- question bank ----------
def test_mentor_creates_question_with_misconception_tag(client, mentor, topic, misconception):
    res = client.post(
        "/api/v1/questions",
        headers=auth(mentor),
        json={
            "topic_id": str(topic.id),
            "body": "Sign of work done BY the gas?",
            "options": [
                {"key": "a", "text": "positive", "is_correct": True},
                {"key": "b", "text": "negative", "misconception_id": str(misconception.id)},
            ],
        },
    )
    assert res.status_code == 201, res.text
    q = res.json()
    assert q["status"] == "approved" and q["source"] == "mentor"
    assert [o["key"] for o in q["options"]] == ["A", "B"]


def test_question_requires_exactly_one_correct(client, mentor, topic):
    res = client.post(
        "/api/v1/questions",
        headers=auth(mentor),
        json={
            "topic_id": str(topic.id),
            "body": "Pick",
            "options": [{"key": "A", "text": "1"}, {"key": "B", "text": "2"}],
        },
    )
    assert res.status_code == 422


def test_other_mentor_cannot_see_course_questions(client, db, topic):
    other = make_user(db, Role.mentor)
    res = client.get(f"/api/v1/questions?course_id={topic.course_id}", headers=auth(other))
    assert res.status_code == 404


# ---------- exam builder: drafts can never be added ----------
def test_draft_questions_rejected_by_exam_builder(client, db, mentor, course, topic):
    exam = create_exam(client, mentor, course)
    draft = make_question(db, topic, status=QuestionStatus.draft, source=QuestionSource.agent)
    res = client.put(
        f"/api/v1/exams/{exam['id']}/questions", headers=auth(mentor), json={"question_ids": [str(draft.id)]}
    )
    assert res.status_code == 422
    assert "accept" in res.json()["detail"].lower()

    skipped = make_question(db, topic, status=QuestionStatus.skipped, source=QuestionSource.agent)
    res = client.put(
        f"/api/v1/exams/{exam['id']}/questions",
        headers=auth(mentor),
        json={"question_ids": [str(skipped.id)]},
    )
    assert res.status_code == 422

    # after the mentor accepts it, it can be used
    assert client.post(f"/api/v1/questions/{draft.id}/accept", headers=auth(mentor)).status_code == 200
    res = client.put(
        f"/api/v1/exams/{exam['id']}/questions", headers=auth(mentor), json={"question_ids": [str(draft.id)]}
    )
    assert res.status_code == 200
    assert [q["id"] for q in res.json()["questions"]] == [str(draft.id)]


def test_accept_and_skip_are_audited_and_only_for_drafts(client, db, mentor, topic):
    draft = make_question(db, topic, status=QuestionStatus.draft, source=QuestionSource.agent)
    assert (
        client.post(f"/api/v1/questions/{draft.id}/skip", headers=auth(mentor)).json()["status"] == "skipped"
    )
    assert client.post(f"/api/v1/questions/{draft.id}/accept", headers=auth(mentor)).status_code == 409
    row = db.scalar(select(AuditLog).where(AuditLog.action == "question.skip"))
    assert row.actor_id == str(mentor.id)


def test_flag_threshold_bounds(client, mentor, course):
    now = utcnow()
    res = client.post(
        "/api/v1/exams",
        headers=auth(mentor),
        json={
            "course_id": str(course.id),
            "title": "x",
            "duration_min": 10,
            "window_start": now.isoformat(),
            "window_end": (now + timedelta(hours=1)).isoformat(),
            "flag_threshold_s": 2,
        },
    )
    assert res.status_code == 422


def test_mentor_sees_only_own_exams(client, db, mentor, course):
    exam = create_exam(client, mentor, course)
    other = make_user(db, Role.mentor)
    assert client.get(f"/api/v1/exams/{exam['id']}", headers=auth(other)).status_code == 404
    assert client.get("/api/v1/exams", headers=auth(other)).json() == []


# ---------- links ----------
def _setup_links(client, db, mentor, course, topic, candidate, **exam_kw):
    exam = create_exam(client, mentor, course, **exam_kw)
    q = make_question(db, topic)
    client.put(
        f"/api/v1/exams/{exam['id']}/questions", headers=auth(mentor), json={"question_ids": [str(q.id)]}
    )
    res = client.put(
        f"/api/v1/exams/{exam['id']}/assignments",
        headers=auth(mentor),
        json={"candidate_ids": [str(candidate.id)]},
    )
    assert res.status_code == 200, res.text
    res = client.post(f"/api/v1/exams/{exam['id']}/send-links", headers=auth(mentor), json={})
    assert res.status_code == 200, res.text
    mail = mailer.OUTBOX[-1]
    assert mail.to == candidate.email
    token = re.search(r"/join/(\S+)", mail.body).group(1)
    return exam, token


def test_link_single_use_and_bound_to_candidate(client, db, mentor, course, topic, candidate):
    exam, token = _setup_links(client, db, mentor, course, topic, candidate)
    # the raw token is never stored
    a = db.scalar(select(ExamAssignment))
    assert token not in (a.link_token_hash or "")

    intruder = make_user(db, Role.candidate)
    assert client.post(f"/api/v1/join/{token}", headers=auth(intruder)).status_code == 403
    res = client.post(f"/api/v1/join/{token}", headers=auth(candidate))
    assert res.status_code == 200, res.text
    assert res.json()["exam_id"] == exam["id"]
    # reuse rejected
    assert client.post(f"/api/v1/join/{token}", headers=auth(candidate)).status_code == 410
    assert client.post("/api/v1/join/not-a-token", headers=auth(candidate)).status_code == 404


def test_expired_link_rejected(client, db, mentor, course, topic, candidate):
    _, token = _setup_links(client, db, mentor, course, topic, candidate)
    a = db.scalar(select(ExamAssignment))
    a.link_expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    res = client.post(f"/api/v1/join/{token}", headers=auth(candidate))
    assert res.status_code == 410 and "expired" in res.json()["detail"]


def test_resending_link_invalidates_old_one(client, db, mentor, course, topic, candidate):
    exam, old = _setup_links(client, db, mentor, course, topic, candidate)
    client.post(f"/api/v1/exams/{exam['id']}/send-links", headers=auth(mentor), json={})
    new = re.search(r"/join/(\S+)", mailer.OUTBOX[-1].body).group(1)
    assert client.post(f"/api/v1/join/{old}", headers=auth(candidate)).status_code == 404
    assert client.post(f"/api/v1/join/{new}", headers=auth(candidate)).status_code == 200


def test_link_expiry_never_exceeds_window(client, db, mentor, course, topic, candidate):
    now = utcnow()
    _setup_links(
        client, db, mentor, course, topic, candidate, window_end=(now + timedelta(hours=2)).isoformat()
    )
    a = db.scalar(select(ExamAssignment))
    assert a.link_expires_at <= now + timedelta(hours=2, seconds=5)


# ---------- Question Bank Agent ----------
def _option_set(correct="A"):
    return [{"key": k, "text": f"option {k}", "is_correct": k == correct} for k in "ABCD"]


def test_suggest_creates_drafts_and_logs_every_step(client, db, mentor, course, topic):
    fake = FakeLLM(
        [
            response(text("Looking up topics."), tool_use("get_syllabus_topics")),
            response(tool_use("find_similar_questions", topic_id=str(topic.id), text="internal energy")),
            response(
                tool_use(
                    "create_question_draft",
                    topic_id=str(topic.id),
                    difficulty=2,
                    body="For an isolated system, what happens to internal energy?",
                    options=_option_set("B"),
                )
            ),
            response(tool_use("publish_question", question_id="x")),  # not on the allow-list
            response(text("Done.")),
        ]
    )
    set_llm_factory(lambda: fake)
    res = client.post(
        "/api/v1/questions/suggest",
        headers=auth(mentor),
        json={"course_id": str(course.id), "topic_id": str(topic.id), "n": 1},
    )
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["status"] == "succeeded"
    assert len(out["drafts"]) == 1
    draft = out["drafts"][0]
    assert draft["status"] == "draft" and draft["source"] == "agent"

    run = db.get(AgentRun, uuid.UUID(out["run_id"]))
    assert run.model == "fake-model" and run.prompt_version == "qb-v1"
    assert run.tokens_in == 500 and run.tokens_out == 250 and run.cost_usd > 0
    steps = list(db.scalars(select(AgentStep).where(AgentStep.run_id == run.id).order_by(AgentStep.seq)))
    tool_steps = [s for s in steps if s.kind == "tool"]
    assert [s.tool for s in tool_steps] == [
        "get_syllabus_topics",
        "find_similar_questions",
        "create_question_draft",
        "publish_question",
    ]
    assert "not allowed" in tool_steps[-1].error
    assert all(s.tokens_in == 0 for s in tool_steps)
    # every tool call is audited, attributed to the agent
    rows = list(db.scalars(select(AuditLog).where(AuditLog.action == "agent.tool_call")))
    assert len(rows) == 4 and all(r.actor_type == "agent" for r in rows)
    q_row = db.scalar(select(AuditLog).where(AuditLog.action == "questions.create"))
    assert q_row.actor_type == "agent"
    # the disallowed tool came back to the model as an error result
    assert fake.tool_results(4)[0]["is_error"] is True


def test_agent_tool_validation_rejects_bad_drafts(client, db, mentor, course, topic):
    other_topic_id = str(uuid.uuid4())
    fake = FakeLLM(
        [
            response(
                tool_use(
                    "create_question_draft",
                    topic_id=other_topic_id,
                    difficulty=2,
                    body="Some question body?",
                    options=_option_set(),
                )
            ),
            response(
                tool_use(
                    "create_question_draft",
                    topic_id=str(topic.id),
                    difficulty=2,
                    body="Two correct answers?",
                    options=[
                        {"key": "A", "text": "1", "is_correct": True},
                        {"key": "B", "text": "2", "is_correct": True},
                    ],
                )
            ),
            response(text("Giving up.")),
        ]
    )
    set_llm_factory(lambda: fake)
    res = client.post(
        "/api/v1/questions/suggest", headers=auth(mentor), json={"course_id": str(course.id), "n": 2}
    )
    assert res.json()["drafts"] == []
    assert fake.tool_results(1)[0]["is_error"] and "Unknown topic" in fake.tool_results(1)[0]["content"]
    assert "Exactly one" in fake.tool_results(2)[0]["content"]
    assert db.scalar(select(func.count()).select_from(Question)) == 0


def test_agent_cannot_exceed_requested_count(client, db, mentor, course, topic):
    def draft(i):
        return response(
            tool_use(
                "create_question_draft",
                topic_id=str(topic.id),
                difficulty=1,
                body=f"Distinct question number {i} about heat?",
                options=_option_set(),
            )
        )

    fake = FakeLLM([draft(1), draft(2), response(text("ok"))])
    set_llm_factory(lambda: fake)
    out = client.post(
        "/api/v1/questions/suggest", headers=auth(mentor), json={"course_id": str(course.id), "n": 1}
    ).json()
    assert len(out["drafts"]) == 1
    assert "stop now" in fake.tool_results(2)[0]["content"]


def test_suggest_without_configured_model_returns_503(client, mentor, course):
    res = client.post("/api/v1/questions/suggest", headers=auth(mentor), json={"course_id": str(course.id)})
    assert res.status_code == 503
    assert "ANTHROPIC_MODEL" in res.json()["detail"]
