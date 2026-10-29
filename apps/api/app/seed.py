"""Synthetic seed data. No real people: invented names, @example.com emails.

uv run python -m app.seed
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import SYSTEM, set_actor
from app.core.config import get_settings
from app.core.db import SessionLocal, get_engine
from app.core.security import hash_password
from app.models import Course, CourseMember, MemberRole, Role, User

DEV_PASSWORD = "eduproctor-dev"

FIRST = [
    "Aarav",
    "Bela",
    "Chen",
    "Divya",
    "Elif",
    "Farid",
    "Gita",
    "Hiro",
    "Isha",
    "Jonah",
    "Kavya",
    "Leo",
    "Maya",
    "Nikhil",
    "Oona",
    "Pranav",
    "Qiu",
    "Riya",
    "Samir",
    "Tara",
    "Uma",
    "Vikram",
    "Wen",
    "Ximena",
    "Yusuf",
    "Zara",
    "Arjun",
    "Bianca",
    "Dev",
    "Esha",
]
LAST = ["Rao", "Iyer", "Lin", "Nair", "Kaya", "Haddad", "Menon", "Sato", "Kapoor", "Reyes"]


def candidate_name(i: int) -> str:
    return f"{FIRST[i % len(FIRST)]} {LAST[(i * 7) % len(LAST)]}"


def seed(db: Session) -> dict[str, int]:
    if get_settings().environment not in {"dev", "test"}:
        raise RuntimeError("Seed data uses a shared dev password; refusing outside dev/test")
    set_actor(db, SYSTEM)
    pw = hash_password(DEV_PASSWORD)

    def user(role: Role, email: str, name: str) -> User:
        u = User(role=role, email=email, name=name, password_hash=pw)
        db.add(u)
        return u

    user(Role.admin, "admin@example.com", "Admin User")
    m1 = user(Role.mentor, "mentor1@example.com", "Mentor Asha")
    m2 = user(Role.mentor, "mentor2@example.com", "Mentor Ravi")
    candidates = [
        user(Role.candidate, f"candidate{i:02d}@example.com", candidate_name(i)) for i in range(1, 31)
    ]

    thermo = Course(name="Thermodynamics 101", code="THERMO-101")
    ds = Course(name="Data Structures", code="CS-201")
    db.add_all([thermo, ds])
    db.flush()
    db.add(CourseMember(course_id=thermo.id, user_id=m1.id, role=MemberRole.mentor))
    db.add(CourseMember(course_id=ds.id, user_id=m2.id, role=MemberRole.mentor))
    for i, c in enumerate(candidates):
        db.add(CourseMember(course_id=thermo.id, user_id=c.id, role=MemberRole.candidate))
        if i < 15:
            db.add(CourseMember(course_id=ds.id, user_id=c.id, role=MemberRole.candidate))
    db.commit()
    return {"admins": 1, "mentors": 2, "candidates": len(candidates), "courses": 2}


def seed_if_empty(demo: bool = True) -> None:
    get_engine()
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)) == 0:
            print("Seeded:", seed(db))
            if demo:
                from app.demo_seed import seed_demo
                from app.seed_tech import seed_tech_courses

                print("Demo data:", seed_demo(db))
                print("Tech courses:", seed_tech_courses(db))


if __name__ == "__main__":
    get_engine()
    with SessionLocal() as session:
        print(seed(session))
