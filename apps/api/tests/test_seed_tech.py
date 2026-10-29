from sqlalchemy import func, select

from app.models import Course, Note, Question, Topic
from app.seed import seed
from app.seed_data.tech_courses import COURSES
from app.seed_tech import seed_tech_courses


def test_course_content_is_well_formed():
    assert [c["code"] for c in COURSES] == ["FE-101", "BE-101", "FS-101", "DA-101"]
    for c in COURSES:
        assert sum(len(t["questions"]) for t in c["topics"]) == 20
        for t in c["topics"]:
            assert len(t["questions"]) >= 3 and t["notes"]  # classifiable topics, each with notes
            for difficulty, body, options, correct, misc in t["questions"]:
                assert difficulty in (1, 2, 3) and body and len(options) == 4 and len(set(options)) == 4
                assert 0 <= correct < 4 and misc != correct


def test_seed_tech_courses_is_idempotent(db):
    seed(db)
    assert seed_tech_courses(db) == {"courses": 4, "questions": 80, "notes": 32}
    assert seed_tech_courses(db) == {"courses": 0, "questions": 0, "notes": 0}
    fe = db.scalar(select(Course).where(Course.code == "FE-101"))
    assert db.scalar(select(func.count()).select_from(Question).where(Question.course_id == fe.id)) == 20
    assert db.scalar(select(func.count()).select_from(Topic).where(Topic.course_id == fe.id)) == 4
    assert db.scalar(select(func.count()).select_from(Note).where(Note.approved.is_(True))) == 32
    # exactly one correct option per question, and the correct key varies
    keys = []
    for q in db.scalars(select(Question).where(Question.course_id == fe.id)):
        assert sum(o.is_correct for o in q.options) == 1
        keys.append(next(o.key for o in q.options if o.is_correct))
    assert len(set(keys)) == 4
