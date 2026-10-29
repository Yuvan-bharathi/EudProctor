"""Test fixtures. Uses TEST_DATABASE_URL if set, otherwise an embedded PostgreSQL 16 (pgserver).

Each test starts with empty tables; the schema is created by running the real Alembic migrations.
"""

import os
import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret")
os.environ["ANTHROPIC_API_KEY"] = ""  # tests never depend on a developer .env
os.environ["ANTHROPIC_MODEL"] = ""
os.environ["AGENT_LLM"] = "anthropic"
os.environ["EVIDENCE_ENCRYPTION_KEY"] = "q3Jw2xkJ0Hk1nQh6c8bS7c3m3o2wQj0wWm3q2vYc9xU="  # test-only key
os.environ["STORAGE_DIR"] = str(
    __import__("pathlib").Path(__import__("tempfile").mkdtemp(prefix="eduproctor-test-"))
)
os.environ["IDENTITY_ENGINE"] = "dev"
os.environ["EVALUATION_JOBS"] = "off"
os.environ["MAIL_BACKEND"] = "memory"
os.environ["ENVIRONMENT"] = "test"

from app.core.audit import SYSTEM, set_actor  # noqa: E402
from app.core.db import SessionLocal, configure_engine  # noqa: E402
from app.core.security import create_token, hash_password  # noqa: E402
from app.devdb import local_postgres, migrate  # noqa: E402
from app.models import Base, Course, CourseMember, MemberRole, Role, User  # noqa: E402

_PW_HASH = hash_password("password123")


@pytest.fixture(scope="session")
def database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL") or local_postgres("eduproctor_test", fresh=True)
    migrate(url)
    return url


@pytest.fixture(scope="session")
def engine(database_url: str):
    eng = configure_engine(database_url)
    yield eng
    eng.dispose()


@pytest.fixture(autouse=True)
def _clean_db(engine) -> Iterator[None]:
    yield
    tables = ", ".join(f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables))
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db(engine) -> Iterator[Session]:
    s = SessionLocal()
    set_actor(s, SYSTEM)
    try:
        yield s
    finally:
        s.close()


@pytest.fixture
def client(engine) -> TestClient:
    from app.main import app

    return TestClient(app)


def make_user(db: Session, role: Role, email: str | None = None, name: str | None = None) -> User:
    u = User(
        role=role,
        email=email or f"{role.value}-{uuid.uuid4().hex[:8]}@example.com",
        name=name or f"Test {role.value}",
        password_hash=_PW_HASH,
    )
    db.add(u)
    db.commit()
    return u


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_token(user.id, user.role.value, 'access')}"}


@pytest.fixture
def admin(db) -> User:
    return make_user(db, Role.admin)


@pytest.fixture
def mentor(db) -> User:
    return make_user(db, Role.mentor)


@pytest.fixture
def candidate(db) -> User:
    return make_user(db, Role.candidate)


@pytest.fixture
def course(db, mentor, candidate) -> Course:
    c = Course(name="Thermodynamics", code=f"T-{uuid.uuid4().hex[:6]}")
    db.add(c)
    db.flush()
    db.add_all(
        [
            CourseMember(course_id=c.id, user_id=mentor.id, role=MemberRole.mentor),
            CourseMember(course_id=c.id, user_id=candidate.id, role=MemberRole.candidate),
        ]
    )
    db.commit()
    return c
