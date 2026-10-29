"""Candidate dashboard, published recommendations and practice.

Only `published` summaries are read (filtered in SQL), and the response models below have NO data_notes or
integrity_note fields, so mentor-only content cannot be serialised to a candidate (rules 3 and 4). No proctoring data.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import candidate_only
from app.models import ExamSession, Question, Topic, User
from app.models.base import utcnow
from app.models.evaluation import EvaluationSummary, Note, PracticeAttempt, PracticeSet, SummaryStatus
from app.models.results import TopicResult
from app.routers.sessions import my_assessments
from app.schemas.sessions import MyAssessment

router = APIRouter(tags=["candidate dashboard"], dependencies=[Depends(candidate_only)])


class _Lenient(BaseModel):
    model_config = ConfigDict(
        extra="ignore"
    )  # unknown keys (e.g. mentor-only ones) are dropped, never echoed


class COverall(_Lenient):
    score_pct: float | None
    class_percentile: float | None = None
    change_vs_previous_pct: float | None = None


class CTopic(_Lenient):
    topic_id: str
    name: str
    score_pct: float
    n_questions: int


class CMisconception(_Lenient):
    explanation: str


class CNote(BaseModel):
    note_id: uuid.UUID
    title: str
    url_or_body: str
    level: str


class CRecommendation(_Lenient):
    topic_id: str
    priority: int
    reason: str
    notes: list[CNote] = []


class CandidateSummary(_Lenient):
    """Candidate-visible part of an approved and published summary. Deliberately no data_notes / integrity_note."""

    overall: COverall
    strong_topics: list[CTopic] = []
    developing_topics: list[CTopic] = []
    weak_topics: list[CTopic] = []
    misconceptions: list[CMisconception] = []
    recommended_topics: list[CRecommendation] = []
    message: str


class CTopicResult(BaseModel):
    topic_id: uuid.UUID
    name: str
    score_pct: float | None
    n_questions: int
    cls: str


class CPracticeAttempt(BaseModel):
    score_pct: float
    completed_at: datetime


class CPractice(BaseModel):
    id: uuid.UUID
    status: str
    n_questions: int
    due_at: datetime | None
    attempts: list[CPracticeAttempt]


class PublishedResult(BaseModel):
    exam_id: uuid.UUID
    exam_title: str
    submitted_at: datetime | None
    published_at: datetime
    approved_by_name: str | None
    topics: list[CTopicResult]
    summary: CandidateSummary
    practice: CPractice | None


class Dashboard(BaseModel):
    assessments: list[MyAssessment]
    results: list[PublishedResult]


def _published(db: Session, candidate_id: uuid.UUID) -> list[PublishedResult]:
    rows = db.execute(
        select(EvaluationSummary, ExamSession)
        .join(ExamSession, ExamSession.id == EvaluationSummary.session_id)
        .where(ExamSession.candidate_id == candidate_id, EvaluationSummary.status == SummaryStatus.published)
        .order_by(EvaluationSummary.published_at.desc())
    )
    out = []
    for s, sess in rows:
        content = s.content_json
        recs = []
        for r in content.get("recommended_topics", []):
            ids = [uuid.UUID(n) for n in r.get("note_ids", [])]
            notes = (
                list(db.scalars(select(Note).where(Note.id.in_(ids), Note.approved.is_(True)))) if ids else []
            )
            recs.append(
                CRecommendation.model_validate(
                    r
                    | {
                        "notes": [
                            CNote(note_id=n.id, title=n.title, url_or_body=n.url_or_body, level=n.level.value)
                            for n in notes
                        ]
                    }
                )
            )
        summary = CandidateSummary.model_validate(
            {k: v for k, v in content.items() if k != "recommended_topics"} | {"recommended_topics": recs}
        )
        trs = list(
            db.execute(
                select(TopicResult, Topic)
                .join(Topic, Topic.id == TopicResult.topic_id)
                .where(TopicResult.session_id == sess.id)
                .order_by(Topic.name)
            )
        )
        ps = db.scalar(select(PracticeSet).where(PracticeSet.summary_id == s.id))
        practice = None
        if ps:
            attempts = db.scalars(
                select(PracticeAttempt)
                .where(PracticeAttempt.practice_id == ps.id)
                .order_by(PracticeAttempt.completed_at)
            )
            practice = CPractice(
                id=ps.id,
                status=ps.status,
                n_questions=len(ps.question_ids),
                due_at=ps.due_at,
                attempts=[
                    CPracticeAttempt(score_pct=a.score_pct, completed_at=a.completed_at) for a in attempts
                ],
            )
        approver = db.get(User, s.approved_by) if s.approved_by else None
        out.append(
            PublishedResult(
                exam_id=sess.exam_id,
                exam_title=sess.exam.title,
                submitted_at=sess.submitted_at,
                published_at=s.published_at,
                approved_by_name=approver.name if approver else None,
                topics=[
                    CTopicResult(
                        topic_id=t.id,
                        name=t.name,
                        score_pct=tr.score_pct,
                        n_questions=tr.n_questions,
                        cls=tr.cls,
                    )
                    for tr, t in trs
                ],
                summary=summary,
                practice=practice,
            )
        )
    return out


@router.get("/candidates/me/dashboard", response_model=Dashboard)
def dashboard(db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    return Dashboard(assessments=my_assessments(db, user), results=_published(db, user.id))


@router.get("/candidates/me/recommendations", response_model=list[PublishedResult])
def recommendations(db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    return _published(db, user.id)


class PracticeQuestion(BaseModel):
    id: uuid.UUID
    body: str
    options: list[dict[str, str]]


class PracticeOut(BaseModel):
    id: uuid.UUID
    exam_title: str
    status: str
    questions: list[PracticeQuestion]


def _own_practice(db: Session, practice_id: uuid.UUID, user: User) -> PracticeSet:
    ps = db.get(PracticeSet, practice_id)
    if ps is None or ps.candidate_id != user.id:
        raise HTTPException(404, "Practice set not found")
    if db.get(EvaluationSummary, ps.summary_id).status != SummaryStatus.published:
        raise HTTPException(404, "Practice set not found")
    return ps


@router.get("/practice-sets/{practice_id}", response_model=PracticeOut)
def get_practice(practice_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    ps = _own_practice(db, practice_id, user)
    sess = db.get(ExamSession, db.get(EvaluationSummary, ps.summary_id).session_id)
    qs = [db.get(Question, uuid.UUID(q)) for q in ps.question_ids]
    return PracticeOut(
        id=ps.id,
        exam_title=sess.exam.title,
        status=ps.status,
        questions=[
            PracticeQuestion(
                id=q.id, body=q.body, options=[{"key": o.key, "text": o.text} for o in q.options]
            )
            for q in qs
            if q
        ],
    )


class PracticeAnswers(BaseModel):
    answers: dict[str, str] = Field(max_length=50)


class PracticeResult(BaseModel):
    score_pct: float
    correct: dict[str, bool]
    correct_keys: dict[str, str]


@router.post("/practice-sets/{practice_id}/submit", response_model=PracticeResult)
def submit_practice(
    practice_id: uuid.UUID,
    body: PracticeAnswers,
    db: Session = Depends(get_db),
    user: User = Depends(candidate_only),
):
    """Deterministic re-check score. Practice never changes assessment marks."""
    ps = _own_practice(db, practice_id, user)
    keys = {}
    for qid in ps.question_ids:
        q = db.get(Question, uuid.UUID(qid))
        keys[qid] = next(o.key for o in q.options if o.is_correct)
    correct = {qid: body.answers.get(qid) == key for qid, key in keys.items()}
    score = round(sum(correct.values()) / len(keys) * 100, 1) if keys else 0.0
    db.add(PracticeAttempt(practice_id=ps.id, answers=body.answers, score_pct=score, completed_at=utcnow()))
    ps.status = "completed"
    db.commit()
    return PracticeResult(score_pct=score, correct=correct, correct_keys=keys)
