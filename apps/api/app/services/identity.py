"""Identity: consent, enrolment, liveness + ArcFace verification, mentor review.

Only cropped face images reach the server (never video). Embeddings and crops are stored encrypted; raw
enrolment images are discarded after embedding. A failed or uncertain start check goes to mentor review;
the mentor (a human) decides whether the candidate may start. Random checks during the assessment never
change the session; a mismatch only creates a mentor-only alert.
"""

import json
import random
import uuid
from datetime import timedelta

import numpy as np
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit, storage
from app.core.config import get_settings
from app.models import ExamSession, SessionStatus, User
from app.models.base import utcnow
from app.models.identity import CheckKind, CheckResult, FaceProfile, IdentityCheck
from app.proctoring.ingest import record_server_event
from app.services import sessions as session_svc
from app.services.face import cosine, decode_image, get_engine

CHALLENGES = ("blink", "turn_left", "turn_right")


def require_consent(user: User) -> None:
    if user.consent_version != get_settings().consent_version:
        raise HTTPException(409, "Please read and accept the consent notice first.")


def enrol(db: Session, user: User, images_b64: list[str]) -> FaceProfile:
    s = get_settings()
    require_consent(user)
    if not s.enrol_min_images <= len(images_b64) <= s.enrol_max_images:
        raise HTTPException(422, f"Provide {s.enrol_min_images} to {s.enrol_max_images} images")
    engine = get_engine()
    vectors = [engine.embed(decode_image(b)) for b in images_b64]
    blob = json.dumps({"engine": engine.name, "embeddings": [v.tolist() for v in vectors]}).encode()
    profile = db.get(FaceProfile, user.id)
    if profile:
        storage.delete(profile.embedding_ref)
        profile.embedding_ref = storage.put("embeddings", blob)
        profile.engine, profile.n_images, profile.consent_version = (
            engine.name,
            len(vectors),
            user.consent_version,
        )
        profile.enrolled_at = utcnow()
    else:
        profile = FaceProfile(
            candidate_id=user.id,
            embedding_ref=storage.put("embeddings", blob),
            engine=engine.name,
            n_images=len(vectors),
            consent_version=user.consent_version or "",
        )
        db.add(profile)
    audit.record(
        db,
        "identity.enrol",
        "face_profiles",
        user.id,
        after={"n_images": len(vectors), "engine": engine.name},
    )
    return profile


def delete_enrolment(db: Session, user: User) -> bool:
    profile = db.get(FaceProfile, user.id)
    if profile is None:
        return False
    storage.delete(profile.embedding_ref)
    db.delete(profile)
    audit.record(db, "identity.delete_enrolment", "face_profiles", user.id)
    return True


def _enrolled_vectors(db: Session, candidate_id: uuid.UUID) -> list[np.ndarray]:
    profile = db.get(FaceProfile, candidate_id)
    if profile is None:
        raise HTTPException(409, "Enrol your face before starting.")
    data = json.loads(storage.get(profile.embedding_ref))
    if data["engine"] != get_engine().name:
        raise HTTPException(409, "Please enrol your face again.")
    return [np.asarray(v, dtype=np.float32) for v in data["embeddings"]]


def similarity(db: Session, candidate_id: uuid.UUID, image: Image.Image) -> float:
    probe = get_engine().embed(image)
    return max(cosine(probe, v) for v in _enrolled_vectors(db, candidate_id))


def classify(sim: float) -> CheckResult:
    s = get_settings()
    if sim >= s.identity_match_threshold:
        return CheckResult.passed
    if sim >= s.identity_uncertain_threshold:
        return CheckResult.uncertain
    return CheckResult.failed


def start_attempts(db: Session, sess: ExamSession) -> int:
    return db.scalar(
        select(func.count())
        .select_from(IdentityCheck)
        .where(IdentityCheck.session_id == sess.id, IdentityCheck.kind == CheckKind.start)
    )


def issue_challenge(db: Session, sess: ExamSession, user: User) -> IdentityCheck:
    s = get_settings()
    require_consent(user)
    _enrolled_vectors(db, user.id)
    if sess.status == SessionStatus.link_opened:
        session_svc.transition(db, sess, SessionStatus.identity_check, "identity check started")
    if sess.status != SessionStatus.identity_check:
        raise HTTPException(409, "Identity check is not available now.")
    attempts = start_attempts(db, sess)
    if attempts >= s.identity_max_attempts:
        raise HTTPException(409, "No attempts left; your mentor will review.")
    check = IdentityCheck(
        session_id=sess.id, kind=CheckKind.start, attempt=attempts + 1, challenge=random.choice(CHALLENGES)
    )
    db.add(check)
    db.flush()
    return check


