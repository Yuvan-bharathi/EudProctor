"""Persisted scoring. Marks are written only by deterministic code (objective questions) or by a mentor
(subjective questions, via the marking endpoint). The AI agent has no path to any function here that writes marks."""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Answer, Exam, ExamSession, Question, QuestionType, SessionStatus
from app.models.base import utcnow
from app.models.results import ItemStat, Result, SessionMisconception, TopicResult
from app.scoring.rules import ItemScore, Response, Thresholds, item_analysis, percentile_ranks, topic_results
from app.scoring.rules import detect_misconceptions as detect

SCORED = (SessionStatus.scored, SessionStatus.analysed)


def thresholds() -> Thresholds:
    s = get_settings()
    return Thresholds(
        strong_pct=s.strong_topic_pct,
        weak_pct=s.weak_topic_pct,
        min_questions=s.min_questions_per_topic,
        mastery_pct=s.priority_mastery_pct if s.priority_mastery_pct is not None else s.strong_topic_pct,
        misconception_min=s.misconception_min_count,
        group_fraction=s.item_group_fraction,
    )


def _questions(db: Session, sess: ExamSession) -> list[Question]:
    ids = [uuid.UUID(q) for q in sess.question_order]
    by_id = {q.id: q for q in db.scalars(select(Question).where(Question.id.in_(ids)))}
    return [by_id[i] for i in ids if i in by_id]


def item_scores(db: Session, sess: ExamSession) -> list[ItemScore]:
    answers = {a.question_id: a for a in sess.answers}
    out = []
    for q in _questions(db, sess):
        a = answers.get(q.id)
        chosen = (a.value or {}).get("option_key") if a else None
        misc = None
        if q.type == QuestionType.mcq:
            opt = next((o for o in q.options if o.key == chosen), None)
            marks = q.marks if opt is not None and opt.is_correct else 0.0
            misc = (
                str(opt.misconception_id)
                if opt is not None and opt.misconception_id and not opt.is_correct
                else None
            )
            if a is not None:
                a.marks_awarded = marks
        else:
            text = ((a.value or {}).get("text") or "").strip() if a else ""
            marks = (
                (a.marks_awarded if a else None) if text else 0.0
            )  # blank answers score 0, no marking needed
            if a is not None and not text:
                a.marks_awarded = 0.0
        out.append(ItemScore(str(q.id), str(q.topic_id), q.marks, marks, chosen, misc))
    return out


def score_session(db: Session, sess: ExamSession) -> Result:
    t = thresholds()
    items = item_scores(db, sess)
    topics = topic_results(items, t)
    db.execute(delete(TopicResult).where(TopicResult.session_id == sess.id))
    db.execute(delete(SessionMisconception).where(SessionMisconception.session_id == sess.id))
    for r in topics:
        db.add(
            TopicResult(
                session_id=sess.id,
                topic_id=uuid.UUID(r.topic_id),
                marks_obtained=r.marks_obtained,
                max_marks=r.max_marks,
                score_pct=r.score_pct,
                n_questions=r.n_questions,
                n_unmarked=r.n_unmarked,
                cls=r.cls.value,
                priority=r.priority,
            )
        )
    for mid, n in detect(items, t).items():
        db.add(SessionMisconception(session_id=sess.id, misconception_id=uuid.UUID(mid), count=n))
    marked = [i for i in items if i.marks is not None]
    obtained = sum(i.marks or 0 for i in marked)
    total_max = sum(i.max_marks for i in marked)
    result = db.get(Result, sess.id) or Result(
        session_id=sess.id, total_obtained=0, total_max=0, score_pct=None
    )
    result.total_obtained = obtained
    result.total_max = total_max
    result.score_pct = round(obtained / total_max * 100, 2) if total_max else None
    result.n_unmarked = len(items) - len(marked)
    result.computed_at = utcnow()
    db.add(result)
    if sess.status == SessionStatus.submitted:
        from app.services.sessions import (
            transition,  # local import: sessions calls into this module on submit
        )

        transition(db, sess, SessionStatus.scored, "scored")
    db.flush()
    return result


def recompute_exam(db: Session, exam: Exam) -> None:
    """Class percentiles and item analysis across all scored attempts of one assessment."""
    sessions = list(
        db.scalars(select(ExamSession).where(ExamSession.exam_id == exam.id, ExamSession.status.in_(SCORED)))
    )
    results = {
        r.session_id: r
        for r in db.scalars(select(Result).where(Result.session_id.in_([s.id for s in sessions])))
    }
    pct = percentile_ranks({str(sid): r.score_pct for sid, r in results.items() if r.score_pct is not None})
    for sid, r in results.items():
        r.percentile = pct.get(str(sid))

    mcqs = [eq.question for eq in exam.questions if eq.question.type == QuestionType.mcq]
    keys = {str(q.id): next(o.key for o in q.options if o.is_correct) for q in mcqs}
    options = {str(q.id): [o.key for o in q.options] for q in mcqs}
    responses = []
    for s in sessions:
        chosen = {str(a.question_id): (a.value or {}).get("option_key") for a in s.answers}
        r = results.get(s.id)
        responses.append(Response(str(s.id), r.total_obtained if r else 0, {q: chosen.get(q) for q in keys}))
    db.execute(delete(ItemStat).where(ItemStat.exam_id == exam.id))
    for st in item_analysis(responses, keys, options, thresholds()):
        db.add(
            ItemStat(
                exam_id=exam.id,
                question_id=uuid.UUID(st.question_id),
                n_attempted=st.n_attempted,
                p=st.p,
                d=st.d,
                distractor_shares=st.distractor_shares,
                flags=st.flags,
            )
        )
    db.flush()


def on_submitted(db: Session, sess: ExamSession) -> None:
    score_session(db, sess)
    recompute_exam(db, sess.exam)
    from app.jobs.evaluation import enqueue_evaluation  # Phase 7: agent drafts after scoring

    enqueue_evaluation(db, sess)


def mark_answer(db: Session, answer: Answer, marks: float, mentor_id: uuid.UUID, comment: str | None) -> None:
    answer.marks_awarded = marks
    answer.marked_by = mentor_id
    answer.marked_at = utcnow()
    answer.mark_comment = comment
    sess = db.get(ExamSession, answer.session_id)
    score_session(db, sess)
    recompute_exam(db, sess.exam)
