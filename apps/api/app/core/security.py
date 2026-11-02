import base64
import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.core.config import get_settings

_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(digest).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(digest_b64)
    except (ValueError, TypeError):
        return False
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    return hmac.compare_digest(digest, expected)


# Used when the email is unknown so the response time does not reveal which accounts exist.
DUMMY_HASH = hash_password("not-a-real-password")

# Accounts created by enrolment have no usable password until the candidate sets one from
# their invitation link. The "!" prefix can never verify (see verify_password).
UNUSABLE_PASSWORD_PREFIX = "!"
# Enrolment used to give every imported candidate this shared password; such accounts are
# treated as "password not set yet" so the candidate must choose their own.
_LEGACY_ENROLMENT_PASSWORD = "candidatepassword"


def make_unusable_password() -> str:
    return UNUSABLE_PASSWORD_PREFIX + secrets.token_urlsafe(24)


def password_not_set(stored: str) -> bool:
    return stored.startswith(UNUSABLE_PASSWORD_PREFIX) or verify_password(_LEGACY_ENROLMENT_PASSWORD, stored)


def create_token(user_id: uuid.UUID, role: str, kind: str) -> str:
    s = get_settings()
    ttl = timedelta(minutes=s.jwt_access_minutes) if kind == "access" else timedelta(days=s.jwt_refresh_days)
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": kind,
        "iat": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def decode_token(token: str, kind: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return payload if payload.get("type") == kind else None


def create_ws_ticket(user_id: uuid.UUID, exam_id: uuid.UUID) -> str:
    """Short-lived, single-use ticket for the mentor WebSocket (keeps the access token out of URLs/logs)."""
    s = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "exam": str(exam_id),
        "type": "ws",
        "iat": now,
        "exp": now + timedelta(seconds=s.ws_ticket_ttl_s),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def sign_value(value: str) -> str:
    """HMAC used for link tokens etc. (stored hashed, never raw)."""
    return hmac.new(get_settings().jwt_secret.encode(), value.encode(), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- password reset
PASSWORD_RESET_TTL_MIN = 30


def _password_fingerprint(password_hash: str) -> str:
    # Changes whenever the password changes, so a reset link works only once.
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_password_reset_token(user_id: uuid.UUID, password_hash: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "pwreset",
        "pwf": _password_fingerprint(password_hash),
        "iat": now,
        "exp": now + timedelta(minutes=PASSWORD_RESET_TTL_MIN),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256")


def reset_token_matches(payload: dict[str, Any], password_hash: str) -> bool:
    return hmac.compare_digest(str(payload.get("pwf", "")), _password_fingerprint(password_hash))


def check_password_strength(password: str) -> str | None:
    """Returns a user-facing problem, or None if the password is acceptable."""
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return "Password must contain at least one letter and one number."
    return None
