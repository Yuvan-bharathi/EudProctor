"""Alert fan-out: Redis pub/sub (channel exam:{exam_id}:alerts) with an in-process fallback for single-process dev."""

import asyncio
import json
import logging
import threading
import uuid
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Any

from app.core.config import get_settings

log = logging.getLogger(__name__)


def channel(exam_id: uuid.UUID | str) -> str:
    return f"exam:{exam_id}:alerts"


class LocalBus:
    def __init__(self) -> None:
        self._subs: dict[str, set[tuple[asyncio.AbstractEventLoop, asyncio.Queue]]] = defaultdict(set)
        self._lock = threading.Lock()

    def publish(self, ch: str, message: dict[str, Any]) -> None:
        with self._lock:
            subs = list(self._subs[ch])
        for loop, q in subs:
            loop.call_soon_threadsafe(q.put_nowait, message)

    async def subscribe(self, ch: str) -> AsyncIterator[dict[str, Any]]:
        q: asyncio.Queue = asyncio.Queue()
        entry = (asyncio.get_running_loop(), q)
        with self._lock:
            self._subs[ch].add(entry)
        try:
            while True:
                yield await q.get()
        finally:
            with self._lock:
                self._subs[ch].discard(entry)


class RedisBus:
    def __init__(self, url: str) -> None:
        import redis

        self._url = url
        self._sync = redis.Redis.from_url(url)

    def publish(self, ch: str, message: dict[str, Any]) -> None:
        self._sync.publish(ch, json.dumps(message, default=str))

    async def subscribe(self, ch: str) -> AsyncIterator[dict[str, Any]]:
        import redis.asyncio as aredis

        client = aredis.Redis.from_url(self._url)
        pubsub = client.pubsub()
        await pubsub.subscribe(ch)
        try:
            async for msg in pubsub.listen():
                if msg.get("type") == "message":
                    yield json.loads(msg["data"])
        finally:
            await pubsub.unsubscribe(ch)
            await client.aclose()


_bus: LocalBus | RedisBus | None = None


def get_bus() -> LocalBus | RedisBus:
    global _bus
    if _bus is None:
        s = get_settings()
        if s.environment != "test":
            try:
                import redis

                redis.Redis.from_url(s.redis_url, socket_connect_timeout=1).ping()
                _bus = RedisBus(s.redis_url)
            except Exception:
                log.warning("Redis unavailable; using in-process alert bus (single API process only)")
        _bus = _bus or LocalBus()
    return _bus


def publish_alert(exam_id: uuid.UUID, message: dict[str, Any]) -> None:
    try:
        get_bus().publish(channel(exam_id), message)
    except Exception:  # alerts are best-effort; the data is already committed
        log.exception("alert publish failed")
