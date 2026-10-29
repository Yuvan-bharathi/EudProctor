"""Proctoring: the 10 reference test cases (.claude/skills/proctoring-engine/reference.md) and the Phase 5 guarantees."""

import base64
import io
import threading
import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import CandidateFlag, ExamSession, GlanceLog, ProctorEvent, Role, SessionStatus
from app.models.base import utcnow
from app.proctoring.policy import LookAwayClass, Policy, classify
from tests.conftest import auth, make_user
from tests.factories import build_exam, build_session

P = Policy.default()


# ---------- pure classifier (thresholds from config, no literals) ----------
@pytest.mark.parametrize(
    ("seconds", "flags", "expected"),
    [
        (P.glance_min_s - 0.01, 0, LookAwayClass.ignore),  # 0.99 s
        (P.glance_min_s, 0, LookAwayClass.glance),  # 1.0 s
        (P.flag_threshold_s - 0.01, 0, LookAwayClass.glance),  # 2.99 s
        (P.flag_threshold_s - 0.1, 0, LookAwayClass.glance),  # 2.9 s
        (P.flag_threshold_s, 0, LookAwayClass.flag),  # 3.0 s
        (P.flag_threshold_s, P.max_flags - 1, LookAwayClass.flag),
        (P.flag_threshold_s, P.max_flags, LookAwayClass.post_limit),
        (12, 0, LookAwayClass.flag),
    ],
)
def test_classify_boundaries(seconds, flags, expected):
    assert classify(round(seconds * 1000), flags, P) == expected


# ---------- helpers ----------
def look(sess, seconds, offset_s=0, source="head", direction="right", event_id=None, snapshot=None):
    started = sess.started_at + timedelta(seconds=1 + offset_s)
    ev = {
        "client_event_id": event_id or uuid.uuid4().hex,
        "type": "LOOK_AWAY",
        "source": source,
        "direction": direction,
        "started_at": started.isoformat(),
        "duration_ms": round(seconds * 1000),
        "exam_clock_ms": int((started - sess.started_at).total_seconds() * 1000),
    }
    if snapshot:
        ev["snapshot_b64"] = snapshot
    return ev


def post(client, cand, sess, *events):
    return client.post(
        f"/api/v1/sessions/{sess.id}/events", headers=auth(cand), json={"events": list(events)}
    )


