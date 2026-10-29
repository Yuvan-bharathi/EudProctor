import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow, uuid_pk


class AuditLog(Base):
    """Append-only. Written by the before_flush hook (app.core.audit) and by explicit service actions."""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = uuid_pk()
    actor_type: Mapped[str] = mapped_column(String(16))  # user / agent / system
    actor_id: Mapped[str | None] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity: Mapped[str] = mapped_column(String(64), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(200), index=True)
    before_json: Mapped[dict[str, Any] | None] = mapped_column(default=None)
    after_json: Mapped[dict[str, Any] | None] = mapped_column(default=None)
    at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
