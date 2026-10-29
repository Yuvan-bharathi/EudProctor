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
