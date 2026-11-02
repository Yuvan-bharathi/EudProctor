"""Assessment IDs, per-candidate credentials (username = name, unique password by email) and password reset."""

import re

from sqlalchemy import select

from app.core.security import hash_password
from app.models import Role, User
from app.services import mailer
from app.services.credentials import _fernet
from tests import test_phase2_exams as p2
from tests.conftest import auth, make_user

topic = p2.topic  # re-use the pytest fixture


def _enrol(client, mentor, exam_id, *people):
    res = client.post(
        f"/api/v1/exams/{exam_id}/import-candidates",
        headers=auth(mentor),
        json={"candidates": [{"name": n, "email": e} for n, e in people]},
    )
    assert res.status_code == 200, res.text
    return res.json()


def _published_exam(client, db, mentor, course, topic):
    exam = p2.create_exam(client, mentor, course)
    q = p2.make_question(db, topic)
    client.put(f"/api/v1/exams/{exam['id']}/questions", headers=auth(mentor), json={"question_ids": [str(q.id)]})
    return exam


def _send(client, mentor, exam_id, force=False):
    mailer.OUTBOX.clear()
    res = client.post(f"/api/v1/exams/{exam_id}/send-links", headers=auth(mentor), json={"force_resend": force})
    assert res.status_code == 200, res.text
    return {m.to: m for m in mailer.OUTBOX}


def _creds(mail):
    user = re.search(r"Username: (\S+)", mail.body).group(1)
    pw = re.search(r"Password: (\S+)", mail.body).group(1)
    return user, pw


def test_exam_gets_assessment_id(client, mentor, course):
    exam = p2.create_exam(client, mentor, course)
    assert re.fullmatch(r"ASM-[A-Z2-9]{6}", exam["code"])
    detail = client.get(f"/api/v1/exams/{exam['id']}", headers=auth(mentor)).json()
    assert detail["code"] == exam["code"]
    assert "candidate_password" not in detail  # no shared password any more


def test_each_candidate_gets_unique_credentials_by_email(client, db, mentor, course, topic):
    exam = _published_exam(client, db, mentor, course, topic)
    rows = _enrol(client, mentor, exam["id"], ("Tanu Shree", "tanu@example.com"), ("Tanu Shree", "tanu2@example.com"))
    assert sorted(r["candidate_username"] for r in rows) == ["tanu.shree", "tanu.shree2"]

    mails = _send(client, mentor, exam["id"])
    u1, p1 = _creds(mails["tanu@example.com"])
    u2, p2_ = _creds(mails["tanu2@example.com"])
    assert {u1, u2} == {"tanu.shree", "tanu.shree2"}
    assert p1 != p2_  # unique per candidate
    assert exam["code"] in mails["tanu@example.com"].body

    assert client.post("/api/v1/auth/login", json={"email": u1, "password": p1}).status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": u2, "password": p2_}).status_code == 200
    # one candidate's password does not open another candidate's account
    assert client.post("/api/v1/auth/login", json={"email": u2, "password": p1}).status_code == 401
    # email works as the login identifier too
    assert client.post("/api/v1/auth/login", json={"email": "tanu@example.com", "password": p1}).status_code == 200


def test_resend_repeats_password_until_candidate_changes_it(client, db, mentor, course, topic):
    exam = _published_exam(client, db, mentor, course, topic)
    _enrol(client, mentor, exam["id"], ("Ravi Kumar", "ravi@example.com"))
    _, first = _creds(_send(client, mentor, exam["id"])["ravi@example.com"])
    _, again = _creds(_send(client, mentor, exam["id"], force=True)["ravi@example.com"])
    assert again == first  # resend shows the same working password

    ravi = db.scalar(select(User).where(User.email == "ravi@example.com"))
    ravi.password_hash = hash_password("MyOwn9Pass")  # e.g. changed via Forgot password
    db.commit()
    body = _send(client, mentor, exam["id"], force=True)["ravi@example.com"].body
    assert first not in body and "MyOwn9Pass" not in body
    assert "existing password" in body


def test_existing_password_is_not_overwritten(client, db, mentor, course):
    existing = make_user(db, Role.candidate, email="own@example.com", name="Own Pw")
    old_hash = existing.password_hash
    exam = p2.create_exam(client, mentor, course)
    _enrol(client, mentor, exam["id"], ("Own Pw", "own@example.com"))
    db.refresh(existing)
    assert existing.password_hash == old_hash
    assert existing.username == "own.pw"


def test_candidate_on_old_shared_password_gets_a_unique_one(client, db, mentor, course, topic):
    exam = _published_exam(client, db, mentor, course, topic)
    _enrol(client, mentor, exam["id"], ("Asha", "asha@example.com"))
    # simulate the earlier build: one shared password stored on the assessment and applied to the account
    from app.models import Exam

    e = db.get(Exam, exam["id"])
    e.candidate_password_enc = _fernet("exam-candidate-password").encrypt(b"Kavo-4827").decode()
    asha = db.scalar(select(User).where(User.email == "asha@example.com"))
    asha.password_hash = hash_password("Kavo-4827")
    asha.issued_password_enc = None
    db.commit()

    _, pw = _creds(_send(client, mentor, exam["id"])["asha@example.com"])
    assert pw != "Kavo-4827"
    assert client.post("/api/v1/auth/login", json={"email": "asha", "password": "Kavo-4827"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "asha", "password": pw}).status_code == 200


def test_forgot_and_reset_password_for_any_role(client, db, mentor):
    mailer.OUTBOX.clear()
    # unknown account: same answer, no email (no account enumeration)
    unknown = client.post("/api/v1/auth/forgot-password", json={"identifier": "nobody@example.com"})
    assert unknown.status_code == 200 and mailer.OUTBOX == []

    res = client.post("/api/v1/auth/forgot-password", json={"identifier": mentor.email})
    assert res.status_code == 200
    token = re.search(r"reset-password\?token=(\S+)", mailer.OUTBOX[-1].body).group(1)

    weak = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "short"})
    assert weak.status_code == 422
    ok = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "Brand9New"})
    assert ok.status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": mentor.email, "password": "Brand9New"}).status_code == 200
    # single use: the same link no longer works
    again = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": "Other9Pass"})
    assert again.status_code == 400
