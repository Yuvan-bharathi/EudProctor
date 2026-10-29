import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at, str_enum, uuid_pk


class Role(StrEnum):
    admin = "admin"
    mentor = "mentor"
    candidate = "candidate"


class MemberRole(StrEnum):
    mentor = "mentor"
    candidate = "candidate"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    role: Mapped[Role] = mapped_column(str_enum(Role))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255), info={"audit": False})
    is_active: Mapped[bool] = mapped_column(default=True)
    consent_version: Mapped[str | None] = mapped_column(String(20), default=None)
    consent_at: Mapped[datetime | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = created_at()


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(160))
    code: Mapped[str] = mapped_column(String(40), unique=True)
    created_at: Mapped[datetime] = created_at()

    members: Mapped[list["CourseMember"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )


class CourseMember(Base):
    __tablename__ = "course_members"

    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[MemberRole] = mapped_column(str_enum(MemberRole))

    course: Mapped[Course] = relationship(back_populates="members")
    user: Mapped[User] = relationship()
