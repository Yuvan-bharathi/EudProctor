import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.db import get_db
from app.core.deps import any_user
from app.core.security import DUMMY_HASH, create_token, decode_token, verify_password
from app.models import User
from app.schemas.users import LoginIn, RefreshIn, TokenOut, UserOut

# Public router: login/refresh are the only unauthenticated write-free entry points.
public = APIRouter(prefix="/auth", tags=["auth"])
router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(any_user)])


def _tokens(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_token(user.id, user.role.value, "access"),
        refresh_token=create_token(user.id, user.role.value, "refresh"),
        user=UserOut.model_validate(user),
    )


@public.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not user.is_active or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect")
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
