from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import create_token
from app.schemas.users import UserOut
from app.schemas.exams import JoinOut
from app.services.links import redeem_link
from app.services.sessions import open_session

router = APIRouter(prefix="/join", tags=["candidate"])


@router.post("/{token}", response_model=JoinOut)
def join(token: str, db: Session = Depends(get_db)) -> JoinOut:
    """Redeem a single-use link (POST because it consumes the link). Seamlessly authenticates as the assigned candidate."""
    assignment, candidate = redeem_link(db, token)
    session = open_session(db, assignment)
    db.commit()
    exam = assignment.exam

    access_tok = create_token(candidate.id, candidate.role.value, "access")
    refresh_tok = create_token(candidate.id, candidate.role.value, "refresh")

    return JoinOut(
        assignment_id=assignment.id,
        exam_id=exam.id,
        exam_title=exam.title,
        duration_min=exam.duration_min,
        session_id=session.id,
        access_token=access_tok,
        refresh_token=refresh_tok,
        user=UserOut.model_validate(candidate).model_dump(),
    )
