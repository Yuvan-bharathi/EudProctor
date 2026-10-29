from sqlalchemy import func, select

from app.models import AuditLog, Course, Role, User
from app.seed import DEV_PASSWORD, seed
from tests.conftest import auth, make_user


def audit_count(db) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(AuditLog))


def test_login_refresh_me(client, db):
    u = make_user(db, Role.mentor, email="m@example.com")
    res = client.post("/api/v1/auth/login", json={"email": "m@example.com", "password": "password123"})
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["role"] == "mentor"
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["id"] == str(u.id)
    ref = client.post("/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert ref.status_code == 200
    # a refresh token is not an access token
    bad = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['refresh_token']}"})
    assert bad.status_code == 401


def test_login_wrong_password(client, db):
    make_user(db, Role.mentor, email="m2@example.com")
    res = client.post("/api/v1/auth/login", json={"email": "m2@example.com", "password": "nope"})
    assert res.status_code == 401


def test_inactive_user_cannot_use_token(client, db):
    u = make_user(db, Role.candidate)
    headers = auth(u)
    u.is_active = False
    db.commit()
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_every_write_creates_audit_rows(client, db, admin):
    h = auth(admin)
    writes = []

    def write(method, path, **kw):
        before = audit_count(db)
        res = client.request(method, path, headers=h, **kw)
        assert res.status_code < 300, res.text
        assert audit_count(db) > before, f"{method} {path} wrote no audit row"
        writes.append(path)
        return res

    user = write(
        "POST",
        "/api/v1/admin/users",
        json={"role": "candidate", "email": "c9@example.com", "name": "Cand Nine", "password": "password123"},
    )
    mentor = write(
        "POST",
        "/api/v1/admin/users",
        json={"role": "mentor", "email": "m9@example.com", "name": "Mentor Nine", "password": "password123"},
    )
    write("PATCH", f"/api/v1/admin/users/{user.json()['id']}", json={"name": "Renamed"})
    course = write("POST", "/api/v1/admin/courses", json={"name": "Optics", "code": "OPT-1"})
    cid = course.json()["id"]
    write(
        "POST",
        f"/api/v1/admin/courses/{cid}/members",
        json={"user_id": user.json()["id"], "role": "candidate"},
    )
    write(
        "POST",
        f"/api/v1/admin/courses/{cid}/members",
        json={"user_id": mentor.json()["id"], "role": "mentor"},
    )
    write("DELETE", f"/api/v1/admin/courses/{cid}/members/{user.json()['id']}")
    write("POST", "/api/v1/auth/login", json={"email": "m9@example.com", "password": "password123"})
    assert len(writes) == 8


def test_audit_row_has_actor_and_redacts_password(client, db, admin):
    client.post(
        "/api/v1/admin/users",
        headers=auth(admin),
        json={"role": "candidate", "email": "c8@example.com", "name": "C8", "password": "password123"},
    )
    row = db.scalar(
        select(AuditLog).where(AuditLog.action == "users.create").order_by(AuditLog.at.desc()).limit(1)
    )
    assert row.actor_type == "user" and row.actor_id == str(admin.id)
    assert "password_hash" not in row.after_json
    assert row.after_json["email"] == "c8@example.com"


def test_mentor_sees_only_own_courses(client, db, mentor, course):
    other = make_user(db, Role.mentor)
    assert [c["id"] for c in client.get("/api/v1/courses", headers=auth(mentor)).json()] == [str(course.id)]
    assert client.get("/api/v1/courses", headers=auth(other)).json() == []
    res = client.get(f"/api/v1/courses/{course.id}/candidates", headers=auth(other))
    assert res.status_code == 404


def test_seed_creates_synthetic_users(db):
    counts = seed(db)
    assert counts == {"admins": 1, "mentors": 2, "candidates": 30, "courses": 2}
    emails = list(db.scalars(select(User.email)))
    assert len(emails) == 33 and all(e.endswith("@example.com") for e in emails)
    assert db.scalar(select(func.count()).select_from(Course)) == 2
    assert DEV_PASSWORD


def test_insecure_jwt_secret_rejected_outside_dev():
    import pytest

    from app.core.config import InsecureConfigError, Settings, validate_settings

    with pytest.raises(InsecureConfigError):
        validate_settings(Settings(environment="production", jwt_secret="change-me"))
    validate_settings(Settings(environment="production", jwt_secret="x" * 40))


def test_bulk_update_is_audited(db, mentor):
    from sqlalchemy import update

    db.execute(update(User).where(User.id == mentor.id).values(name="Bulk"))
    db.commit()
    assert (
        db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "users.bulk_update"))
        == 1
    )


def test_malformed_password_hash_does_not_crash():
    from app.core.security import verify_password

    assert verify_password("x", "garbage") is False
    assert verify_password("x", "bcrypt$a$b") is False


def test_admin_user_and_course_details(client, db, admin, mentor, candidate, course):
    from tests.factories import build_exam, build_session

    exam = build_exam(db, course, mentor, title="Admin view check")
    build_session(db, exam, candidate)
    d = client.get(f"/api/v1/admin/users/{candidate.id}", headers=auth(admin)).json()
    assert d["user"]["email"] == candidate.email and d["memberships"][0]["course_code"] == course.code
    assert d["attempts"][0]["exam_title"] == "Admin view check" and d["attempts"][0]["max_flags"] == 3
    m = client.get(f"/api/v1/admin/users/{mentor.id}", headers=auth(admin)).json()
    assert m["mentor_exams"][0]["title"] == "Admin view check"
    c = client.get(f"/api/v1/admin/courses/{course.id}", headers=auth(admin)).json()
    assert [x["user"]["id"] for x in c["mentors"]] == [str(mentor.id)] and c["assessments"] == 1
    assert c["topics"][0]["questions"] == 3
