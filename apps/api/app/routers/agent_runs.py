"""Agent observability (Phase 8). Shows recorded steps and stated reasons only, never raw chain-of-thought (the
runner stores visible text, not thinking blocks). Mentors see runs for their own courses/assessments; admins see all."""

import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.describe import build_labels, describe
from app.core.db import get_db
from app.core.deps import mentor_or_admin
from app.models import (
    AgentRun,
    AgentStep,
    CourseMember,
    EvaluationSummary,
    Exam,
    ExamSession,
    MemberRole,
    Question,
    QuestionStatus,
    Role,
    SummaryStatus,
    User,
)
from app.models.results import Result

router = APIRouter(prefix="/agent", tags=["agent observability"], dependencies=[Depends(mentor_or_admin)])
MAX_RUNS = 500


def _visible(db: Session, user: User, runs: list[AgentRun]) -> list[AgentRun]:
    if user.role == Role.admin:
        return runs
    courses = {
        str(c)
        for c in db.scalars(
            select(CourseMember.course_id).where(
                CourseMember.user_id == user.id, CourseMember.role == MemberRole.mentor
            )
        )
    }
    session_ids = [uuid.UUID(r.subject_id) for r in runs if r.subject_type == "session" and r.subject_id]
    own_sessions = (
        {
            str(s)
            for s in db.scalars(
                select(ExamSession.id)
                .join(Exam, Exam.id == ExamSession.exam_id)
                .where(ExamSession.id.in_(session_ids), Exam.mentor_id == user.id)
            )
        }
        if session_ids
        else set()
    )
    return [
        r
        for r in runs
        if (r.subject_type == "course" and r.subject_id in courses)
        or (r.subject_type == "session" and r.subject_id in own_sessions)
    ]


def _duration_ms(r: AgentRun) -> int | None:
    return int((r.ended_at - r.started_at).total_seconds() * 1000) if r.ended_at else None


class RunRow(BaseModel):
    id: uuid.UUID
    agent: str
    status: str
    goal: str
    model: str | None
    prompt_version: str | None
    tokens_in: int
    tokens_out: int
    cost_usd: float
    duration_ms: int | None
    started_at: datetime
    error: str | None
    subject_type: str | None
    subject_id: str | None


def _row(r: AgentRun) -> RunRow:
    return RunRow(
        id=r.id,
        agent=r.agent,
        status=r.status,
        goal=r.goal,
        model=r.model,
        prompt_version=r.prompt_version,
        tokens_in=r.tokens_in,
        tokens_out=r.tokens_out,
        cost_usd=r.cost_usd,
        duration_ms=_duration_ms(r),
        started_at=r.started_at,
        error=r.error,
        subject_type=r.subject_type,
        subject_id=r.subject_id,
    )


class AgentStats(BaseModel):
    agent: str
    runs: int
    succeeded: int
    success_rate: float | None
    avg_duration_ms: float | None
    tokens_in: int
    tokens_out: int
    cost_usd: float


class Dashboard(BaseModel):
    agents: list[AgentStats]
    summaries_reviewed: int
    approved_without_edits: int
    approved_without_edits_share: float | None
    awaiting_review: int
    recent: list[RunRow]


@router.get("/dashboard", response_model=Dashboard)
def dashboard(db: Session = Depends(get_db), user: User = Depends(mentor_or_admin)):
    runs = _visible(
        db, user, list(db.scalars(select(AgentRun).order_by(AgentRun.started_at.desc()).limit(MAX_RUNS)))
    )
    by_agent: dict[str, list[AgentRun]] = defaultdict(list)
    for r in runs:
        by_agent[r.agent].append(r)
    stats = []
    for name, rs in sorted(by_agent.items()):
        done = [d for d in (_duration_ms(r) for r in rs) if d is not None]
        ok = sum(r.status == "succeeded" for r in rs)
        finished = sum(r.status != "running" for r in rs)
        stats.append(
            AgentStats(
                agent=name,
                runs=len(rs),
                succeeded=ok,
                success_rate=round(ok / finished, 3) if finished else None,
                avg_duration_ms=round(sum(done) / len(done), 1) if done else None,
                tokens_in=sum(r.tokens_in for r in rs),
                tokens_out=sum(r.tokens_out for r in rs),
                cost_usd=round(sum(r.cost_usd for r in rs), 4),
            )
        )
    # summary outcomes for the sessions this user can see
    q = (
        select(EvaluationSummary)
        .join(ExamSession, ExamSession.id == EvaluationSummary.session_id)
        .join(Exam, Exam.id == ExamSession.exam_id)
    )
    if user.role != Role.admin:
        q = q.where(Exam.mentor_id == user.id)
    summaries = list(db.scalars(q))
    reviewed = [s for s in summaries if s.status in (SummaryStatus.approved, SummaryStatus.published)]
    clean = sum(not s.edited_by_mentor for s in reviewed)
    awaiting = sum(s.status == SummaryStatus.draft and s.ready_for_review for s in summaries)
    return Dashboard(
        agents=stats,
        summaries_reviewed=len(reviewed),
        approved_without_edits=clean,
        approved_without_edits_share=round(clean / len(reviewed), 3) if reviewed else None,
        awaiting_review=awaiting,
        recent=[_row(r) for r in runs[:50]],
    )


