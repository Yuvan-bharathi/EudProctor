"""Demo data on top of app.seed: realistic synthetic results, flags, glances and summaries. Dev only; no real people.

uv run python -m app.demo_seed      (normally run automatically by app.devserver on an empty database)
"""

import random
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.evaluation import run_evaluation
from app.agent.mock_llm import MockLLM
from app.core import audit
from app.core.config import get_settings
from app.models import (
    Answer,
    CandidateFlag,
    Course,
    CourseMember,
    EvaluationSummary,
    Exam,
    ExamAssignment,
    ExamQuestion,
    ExamSession,
    GlanceLog,
    MemberRole,
    Misconception,
    Note,
    PracticeAttempt,
    PracticeSet,
    ProctorEvent,
    Question,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
    SessionStatus,
    SubmitReason,
    SummaryStatus,
    Topic,
    User,
)
from app.models.base import utcnow
from app.scoring.service import recompute_exam, score_session

TOPICS = {
    "Heat transfer": ("Confuses conduction with convection", 0.75),
    "First law": ("Mixes up heat and work sign convention", 0.45),
    "Entropy": ("Thinks entropy always decreases when cooled", 0.55),
    "Thermodynamic cycles": ("Treats a cycle as having net change in internal energy", 0.6),
    "Ideal gases": ("Uses Celsius instead of kelvin in pV = nRT", 0.7),
}
NOTES = {
    "Heat transfer": [("Modes of heat transfer", "https://example.com/notes/heat-modes", "intro")],
    "First law": [
        ("Energy balance basics", "https://example.com/notes/energy-balance", "core"),
        ("Sign conventions for heat and work", "https://example.com/notes/sign-conventions", "intro"),
    ],
    "Ideal gases": [("Working with absolute temperature", "https://example.com/notes/kelvin", "intro")],
}
UNAPPROVED_NOTE = ("Entropy (draft, not reviewed)", "https://example.com/notes/entropy-draft", "core")


def _questions(db: Session, course: Course, mentor: User) -> dict[str, list[Question]]:
    out: dict[str, list[Question]] = {}
    for name, (misc_text, _) in TOPICS.items():
        topic = Topic(course_id=course.id, name=name)
        db.add(topic)
        db.flush()
        misc = Misconception(topic_id=topic.id, description=misc_text)
        db.add(misc)
        db.flush()
        qs = []
        for i in range(8):
            q = Question(
                course_id=course.id,
                topic_id=topic.id,
                type=QuestionType.mcq,
                difficulty=1 + i % 3,
                marks=1,
                body=f"{name}: question {i + 1} - which option is correct?",
                status=QuestionStatus.approved,
                source=QuestionSource.mentor,
                created_by=mentor.id,
                options=[
                    QuestionOption(key="A", text="The correct statement", is_correct=True),
                    QuestionOption(
                        key="B", text=f"A statement reflecting: {misc_text.lower()}", misconception_id=misc.id
                    ),
                    QuestionOption(key="C", text="A plausible but wrong statement"),
                    QuestionOption(key="D", text="An unrelated statement"),
                ],
            )
            db.add(q)
            qs.append(q)
        if name == "Entropy":
            for i in range(2):
                qs.append(
                    Question(
                        course_id=course.id,
                        topic_id=topic.id,
                        type=QuestionType.short,
                        difficulty=2,
                        marks=2,
                        body=f"Entropy: explain in two sentences why process {i + 1} is irreversible.",
                        answer_text="Entropy of the universe increases; the process cannot be reversed without "
                        "external work.",
                        status=QuestionStatus.approved,
                        source=QuestionSource.mentor,
                        created_by=mentor.id,
                    )
                )
                db.add(qs[-1])
        for title, url, level in NOTES.get(name, []):
            db.add(Note(topic_id=topic.id, title=title, url_or_body=url, level=level, approved=True))
        if name == "Entropy":
            db.add(
                Note(
                    topic_id=topic.id,
                    title=UNAPPROVED_NOTE[0],
                    url_or_body=UNAPPROVED_NOTE[1],
                    approved=False,
                )
            )
        db.flush()
        out[name] = qs
    return out


def _exam(
    db: Session, course: Course, mentor: User, title: str, start_days_ago: float, questions: list[Question]
) -> Exam:
    s = get_settings()
    now = utcnow()
    exam = Exam(
        course_id=course.id,
        mentor_id=mentor.id,
        title=title,
        duration_min=30,
        window_start=now - timedelta(days=start_days_ago),
        window_end=now - timedelta(days=start_days_ago - 2),
        shuffle=True,
        flag_threshold_s=s.flag_threshold_s,
        glance_min_s=s.glance_min_s,
        max_flags=s.max_flags,
    )
    db.add(exam)
    db.flush()
    for i, q in enumerate(questions):
        exam.questions.append(ExamQuestion(question_id=q.id, order=i))
    db.flush()
    return exam