def _frames_vary(frames: list[Image.Image]) -> bool:
    """A held-up photo produces near-identical crops while a live face blinking/turning does not."""
    arrays = [np.asarray(f.convert("L").resize((64, 64)), dtype=np.float32) for f in frames]
    diffs = [float(np.abs(a - b).mean()) for a, b in zip(arrays, arrays[1:], strict=False)]
    return max(diffs, default=0.0) >= get_settings().liveness_min_frame_diff


def record_liveness(
    db: Session,
    sess: ExamSession,
    check_id: uuid.UUID,
    browser_passed: bool,
    detail: str,
    frames_b64: list[str],
) -> IdentityCheck:
    s = get_settings()
    check = _pending_check(db, sess, check_id)
    if not 2 <= len(frames_b64) <= 4:
        raise HTTPException(422, "Send 2 to 4 face crops captured during the challenge")
    frames = [decode_image(f) for f in frames_b64]
    in_time = utcnow() - check.issued_at <= timedelta(seconds=s.liveness_window_s)
    vary = _frames_vary(frames)
    check.liveness_ok = bool(browser_passed and in_time and vary)
    check.liveness_detail = (
        (detail or "")[:120] + ("" if in_time else " · too slow") + ("" if vary else " · frames static")
    )
    return check


def _pending_check(db: Session, sess: ExamSession, check_id: uuid.UUID) -> IdentityCheck:
    check = db.get(IdentityCheck, check_id)
    if check is None or check.session_id != sess.id or check.result != CheckResult.pending:
        raise HTTPException(404, "Identity check not found")
    return check


def verify_start(db: Session, sess: ExamSession, check_id: uuid.UUID, image_b64: str) -> IdentityCheck:
    s = get_settings()
    check = _pending_check(db, sess, check_id)
    if check.kind != CheckKind.start or sess.status != SessionStatus.identity_check:
        raise HTTPException(409, "Identity check is not available now.")
    if check.liveness_ok is None:
        raise HTTPException(409, "Complete the liveness challenge first.")
    image = decode_image(image_b64)
    check.similarity = round(similarity(db, sess.candidate_id, image), 4)
    match = classify(check.similarity)
    check.result = match if check.liveness_ok else CheckResult.failed
    if check.result == CheckResult.passed:
        session_svc.transition(db, sess, SessionStatus.calibrating, "identity verified")
    else:
        check.crop_ref = storage.put("identity_crops", _jpeg(image))
        record_server_event(
            db,
            sess,
            "LIVENESS_FAIL" if not check.liveness_ok else "IDENTITY_MISMATCH",
            {"check_id": str(check.id), "attempt": check.attempt, "similarity": check.similarity},
        )
        if check.attempt >= s.identity_max_attempts:
            check.needs_review = True
            session_svc.transition(db, sess, SessionStatus.identity_review, "identity needs mentor review")
    return check


def schedule_random_checks(sess: ExamSession) -> None:
    """Pick the random in-assessment check times (seconds after start)."""
    s = get_settings()
    total = (sess.deadline_at - sess.started_at).total_seconds()
    rng = random.Random()
    sess.identity_checks_due = sorted(
        int(rng.uniform(0.1, 0.9) * total) for _ in range(s.identity_random_checks)
    )


def next_random_check_in(sess: ExamSession) -> int | None:
    if sess.status != SessionStatus.in_progress or not sess.identity_checks_due or sess.started_at is None:
        return None
    elapsed = (utcnow() - sess.started_at).total_seconds()
    return max(0, int(sess.identity_checks_due[0] - elapsed))


def verify_random(db: Session, sess: ExamSession, image_b64: str) -> IdentityCheck:
    """In-assessment check. Never changes the session (rule 1); a mismatch is a mentor-only alert."""
    if sess.status != SessionStatus.in_progress or not sess.identity_checks_due:
        raise HTTPException(409, "No identity check is due.")
    image = decode_image(image_b64)
    sim = round(similarity(db, sess.candidate_id, image), 4)
    result = classify(sim)
    check = IdentityCheck(
        session_id=sess.id,
        kind=CheckKind.random,
        similarity=sim,
        result=result,
        needs_review=result != CheckResult.passed,
    )
    db.add(check)
    if check.needs_review:
        check.crop_ref = storage.put("identity_crops", _jpeg(image))
        db.flush()
        record_server_event(db, sess, "IDENTITY_MISMATCH", {"check_id": str(check.id), "similarity": sim})
    sess.identity_checks_due = list(sess.identity_checks_due[1:])
    db.flush()
    return check


def _jpeg(image: Image.Image) -> bytes:
    import io

    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=80)
    return buf.getvalue()
