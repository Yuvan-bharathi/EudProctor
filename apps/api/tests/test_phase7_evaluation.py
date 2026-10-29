import json
import uuid

import pytest
from sqlalchemy import select

from app.agent import evaluation as ev
from app.agent.evaluation import run_evaluation
from app.agent.llm import set_llm_factory
from app.models import (
    AgentRun,
    AgentStep,
    AuditLog,
    EvaluationSummary,
    ExamQuestion,
    Misconception,
    Note,
    PracticeSet,
    Question,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
    Role,
    SessionStatus,
    Topic,
)
from app.services import mailer
from tests.conftest import auth, make_user
from tests.factories import build_exam, build_session
from tests.fakes import FakeLLM, response, text, tool_use


def mcq(db, course_id, topic, body, misc=None):
    q = Question(
        course_id=course_id,
        topic_id=topic.id,
        type=QuestionType.mcq,
        body=body,
        marks=1,
        status=QuestionStatus.approved,
        source=QuestionSource.mentor,
        options=[
            QuestionOption(key="A", text="right", is_correct=True),
            QuestionOption(key="B", text="wrong", misconception_id=misc.id if misc else None),
            QuestionOption(key="C", text="other"),
        ],
    )
    db.add(q)
    db.flush()
    return q


@pytest.fixture
def scored(db, client, mentor, course, candidate):
    """Heat (3/3 strong) · First law (1/4 weak, misconception x2) · Cycles (2 qs insufficient), plus 6 unseen practice qs."""
    exam = build_exam(db, course, mentor, n_questions=0)
    heat, first, cycles = (
        Topic(course_id=course.id, name=n) for n in ("Heat transfer", "First law", "Cycles")
    )
    db.add_all([heat, first, cycles])
    db.flush()
    misc = Misconception(topic_id=first.id, description="Mixes up heat and work sign convention")
    db.add(misc)
    db.flush()
    plan = [(heat, "A")] * 3 + [
        (first, "A"),
        (first, "B"),
        (first, "B"),
        (first, "C"),
        (cycles, "A"),
        (cycles, "A"),
    ]
    qs = []
    for i, (t, _) in enumerate(plan):
        q = mcq(db, course.id, t, f"{t.name} {i}", misc if t is first else None)
        exam.questions.append(ExamQuestion(question_id=q.id, order=i))
        qs.append(q)
    practice = [mcq(db, course.id, first, f"Practice first law {i}") for i in range(6)]
    db.commit()
    sess = build_session(db, exam, candidate)
    client.put(
        f"/api/v1/sessions/{sess.id}/answers",
        headers=auth(candidate),
        json={
            "answers": [
                {"question_id": str(q.id), "value": {"option_key": k}, "client_seq": 1}
                for q, (_, k) in zip(qs, plan, strict=True)
            ]
        },
    )
    client.post(f"/api/v1/sessions/{sess.id}/submit", headers=auth(candidate))
    db.refresh(sess)
    assert sess.status == SessionStatus.scored
    return {
        "exam": exam,
        "sess": sess,
        "first": first,
        "heat": heat,
        "cycles": cycles,
        "misc": misc,
        "practice": practice,
    }


@pytest.fixture(autouse=True)
def _reset():
    mailer.OUTBOX.clear()
    yield
    set_llm_factory(None)


def last_tool_json(kwargs, index=0):
    return json.loads(kwargs["messages"][-1]["content"][index]["content"])


def build_content(results, *, note_ids=None, practice=None, needs_note=None, tweak=None):
    by = {
        c: [t for t in results["topics"] if t["class"] == c]
        for c in ("strong", "developing", "weak", "insufficient")
    }

    def topic(t):
        return {
            "topic_id": t["topic_id"],
            "name": t["name"],
            "score_pct": t["score_pct"],
            "n_questions": t["n_questions"],
        }

    weak = by["weak"][0]
    rec = {
        "topic_id": weak["topic_id"],
        "priority": 1,
        "reason": "Revisit the sign convention for heat and work.",
        "note_ids": note_ids or [],
        "practice_question_ids": practice or [],
    }
    if needs_note is not None:
        rec["needs_mentor_note"] = needs_note
    content = {
        "overall": {
            "score_pct": results["overall"]["score_pct"],
            "class_percentile": results["overall"]["class_percentile"],
        },
        "strong_topics": [topic(t) for t in by["strong"]],
        "developing_topics": [topic(t) for t in by["developing"]],
        "weak_topics": [topic(t) for t in by["weak"]],
        "misconceptions": [],
        "recommended_topics": [rec],
        "message": "You did well on heat transfer. Next, practise the first law and its sign convention.",
        "data_notes": [],
        "integrity_note": "",
    }
    if tweak:
        tweak(content)
    return content


