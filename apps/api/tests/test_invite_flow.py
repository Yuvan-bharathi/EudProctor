"""Invitation link -> sign in with the emailed credentials -> candidate portal."""

import re
from datetime import timedelta

from sqlalchemy import select

from app.core.security import make_unusable_password
from app.models import ExamAssignment
from app.models.base import utcnow
from app.services import mailer
from tests import test_phase2_exams as p2
from tests.conftest import auth

topic = p2.topic  # re-use the pytest fixture


def _invite(client, db, mentor, course, topic, candidate):
    """Candidate enrolled without a password of their own -> gets a unique password by email."""
    candidate.password_hash = make_unusable_password()
    db.commit()
    exam, token = p2._setup_links(client, db, mentor, course, topic, candidate)
    pw = re.search(r"Password: (\S+)", mailer.OUTBOX[-1].body).group(1)  # as the candidate would read it
    return exam, token, pw


def test_invite_details_are_public(client, db, mentor, course, topic, candidate):
    exam, token, _ = _invite(client, db, mentor, course, topic, candidate)
    res = client.get(f"/api/v1/invite/{token}")  # no auth header
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "pending"
    assert body["needs_password"] is False  # the emailed password already works
    assert body["candidate_email"] == candidate.email
    assert body["candidate_username"]
    assert body["exam_title"] == exam["title"] and body["exam_code"] == exam["code"]


def test_accept_with_emailed_password_signs_in_and_marks_accepted(client, db, mentor, course, topic, candidate):
    _, token, pw = _invite(client, db, mentor, course, topic, candidate)

    assert client.post(f"/api/v1/invite/{token}/accept", json={"password": "Wrong999"}).status_code == 401

    res = client.post(f"/api/v1/invite/{token}/accept", json={"password": pw})
    assert res.status_code == 200, res.text
    tokens = res.json()
    assert tokens["user"]["email"] == candidate.email
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.status_code == 200

    a = db.scalar(select(ExamAssignment))
    db.refresh(a)
    assert a.link_used_at is not None
    assert client.get(f"/api/v1/invite/{token}").json()["status"] == "accepted"
    # re-opening the link is just a sign-in
    assert client.post(f"/api/v1/invite/{token}/accept", json={"password": pw}).status_code == 200


def test_account_without_password_can_create_one_from_link(client, db, mentor, course, topic, candidate):
    _, token, _ = _invite(client, db, mentor, course, topic, candidate)
    candidate.password_hash = make_unusable_password()  # e.g. legacy account
    db.commit()
    assert client.get(f"/api/v1/invite/{token}").json()["needs_password"] is True
    assert client.post(f"/api/v1/invite/{token}/accept", json={"password": "short"}).status_code == 422
    assert client.post(f"/api/v1/invite/{token}/accept", json={"password": "Secret123"}).status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": candidate.email, "password": "Secret123"}).status_code == 200


def test_expired_and_invalid_invites_rejected(client, db, mentor, course, topic, candidate):
    _, token, pw = _invite(client, db, mentor, course, topic, candidate)
    a = db.scalar(select(ExamAssignment))
    a.link_expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.get(f"/api/v1/invite/{token}").json()["status"] == "expired"
    assert client.post(f"/api/v1/invite/{token}/accept", json={"password": pw}).status_code == 410
    assert client.get("/api/v1/invite/not-a-token").status_code == 404


def test_candidate_sees_assessment_in_portal_after_accepting(client, db, mentor, course, topic, candidate):
    exam, token, pw = _invite(client, db, mentor, course, topic, candidate)
    client.post(f"/api/v1/invite/{token}/accept", json={"password": pw})
    mine = client.get("/api/v1/candidates/me/assessments", headers=auth(candidate))
    assert mine.status_code == 200
    assert any(row["exam_id"] == exam["id"] for row in mine.json())
