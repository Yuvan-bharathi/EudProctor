"""Assessment IDs, candidate usernames and per-candidate login passwords.

Policy (product decision, 2 Nov 2026): every enrolled candidate gets their OWN credentials by email:
  username = their name (lower-cased, made unique), password = a random password unique to them.
The issued password is stored Fernet-encrypted on the account so a re-sent invitation can include it
again. Once the candidate changes it (e.g. via "Forgot password") the stored copy no longer verifies and
is never emailed again. A candidate who already has their own password keeps it.

Earlier builds used one shared password per assessment (exams.candidate_password_enc). Accounts still on
such a shared password are treated as "not personalised" and get a unique password on the next send.
"""

import base64
import hashlib
import re
import secrets
import unicodedata

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password, password_not_set, verify_password
from app.models import Exam, User

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I: easy to read aloud and type
_CONSONANTS = "bcdfghjkmnprstvz"
_VOWELS = "aeiou"


# ---------------------------------------------------------------- Assessment ID
def generate_exam_code(db: Session) -> str:
    while True:
        code = "ASM-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if db.scalar(select(Exam.id).where(Exam.code == code)) is None:
            return code


def ensure_exam_code(db: Session, exam: Exam) -> str:
    if not exam.code:
        exam.code = generate_exam_code(db)
    return exam.code


# ---------------------------------------------------------------- per-candidate passwords
def _syllables() -> str:
    return "".join(secrets.choice(_CONSONANTS if i % 2 == 0 else _VOWELS) for i in range(4)).capitalize()


def generate_candidate_password() -> str:
    """Readable but personal, e.g. "Kavo-Ribe-4827" (~3.7e11 combinations; meets letter + digit + 8 chars)."""
    return f"{_syllables()}-{_syllables()}-{secrets.randbelow(9000) + 1000}"


def _fernet(purpose: str) -> Fernet:
    key = hashlib.sha256(f"{purpose}:{get_settings().jwt_secret}".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def _decrypt(purpose: str, token: str | None) -> str | None:
    if not token:
        return None
    try:
        return _fernet(purpose).decrypt(token.encode()).decode()
    except InvalidToken:  # JWT_SECRET changed since it was stored
        return None


def issue_password(user: User) -> str:
    """Give the account a new unique password and keep an encrypted copy for invitation emails."""
    password = generate_candidate_password()
    user.password_hash = hash_password(password)
    user.issued_password_enc = _fernet("candidate-issued-password").encrypt(password.encode()).decode()
    return password


def get_issued_password(user: User) -> str | None:
    """The system-issued password, only while it is still the account's current password."""
    password = _decrypt("candidate-issued-password", user.issued_password_enc)
    if password and verify_password(password, user.password_hash):
        return password
    return None


def _legacy_exam_password(exam: Exam) -> str | None:
    return _decrypt("exam-candidate-password", exam.candidate_password_enc)


def ensure_candidate_password(user: User, exam: Exam | None = None) -> str | None:
    """Make sure the candidate has personal credentials; return the password to email, or None.

    None means the candidate set their own password, which is never emailed.
    """
    issued = get_issued_password(user)
    if issued:
        return issued
    legacy = _legacy_exam_password(exam) if exam is not None else None
    if password_not_set(user.password_hash) or (legacy and verify_password(legacy, user.password_hash)):
        return issue_password(user)
    return None


# ---------------------------------------------------------------- usernames
def _slug(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    parts = re.findall(r"[a-z0-9]+", ascii_name.lower())
    return ".".join(parts)[:60] or "candidate"


def make_username(db: Session, name: str) -> str:
    """"Tanu Shree" -> "tanu.shree"; a second "Tanu Shree" -> "tanu.shree2"."""
    base = _slug(name)
    candidate, n = base, 1
    while db.scalar(select(User.id).where(User.username == candidate)) is not None:
        n += 1
        candidate = f"{base}{n}"
    return candidate


def ensure_username(db: Session, user: User) -> str:
    if not user.username:
        user.username = make_username(db, user.name)
        db.flush()
    return user.username
