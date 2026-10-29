from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import candidate_only
from app.models import User
from app.schemas.exams import JoinOut
from app.services.links import redeem_link
from app.services.sessions import open_session

router = APIRouter(prefix="/join", tags=["candidate"], dependencies=[Depends(candidate_only)])


@router.post("/{token}", response_model=JoinOut)
def join(token: str, db: Session = Depends(get_db), user: User = Depends(candidate_only)) -> JoinOut:
    """Redeem a single-use link (POST because it consumes the link). Bound to the signed-in candidate."""
    assignment = redeem_link(db, token, user)
    session = open_session(db, assignment)
    db.commit()
    exam = assignment.exam
    return JoinOut(
        assignment_id=assignment.id,
        exam_id=exam.id,
        exam_title=exam.title,
        duration_min=exam.duration_min,
        session_id=session.id,
    )
