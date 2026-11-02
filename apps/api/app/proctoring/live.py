"""Last-known live proctoring state per session, for the mentor Proctoring tab when it polls instead of using the
WebSocket (e.g. behind a proxy that cannot upgrade connections). In-process and best-effort: the database stays the
record, and this only mirrors the alerts already published on the bus."""

import threading
import time
from collections import OrderedDict, deque
from typing import Any

ONGOING_TTL_S = 3.0  # an ongoing look-away is reported about once a second; stale after this
RECENT = 5
MAX_SESSIONS = 5000

_lock = threading.Lock()
_ongoing: dict[str, tuple[float, dict[str, Any]]] = {}
_recent: OrderedDict[str, deque[dict[str, Any]]] = OrderedDict()


def remember(alert: dict[str, Any]) -> None:
    sid = str(alert.get("session_id", ""))
    if not sid:
        return
    with _lock:
        if alert.get("kind") == "look_away_ongoing":
            _ongoing[sid] = (time.monotonic(), alert)
            return
        _ongoing.pop(sid, None)  # a finished look-away arrives as a glance / flag
        _recent.setdefault(sid, deque(maxlen=RECENT)).appendleft(alert)
        _recent.move_to_end(sid)
        while len(_recent) > MAX_SESSIONS:
            old, _ = _recent.popitem(last=False)
            _ongoing.pop(old, None)


def snapshot(session_id: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """(ongoing look-away or None, most recent alerts first)."""
    with _lock:
        ongoing = _ongoing.get(session_id)
        if ongoing and time.monotonic() - ongoing[0] > ONGOING_TTL_S:
            _ongoing.pop(session_id, None)
            ongoing = None
        return (ongoing[1] if ongoing else None), list(_recent.get(session_id, ()))
