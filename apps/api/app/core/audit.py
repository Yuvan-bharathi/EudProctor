"""Audit logging (CLAUDE.md rule 9).

Every ORM insert/update/delete is captured by a `before_flush` hook, so no write can skip the audit log.
Services additionally call `record()` for named actions (approve, publish, flag decision, agent tool call).
The acting principal is stored on `session.info["actor"]` by the auth dependency or the job runner.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.models.audit import AuditLog

SKIP_TABLES = {"audit_log"}


@dataclass(frozen=True)
class Actor:
    type: str  # user / agent / system
    id: str | None = None


SYSTEM = Actor("system")


def set_actor(db: Session, actor: Actor) -> None:
    db.info["actor"] = actor


def _jsonable(v: Any) -> Any:
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if isinstance(v, (uuid.UUID, Decimal)):
        return str(v)
    if isinstance(v, Enum):
        return v.value
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, (bytes, bytearray)):
        return f"<{len(v)} bytes>"
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, set)):
        return [_jsonable(x) for x in v]
    return str(v)


def _audited_columns(obj: Any):
    for col in inspect(obj).mapper.column_attrs:
        column = col.columns[0]
        if column.info.get("audit", True):
            yield col.key


def _snapshot(obj: Any) -> dict[str, Any]:
    return {k: _jsonable(getattr(obj, k, None)) for k in _audited_columns(obj)}


def _entity_id(obj: Any) -> str:
    ident = inspect(obj).mapper.primary_key_from_instance(obj)
    return ":".join(str(i) for i in ident)


def _ensure_ids(obj: Any) -> None:
    mapper = inspect(obj).mapper
    for col in mapper.primary_key:
        if col.key == "id" and getattr(obj, "id", None) is None and col.default is not None:
            obj.id = uuid.uuid4()


def record(
    db: Session,
    action: str,
    entity: str,
    entity_id: Any = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    actor: Actor | None = None,
) -> AuditLog:
    a = actor or db.info.get("actor", SYSTEM)
    row = AuditLog(
        actor_type=a.type,
        actor_id=a.id,
        action=action,
        entity=entity,
        entity_id=None if entity_id is None else str(entity_id),
        before_json=_jsonable(before),
        after_json=_jsonable(after),
    )
    db.add(row)
    return row


@event.listens_for(Session, "before_flush")
def _audit_before_flush(session: Session, _ctx, _instances) -> None:
    actor: Actor = session.info.get("actor", SYSTEM)
    rows: list[AuditLog] = []
    for obj in list(session.new):
        table = getattr(obj, "__tablename__", None)
        if table is None or table in SKIP_TABLES:
            continue
        _ensure_ids(obj)
        rows.append(_row(actor, f"{table}.create", table, _entity_id(obj), None, _snapshot(obj)))
    for obj in list(session.dirty):
        table = getattr(obj, "__tablename__", None)
        if table is None or table in SKIP_TABLES or not session.is_modified(obj, include_collections=False):
            continue
        state = inspect(obj)
        before, after = {}, {}
        for key in _audited_columns(obj):
            hist = state.attrs[key].history
            if hist.has_changes():
                before[key] = _jsonable(hist.deleted[0] if hist.deleted else None)
                after[key] = _jsonable(hist.added[0] if hist.added else None)
        if not after and not before:
            # only non-audited (secret) columns changed: still record that a write happened
            after = {"_changed": "redacted"}
        rows.append(_row(actor, f"{table}.update", table, _entity_id(obj), before, after))
    for obj in list(session.deleted):
        table = getattr(obj, "__tablename__", None)
        if table is None or table in SKIP_TABLES:
            continue
        rows.append(_row(actor, f"{table}.delete", table, _entity_id(obj), _snapshot(obj), None))
    session.add_all(rows)


@event.listens_for(Session, "do_orm_execute")
def _audit_bulk_dml(state) -> None:
    """Bulk UPDATE/DELETE bypass before_flush; record them so no write escapes the audit log."""
    if not (state.is_update or state.is_delete):
        return
    table = getattr(getattr(state.statement, "table", None), "name", "?")
    if table in SKIP_TABLES:
        return
    actor: Actor = state.session.info.get("actor", SYSTEM)
    kind = "bulk_update" if state.is_update else "bulk_delete"
    state.session.add(
        _row(actor, f"{table}.{kind}", table, None, None, {"statement": str(state.statement)[:500]})
    )


def _row(actor: Actor, action: str, entity: str, entity_id: str, before, after) -> AuditLog:
    return AuditLog(
        actor_type=actor.type,
        actor_id=actor.id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before_json=before,
        after_json=after,
    )
