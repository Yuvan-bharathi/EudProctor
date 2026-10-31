"""Mentor live alerts over WebSocket. Browsers cannot send headers on the upgrade, so the client first gets a
short-lived single-use ticket from POST /mentor/exams/{id}/ws-ticket (authenticated) and passes that instead of
the access token; the ticket is checked here (role mentor + owns the assessment)."""

import asyncio
import threading
import uuid
from collections import OrderedDict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.db import SessionLocal, get_engine
from app.core.security import decode_token
from app.models import Exam, Role, User
from app.proctoring.bus import channel, get_bus
from app.routers.courses import mentor_course_ids

router = APIRouter(tags=["live"])

# single-use: remember recently redeemed ticket ids (tickets expire within ws_ticket_ttl_s anyway)
_used: OrderedDict[str, None] = OrderedDict()
_used_lock = threading.Lock()


def _redeem(jti: str) -> bool:
    with _used_lock:
        if jti in _used:
            return False
        _used[jti] = None
        while len(_used) > 10_000:
            _used.popitem(last=False)
        return True


def _authorised(ticket: str, exam_id: uuid.UUID) -> bool:
    payload = decode_token(ticket, "ws")
    if payload is None or payload.get("exam") != str(exam_id) or not _redeem(payload["jti"]):
        return False
    get_engine()
    with SessionLocal() as db:
        user = db.get(User, uuid.UUID(payload["sub"]))
        exam = db.get(Exam, exam_id)
        return bool(
            user
            and user.is_active
            and user.role == Role.mentor
            and exam
            and (exam.mentor_id == user.id or exam.course_id in mentor_course_ids(db, user))
        )


@router.websocket("/ws/mentor/exams/{exam_id}")
async def mentor_exam_ws(websocket: WebSocket, exam_id: uuid.UUID, ticket: str = "") -> None:
    if not await asyncio.to_thread(_authorised, ticket, exam_id):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await websocket.accept()
    try:
        async for message in get_bus().subscribe(channel(exam_id)):
            await websocket.send_json(message)
    except WebSocketDisconnect:
        pass