def script(*drafts, submit=True):
    """get_topic_results, then each draft attempt (a function of the results), then submit_for_mentor_review."""
    state = {}

    def first(_kw):
        return response(text("Reading results."), tool_use("get_topic_results"))

    steps = [first]
    for i, d in enumerate(drafts):

        def step(kw, d=d, i=i):
            if i == 0:
                state["results"] = last_tool_json(kw)
            return response(tool_use("draft_evaluation_summary", content=d(state["results"])))

        steps.append(step)
    if submit:

        def sub(kw):
            return response(tool_use("submit_for_mentor_review", summary_id=last_tool_json(kw)["summary_id"]))

        steps.append(sub)
    steps.append(response(text("Done.")))
    return FakeLLM(steps)


def run(db, sess, fake, comment=None):
    return run_evaluation(db, sess.id, comment=comment, llm=fake)


def summary_of(db, sess):
    db.expire_all()
    return db.scalar(select(EvaluationSummary).where(EvaluationSummary.session_id == sess.id))


# ---------------------------------------------------------------------------
def test_tool_allow_list_has_no_publish_or_write_tools():
    names = {t.name for t in ev.SPEC.tools}
    assert names == {
        "get_topic_results",
        "get_wrong_answers",
        "get_misconceptions",
        "find_notes",
        "select_practice_questions",
        "draft_evaluation_summary",
        "submit_for_mentor_review",
    }
    assert not any("publish" in n or "mark" in n or "flag" in n or "event" in n for n in names)


def test_empty_notes_library_flags_topic_and_rejects_invented_notes(db, scored):
    sess = scored["sess"]
    fake = script(
        lambda r: build_content(r, note_ids=[str(uuid.uuid4())]),  # invented note
        lambda r: build_content(r),  # empty notes without needs_mentor_note
        lambda r: build_content(r, needs_note=True),  # correct
    )
    run_ = run(db, sess, fake)
    assert run_.status == "succeeded"
    assert "not an approved note" in fake.tool_results(2)[0]["content"]
    assert "needs_mentor_note" in fake.tool_results(3)[0]["content"]
    s = summary_of(db, sess)
    rec = s.content_json["recommended_topics"][0]
    assert rec["note_ids"] == [] and rec["needs_mentor_note"] is True
    assert s.status.value == "draft" and s.ready_for_review
    # deterministic data notes added server-side
    assert any("Cycles" in d and "not enough" in d for d in s.content_json["data_notes"])
    db.refresh(sess)
    assert sess.status == SessionStatus.analysed


def test_numbers_must_equal_computed_scores(db, scored):
    sess = scored["sess"]

    def altered(c):
        c["overall"]["score_pct"] += 5

    def renamed(c):
        c["weak_topics"][0]["score_pct"] = 60.0

    fake = script(
        lambda r: build_content(r, needs_note=True, tweak=altered),
        lambda r: build_content(r, needs_note=True, tweak=renamed),
        submit=False,
    )
    run(db, sess, fake)
    assert "computed" in fake.tool_results(2)[0]["content"]
    assert "must equal the computed values" in fake.tool_results(3)[0]["content"]
    assert summary_of(db, sess) is None


@pytest.mark.parametrize(
    "bad", ["You may have been cheating.", "Your red flags were noted.", "Stay honest next time."]
)
def test_proctoring_or_judgement_language_rejected(db, scored, bad):
    sess = scored["sess"]

    def msg(c):
        c["message"] = bad

    fake = script(lambda r: build_content(r, needs_note=True, tweak=msg), submit=False)
    run(db, sess, fake)
    assert "must not mention" in fake.tool_results(2)[0]["content"]
    assert summary_of(db, sess) is None


def test_agent_cannot_write_integrity_note(db, scored):
    def integ(c):
        c["integrity_note"] = "Candidate looked away a lot"

    fake = script(lambda r: build_content(r, needs_note=True, tweak=integ), submit=False)
    run(db, scored["sess"], fake)
    assert "integrity_note must be an empty string" in fake.tool_results(2)[0]["content"]


