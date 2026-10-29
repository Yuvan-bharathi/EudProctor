"""Identity flow. Images are synthetic noise patterns (no real faces); the dev engine compares pixels."""

import base64
import io
from pathlib import Path

import numpy as np
import pytest
from PIL import Image
from sqlalchemy import select

from app.core.config import get_settings
from app.models import FaceProfile, IdentityCheck, Role, SessionStatus
from tests.conftest import auth, make_user
from tests.factories import build_exam, build_session


def face(seed: int, shift: int = 0, noise: float = 4.0, nonce: int = 0) -> str:
    rng = np.random.default_rng(seed)
    base = rng.integers(0, 255, (8, 8)).astype(np.float32)
    img = np.kron(base, np.ones((24, 24)))  # 192x192 blocky "face"
    img = np.roll(img, shift, axis=1)
    img += np.random.default_rng(seed * 1000 + shift + nonce).normal(0, noise, img.shape)
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGB")
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode()


PERSON, OTHER = 7, 99


def consent(client, cand):
    v = get_settings().consent_version
    assert (
        client.post("/api/v1/identity/consent", headers=auth(cand), json={"consent_version": v}).status_code
        == 204
    )


def enrol(client, cand, seed=PERSON):
    res = client.post(
        "/api/v1/identity/enrol", headers=auth(cand), json={"images": [face(seed, nonce=i) for i in range(3)]}
    )
    assert res.status_code == 204, res.text


def attempt(client, cand, sess, seed=PERSON, live=True):
    ch = client.post(f"/api/v1/sessions/{sess.id}/identity/challenge", headers=auth(cand))
    assert ch.status_code == 200, ch.text
    check_id = ch.json()["check_id"]
    frames = [face(seed, shift=s) for s in ((0, 12, 24) if live else (0, 0, 0))]
    res = client.post(
        f"/api/v1/sessions/{sess.id}/liveness",
        headers=auth(cand),
        json={"check_id": check_id, "passed": True, "detail": ch.json()["challenge"], "frames": frames},
    )
    assert res.status_code == 204, res.text
    return client.post(
        f"/api/v1/sessions/{sess.id}/verify",
        headers=auth(cand),
        json={"kind": "start", "check_id": check_id, "image": face(seed, nonce=42)},
    )


@pytest.fixture
def pre_start(db, mentor, course, candidate):
    exam = build_exam(db, course, mentor)
    return build_session(db, exam, candidate, status=SessionStatus.link_opened)


def test_consent_required_before_enrolment(client, candidate):
    res = client.post("/api/v1/identity/enrol", headers=auth(candidate), json={"images": [face(1)] * 3})
    assert res.status_code == 409
    status = client.get("/api/v1/identity/status", headers=auth(candidate)).json()
    assert status["consented"] is False and "never uploaded" in status["consent_text"]


def test_embeddings_are_encrypted_at_rest(client, db, candidate):
    consent(client, candidate)
    enrol(client, candidate)
    profile = db.get(FaceProfile, candidate.id)
    blob = (Path(get_settings().storage_dir) / f"{profile.embedding_ref}.bin").read_bytes()
    assert b"embeddings" not in blob and blob.startswith(b"gAAAA")  # Fernet token
    assert profile.consent_version == get_settings().consent_version


def test_genuine_user_passes_and_can_start(client, db, candidate, pre_start):
    consent(client, candidate)
    enrol(client, candidate)
    res = attempt(client, candidate, pre_start)
    assert res.json()["result"] == "pass"
    assert "similarity" not in res.text
    assert res.json()["status"] == "calibrating"
    started = client.post(f"/api/v1/sessions/{pre_start.id}/start", headers=auth(candidate))
    assert started.json()["status"] == "in_progress"
    db.refresh(pre_start)
    assert len(pre_start.identity_checks_due) == get_settings().identity_random_checks


