import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import any_user
from app.core.security import (
    DUMMY_HASH,
    PASSWORD_RESET_TTL_MIN,
    check_password_strength,
    create_password_reset_token,
    create_token,
    decode_token,
    hash_password,
    reset_token_matches,
    verify_password,
)
from app.models import User
from app.schemas.users import ForgotPasswordIn, LoginIn, RefreshIn, ResetPasswordIn, TokenOut, UserOut
from app.services.mailer import send_mail

# Public router: login/refresh are the only unauthenticated write-free entry points.
public = APIRouter(prefix="/auth", tags=["auth"])
router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(any_user)])


def find_user(db: Session, identifier: str) -> User | None:
    """Look a user up by email or by username (both stored lower-case)."""
    ident = identifier.strip().lower()
    return db.scalar(select(User).where(or_(User.email == ident, User.username == ident)))


def _tokens(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_token(user.id, user.role.value, "access"),
        refresh_token=create_token(user.id, user.role.value, "refresh"),
        user=UserOut.model_validate(user),
    )


@public.post("/token", response_model=TokenOut)
def oauth2_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> TokenOut:
    """Standard OAuth 2.0 Password Grant token endpoint (RFC 6749)."""
    user = find_user(db, form_data.username)
    ok = verify_password(form_data.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not user.is_active or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Username/email or password is incorrect")
    audit.record(db, "auth.login", "users", user.id, actor=audit.Actor("user", str(user.id)))
    db.commit()
    return _tokens(user)


@public.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = find_user(db, body.email)
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not user.is_active or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Username/email or password is incorrect")
    audit.record(db, "auth.login", "users", user.id, actor=audit.Actor("user", str(user.id)))
    db.commit()
    return _tokens(user)


@public.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)) -> TokenOut:
    payload = decode_token(body.refresh_token, "refresh")
    user = db.get(User, uuid.UUID(payload["sub"])) if payload else None
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    audit.record(db, "auth.refresh", "users", user.id, actor=audit.Actor("user", str(user.id)))
    db.commit()
    return _tokens(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(any_user)) -> User:
    return user


_RESET_SENT = (
    "If an account matches what you entered, a password reset link has been sent to its email address. "
    f"The link is valid for {PASSWORD_RESET_TTL_MIN} minutes."
)


@public.post("/forgot-password")
def forgot_password(body: ForgotPasswordIn, db: Session = Depends(get_db)) -> dict[str, str]:
    """Email a single-use reset link. Same response whether or not the account exists (no enumeration)."""
    user = find_user(db, body.identifier)
    if user is None or not user.is_active:
        return {"detail": _RESET_SENT}
    token = create_password_reset_token(user.id, user.password_hash)
    url = f"{get_settings().web_base_url}/reset-password?token={token}"
    who = f" (username: {user.username})" if user.username else ""
    send_mail(
        user.email,
        "Reset your EduProctor password",
        f"Hello {user.name},\n\nWe received a request to reset the password for your EduProctor account{who}.\n\n"
        f"Set a new password here (valid for {PASSWORD_RESET_TTL_MIN} minutes, single use):\n{url}\n\n"
        "If you did not ask for this, you can ignore this email; your password will not change.\n",
    )
    audit.record(db, "auth.password_reset_requested", "users", user.id, actor=audit.Actor("user", str(user.id)))
    db.commit()
    return {"detail": _RESET_SENT}


@public.post("/reset-password")
def reset_password(body: ResetPasswordIn, db: Session = Depends(get_db)) -> dict[str, str]:
    payload = decode_token(body.token, "pwreset")
    user = db.get(User, uuid.UUID(payload["sub"])) if payload else None
    if user is None or not user.is_active or not reset_token_matches(payload, user.password_hash):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This reset link is invalid, expired or has already been used. Please request a new one.",
        )
    problem = check_password_strength(body.new_password)
    if problem:
        raise HTTPException(422, problem)
    user.password_hash = hash_password(body.new_password)
    audit.record(db, "auth.password_reset", "users", user.id, actor=audit.Actor("user", str(user.id)))
    db.commit()
    return {"detail": "Your password has been changed. You can now sign in with your new password."}
