import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import MemberRole, Role


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: uuid.UUID
    role: Role
    email: str
    name: str
    is_active: bool


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class RefreshIn(BaseModel):
    refresh_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    role: Role
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)


class UserPatch(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class CourseIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    code: str = Field(min_length=1, max_length=40)


class CourseOut(ORM):
    id: uuid.UUID
    name: str
    code: str


class MemberIn(BaseModel):
    user_id: uuid.UUID
    role: MemberRole


class MemberOut(BaseModel):
    user: UserOut
    role: MemberRole
