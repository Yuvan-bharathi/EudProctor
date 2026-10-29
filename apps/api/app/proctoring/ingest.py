"""Server-side event ingest. The server is the authority for the flag count.

Rules (CLAUDE.md 1-3, 6): this module never changes session status, never pauses, blocks or submits;
glances and events are mentor-only; only events and small snapshots arrive (never video).
"""

import base64
import binascii
import io
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import storage
from app.core.config import get_settings
from app.models import ExamSession, SessionStatus, SubmitReason
from app.models.base import utcnow
from app.models.proctoring import CandidateFlag, GlanceLog, ProctorEvent
from app.proctoring.bus import publish_alert
from app.proctoring.policy import LookAwayClass, Policy, classify

CLIENT_TYPES = {
    "LOOK_AWAY",
    "LOOK_AWAY_PROGRESS",  # live mentor view only, never stored
    "FACE_ABSENT",
    "MULTIPLE_FACES",
    "TAB_SWITCH",
    "FULLSCREEN_EXIT",
    "COPY_PASTE_ATTEMPT",
    "CAMERA_UNAVAILABLE",
}
SOURCES = {"head", "eyes"}
DIRECTIONS = {"left", "right", "up", "down"}


class EventIn(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=64)
    type: str
    source: str | None = None
    direction: str | None = None
    started_at: datetime
    duration_ms: int = Field(ge=0, le=6 * 3600 * 1000)
    exam_clock_ms: int | None = Field(default=None, ge=0)
    snapshot_b64: str | None = Field(default=None, max_length=400_000)


@dataclass
class IngestResult:
    accepted: int = 0
    rejected: int = 0
    new_flags: list[int] = field(default_factory=list)
    alerts: list[dict[str, Any]] = field(default_factory=list)


def _session_accepts_events(sess: ExamSession, now: datetime) -> bool:
    if sess.status == SessionStatus.in_progress:
        return True
    # events buffered offline before an automatic deadline submit may still arrive shortly after it
    return (
        sess.status in (SessionStatus.submitted, SessionStatus.scored)
        and sess.submit_reason == SubmitReason.deadline
        and sess.deadline_at is not None
        and now <= sess.deadline_at + timedelta(seconds=get_settings().late_sync_grace_s)
    )


def _valid_window(sess: ExamSession, ev: EventIn, now: datetime) -> bool:
    if sess.started_at is None:
        return False
    end = ev.started_at + timedelta(milliseconds=ev.duration_ms)
    skew = timedelta(seconds=get_settings().event_clock_skew_s)
    latest = min(now, sess.deadline_at or now) + skew
    return sess.started_at - skew <= ev.started_at and end <= latest


def _snapshot(b64: str | None) -> str | None:
    """Store a small JPEG evidence snapshot (encrypted). Anything else is rejected silently."""
    if not b64:
        return None
    s = get_settings()
    try:
        raw = base64.b64decode(b64.split(",", 1)[-1], validate=True)
        if len(raw) > s.snapshot_max_bytes:
            return None
        img = Image.open(io.BytesIO(raw))
        if img.format != "JPEG" or img.width > s.snapshot_max_width:
            return None
    except (binascii.Error, ValueError, UnidentifiedImageError, OSError):
        return None
    return storage.put("snapshots", raw)


def _event_exists(db: Session, sess: ExamSession, client_event_id: str) -> bool:
    return bool(
        db.scalar(
            select(func.count())
            .select_from(ProctorEvent)
            .where(ProctorEvent.session_id == sess.id, ProctorEvent.client_event_id == client_event_id)
        )
        or db.scalar(
            select(func.count())
            .select_from(GlanceLog)
            .where(GlanceLog.session_id == sess.id, GlanceLog.client_event_id == client_event_id)
        )
    )


def severity_for(db: Session, sess: ExamSession, ev_type: str, duration_ms: int) -> str | None:
    """Returns the severity tier, or None if the event is below its threshold and should be dropped."""
    s = get_settings()
    if ev_type == "FACE_ABSENT":
        if duration_ms < s.face_absent_s * 1000:
            return None
        return "high" if duration_ms > s.face_absent_high_s * 1000 else "medium"
    if ev_type == "MULTIPLE_FACES":
        return "high" if duration_ms >= s.multi_face_s * 1000 else None
    if ev_type == "TAB_SWITCH":
        if duration_ms <= s.tab_switch_s * 1000:
            return None
        previous = db.scalar(
            select(func.count())
            .select_from(ProctorEvent)
            .where(ProctorEvent.session_id == sess.id, ProctorEvent.type == "TAB_SWITCH")
        )
        return "medium" if previous + 1 >= s.tab_switch_repeat_medium else "low"
    if ev_type in ("FULLSCREEN_EXIT", "COPY_PASTE_ATTEMPT"):
        return "low"
    if ev_type == "CAMERA_UNAVAILABLE":
        return "medium"
    return None


def _gaze_disabled(sess: ExamSession) -> bool:
    return bool((sess.accommodations or {}).get("disable_gaze"))


