import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import candidate_only
from app.models import SessionStatus, User
from app.models.base import utcnow
from app.models.identity import FaceProfile
from app.proctoring.ingest import publish_after_commit
from app.services import identity as svc
from app.services.sessions import own_session

router = APIRouter(tags=["identity"], dependencies=[Depends(candidate_only)])


class ConsentIn(BaseModel):
    consent_version: str


class IdentityStatus(BaseModel):
    consent_version: str
    consented: bool
    enrolled: bool
    consent_text: str


class EnrolIn(BaseModel):
    images: list[str] = Field(max_length=10)


class ChallengeOut(BaseModel):
    check_id: uuid.UUID
    challenge: str
    attempt: int
    max_attempts: int
    window_s: int


class LivenessIn(BaseModel):
    check_id: uuid.UUID
    passed: bool
    detail: str = Field(default="", max_length=120)
    frames: list[str] = Field(max_length=4)


class VerifyIn(BaseModel):
    kind: str = Field(pattern="^(start|random)$")
    image: str
    check_id: uuid.UUID | None = None


class VerifyOut(BaseModel):
    result: str
    status: SessionStatus
    attempts_left: int


CONSENT_TEXT = (
    "To confirm that you are the person taking this assessment, EduProctor uses your camera. "
    "Video is analysed only in your browser and never uploaded. We store an encrypted face template from your "
    "enrolment photos (not the photos), small face crops when a check needs mentor review, and short snapshots "
    "if a red flag is raised. These are used only to verify identity and support assessment integrity, are "
    "visible only to your mentor, and are deleted after {days} days or when you ask. No decision about you is "
    "made automatically: a mentor reviews every failed check and every flag."
)


@router.get("/identity/status", response_model=IdentityStatus)
def identity_status(db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    s = get_settings()
    return IdentityStatus(
        consent_version=s.consent_version,
        consented=user.consent_version == s.consent_version,
        enrolled=db.get(FaceProfile, user.id) is not None,
        consent_text=CONSENT_TEXT.format(days=s.retention_days),
    )


@router.post("/identity/consent", status_code=204)
def give_consent(body: ConsentIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    if body.consent_version != get_settings().consent_version:
        raise HTTPException(409, "The consent notice has changed; please read it again.")
    user.consent_version = body.consent_version
    user.consent_at = utcnow()
    audit.record(db, "identity.consent", "users", user.id, after={"consent_version": body.consent_version})
    db.commit()
    return Response(status_code=204)


@router.post("/identity/enrol", status_code=204)
def enrol(body: EnrolIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    svc.enrol(db, user, body.images)
    db.commit()
    return Response(status_code=204)


@router.delete("/identity/enrolment", status_code=204)
def delete_enrolment(db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    svc.delete_enrolment(db, user)
    db.commit()
    return Response(status_code=204)


@router.post("/sessions/{session_id}/identity/challenge", response_model=ChallengeOut)
def challenge(session_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(candidate_only)):
    s = get_settings()
    sess = own_session(db, session_id, user.id, lock=True)
    check = svc.issue_challenge(db, sess, user)
    db.commit()
    return ChallengeOut(
        check_id=check.id,
        challenge=check.challenge or "",
        attempt=check.attempt,
        max_attempts=s.identity_max_attempts,
        window_s=s.liveness_window_s,
    )


@router.post("/sessions/{session_id}/liveness", status_code=204)
def liveness(
    session_id: uuid.UUID,
    body: LivenessIn,
    db: Session = Depends(get_db),
    user: User = Depends(candidate_only),
):
    sess = own_session(db, session_id, user.id, lock=True)
    svc.record_liveness(db, sess, body.check_id, body.passed, body.detail, body.frames)
    db.commit()
    return Response(status_code=204)


@router.post("/sessions/{session_id}/verify", response_model=VerifyOut)
def verify(
    session_id: uuid.UUID, body: VerifyIn, db: Session = Depends(get_db), user: User = Depends(candidate_only)
):
    s = get_settings()
    sess = own_session(db, session_id, user.id, lock=True)
    alerts: list[dict] = []
    if body.kind == "start":
        if body.check_id is None:
            raise HTTPException(422, "check_id is required")
        check = svc.verify_start(db, sess, body.check_id, body.image)
        left = max(0, s.identity_max_attempts - svc.start_attempts(db, sess))
        # the candidate sees only pass / try again / waiting for mentor, never the similarity score
        result = "pass" if check.result.value == "pass" else ("review" if check.needs_review else "retry")
        if result != "pass":
            ev_type = "LIVENESS_FAIL" if not check.liveness_ok else "IDENTITY_MISMATCH"
            alerts.append({"kind": "alert", "session_id": str(sess.id), "type": ev_type, "severity": "high"})
    else:
        check = svc.verify_random(db, sess, body.image)
        left, result = 0, "recorded"
        if check.needs_review:
            alerts.append(
                {"kind": "alert", "session_id": str(sess.id), "type": "IDENTITY_MISMATCH", "severity": "high"}
            )
    db.commit()
    publish_after_commit(sess, alerts)
    return VerifyOut(result=result, status=sess.status, attempts_left=left)