def test_integrity_note_written_by_deterministic_step_with_zero_tokens(db, scored):
    sess = scored["sess"]
    sess.flag_count = 2
    db.commit()
    run(db, sess, script(lambda r: build_content(r, needs_note=True)))
    s = summary_of(db, sess)
    assert s.content_json["integrity_note"].startswith("Red flags 2 of 3")
    integ = db.scalar(select(AgentRun).where(AgentRun.agent == "integrity_summary"))
    steps = list(db.scalars(select(AgentStep).where(AgentStep.run_id == integ.id)))
    assert (
        integ.tokens_in == integ.tokens_out == 0
        and steps[0].kind == "deterministic"
        and steps[0].tokens_in == 0
    )


def test_notes_and_practice_from_approved_library(db, client, scored):
    sess, first = scored["sess"], scored["first"]
    approved = Note(
        topic_id=first.id,
        title="Energy balance basics",
        url_or_body="https://example.com/energy",
        approved=True,
    )
    draft = Note(topic_id=first.id, title="Unreviewed draft note", url_or_body="x", approved=False)
    db.add_all([approved, draft])
    db.commit()
    practice = [str(q.id) for q in scored["practice"][:5]]
    seen_q = sess.question_order[3]
    fake = script(
        lambda r: build_content(r, note_ids=[str(draft.id)]),  # unapproved note rejected
        lambda r: build_content(
            r, note_ids=[str(approved.id)], practice=[seen_q]
        ),  # already-seen question rejected
        lambda r: build_content(r, note_ids=[str(approved.id)], practice=practice),
    )
    run(db, sess, fake)
    assert "not an approved note" in fake.tool_results(2)[0]["content"]
    assert "practice question" in fake.tool_results(3)[0]["content"]
    assert summary_of(db, sess).content_json["recommended_topics"][0]["note_ids"] == [str(approved.id)]


def test_publish_requires_approval_and_candidate_sees_only_published_safe_fields(
    db, client, mentor, candidate, scored
):
    sess, first = scored["sess"], scored["first"]
    note = Note(
        topic_id=first.id,
        title="Energy balance basics",
        url_or_body="https://example.com/energy",
        approved=True,
    )
    db.add(note)
    db.commit()
    run(db, sess, script(lambda r: build_content(r, note_ids=[str(note.id)])))
    s = summary_of(db, sess)

    # nothing visible to the candidate before publishing
    dash = client.get("/api/v1/candidates/me/dashboard", headers=auth(candidate)).json()
    assert dash["results"] == []
    assert client.get("/api/v1/candidates/me/recommendations", headers=auth(candidate)).json() == []

    # publish before approve -> 409
    assert (
        client.post(f"/api/v1/evaluation-summaries/{s.id}/publish", headers=auth(mentor), json={}).status_code
        == 409
    )
    assert (
        client.post(f"/api/v1/evaluation-summaries/{s.id}/approve", headers=auth(mentor)).json()["status"]
        == "approved"
    )
    # approved but not yet published: still invisible
    assert client.get("/api/v1/candidates/me/recommendations", headers=auth(candidate)).json() == []
    res = client.post(
        f"/api/v1/evaluation-summaries/{s.id}/publish", headers=auth(mentor), json={"notify": True}
    )
    assert res.status_code == 200 and res.json()["status"] == "published"
    assert mailer.OUTBOX[-1].to == candidate.email and "recommendations" in mailer.OUTBOX[-1].subject.lower()

    raw = client.get("/api/v1/candidates/me/dashboard", headers=auth(candidate)).text
    for forbidden in (
        "data_notes",
        "integrity_note",
        "Red flags",
        "not enough to classify",
        "needs_mentor_note",
        "glance",
    ):
        assert forbidden not in raw, forbidden
    dash = json.loads(raw)
    r0 = dash["results"][0]
    assert r0["summary"]["recommended_topics"][0]["notes"][0]["title"] == "Energy balance basics"
    assert {t["cls"] for t in r0["topics"]} == {"strong", "weak", "insufficient"}
    assert r0["practice"]["n_questions"] >= 5  # topped up to the configured minimum

    # practice + re-check score
    ps = db.scalar(select(PracticeSet).where(PracticeSet.summary_id == s.id))
    pq = client.get(f"/api/v1/practice-sets/{ps.id}", headers=auth(candidate)).json()
    assert "is_correct" not in json.dumps(pq)
    answers = {q["id"]: "A" for q in pq["questions"]}
    assert (
        client.post(
            f"/api/v1/practice-sets/{ps.id}/submit", headers=auth(candidate), json={"answers": answers}
        ).json()["score_pct"]
        == 100.0
    )
    # another candidate cannot open it
    other = make_user(db, Role.candidate)
    assert client.get(f"/api/v1/practice-sets/{ps.id}", headers=auth(other)).status_code == 404

    actions = set(db.scalars(select(AuditLog.action)))
    assert {"summary.approve", "summary.publish", "agent.tool_call"} <= actions


