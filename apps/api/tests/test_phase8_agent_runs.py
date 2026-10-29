from sqlalchemy import select

from app.agent.evaluation import run_evaluation
from app.models import AgentRun, Role
from tests.conftest import auth, make_user
from tests.test_phase7_evaluation import build_content, scored, script  # noqa: F401  (fixture)


def test_dashboard_and_run_detail(db, client, mentor, admin, scored):  # noqa: F811
    sess = scored["sess"]
    run = run_evaluation(db, sess.id, llm=script(lambda r: build_content(r, needs_note=True)))
    summary_id = client.get(
        f"/api/v1/evaluation-summaries/by-session/{sess.id}", headers=auth(mentor)
    ).json()["summary"]["id"]
    client.post(f"/api/v1/evaluation-summaries/{summary_id}/approve", headers=auth(mentor))

    d = client.get("/api/v1/agent/dashboard", headers=auth(mentor)).json()
    agents = {a["agent"]: a for a in d["agents"]}
    assert (
        agents["assessment_evaluation"]["runs"] == 1
        and agents["assessment_evaluation"]["success_rate"] == 1.0
    )
    assert (
        agents["assessment_evaluation"]["tokens_in"] == 400
        and agents["assessment_evaluation"]["cost_usd"] > 0
    )
    assert agents["integrity_summary"]["tokens_in"] == 0 and agents["integrity_summary"]["tokens_out"] == 0
    assert (d["summaries_reviewed"], d["approved_without_edits"], d["approved_without_edits_share"]) == (
        1,
        1,
        1.0,
    )

    detail = client.get(f"/api/v1/agent/runs/{run.id}", headers=auth(mentor)).json()
    tools = [s["tool"] for s in detail["steps"] if s["kind"] == "tool"]
    assert tools == ["get_topic_results", "draft_evaluation_summary", "submit_for_mentor_review"]
    assert all(s["tokens_in"] == 0 for s in detail["steps"] if s["kind"] == "tool")
    assert detail["steps"][0]["reason"] == "Reading results."  # recorded visible text only
    assert detail["model"] == "fake-model" and detail["prompt_version"] == "eval-v1"
    assert detail["decision"]["status"] == "approved" and detail["decision"]["edited_by_mentor"] is False
    assert detail["data_timestamps"]["scored_at"] is not None

    integ = db.scalar(select(AgentRun).where(AgentRun.agent == "integrity_summary"))
    integ_detail = client.get(f"/api/v1/agent/runs/{integ.id}", headers=auth(admin)).json()
    assert integ_detail["steps"][0]["kind"] == "deterministic" and integ_detail["steps"][0]["tokens_in"] == 0

    # another mentor sees nothing of it; candidates are refused
    other = make_user(db, Role.mentor)
    assert client.get(f"/api/v1/agent/runs/{run.id}", headers=auth(other)).status_code == 404
    assert client.get("/api/v1/agent/runs", headers=auth(other)).json() == []
    cand = make_user(db, Role.candidate)
    assert client.get("/api/v1/agent/dashboard", headers=auth(cand)).status_code == 403

    # plain-language step descriptions
    titles = [s["title"] for s in detail["steps"] if s["kind"] == "tool"]
    assert titles == [
        "Read the computed scores for this candidate",
        "Saved the summary draft",
        "Sent the draft to the mentor's review queue",
    ]
    assert "Topics:" in detail["steps"][1]["detail"] and "First law" in detail["steps"][1]["detail"]
    assert detail["steps"][0]["title"] == "The model decided which tool to use next"
