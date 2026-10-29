import uuid
from datetime import timedelta
from pathlib import Path

from app.core import storage
from app.core.config import get_settings
from app.jobs.retention import run_retention
from app.models import FaceProfile, IdentityCheck, ProctorEvent
from app.models.base import utcnow
from tests.factories import build_exam, build_session


def blob_exists(ref):
    return (Path(get_settings().storage_dir) / f"{ref}.bin").exists()


def test_retention_deletes_old_blobs_and_templates_only(db, mentor, course, candidate):
    sess = build_session(db, build_exam(db, course, mentor), candidate)
    days = get_settings().retention_days
    old = utcnow() - timedelta(days=days + 1)
    recent = utcnow() - timedelta(days=days - 1)
    refs = {k: storage.put("snapshots", b"jpeg") for k in ("old", "new")}
    crop = storage.put("identity_crops", b"jpeg")
    emb = storage.put("embeddings", b"{}")
    db.add_all(
        [
            ProctorEvent(
                session_id=sess.id,
                client_event_id=uuid.uuid4().hex,
                type="MULTIPLE_FACES",
                severity="high",
                started_at=old,
                snapshot_ref=refs["old"],
                created_at=old,
            ),
            ProctorEvent(
                session_id=sess.id,
                client_event_id=uuid.uuid4().hex,
                type="MULTIPLE_FACES",
                severity="high",
                started_at=recent,
                snapshot_ref=refs["new"],
                created_at=recent,
            ),
            IdentityCheck(session_id=sess.id, kind="random", crop_ref=crop, created_at=old),
            FaceProfile(
                candidate_id=candidate.id,
                embedding_ref=emb,
                engine="dev",
                n_images=3,
                consent_version="v",
                enrolled_at=old,
            ),
        ]
    )
    db.commit()
    rep = run_retention(db)
    assert (rep.snapshots, rep.identity_crops, rep.face_profiles) == (1, 1, 1)
    assert not blob_exists(refs["old"]) and blob_exists(refs["new"])
    assert not blob_exists(crop) and not blob_exists(emb)
    db.expire_all()
    assert db.get(FaceProfile, candidate.id) is None
    from app.models import AuditLog

    row = db.query(AuditLog).filter(AuditLog.action == "retention.run").one()
    assert row.after_json["snapshots"] == 1 and row.after_json["face_profiles"] == 1
    # event rows themselves are kept for the mentor timeline
    assert db.query(ProctorEvent).filter(ProctorEvent.session_id == sess.id).count() == 2