def test_request_changes_redrafts_with_comment(db, client, mentor, scored):
    sess = scored["sess"]
    run(db, sess, script(lambda r: build_content(r, needs_note=True)))
    s = summary_of(db, sess)
    fake = script(
        lambda r: build_content(
            r, needs_note=True, tweak=lambda c: c.update(message="Focus first on the first law.")
        )
    )
    set_llm_factory(lambda: fake)
    res = client.post(
        f"/api/v1/evaluation-summaries/{s.id}/request-changes",
        headers=auth(mentor),
        json={"comment": "Shorter message please"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert (
        body["version"] == 2
        and body["status"] == "draft"
        and body["content"]["message"] == "Focus first on the first law."
    )
    assert "Shorter message please" in fake.calls[0]["system"]
    assert body["content"]["integrity_note"].startswith("Red flags")


def test_mentor_edit_is_validated_and_needs_reapproval(db, client, mentor, scored):
    sess = scored["sess"]
    run(db, sess, script(lambda r: build_content(r, needs_note=True)))
    s = summary_of(db, sess)
    client.post(f"/api/v1/evaluation-summaries/{s.id}/approve", headers=auth(mentor))
    content = dict(s.content_json)
    content["message"] = "Great work on heat transfer. Let's strengthen the first law next."
    res = client.patch(
        f"/api/v1/evaluation-summaries/{s.id}", headers=auth(mentor), json={"content": content}
    )
    assert res.status_code == 200 and res.json()["status"] == "draft" and res.json()["edited_by_mentor"]
    bad = dict(content, overall={**content["overall"], "score_pct": 99})
    assert (
        client.patch(
            f"/api/v1/evaluation-summaries/{s.id}", headers=auth(mentor), json={"content": bad}
        ).status_code
        == 422
    )
    other = make_user(db, Role.mentor)
    assert (
        client.get(f"/api/v1/evaluation-summaries/by-session/{sess.id}", headers=auth(other)).status_code
        == 404
    )


def test_candidate_cannot_reach_mentor_summary_endpoints(client, candidate, scored):
    assert (
        client.get(
            f"/api/v1/evaluation-summaries/by-session/{scored['sess'].id}", headers=auth(candidate)
        ).status_code
        == 403
    )


def test_invented_change_and_numbers_in_text_are_rejected(db, scored):
    sess = scored["sess"]

    def change(c):
        c["overall"]["change_vs_previous_pct"] = 12.5  # no previous assessment exists

    def number(c):
        c["message"] = "You scored 95% overall."

    fake = script(
        lambda r: build_content(r, needs_note=True, tweak=change),
        lambda r: build_content(r, needs_note=True, tweak=number),
        submit=False,
    )
    run(db, sess, fake)
    assert "change_vs_previous_pct" in fake.tool_results(2)[0]["content"]
    assert "not a computed score" in fake.tool_results(3)[0]["content"]
    assert summary_of(db, sess) is None


def test_unsubmitted_draft_cannot_be_approved(db, client, mentor, scored):
    sess = scored["sess"]
    run(db, sess, script(lambda r: build_content(r, needs_note=True), submit=False))
    s = summary_of(db, sess)
    assert not s.ready_for_review
    assert (
        client.post(f"/api/v1/evaluation-summaries/{s.id}/approve", headers=auth(mentor)).status_code == 409
    )


def test_mock_llm_drafts_a_valid_summary_through_the_real_validators(db, scored):
    from app.agent.mock_llm import MockLLM

    sess, first = scored["sess"], scored["first"]
    note = Note(
        topic_id=first.id, title="Energy balance basics", url_or_body="https://example.com/e", approved=True
    )
    db.add(note)
    db.commit()
    run_ = run(db, sess, MockLLM())
    assert run_.status == "succeeded", run_.error
    s = summary_of(db, sess)
    assert s.ready_for_review and s.content_json["recommended_topics"][0]["note_ids"] == [str(note.id)]
    assert 1 <= len(s.content_json["recommended_topics"][0]["practice_question_ids"]) <= 4


def test_mock_llm_question_bank(db, client, mentor, course):
    from app.agent.mock_llm import MockLLM

    t = Topic(course_id=course.id, name="Entropy")
    db.add(t)
    db.commit()
    set_llm_factory(MockLLM)
    out = client.post(
        "/api/v1/questions/suggest", headers=auth(mentor), json={"course_id": str(course.id), "n": 2}
    ).json()
    assert out["status"] == "succeeded" and len(out["drafts"]) == 2