def test_static_photo_fails_liveness_and_goes_to_mentor_review(client, db, mentor, candidate, pre_start):
    consent(client, candidate)
    enrol(client, candidate)
    first = attempt(client, candidate, pre_start, live=False)
    assert first.json() == {"result": "retry", "status": "identity_check", "attempts_left": 1}
    second = attempt(client, candidate, pre_start, live=False)
    assert second.json()["result"] == "review" and second.json()["status"] == "identity_review"
    # no third attempt
    assert (
        client.post(
            f"/api/v1/sessions/{pre_start.id}/identity/challenge", headers=auth(candidate)
        ).status_code
        == 409
    )

    queue = client.get("/api/v1/mentor/identity-reviews", headers=auth(mentor)).json()
    assert (
        len(queue) == 1
        and queue[0]["liveness_ok"] is False
        and "frames static" in queue[0]["liveness_detail"]
    )
    crop = client.get(f"/api/v1/mentor/identity-checks/{queue[0]['check_id']}/crop", headers=auth(mentor))
    assert crop.status_code == 200 and crop.headers["content-type"] == "image/jpeg"
    # another mentor cannot see or decide it
    other = make_user(db, Role.mentor)
    assert client.get("/api/v1/mentor/identity-reviews", headers=auth(other)).json() == []

    res = client.post(
        f"/api/v1/mentor/identity-checks/{queue[0]['check_id']}/decision",
        headers=auth(mentor),
        json={"decision": "allow", "comment": "Spoke to candidate on call"},
    )
    assert res.status_code == 200
    db.refresh(pre_start)
    assert pre_start.status == SessionStatus.calibrating


def test_different_person_is_blocked_only_by_mentor_decision(client, db, mentor, candidate, pre_start):
    consent(client, candidate)
    enrol(client, candidate, seed=PERSON)
    assert attempt(client, candidate, pre_start, seed=OTHER).json()["result"] == "retry"
    assert attempt(client, candidate, pre_start, seed=OTHER).json()["status"] == "identity_review"
    check = client.get("/api/v1/mentor/identity-reviews", headers=auth(mentor)).json()[0]
    assert check["similarity"] < get_settings().identity_match_threshold
    client.post(
        f"/api/v1/mentor/identity-checks/{check['check_id']}/decision",
        headers=auth(mentor),
        json={"decision": "block"},
    )
    db.refresh(pre_start)
    assert pre_start.status == SessionStatus.identity_blocked


def test_random_check_mismatch_never_changes_session(client, db, mentor, course, candidate):
    consent(client, candidate)
    enrol(client, candidate)
    sess = build_session(db, build_exam(db, course, mentor), candidate)
    res = client.post(
        f"/api/v1/sessions/{sess.id}/verify",
        headers=auth(candidate),
        json={"kind": "random", "image": face(OTHER)},
    )
    assert res.json() == {"result": "recorded", "status": "in_progress", "attempts_left": 0}
    db.refresh(sess)
    assert sess.status == SessionStatus.in_progress and len(sess.identity_checks_due) == 1
    check = db.scalar(select(IdentityCheck).where(IdentityCheck.session_id == sess.id))
    assert check.needs_review and check.crop_ref
    # mentor decisions on random checks are recorded but never change the session
    client.post(
        f"/api/v1/mentor/identity-checks/{check.id}/decision",
        headers=auth(mentor),
        json={"decision": "block"},
    )
    db.refresh(sess)
    assert sess.status == SessionStatus.in_progress


def test_delete_enrolment_removes_template(client, db, candidate):
    consent(client, candidate)
    enrol(client, candidate)
    ref = db.get(FaceProfile, candidate.id).embedding_ref
    assert client.delete("/api/v1/identity/enrolment", headers=auth(candidate)).status_code == 204
    db.expire_all()
    assert db.get(FaceProfile, candidate.id) is None
    assert not (Path(get_settings().storage_dir) / f"{ref}.bin").exists()


def test_oversized_image_rejected(client, candidate):
    consent(client, candidate)
    big = base64.b64encode(b"x" * (get_settings().max_face_image_bytes + 1)).decode()
    res = client.post("/api/v1/identity/enrol", headers=auth(candidate), json={"images": [big] * 3})
    assert res.status_code == 413
