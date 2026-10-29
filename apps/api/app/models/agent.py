import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow, uuid_pk


class AgentRun(Base):
    """One agent job. Observability for Phase 8; written by app.agent.runner only."""

    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = uuid_pk()
    agent: Mapped[str] = mapped_column(String(60), index=True)
    status: Mapped[str] = mapped_column(String(20), default="running")  # running / succeeded / failed
    goal: Mapped[str] = mapped_column(Text)
    inputs_json: Mapped[dict[str, Any]] = mapped_column(default=dict)
    model: Mapped[str | None] = mapped_column(String(80), default=None)
    prompt_version: Mapped[str | None] = mapped_column(String(40), default=None)
    tokens_in: Mapped[int] = mapped_column(default=0)
    tokens_out: Mapped[int] = mapped_column(default=0)
    cost_usd: Mapped[float] = mapped_column(default=0.0)
    error: Mapped[str | None] = mapped_column(Text, default=None)
    triggered_by: Mapped[str | None] = mapped_column(String(64), default=None)
    subject_type: Mapped[str | None] = mapped_column(String(40), default=None)
    subject_id: Mapped[str | None] = mapped_column(String(64), default=None, index=True)
    started_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(default=None)

    steps: Mapped[list["AgentStep"]] = relationship(order_by="AgentStep.seq", cascade="all, delete-orphan")


class AgentStep(Base):
    __tablename__ = "agent_steps"

    id: Mapped[uuid.UUID] = uuid_pk()
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True)
    seq: Mapped[int]
    kind: Mapped[str] = mapped_column(String(16))  # llm / tool / deterministic
    tool: Mapped[str | None] = mapped_column(String(80), default=None)
    args_json: Mapped[dict[str, Any] | None] = mapped_column(default=None)
    output_summary: Mapped[str | None] = mapped_column(Text, default=None)
    reason: Mapped[str | None] = mapped_column(
        Text, default=None
    )  # model-stated reason text, never raw thinking
    latency_ms: Mapped[int] = mapped_column(default=0)
    tokens_in: Mapped[int] = mapped_column(default=0)
    tokens_out: Mapped[int] = mapped_column(default=0)
    error: Mapped[str | None] = mapped_column(Text, default=None)
    at: Mapped[datetime] = mapped_column(default=utcnow)
