"""Retention: delete evidence snapshots, identity crops and face templates older than RETENTION_DAYS.

Rows describing events, flags and decisions are kept (they hold no images); only the encrypted blobs and the face
templates go. Runs daily from the API process and can be run by hand:  uv run python -m app.jobs.retention
"""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit, storage
from app.core.config import get_settings
from app.models import CandidateFlag, FaceProfile, IdentityCheck, ProctorEvent
from app.models.base import utcnow


@dataclass
class RetentionReport:
    snapshots: int = 0
    identity_crops: int = 0
    face_profiles: int = 0


def run_retention(db: Session, now=None) -> RetentionReport:
    cutoff = (now or utcnow()) - timedelta(days=get_settings().retention_days)
    audit.set_actor(db, audit.Actor("system", "retention"))
    rep = RetentionReport()
    for ev in db.scalars(
        select(ProctorEvent).where(ProctorEvent.snapshot_ref.is_not(None), ProctorEvent.created_at < cutoff)
    ):
        storage.delete(ev.snapshot_ref)
        ev.snapshot_ref = None
        rep.snapshots += 1
    for flag in db.scalars(
        select(CandidateFlag).where(
            CandidateFlag.snapshot_ref.is_not(None), CandidateFlag.started_at < cutoff
        )
    ):
        storage.delete(flag.snapshot_ref)  # same blob as its event; deleting twice is harmless
        flag.snapshot_ref = None
    for check in db.scalars(
        select(IdentityCheck).where(IdentityCheck.crop_ref.is_not(None), IdentityCheck.created_at < cutoff)
    ):
        storage.delete(check.crop_ref)
        check.crop_ref = None
        rep.identity_crops += 1
    for profile in db.scalars(select(FaceProfile).where(FaceProfile.enrolled_at < cutoff)):
        storage.delete(profile.embedding_ref)
        db.delete(profile)
        rep.face_profiles += 1
    audit.record(db, "retention.run", "storage", None, after=rep.__dict__ | {"cutoff": cutoff.isoformat()})
    db.commit()
    return rep


if __name__ == "__main__":
    from app.core.db import SessionLocal, get_engine

    get_engine()
    with SessionLocal() as session:
        print(run_retention(session))