def jpeg(width=320) -> str:
    buf = io.BytesIO()
    Image.new("RGB", (width, width * 3 // 4), (120, 130, 140)).save(buf, format="JPEG", quality=70)
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture
def live(db, mentor, course, candidate):
    exam = build_exam(db, course, mentor, duration_min=60)
    sess = build_session(db, exam, candidate)
    sess.started_at = utcnow() - timedelta(minutes=30)  # room for events in the past
    db.commit()
    return sess


def count(db, model, sess):
    db.expire_all()
    return db.scalar(select(func.count()).select_from(model).where(model.session_id == sess.id))


# ---------- reference cases 1-10 ----------
def test_case1_under_glance_min_stores_nothing(client, db, candidate, live):
    assert post(client, candidate, live, look(live, 0.8)).json() == {"flag_count": 0, "max_flags": 3}
    assert count(db, GlanceLog, live) == 0 and count(db, ProctorEvent, live) == 0


def test_case2_and_3_glances_are_mentor_only(client, db, candidate, live):
    res = post(
        client,
        candidate,
        live,
        look(live, 1.0),
        look(live, 2.9, offset_s=10, source="eyes", direction="down"),
    )
    assert res.json() == {"flag_count": 0, "max_flags": 3}  # the candidate learns nothing about glances
    assert count(db, GlanceLog, live) == 2 and count(db, CandidateFlag, live) == 0


def test_case4_three_seconds_is_flag_one_notified(client, db, candidate, live):
    assert post(client, candidate, live, look(live, 3.0)).json()["flag_count"] == 1
    flag = db.scalar(select(CandidateFlag).where(CandidateFlag.session_id == live.id))
    assert flag.flag_no == 1 and flag.notified is True


def test_case5_one_continuous_look_away_is_one_flag(client, db, candidate, live):
    """The browser merges a continuous look-away into ONE event; a retried upload of it is idempotent."""
    ev = look(live, 12)
    post(client, candidate, live, ev)
    post(client, candidate, live, ev)  # retry of the same event
    assert count(db, CandidateFlag, live) == 1
    db.refresh(live)
    assert live.flag_count == 1


def test_case6_fourth_flag_is_post_limit(client, db, candidate, live):
    events = [look(live, 4, offset_s=i * 20) for i in range(4)]
    res = post(client, candidate, live, *events)
    assert res.json() == {"flag_count": 3, "max_flags": 3}
    flags = list(
        db.scalars(
            select(CandidateFlag)
            .where(CandidateFlag.session_id == live.id)
            .order_by(CandidateFlag.started_at)
        )
    )
    assert [f.flag_no for f in flags] == [1, 2, 3, None]
    assert [f.notified for f in flags] == [True, True, True, False]
    db.refresh(live)
    assert live.flag_limit_reached is True and live.flag_count == 3


def test_case7_concurrent_batches_cannot_exceed_max(db, candidate, live):
    """Two batches race at flags=2: SELECT ... FOR UPDATE serialises them -> flag_count 3 and one post_limit."""
    live.flag_count = 2
    db.commit()
    from app.main import app

    barrier = threading.Barrier(2)
    results = []

    def send(offset):
        with TestClient(app) as c:
            barrier.wait()
            results.append(post(c, candidate, live, look(live, 5, offset_s=offset)).status_code)

    threads = [threading.Thread(target=send, args=(o,)) for o in (0, 30)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert results == [200, 200]
    db.expire_all()
    with SessionLocal() as s:
        sess = s.get(ExamSession, live.id)
        assert sess.flag_count == 3 and sess.flag_limit_reached
        nos = sorted(
            (f.flag_no or 0)
            for f in s.scalars(select(CandidateFlag).where(CandidateFlag.session_id == live.id))
        )
        assert nos == [0, 3]  # one flag #3, one post_limit


def test_case8_no_proctoring_event_changes_session_status(client, db, candidate, live):
    batch = [look(live, 4, offset_s=i * 10) for i in range(6)] + [
        {
            "client_event_id": uuid.uuid4().hex,
            "type": t,
            "started_at": (live.started_at + timedelta(seconds=200 + i)).isoformat(),
            "duration_ms": 40_000,
        }
        for i, t in enumerate(
            [
                "FACE_ABSENT",
                "MULTIPLE_FACES",
                "TAB_SWITCH",
                "FULLSCREEN_EXIT",
                "COPY_PASTE_ATTEMPT",
                "CAMERA_UNAVAILABLE",
            ]
        )
    ]
    assert post(client, candidate, live, *batch).status_code == 200
    db.refresh(live)
    assert live.status == SessionStatus.in_progress
    assert live.submitted_at is None and live.submit_reason is None
    # the candidate can still answer
    q1 = live.question_order[0]
    res = client.put(
        f"/api/v1/sessions/{live.id}/answers",
        headers=auth(candidate),
        json={"answers": [{"question_id": q1, "value": {"option_key": "A"}, "client_seq": 1}]},
    )
    assert res.json()["acks"][0]["accepted"] is True


def test_case9_merged_look_away_is_a_flag(client, db, candidate, live):
    # 1.5 s away + 0.2 s back (< return_to_screen_s) + 2 s away = one 3.7 s event from the browser
    assert post(client, candidate, live, look(live, 3.7)).json()["flag_count"] == 1


def test_case10_flag_status_returns_only_counts(client, candidate, live):
    assert client.get(f"/api/v1/sessions/{live.id}/flag-status", headers=auth(candidate)).json() == {
        "flag_count": 0,
        "max_flags": 3,
    }


# ---------- Phase 5 guarantees ----------
def test_candidate_endpoints_never_return_glances_events_or_snapshots(client, db, candidate, live):
    post(
        client,
        candidate,
        live,
        look(live, 1.5),
        look(live, 4, offset_s=10, snapshot=jpeg()),
        {
            "client_event_id": uuid.uuid4().hex,
            "type": "TAB_SWITCH",
            "started_at": (live.started_at + timedelta(seconds=60)).isoformat(),
            "duration_ms": 5000,
        },
    )
    forbidden = (
        "glance",
        "snapshot",
        "evidence",
        "event",
        "integrity",
        "direction",
        "duration_ms",
        "severity",
    )
    for path in (
        f"/sessions/{live.id}",
        f"/sessions/{live.id}/flag-status",
        "/candidates/me/assessments",
        f"/sessions/{live.id}/proctoring-config",
    ):
        body = client.get(f"/api/v1{path}", headers=auth(candidate)).text.lower()
        for word in forbidden:
            if path.endswith("proctoring-config") and word in ("glance",):
                continue  # thresholds only (glance_min_s), no glance data
            assert word not in body, f"{path} leaked '{word}'"
    # candidates cannot reach mentor details or evidence
    assert (
        client.get(f"/api/v1/mentor/sessions/{live.id}/details", headers=auth(candidate)).status_code == 403
    )


def test_server_revalidates_durations(client, db, candidate, live):
    future = look(live, 4)
    future["started_at"] = (utcnow() + timedelta(minutes=5)).isoformat()
    before_start = look(live, 4)
    before_start["started_at"] = (live.started_at - timedelta(minutes=5)).isoformat()
    too_long = look(live, 60 * 60)  # longer than the session has run
    bad_type = look(live, 4)
    bad_type["type"] = "DISQUALIFY"
    assert post(client, candidate, live, future, before_start, too_long, bad_type).json()["flag_count"] == 0
    assert count(db, ProctorEvent, live) == 0


def test_snapshot_rules(client, db, candidate, live):
    post(
        client,
        candidate,
        live,
        look(live, 4, snapshot=jpeg(320)),
        look(live, 4, offset_s=10, snapshot=jpeg(1280)),
    )
    events = list(
        db.scalars(
            select(ProctorEvent).where(ProctorEvent.session_id == live.id).order_by(ProctorEvent.started_at)
        )
    )
    assert events[0].snapshot_ref is not None  # small JPEG kept (encrypted)
    assert events[1].snapshot_ref is None  # wider than snapshot_max_width: discarded


def test_thresholds_for_other_alerts(client, db, candidate, live):
    s = get_settings()

    def ev(t, ms, off):
        return {
            "client_event_id": uuid.uuid4().hex,
            "type": t,
            "duration_ms": ms,
            "started_at": (live.started_at + timedelta(seconds=off)).isoformat(),
        }

    post(
        client,
        candidate,
        live,
        ev("TAB_SWITCH", int(s.tab_switch_s * 1000) - 1, 1),  # too short: dropped
        ev("FACE_ABSENT", int(s.face_absent_s * 1000) + 1, 2),  # medium
        ev("FACE_ABSENT", int(s.face_absent_high_s * 1000) + 1, 300),  # high
        ev("MULTIPLE_FACES", int(s.multi_face_s * 1000), 600),
    )  # high
    sev = [
        (e.type, e.severity)
        for e in db.scalars(
            select(ProctorEvent).where(ProctorEvent.session_id == live.id).order_by(ProctorEvent.started_at)
        )
    ]
    assert sev == [("FACE_ABSENT", "medium"), ("FACE_ABSENT", "high"), ("MULTIPLE_FACES", "high")]


def test_gaze_accommodation_suppresses_eye_events(client, db, candidate, live):
    live.accommodations = {"disable_gaze": True}
    db.commit()
    post(client, candidate, live, look(live, 4, source="eyes"), look(live, 1.5, offset_s=10, source="eyes"))
    assert count(db, CandidateFlag, live) == 0 and count(db, GlanceLog, live) == 0
    cfg = client.get(f"/api/v1/sessions/{live.id}/proctoring-config", headers=auth(candidate)).json()
    assert cfg["gaze_disabled"] is True


def test_mentor_details_summary_and_timeline(client, db, mentor, candidate, live):
    post(
        client,
        candidate,
        live,
        look(live, 1.4, source="eyes", direction="left"),
        look(live, 3.8, offset_s=10, direction="right", snapshot=jpeg()),
        look(live, 4.6, offset_s=30, source="eyes", direction="down"),
        look(live, 2.0, offset_s=50, source="head", direction="up"),
    )
    d = client.get(f"/api/v1/mentor/sessions/{live.id}/details", headers=auth(mentor)).json()
    assert d["summary"] | {} == d["summary"]
    assert (
        d["summary"]["red_flags"],
        d["summary"]["head_glances"],
        d["summary"]["eye_glances"],
        d["summary"]["other_alerts"],
    ) == (2, 1, 1, 0)
    kinds = [(i["kind"], i["candidate_notified"]) for i in d["timeline"]]
    assert kinds == [("glance", False), ("red_flag", True), ("red_flag", True), ("glance", False)]
    flag = d["timeline"][1]
    assert flag["has_evidence"] and flag["flag_no"] == 1
    img = client.get(f"/api/v1/mentor/evidence/{flag['id']}", headers=auth(mentor))
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"

    # decision recorded; the flag itself is unchanged
    res = client.post(
        f"/api/v1/mentor/flags/{flag['id']}/review",
        headers=auth(mentor),
        json={
            "item_type": "event",
            "decision": "dismiss",
            "comment": "Looked at notes window? No - window glare.",
        },
    )
    assert res.status_code == 204
    d2 = client.get(f"/api/v1/mentor/sessions/{live.id}/details", headers=auth(mentor)).json()
    assert d2["timeline"][1]["decision"] == "dismiss" and d2["summary"]["red_flags"] == 2

    other = make_user(db, Role.mentor)
    assert client.get(f"/api/v1/mentor/sessions/{live.id}/details", headers=auth(other)).status_code == 404


def test_live_websocket_relays_alerts(client, db, mentor, candidate, live):
    ticket = client.post(f"/api/v1/mentor/exams/{live.exam_id}/ws-ticket", headers=auth(mentor)).json()[
        "ticket"
    ]
    with client.websocket_connect(f"/api/v1/ws/mentor/exams/{live.exam_id}?ticket={ticket}") as ws:
        post(client, candidate, live, look(live, 4))
        msg = ws.receive_json()
        assert msg["kind"] == "red_flag" and msg["flag_no"] == 1 and msg["session_id"] == str(live.id)
    live_rows = client.get(f"/api/v1/mentor/exams/{live.exam_id}/live", headers=auth(mentor)).json()
    assert live_rows[0]["flag_count"] == 1


def test_websocket_rejects_candidates_access_tokens_and_reused_tickets(client, mentor, candidate, live):
    from starlette.websockets import WebSocketDisconnect

    from app.core.security import create_token, create_ws_ticket

    url = f"/api/v1/ws/mentor/exams/{live.exam_id}"
    assert (
        client.post(f"/api/v1/mentor/exams/{live.exam_id}/ws-ticket", headers=auth(candidate)).status_code
        == 403
    )
    bad = [
        create_ws_ticket(candidate.id, live.exam_id),  # a ticket minted for a candidate
        create_token(mentor.id, "mentor", "access"),  # access tokens are not accepted
        create_ws_ticket(mentor.id, uuid.uuid4()),  # a different assessment
    ]
    for t in bad:
        with pytest.raises(WebSocketDisconnect), client.websocket_connect(f"{url}?ticket={t}") as ws:
            ws.receive_json()
    ticket = client.post(f"/api/v1/mentor/exams/{live.exam_id}/ws-ticket", headers=auth(mentor)).json()[
        "ticket"
    ]
    with client.websocket_connect(f"{url}?ticket={ticket}"):
        pass
    with (
        pytest.raises(WebSocketDisconnect),
        client.websocket_connect(f"{url}?ticket={ticket}") as ws,
    ):  # single use
        ws.receive_json()
