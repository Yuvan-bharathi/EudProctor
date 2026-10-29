import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import admin_only
from app.core.security import hash_password
from app.models import Course, CourseMember, MemberRole, Role, User
from app.schemas.users import CourseIn, CourseOut, MemberIn, MemberOut, UserCreate, UserOut, UserPatch

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_only)])


@router.get("/users", response_model=list[UserOut])
def list_users(role: Role | None = None, db: Session = Depends(get_db)) -> list[User]:
    q = select(User).order_by(User.role, User.name)
    if role:
        q = q.where(User.role == role)
    return list(db.scalars(q))


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db)) -> User:
    user = User(
        role=body.role, email=body.email.lower(), name=body.name, password_hash=hash_password(body.password)
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from None
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def patch_user(user_id: uuid.UUID, body: UserPatch, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    db.commit()
    return user


@router.get("/courses", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db)) -> list[Course]:
    return list(db.scalars(select(Course).order_by(Course.name)))


@router.post("/courses", response_model=CourseOut, status_code=201)
def create_course(body: CourseIn, db: Session = Depends(get_db)) -> Course:
    course = Course(name=body.name, code=body.code)
    db.add(course)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Course code already exists") from None
    return course


@router.get("/courses/{course_id}/members", response_model=list[MemberOut])
def list_members(course_id: uuid.UUID, db: Session = Depends(get_db)) -> list[MemberOut]:
    rows = db.scalars(select(CourseMember).where(CourseMember.course_id == course_id))
    return [MemberOut(user=UserOut.model_validate(m.user), role=m.role) for m in rows]


@router.post("/courses/{course_id}/members", status_code=201)
def add_member(course_id: uuid.UUID, body: MemberIn, db: Session = Depends(get_db)) -> dict[str, str]:
    course, user = db.get(Course, course_id), db.get(User, body.user_id)
    if course is None or user is None:
        raise HTTPException(404, "Course or user not found")
    expected = Role.mentor if body.role == MemberRole.mentor else Role.candidate
    if user.role != expected:
        raise HTTPException(422, f"User is not a {body.role.value}")
    if db.get(CourseMember, (course_id, body.user_id)) is None:
        db.add(CourseMember(course_id=course_id, user_id=body.user_id, role=body.role))
        db.commit()
    return {"status": "ok"}


@router.delete("/courses/{course_id}/members/{user_id}", status_code=204)
def remove_member(course_id: uuid.UUID, user_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    member = db.get(CourseMember, (course_id, user_id))
    if member is None:
        raise HTTPException(404, "Member not found")
    db.delete(member)
    db.commit()
    return Response(status_code=204)