def _take(db: Session, rng: random.Random, exam: Exam, cand: User, ability: float) -> ExamSession:
    a = ExamAssignment(
        exam_id=exam.id, candidate_id=cand.id, link_sent_at=exam.window_start, link_used_at=exam.window_start
    )
    db.add(a)
    db.flush()
    started = exam.window_start + timedelta(hours=rng.uniform(1, 30))
    sess = ExamSession(
        exam_id=exam.id,
        candidate_id=cand.id,
        assignment_id=a.id,
        status=SessionStatus.submitted,
        started_at=started,
        deadline_at=started + timedelta(minutes=exam.duration_min),
        submitted_at=started + timedelta(minutes=rng.uniform(18, 29)),
        submit_reason=SubmitReason.manual,
        question_order=[str(eq.question_id) for eq in exam.questions],
        option_order={str(eq.question_id): [o.key for o in eq.question.options] for eq in exam.questions},
    )
    db.add(sess)
    db.flush()
    for eq in exam.questions:
        q = eq.question
        base = TOPICS[q.topic.name][1]
        if q.type == QuestionType.short:
            text = "Entropy increases because heat flows from hot to cold." if rng.random() < 0.8 else ""
            if not text:
                marks = 0.0  # blank: nothing to mark
            elif rng.random() < 0.85:
                marks = rng.choice([0.5, 1.0, 1.5, 2.0])  # already marked by the mentor
            else:
                marks = None  # still in the marking queue
            ans = Answer(
                session_id=sess.id,
                question_id=q.id,
                value={"text": text},
                client_seq=1,
                answered_at=started,
                marks_awarded=marks,
            )
        else:
            p = min(0.97, max(0.05, base + ability - 0.1 * (q.difficulty - 2)))
            key = "A" if rng.random() < p else ("B" if rng.random() < 0.6 else rng.choice("CD"))
            ans = Answer(
                session_id=sess.id,
                question_id=q.id,
                value={"option_key": key},
                client_seq=1,
                answered_at=started,
            )
        db.add(ans)
    _proctoring(db, rng, sess, started)
    db.flush()
    return sess


def _proctoring(db: Session, rng: random.Random, sess: ExamSession, started) -> None:
    max_flags = sess.exam.max_flags
    n_flags = rng.choices([0, 1, 2, 3, 4], weights=[45, 25, 15, 10, 5])[0]
    for i in range(n_flags):
        at = started + timedelta(minutes=2 + i * 5 + rng.uniform(0, 3))
        no = i + 1 if i < max_flags else None
        ev = ProctorEvent(
            session_id=sess.id,
            client_event_id=uuid.uuid4().hex,
            type="LOOK_AWAY_FLAG" if no else "LOOK_AWAY_POST_LIMIT",
            severity="high",
            started_at=at,
            duration_ms=rng.randint(3100, 9000),
            exam_clock_ms=int((at - started).total_seconds() * 1000),
            payload={
                "source": rng.choice(["head", "eyes"]),
                "direction": rng.choice(["left", "right", "down"]),
                "flag_no": no,
            },
        )
        db.add(ev)
        db.flush()
        db.add(
            CandidateFlag(
                session_id=sess.id,
                event_id=ev.id,
                flag_no=no,
                source=ev.payload["source"],
                direction=ev.payload["direction"],
                started_at=at,
                duration_ms=ev.duration_ms,
                notified=no is not None,
            )
        )
    sess.flag_count = min(n_flags, max_flags)
    sess.flag_limit_reached = n_flags > max_flags
    for _ in range(rng.randint(0, 9)):
        at = started + timedelta(minutes=rng.uniform(1, 25))
        db.add(
            GlanceLog(
                session_id=sess.id,
                client_event_id=uuid.uuid4().hex,
                source=rng.choice(["head", "eyes"]),
                direction=rng.choice(["left", "right", "up", "down"]),
                started_at=at,
                duration_ms=rng.randint(1000, 2900),
                exam_clock_ms=int((at - started).total_seconds() * 1000),
            )
        )
    if rng.random() < 0.2:
        at = started + timedelta(minutes=rng.uniform(5, 20))
        db.add(
            ProctorEvent(
                session_id=sess.id,
                client_event_id=uuid.uuid4().hex,
                type="TAB_SWITCH",
                severity="low",
                started_at=at,
                duration_ms=rng.randint(2500, 8000),
            )
        )


