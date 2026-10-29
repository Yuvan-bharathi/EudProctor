"""Mentor views of proctoring data: live exam overview, candidate details timeline, evidence, decisions."""

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit, storage
from app.core.db import get_db
from app.core.deps import mentor_only
from app.models import Exam, ExamSession, IdentityCheck, User
from app.models.proctoring import CandidateFlag, FlagReview, GlanceLog, ProctorEvent
from app.routers.exams import own_exam
from app.routers.mentor import mentor_session

router = APIRouter(prefix="/mentor", tags=["mentor proctoring"], dependencies=[Depends(mentor_only)])

LOOK_AWAY_TYPES = ("LOOK_AWAY_FLAG", "LOOK_AWAY_POST_LIMIT")


class Summary(BaseModel):
    red_flags: int
    max_flags: int
    post_limit: int
    head_glances: int
    eye_glances: int
    other_alerts: int
    flag_limit_reached: bool
    accommodations: dict


class TimelineItem(BaseModel):
    id: uuid.UUID
    item_type: Literal["event", "glance"]
    kind: Literal["red_flag", "post_limit", "glance", "alert"]
    type: str
    severity: str
    flag_no: int | None = None
    source: str | None = None
    direction: str | None = None
    started_at: datetime
    exam_clock_ms: int | None
    duration_ms: int
    candidate_notified: bool
    has_evidence: bool
    decision: str | None = None
    decision_comment: str | None = None


class SessionDetails(BaseModel):
    session_id: uuid.UUID
    candidate_name: str
    exam_title: str
    status: str
    started_at: datetime | None
    summary: Summary
    timeline: list[TimelineItem]


class ReviewIn(BaseModel):
    item_type: Literal["event", "glance"]
    decision: Literal["dismiss", "concern", "escalate"]
    comment: str = Field(default="", max_length=500)


def _counts(db: Session, session_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict[str, int]]:
    out: dict[uuid.UUID, dict[str, int]] = {
        sid: {"head": 0, "eyes": 0, "alerts": 0, "high": 0} for sid in session_ids
    }
    if not session_ids:
        return out
    for sid, src, n in db.execute(
        select(GlanceLog.session_id, GlanceLog.source, func.count())
        .where(GlanceLog.session_id.in_(session_ids))
        .group_by(GlanceLog.session_id, GlanceLog.source)
    ):
        out[sid][src] = n
    for sid, sev, n in db.execute(
        select(ProctorEvent.session_id, ProctorEvent.severity, func.count())
        .where(ProctorEvent.session_id.in_(session_ids), ProctorEvent.type.not_in(LOOK_AWAY_TYPES))
        .group_by(ProctorEvent.session_id, ProctorEvent.severity)
    ):
        out[sid]["alerts"] += n
        if sev == "high":
            out[sid]["high"] += n
    return out


def summary_for(db: Session, sess: ExamSession) -> Summary:
    c = _counts(db, [sess.id])[sess.id]
    post_limit = db.scalar(
        select(func.count())
        .select_from(CandidateFlag)
        .where(CandidateFlag.session_id == sess.id, CandidateFlag.flag_no.is_(None))
    )
    return Summary(
        red_flags=min(sess.flag_count, sess.exam.max_flags),
        max_flags=sess.exam.max_flags,
        post_limit=post_limit,
        head_glances=c["head"],
        eye_glances=c["eyes"],
        other_alerts=c["alerts"],
        flag_limit_reached=sess.flag_limit_reached,
        accommodations=sess.accommodations or {},
    )


