"""Mentor results, marking queue and class analytics (Phase 6)."""

import uuid
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.db import get_db
from app.core.deps import mentor_only
from app.models import Answer, ExamSession, Misconception, Question, QuestionType, Topic, User
from app.models.results import ItemStat, Result, SessionMisconception, TopicResult
from app.routers.exams import own_exam
from app.routers.mentor import mentor_session
from app.scoring.rules import classify_topic
from app.scoring.service import SCORED, mark_answer, thresholds

router = APIRouter(tags=["results"], dependencies=[Depends(mentor_only)])


class TopicOut(BaseModel):
    topic_id: uuid.UUID
    name: str
    score_pct: float | None
    marks_obtained: float
    max_marks: float
    n_questions: int
    n_unmarked: int
    cls: str
    priority: float | None


class ResultRow(BaseModel):
    session_id: uuid.UUID
    candidate_name: str
    status: str
    score_pct: float | None
    percentile: float | None
    n_unmarked: int
    topics: list[TopicOut]


def _topic_names(db: Session, ids) -> dict[uuid.UUID, str]:
    ids = list(ids)
    return {t.id: t.name for t in db.scalars(select(Topic).where(Topic.id.in_(ids)))} if ids else {}


def _topics(db: Session, session_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[TopicOut]]:
    rows = (
        list(db.scalars(select(TopicResult).where(TopicResult.session_id.in_(session_ids))))
        if session_ids
        else []
    )
    names = _topic_names(db, {r.topic_id for r in rows})
    out: dict[uuid.UUID, list[TopicOut]] = defaultdict(list)
    for r in rows:
        out[r.session_id].append(
            TopicOut(
                topic_id=r.topic_id,
                name=names.get(r.topic_id, "?"),
                score_pct=r.score_pct,
                marks_obtained=r.marks_obtained,
                max_marks=r.max_marks,
                n_questions=r.n_questions,
                n_unmarked=r.n_unmarked,
                cls=r.cls,
                priority=r.priority,
            )
        )
    for v in out.values():
        v.sort(key=lambda t: t.name)
    return out


