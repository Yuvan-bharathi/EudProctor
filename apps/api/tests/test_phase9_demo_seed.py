from sqlalchemy import func, select

from app.demo_seed import seed_demo
from app.models import EvaluationSummary, Exam, ExamSession, GlanceLog, SummaryStatus
from app.seed import seed
from tests.conftest import auth


def test_demo_seed_builds_a_realistic_mix(db, client):
    seed(db)
    out = seed_demo(db)
    assert out["assessments"] == 3 and out["sessions"] == 60
    statuses = dict(
        db.execute(select(EvaluationSummary.status, func.count()).group_by(EvaluationSummary.status)).all()
    )
    assert {SummaryStatus.draft, SummaryStatus.approved, SummaryStatus.published} <= set(statuses)
    assert db.scalar(select(func.count()).select_from(GlanceLog)) > 30
    assert db.scalar(select(func.count()).select_from(ExamSession).where(ExamSession.flag_count > 0)) > 5
    assert db.scalar(select(func.count()).select_from(Exam)) == 3

    from app.models import User

    cand = db.scalar(select(User).where(User.email == "candidate01@example.com"))
    dash = client.get("/api/v1/candidates/me/dashboard", headers=auth(cand))
    assert dash.status_code == 200
    body = dash.json()
    assert len(body["results"]) >= 1 and len(body["assessments"]) == 3
    assert "integrity_note" not in dash.text and "glance" not in dash.text.lower()
