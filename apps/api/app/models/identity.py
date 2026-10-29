import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, created_at, str_enum, utcnow, uuid_pk


class FaceProfile(Base):
    __tablename__ = "face_profiles"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    embedding_ref: Mapped[str] = mapped_column(String(80), info={"audit": False})  # encrypted blob
    engine: Mapped[str] = mapped_column(String(40))
    n_images: Mapped[int]
    consent_version: Mapped[str] = mapped_column(String(20))
    enrolled_at: Mapped[datetime] = mapped_column(default=utcnow)


class CheckKind(StrEnum):
    start = "start"
    random = "random"


class CheckResult(StrEnum):
    pending = "pending"
    passed = "pass"
    failed = "fail"
    uncertain = "uncertain"


class ReviewDecision(StrEnum):
    allow = "allow"
    block = "block"


class IdentityCheck(Base):
    __tablename__ = "identity_checks"

    id: Mapped[uuid.UUID] = uuid_pk()
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    kind: Mapped[CheckKind] = mapped_column(str_enum(CheckKind))
    attempt: Mapped[int] = mapped_column(default=1)
    challenge: Mapped[str | None] = mapped_column(String(20), default=None)  # blink / turn_left / turn_right
    issued_at: Mapped[datetime] = mapped_column(default=utcnow)
    liveness_ok: Mapped[bool | None] = mapped_column(default=None)
    liveness_detail: Mapped[str | None] = mapped_column(String(200), default=None)
    similarity: Mapped[float | None] = mapped_column(default=None)
    result: Mapped[CheckResult] = mapped_column(str_enum(CheckResult), default=CheckResult.pending)
    crop_ref: Mapped[str | None] = mapped_column(String(80), default=None, info={"audit": False})
    needs_review: Mapped[bool] = mapped_column(default=False, index=True)
    decision: Mapped[ReviewDecision | None] = mapped_column(str_enum(ReviewDecision), default=None)
    decision_comment: Mapped[str | None] = mapped_column(String(500), default=None)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    reviewed_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()