@router.get("/exams/{exam_id}/results", response_model=list[ResultRow])
def exam_results(exam_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    exam = own_exam(db, mentor, exam_id)
    rows = list(
        db.execute(
            select(ExamSession, User)
            .join(User, User.id == ExamSession.candidate_id)
            .where(ExamSession.exam_id == exam.id)
            .order_by(User.name)
        )
    )
    results = (
        {
            r.session_id: r
            for r in db.scalars(select(Result).where(Result.session_id.in_([s.id for s, _ in rows])))
        }
        if rows
        else {}
    )
    topics = _topics(db, [s.id for s, _ in rows])
    return [
        ResultRow(
            session_id=s.id,
            candidate_name=u.name,
            status=s.status.value,
            score_pct=results[s.id].score_pct if s.id in results else None,
            percentile=results[s.id].percentile if s.id in results else None,
            n_unmarked=results[s.id].n_unmarked if s.id in results else 0,
            topics=topics.get(s.id, []),
        )
        for s, u in rows
    ]


class ItemRow(BaseModel):
    question_id: uuid.UUID
    body: str
    topic: str
    n_attempted: int
    p: float | None
    d: float | None
    distractor_shares: dict[str, float]
    correct_key: str | None
    flags: list[str]


@router.get("/exams/{exam_id}/item-analysis", response_model=list[ItemRow])
def item_analysis(exam_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    exam = own_exam(db, mentor, exam_id)
    stats = {s.question_id: s for s in db.scalars(select(ItemStat).where(ItemStat.exam_id == exam.id))}
    out = []
    for eq in exam.questions:
        q = eq.question
        st = stats.get(q.id)
        if q.type != QuestionType.mcq:
            continue
        out.append(
            ItemRow(
                question_id=q.id,
                body=q.body,
                topic=q.topic.name,
                n_attempted=st.n_attempted if st else 0,
                p=st.p if st else None,
                d=st.d if st else None,
                distractor_shares=st.distractor_shares if st else {},
                correct_key=next((o.key for o in q.options if o.is_correct), None),
                flags=st.flags if st else [],
            )
        )
    return out


class TopicAverage(BaseModel):
    topic_id: uuid.UUID
    name: str
    average_pct: float | None
    average_cls: str  # class of the average, from the same deterministic thresholds
    strong: int
    developing: int
    weak: int
    insufficient: int


def _avg_cls(scores: list[float]) -> str:
    avg = round(sum(scores) / len(scores), 1) if scores else None
    t = thresholds()
    return classify_topic(avg, t.min_questions if scores else 0, t).value


class Analytics(BaseModel):
    n_scored: int
    average_pct: float | None
    score_buckets: list[dict]
    topics: list[TopicAverage]


@router.get("/exams/{exam_id}/analytics", response_model=Analytics)
def analytics(exam_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    exam = own_exam(db, mentor, exam_id)
    sids = list(
        db.scalars(
            select(ExamSession.id).where(ExamSession.exam_id == exam.id, ExamSession.status.in_(SCORED))
        )
    )
    results = [r for r in db.scalars(select(Result).where(Result.session_id.in_(sids)))] if sids else []
    scores = [r.score_pct for r in results if r.score_pct is not None]
    buckets = [
        {
            "range": f"{lo}–{lo + 9 if lo < 90 else 100}",
            "count": sum(lo <= s < lo + 10 or (lo == 90 and s == 100) for s in scores),
        }
        for lo in range(0, 100, 10)
    ]
    trs = list(db.scalars(select(TopicResult).where(TopicResult.session_id.in_(sids)))) if sids else []
    names = _topic_names(db, {t.topic_id for t in trs})
    agg: dict[uuid.UUID, dict] = defaultdict(
        lambda: {"scores": [], "strong": 0, "developing": 0, "weak": 0, "insufficient": 0}
    )
    for t in trs:
        a = agg[t.topic_id]
        a[t.cls] += 1
        if t.score_pct is not None:
            a["scores"].append(t.score_pct)
    topics = [
        TopicAverage(
            topic_id=tid,
            name=names.get(tid, "?"),
            average_pct=round(sum(a["scores"]) / len(a["scores"]), 1) if a["scores"] else None,
            average_cls=(
                "insufficient"
                if a["insufficient"] == a["strong"] + a["developing"] + a["weak"] + a["insufficient"]
                else _avg_cls(a["scores"])
            ),
            strong=a["strong"],
            developing=a["developing"],
            weak=a["weak"],
            insufficient=a["insufficient"],
        )
        for tid, a in agg.items()
    ]
    return Analytics(
        n_scored=len(results),
        average_pct=round(sum(scores) / len(scores), 1) if scores else None,
        score_buckets=buckets,
        topics=sorted(topics, key=lambda t: t.name),
    )


class MarkingItem(BaseModel):
    answer_id: uuid.UUID
    session_id: uuid.UUID
    candidate_name: str
    question_id: uuid.UUID
    question: str
    model_answer: str | None
    max_marks: float
    text: str
    marks_awarded: float | None


@router.get("/exams/{exam_id}/marking-queue", response_model=list[MarkingItem])
def marking_queue(
    exam_id: uuid.UUID,
    include_marked: bool = False,
    db: Session = Depends(get_db),
    mentor: User = Depends(mentor_only),
):
    exam = own_exam(db, mentor, exam_id)
    q = (
        select(Answer, Question, ExamSession, User)
        .join(Question, Question.id == Answer.question_id)
        .join(ExamSession, ExamSession.id == Answer.session_id)
        .join(User, User.id == ExamSession.candidate_id)
        .where(
            ExamSession.exam_id == exam.id,
            ExamSession.status.in_(SCORED),
            Question.type == QuestionType.short,
        )
    )
    if not include_marked:
        q = q.where(Answer.marks_awarded.is_(None))
    return [
        MarkingItem(
            answer_id=a.id,
            session_id=s.id,
            candidate_name=u.name,
            question_id=qq.id,
            question=qq.body,
            model_answer=qq.answer_text,
            max_marks=qq.marks,
            text=(a.value or {}).get("text", ""),
            marks_awarded=a.marks_awarded,
        )
        for a, qq, s, u in db.execute(q.order_by(Question.id, User.name))
    ]


class MarkIn(BaseModel):
    marks: float = Field(ge=0)
    comment: str | None = Field(default=None, max_length=500)


@router.post("/mentor/answers/{answer_id}/mark", status_code=204)
def mark(
    answer_id: uuid.UUID, body: MarkIn, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    answer = db.get(Answer, answer_id)
    if answer is None:
        raise HTTPException(404, "Answer not found")
    sess = mentor_session(db, mentor, answer.session_id, lock=True)
    if sess.status not in SCORED:
        raise HTTPException(409, "Only submitted assessments can be marked")
    q = db.get(Question, answer.question_id)
    if q.type != QuestionType.short:
        raise HTTPException(409, "Objective questions are marked automatically")
    if body.marks > q.marks:
        raise HTTPException(422, f"At most {q.marks} marks")
    before = {"marks_awarded": answer.marks_awarded}
    mark_answer(db, answer, body.marks, mentor.id, body.comment)
    audit.record(
        db,
        "answer.mark",
        "answers",
        answer.id,
        before=before,
        after={"marks_awarded": body.marks, "comment": body.comment},
    )
    db.commit()


class AnswerDetail(BaseModel):
    number: int
    question_id: uuid.UUID
    body: str
    topic: str
    type: str
    max_marks: float
    marks_awarded: float | None
    chosen_key: str | None
    correct_key: str | None
    text: str | None
    misconception: str | None


class MisconceptionOut(BaseModel):
    misconception_id: uuid.UUID
    description: str
    count: int


class SessionResult(BaseModel):
    session_id: uuid.UUID
    candidate_name: str
    exam_title: str
    status: str
    submitted_at: datetime | None
    score_pct: float | None
    percentile: float | None
    total_obtained: float
    total_max: float
    n_unmarked: int
    topics: list[TopicOut]
    misconceptions: list[MisconceptionOut]
    answers: list[AnswerDetail]


def session_result(db: Session, sess: ExamSession) -> SessionResult:
    r = db.get(Result, sess.id)
    if r is None:
        raise HTTPException(404, "Not scored yet")
    answers = {a.question_id: a for a in sess.answers}
    miscs = {m.id: m.description for m in db.scalars(select(Misconception))} if sess.answers else {}
    details = []
    for i, qid in enumerate(sess.question_order, start=1):
        q = db.get(Question, uuid.UUID(qid))
        a = answers.get(q.id)
        chosen = (a.value or {}).get("option_key") if a else None
        opt = next((o for o in q.options if o.key == chosen), None)
        details.append(
            AnswerDetail(
                number=i,
                question_id=q.id,
                body=q.body,
                topic=q.topic.name,
                type=q.type.value,
                max_marks=q.marks,
                marks_awarded=a.marks_awarded if a else 0.0,
                chosen_key=chosen,
                correct_key=next((o.key for o in q.options if o.is_correct), None),
                text=(a.value or {}).get("text") if a else None,
                misconception=miscs.get(opt.misconception_id)
                if opt and opt.misconception_id and not opt.is_correct
                else None,
            )
        )
    hits = list(db.scalars(select(SessionMisconception).where(SessionMisconception.session_id == sess.id)))
    return SessionResult(
        session_id=sess.id,
        candidate_name=db.get(User, sess.candidate_id).name,
        exam_title=sess.exam.title,
        status=sess.status.value,
        submitted_at=sess.submitted_at,
        score_pct=r.score_pct,
        percentile=r.percentile,
        total_obtained=r.total_obtained,
        total_max=r.total_max,
        n_unmarked=r.n_unmarked,
        topics=_topics(db, [sess.id]).get(sess.id, []),
        misconceptions=[
            MisconceptionOut(
                misconception_id=h.misconception_id,
                description=miscs.get(h.misconception_id, ""),
                count=h.count,
            )
            for h in hits
        ],
        answers=details,
    )


@router.get("/mentor/sessions/{session_id}/result", response_model=SessionResult)
def mentor_session_result(
    session_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    return session_result(db, mentor_session(db, mentor, session_id))
