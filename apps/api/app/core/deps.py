import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.audit import Actor, set_actor
from app.core.db import get_db
from app.core.security import decode_token
from app.models import Role, User

_bearer = HTTPBearer(auto_error=False)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    token_oauth: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    raw_token = cred.credentials if cred else token_oauth
    if not raw_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_token(raw_token, "access")
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account inactive")
    set_actor(db, Actor("user", str(user.id)))
    return user


def require_roles(*roles: Role) -> Callable[..., User]:
    """Role guard. Every router is mounted with one of these (enforced by tests/test_role_guards.py)."""
    allowed = frozenset(roles)

    def guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed for your role")
        return user

    guard.roles = allowed  # type: ignore[attr-defined]
    return guard


admin_only = require_roles(Role.admin)
mentor_only = require_roles(Role.mentor)
candidate_only = require_roles(Role.candidate)
mentor_or_admin = require_roles(Role.mentor, Role.admin)
any_user = require_roles(Role.admin, Role.mentor, Role.candidate)