def _approve(db: Session, s: EvaluationSummary, mentor: User, when) -> None:
    s.status = SummaryStatus.approved
    s.approved_by = mentor.id
    s.approved_at = when
    audit.record(
        db, "summary.approve", "evaluation_summaries", s.id, actor=audit.Actor("user", str(mentor.id))
    )


def _publish(db: Session, rng: random.Random, s: EvaluationSummary, sess: ExamSession, when) -> None:
    from app.routers.evaluation import _top_up_practice

    qids = [
        q for r in s.content_json.get("recommended_topics", []) for q in r.get("practice_question_ids", [])
    ]
    qids = _top_up_practice(db, sess, s, list(dict.fromkeys(qids)))
    s.status = SummaryStatus.published
    s.published_at = when
    audit.record(db, "summary.publish", "evaluation_summaries", s.id, after={"practice_questions": len(qids)})
    if qids:
        ps = PracticeSet(
            summary_id=s.id,
            candidate_id=sess.candidate_id,
            question_ids=qids,
            due_at=when + timedelta(days=7),
        )
        db.add(ps)
        db.flush()
        if rng.random() < 0.5:
            db.add(
                PracticeAttempt(
                    practice_id=ps.id,
                    answers={},
                    score_pct=round(rng.uniform(50, 100), 1),
                    completed_at=when + timedelta(days=2),
                )
            )
            ps.status = "completed"


def seed_demo(db: Session) -> dict[str, int]:
    if get_settings().environment not in {"dev", "test"}:
        raise RuntimeError("Demo data is synthetic and uses a dev-only mock agent; refusing outside dev/test")
    rng = random.Random(2026)
    course = db.scalar(select(Course).where(Course.code == "THERMO-101"))
    mentor = db.scalar(select(User).where(User.email == "mentor1@example.com"))
    candidates = list(
        db.scalars(
            select(User)
            .join(CourseMember, CourseMember.user_id == User.id)
            .where(CourseMember.course_id == course.id, CourseMember.role == MemberRole.candidate)
            .order_by(User.email)
        )
    )
    audit.set_actor(db, audit.Actor("system", "demo_seed"))
    bank = _questions(db, course, mentor)

    def pick(per_topic: int, short: bool) -> list[Question]:
        qs = []
        for name, items in bank.items():
            mcqs = [q for q in items if q.type == QuestionType.mcq]
            qs += rng.sample(
                mcqs, per_topic if name != "Thermodynamic cycles" else 2
            )  # cycles: insufficient data
            if short and name == "Entropy":
                qs += [q for q in items if q.type == QuestionType.short]
        return qs

    exam1 = _exam(db, course, mentor, "Unit test 1 · Foundations", 21, pick(3, False))
    exam2 = _exam(db, course, mentor, "Unit test 2 · Energy and entropy", 9, pick(4, True))
    exam3 = _exam(db, course, mentor, "Unit test 3 · Mixed review", 0.5, pick(3, False))
    exam3.window_end = utcnow() + timedelta(days=5)
    for cand in candidates:
        db.add(ExamAssignment(exam_id=exam3.id, candidate_id=cand.id))
    db.commit()

    abilities = {c.id: rng.gauss(0, 0.15) for c in candidates}
    sessions = {}
    for exam in (exam1, exam2):
        for cand in candidates:
            sess = _take(db, rng, exam, cand, abilities[cand.id] + (0.05 if exam is exam2 else 0))
            score_session(db, sess)
            sessions[(exam.id, cand.id)] = sess
        recompute_exam(db, exam)
        db.commit()

    summaries = 0
    for exam, published_share, approved_share in ((exam1, 0.8, 0.1), (exam2, 0.0, 0.35)):
        for i, cand in enumerate(candidates):
            sess = sessions[(exam.id, cand.id)]
            run_evaluation(db, sess.id, triggered_by="demo_seed", llm=MockLLM())
            s = db.scalar(select(EvaluationSummary).where(EvaluationSummary.session_id == sess.id))
            if s is None:
                continue
            summaries += 1
            r = (i + 0.5) / len(candidates)
            when = sess.submitted_at + timedelta(days=1)
            if cand.email == "candidate01@example.com" or r < published_share:
                if exam is exam1:
                    if rng.random() < 0.25:
                        s.edited_by_mentor = True
                    _approve(db, s, mentor, when)
                    _publish(db, rng, s, sess, when + timedelta(hours=2))
            elif r < published_share + approved_share:
                _approve(db, s, mentor, when)
            db.commit()
    return {"assessments": 3, "sessions": len(sessions), "summaries": summaries}


if __name__ == "__main__":
    from app.core.db import SessionLocal, get_engine
    from app.seed import seed

    get_engine()
    with SessionLocal() as session:
        if session.scalar(select(User).limit(1)) is None:
            print(seed(session))
        print(seed_demo(session))
