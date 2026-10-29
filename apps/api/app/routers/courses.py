import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import mentor_only
from app.models import Course, CourseMember, MemberRole, User
from app.schemas.users import CourseOut, UserOut

router = APIRouter(prefix="/courses", tags=["courses"], dependencies=[Depends(mentor_only)])


def mentor_course_ids(db: Session, mentor: User) -> set[uuid.UUID]:
    return set(
        db.scalars(
            select(CourseMember.course_id).where(
                CourseMember.user_id == mentor.id, CourseMember.role == MemberRole.mentor
            )
        )
    )


def require_course_mentor(db: Session, mentor: User, course_id: uuid.UUID) -> None:
    if course_id not in mentor_course_ids(db, mentor):
        raise HTTPException(404, "Course not found")


@router.get("", response_model=list[CourseOut])
def my_courses(db: Session = Depends(get_db), mentor: User = Depends(mentor_only)) -> list[Course]:
    ids = mentor_course_ids(db, mentor)
    return list(db.scalars(select(Course).where(Course.id.in_(ids)).order_by(Course.name))) if ids else []


@router.get("/{course_id}/candidates", response_model=list[UserOut])
def course_candidates(
    course_id: uuid.UUID, db: Session = Depends(get_db), mentor: User = Depends(mentor_only)
) -> list[User]:
    require_course_mentor(db, mentor, course_id)
    return list(
        db.scalars(
            select(User)
            .join(CourseMember, CourseMember.user_id == User.id)
            .where(CourseMember.course_id == course_id, CourseMember.role == MemberRole.candidate)
            .order_by(User.name)
        )
    )