@router.get("/sessions/{session_id}/details", response_model=SessionDetails)
def session_details(
    session_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    sess = mentor_session(db, mentor, session_id)
    reviews: dict[uuid.UUID, FlagReview] = {}
    for r in db.scalars(select(FlagReview).where(FlagReview.session_id == sess.id).order_by(FlagReview.at)):
        reviews[r.item_id] = r  # latest wins
    items: list[TimelineItem] = []
    for e in db.scalars(select(ProctorEvent).where(ProctorEvent.session_id == sess.id)):
        flag_no = (e.payload or {}).get("flag_no")
        kind = (
            "red_flag"
            if e.type == "LOOK_AWAY_FLAG"
            else "post_limit"
            if e.type == "LOOK_AWAY_POST_LIMIT"
            else "alert"
        )
        r = reviews.get(e.id)
        items.append(
            TimelineItem(
                id=e.id,
                item_type="event",
                kind=kind,
                type=e.type,
                severity=e.severity,
                flag_no=flag_no,
                source=(e.payload or {}).get("source"),
                direction=(e.payload or {}).get("direction"),
                started_at=e.started_at,
                exam_clock_ms=e.exam_clock_ms,
                duration_ms=e.duration_ms,
                candidate_notified=kind == "red_flag",
                has_evidence=e.snapshot_ref is not None,
                decision=r.decision if r else None,
                decision_comment=r.comment if r else None,
            )
        )
    for g in db.scalars(select(GlanceLog).where(GlanceLog.session_id == sess.id)):
        r = reviews.get(g.id)
        items.append(
            TimelineItem(
                id=g.id,
                item_type="glance",
                kind="glance",
                type="GLANCE",
                severity="low",
                source=g.source,
                direction=g.direction,
                started_at=g.started_at,
                exam_clock_ms=g.exam_clock_ms,
                duration_ms=g.duration_ms,
                candidate_notified=False,
                has_evidence=False,
                decision=r.decision if r else None,
                decision_comment=r.comment if r else None,
            )
        )
    items.sort(key=lambda i: i.started_at)
    candidate = db.get(User, sess.candidate_id)
    return SessionDetails(
        session_id=sess.id,
        candidate_name=candidate.name,
        exam_title=sess.exam.title,
        status=sess.status.value,
        started_at=sess.started_at,
        summary=summary_for(db, sess),
        timeline=items,
    )


@router.get("/evidence/{event_id}")
def evidence(event_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    event = db.get(ProctorEvent, event_id)
    if event is None or not event.snapshot_ref:
        raise HTTPException(404, "No evidence")
    mentor_session(db, mentor, event.session_id)
    audit.record(db, "evidence.view", "proctor_events", event.id)
    db.commit()
    return Response(
        storage.get(event.snapshot_ref), media_type="image/jpeg", headers={"Cache-Control": "no-store"}
    )


@router.post("/flags/{item_id}/review", status_code=204)
def review_item(
    item_id: uuid.UUID, body: ReviewIn, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
):
    """Records the mentor's decision. Never edits or deletes the flag/event itself (rule 5)."""
    model = ProctorEvent if body.item_type == "event" else GlanceLog
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(404, "Timeline item not found")
    mentor_session(db, mentor, item.session_id)
    db.add(
        FlagReview(
            session_id=item.session_id,
            item_type=body.item_type,
            item_id=item.id,
            mentor_id=mentor.id,
            decision=body.decision,
            comment=body.comment or None,
        )
    )
    audit.record(
        db,
        "flag.review",
        model.__tablename__,
        item.id,
        after={"decision": body.decision, "comment": body.comment},
    )
    db.commit()
    return Response(status_code=204)


class TicketOut(BaseModel):
    ticket: str


@router.post("/exams/{exam_id}/ws-ticket", response_model=TicketOut)
def ws_ticket(exam_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    from app.core.security import create_ws_ticket

    own_exam(db, mentor, exam_id)
    return TicketOut(ticket=create_ws_ticket(mentor.id, exam_id))


class LiveRow(BaseModel):
    session_id: uuid.UUID
    candidate_id: uuid.UUID
    candidate_name: str
    status: str
    flag_count: int
    max_flags: int
    flag_limit_reached: bool
    head_glances: int
    eye_glances: int
    other_alerts: int
    high_alerts: int
    open_identity_reviews: int


@router.get("/exams/{exam_id}/live", response_model=list[LiveRow])
def exam_live(exam_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)):
    exam: Exam = own_exam(db, mentor, exam_id)
    rows = list(
        db.execute(
            select(ExamSession, User)
            .join(User, User.id == ExamSession.candidate_id)
            .where(ExamSession.exam_id == exam.id)
            .order_by(User.name)
        )
    )
    counts = _counts(db, [s.id for s, _ in rows])
    reviews = (
        dict(
            db.execute(
                select(IdentityCheck.session_id, func.count())
                .where(
                    IdentityCheck.session_id.in_([s.id for s, _ in rows]),
                    IdentityCheck.needs_review.is_(True),
                    IdentityCheck.decision.is_(None),
                )
                .group_by(IdentityCheck.session_id)
            ).all()
        )
        if rows
        else {}
    )
    return [
        LiveRow(
            session_id=s.id,
            candidate_id=u.id,
            candidate_name=u.name,
            status=s.status.value,
            flag_count=min(s.flag_count, exam.max_flags),
            max_flags=exam.max_flags,
            flag_limit_reached=s.flag_limit_reached,
            head_glances=counts[s.id]["head"],
            eye_glances=counts[s.id]["eyes"],
            other_alerts=counts[s.id]["alerts"],
            high_alerts=counts[s.id]["high"],
            open_identity_reviews=reviews.get(s.id, 0),
        )
        for s, u in rows
    ]