@router.get("/runs", response_model=list[RunRow])
def list_runs(
    agent: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(mentor_or_admin),
):
    q = select(AgentRun).order_by(AgentRun.started_at.desc()).limit(MAX_RUNS)
    if agent:
        q = q.where(AgentRun.agent == agent)
    if status:
        q = q.where(AgentRun.status == status)
    return [_row(r) for r in _visible(db, user, list(db.scalars(q)))]


class StepOut(BaseModel):
    seq: int
    kind: str
    tool: str | None
    args: dict[str, Any] | None
    output_summary: str | None
    reason: str | None
    latency_ms: int
    tokens_in: int
    tokens_out: int
    error: str | None
    at: datetime
    # plain-language view (ids replaced by names)
    title: str
    detail: str | None
    facts: list[dict[str, str]]


class Decision(BaseModel):
    kind: str
    status: str | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    edited_by_mentor: bool | None = None
    version: int | None = None
    accepted: int | None = None
    skipped: int | None = None
    pending: int | None = None


class RunDetail(RunRow):
    inputs: dict[str, Any]
    data_timestamps: dict[str, datetime | None]
    steps: list[StepOut]
    decision: Decision | None


@router.get("/runs/{run_id}", response_model=RunDetail)
def run_detail(run_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(mentor_or_admin)):
    run = db.get(AgentRun, run_id)
    if run is None or not _visible(db, user, [run]):
        raise HTTPException(404, "Run not found")
    steps = list(db.scalars(select(AgentStep).where(AgentStep.run_id == run.id).order_by(AgentStep.seq)))
    labels = build_labels(db, steps)
    inputs = {k: labels.get(str(v), v) for k, v in (run.inputs_json or {}).items()}
    timestamps: dict[str, datetime | None] = {}
    decision = None
    if run.subject_type == "session" and run.subject_id:
        sid = uuid.UUID(run.subject_id)
        sess = db.get(ExamSession, sid)
        res = db.get(Result, sid)
        timestamps = {
            "submitted_at": sess.submitted_at if sess else None,
            "scored_at": res.computed_at if res else None,
        }
        s = db.scalar(select(EvaluationSummary).where(EvaluationSummary.session_id == sid))
        if s:
            approver = db.get(User, s.approved_by) if s.approved_by else None
            decision = Decision(
                kind="summary",
                status=s.status.value,
                approved_by=approver.name if approver else None,
                approved_at=s.approved_at,
                edited_by_mentor=s.edited_by_mentor,
                version=s.version,
            )
    elif run.agent == "question_bank":
        counts = defaultdict(int)
        for st in db.scalars(select(Question.status).where(Question.agent_run_id == run.id)):
            counts[st] += 1
        decision = Decision(
            kind="questions",
            accepted=counts[QuestionStatus.approved],
            skipped=counts[QuestionStatus.skipped],
            pending=counts[QuestionStatus.draft],
        )
    return RunDetail(
        **_row(run).model_dump(),
        inputs=inputs,
        data_timestamps=timestamps,
        decision=decision,
        steps=[
            StepOut(
                seq=s.seq,
                kind=s.kind,
                tool=s.tool,
                args=s.args_json,
                output_summary=s.output_summary,
                reason=s.reason,
                latency_ms=s.latency_ms,
                tokens_in=s.tokens_in,
                tokens_out=s.tokens_out,
                error=s.error,
                at=s.at,
                **describe(s, labels),
            )
            for s in steps
        ],
    )