def ingest(db: Session, sess: ExamSession, events: list[EventIn]) -> IngestResult:
    """Caller must hold the session row lock (SELECT ... FOR UPDATE) for the whole batch."""
    now = utcnow()
    res = IngestResult()
    policy = Policy.for_exam(sess.exam)
    if not _session_accepts_events(sess, now):
        res.rejected = len(events)
        return res

    for ev in sorted(events, key=lambda e: e.started_at):
        if ev.type not in CLIENT_TYPES or not _valid_window(sess, ev, now):
            res.rejected += 1
            continue
        if ev.type == "LOOK_AWAY_PROGRESS":
            if ev.source in SOURCES and ev.direction in DIRECTIONS:
                res.alerts.append(
                    {
                        "kind": "look_away_ongoing",
                        "session_id": str(sess.id),
                        "source": ev.source,
                        "direction": ev.direction,
                        "duration_ms": ev.duration_ms,
                    }
                )
            continue
        if _event_exists(db, sess, ev.client_event_id):
            res.accepted += 1  # idempotent retry
            continue

        if ev.type == "LOOK_AWAY":
            if ev.source not in SOURCES or ev.direction not in DIRECTIONS:
                res.rejected += 1
                continue
            if ev.source == "eyes" and _gaze_disabled(sess):
                res.accepted += 1  # accommodation: gaze detection relaxed for this candidate
                continue
            cls = classify(ev.duration_ms, sess.flag_count, policy)
            if cls == LookAwayClass.ignore:
                res.accepted += 1  # < glance_min: not stored
                continue
            if cls == LookAwayClass.glance:
                db.add(
                    GlanceLog(
                        session_id=sess.id,
                        client_event_id=ev.client_event_id,
                        source=ev.source,
                        direction=ev.direction,
                        started_at=ev.started_at,
                        duration_ms=ev.duration_ms,
                        exam_clock_ms=ev.exam_clock_ms,
                    )
                )
                res.alerts.append(
                    {
                        "kind": "glance",
                        "session_id": str(sess.id),
                        "source": ev.source,
                        "direction": ev.direction,
                        "duration_ms": ev.duration_ms,
                    }
                )
                res.accepted += 1
                continue
            snap = _snapshot(ev.snapshot_b64)
            if cls == LookAwayClass.flag:
                sess.flag_count += 1
                flag_no: int | None = sess.flag_count
                res.new_flags.append(sess.flag_count)
            else:
                flag_no = None
                sess.flag_limit_reached = True
            event = ProctorEvent(
                session_id=sess.id,
                client_event_id=ev.client_event_id,
                type="LOOK_AWAY_FLAG" if flag_no else "LOOK_AWAY_POST_LIMIT",
                severity="high",
                started_at=ev.started_at,
                duration_ms=ev.duration_ms,
                exam_clock_ms=ev.exam_clock_ms,
                payload={"source": ev.source, "direction": ev.direction, "flag_no": flag_no},
                snapshot_ref=snap,
            )
            db.add(event)
            db.flush()
            db.add(
                CandidateFlag(
                    session_id=sess.id,
                    event_id=event.id,
                    flag_no=flag_no,
                    source=ev.source,
                    direction=ev.direction,
                    started_at=ev.started_at,
                    duration_ms=ev.duration_ms,
                    snapshot_ref=snap,
                    notified=flag_no is not None,
                )
            )
            res.alerts.append(
                {
                    "kind": "red_flag" if flag_no else "post_limit",
                    "session_id": str(sess.id),
                    "flag_no": flag_no,
                    "flag_count": sess.flag_count,
                    "max_flags": policy.max_flags,
                    "source": ev.source,
                    "direction": ev.direction,
                    "duration_ms": ev.duration_ms,
                    "severity": "high",
                }
            )
            res.accepted += 1
            continue

        severity = severity_for(db, sess, ev.type, ev.duration_ms)
        if severity is None:
            res.accepted += 1  # below its threshold: not stored
            continue
        snap = _snapshot(ev.snapshot_b64) if severity == "high" else None
        db.add(
            ProctorEvent(
                session_id=sess.id,
                client_event_id=ev.client_event_id,
                type=ev.type,
                severity=severity,
                started_at=ev.started_at,
                duration_ms=ev.duration_ms,
                exam_clock_ms=ev.exam_clock_ms,
                payload={},
                snapshot_ref=snap,
            )
        )
        db.flush()
        res.alerts.append(
            {
                "kind": "alert",
                "session_id": str(sess.id),
                "type": ev.type,
                "severity": severity,
                "duration_ms": ev.duration_ms,
            }
        )
        res.accepted += 1
    return res


def record_server_event(
    db: Session, sess: ExamSession, ev_type: str, payload: dict[str, Any]
) -> ProctorEvent:
    """Server-generated alerts (identity mismatch). Mentor-only; never changes the session."""
    event = ProctorEvent(
        session_id=sess.id,
        client_event_id=f"server-{uuid.uuid4().hex}",
        type=ev_type,
        severity="high",
        started_at=utcnow(),
        payload=payload,
    )
    db.add(event)
    db.flush()
    return event


def publish_after_commit(sess: ExamSession, alerts: list[dict[str, Any]]) -> None:
    for a in alerts:
        publish_alert(sess.exam_id, a | {"at": utcnow().isoformat()})
