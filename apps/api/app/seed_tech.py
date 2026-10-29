"""Adds the Frontend, Backend, Full Stack and Data Analyst courses with questions and approved notes.

Idempotent: a course whose code already exists is skipped. Synthetic users only (from app.seed).

    uv run python -m app.seed_tech
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import get_settings
from app.models import (
    Course,
    CourseMember,
    MemberRole,
    Misconception,
    Note,
    Question,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
    Topic,
    User,
)
from app.seed_data.tech_courses import COURSES

KEYS = "ABCD"


def rotate(options: list[str], correct: int, misc: int | None, k: int) -> tuple[list[str], int, int | None]:
    """Move the options round by k so the correct answer is not always A (deterministic)."""
    k %= len(options)
    rotated = options[-k:] + options[:-k] if k else list(options)
    shift = lambda i: (i + k) % len(options)  # noqa: E731
    return rotated, shift(correct), None if misc is None else shift(misc)


def seed_tech_courses(db: Session) -> dict[str, int]:
    if get_settings().environment not in {"dev", "test"}:
        raise RuntimeError("Seed data is for development; refusing outside dev/test")
    audit.set_actor(db, audit.Actor("system", "seed_tech"))
    added = {"courses": 0, "questions": 0, "notes": 0}
    for spec in COURSES:
        if db.scalar(select(Course).where(Course.code == spec["code"])):
            continue
        mentor = db.scalar(select(User).where(User.email == spec["mentor"]))
        course = Course(name=spec["name"], code=spec["code"])
        db.add(course)
        db.flush()
        if mentor:
            db.add(CourseMember(course_id=course.id, user_id=mentor.id, role=MemberRole.mentor))
        for i in spec["candidates"]:
            cand = db.scalar(select(User).where(User.email == f"candidate{i:02d}@example.com"))
            if cand:
                db.add(CourseMember(course_id=course.id, user_id=cand.id, role=MemberRole.candidate))
        for t in spec["topics"]:
            topic = Topic(course_id=course.id, name=t["name"])
            db.add(topic)
            db.flush()
            misc = Misconception(topic_id=topic.id, description=t["misconception"])
            db.add(misc)
            db.flush()
            for n, (difficulty, body, options, correct, misc_index) in enumerate(t["questions"]):
                options, correct, misc_index = rotate(options, correct, misc_index, n + len(t["name"]))
                db.add(
                    Question(
                        course_id=course.id,
                        topic_id=topic.id,
                        type=QuestionType.mcq,
                        difficulty=difficulty,
                        marks=1,
                        body=body,
                        status=QuestionStatus.approved,
                        source=QuestionSource.mentor,
                        created_by=mentor.id if mentor else None,
                        options=[
                            QuestionOption(
                                key=KEYS[j],
                                text=text,
                                is_correct=j == correct,
                                misconception_id=misc.id if j == misc_index and j != correct else None,
                            )
                            for j, text in enumerate(options)
                        ],
                    )
                )
                added["questions"] += 1
            for title, body, level in t["notes"]:
                db.add(Note(topic_id=topic.id, title=title, url_or_body=body, level=level, approved=True))
                added["notes"] += 1
        added["courses"] += 1
        db.commit()
    return added


if __name__ == "__main__":
    from app.core.db import SessionLocal, get_engine

    get_engine()
    with SessionLocal() as session:
        print(seed_tech_courses(session))
