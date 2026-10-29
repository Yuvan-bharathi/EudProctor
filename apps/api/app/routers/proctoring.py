"""Candidate proctoring endpoints. Responses carry only the candidate's own flag counter, never glances,
events, evidence or integrity notes (CLAUDE.md rule 3)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import candidate_only
from app.models import User
from app.proctoring.ingest import EventIn, ingest, publish_after_commit
from app.services.sessions import own_session

router = APIRouter(tags=["proctoring"], dependencies=[Depends(candidate_only)])


class EventsIn(BaseModel):
    events: list[EventIn] = Field(max_length=200)


class FlagStatus(BaseModel):
    flag_count: int
    max_flags: int


class ProctoringConfig(BaseModel):
    glance_min_s: float
    flag_threshold_s: float
    max_flags: int
    yaw_limit_deg: float
    pitch_limit_deg: float
    face_absent_s: float
    multi_face_s: float
    tab_switch_s: float
    return_to_screen_s: float
    gaze_disabled: bool


@router.post("/sessions/{session_id}/events", response_model=FlagStatus)
def post_events(
    session_id: uuid.UUID, body: EventsIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)
) -> FlagStatus:
    if len(body.events) > get_settings().max_events_per_batch:
        raise HTTPException(413, "Too many events in one batch")
    sess = own_session(db, session_id, user.id, lock=True)  # row lock: concurrent batches cannot exceed max
    result = ingest(db, sess, body.events)
    db.commit()
    publish_after_commit(sess, result.alerts)
    return FlagStatus(flag_count=min(sess.flag_count, sess.exam.max_flags), max_flags=sess.exam.max_flags)


@router.get("/sessions/{session_id}/flag-status", response_model=FlagStatus)
def flag_status(session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    sess = own_session(db, session_id, user.id)
    db.commit()
    return FlagStatus(flag_count=min(sess.flag_count, sess.exam.max_flags), max_flags=sess.exam.max_flags)


@router.get("/sessions/{session_id}/proctoring-config", response_model=ProctoringConfig)
def proctoring_config(
    session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(candidate_only)
):
    s = get_settings()
    sess = own_session(db, session_id, user.id)
    exam = sess.exam
    return ProctoringConfig(
        glance_min_s=exam.glance_min_s,
        flag_threshold_s=exam.flag_threshold_s,
        max_flags=exam.max_flags,
        yaw_limit_deg=s.yaw_limit_deg,
        pitch_limit_deg=s.pitch_limit_deg,
        face_absent_s=s.face_absent_s,
        multi_face_s=s.multi_face_s,
        tab_switch_s=s.tab_switch_s,
        return_to_screen_s=s.return_to_screen_s,
        gaze_disabled=bool((sess.accommodations or {}).get("disable_gaze")),
    )
