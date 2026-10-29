"""Evaluation job: after a session is scored (and that transaction commits), run the Assessment Evaluation Agent in a
background worker thread with its own DB session. EVALUATION_JOBS=off disables it (tests call run_evaluation directly).

In production this would sit on the Redis job queue; a thread pool keeps the single-process dev setup simple.
"""

import logging
import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import ExamSession

log = logging.getLogger(__name__)
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="evaluation")
_KEY = "evaluation_jobs"


def enqueue_evaluation(db: Session, sess: ExamSession) -> None:
    if get_settings().evaluation_jobs == "off":
        return
    db.info.setdefault(_KEY, set()).add(sess.id)


def _run(session_id: uuid.UUID) -> None:
    from app.agent.evaluation import run_evaluation
    from app.agent.llm import AgentUnavailable
    from app.core.db import SessionLocal, get_engine

    get_engine()
    with SessionLocal() as db:
        try:
            run_evaluation(db, session_id, triggered_by="job:scored")
        except AgentUnavailable as exc:
            log.info("Evaluation agent not configured: %s", exc)
        except Exception:
            log.exception("evaluation job failed for session %s", session_id)


@event.listens_for(Session, "after_commit")
def _dispatch(session: Session) -> None:
    ids = session.info.pop(_KEY, None)
    for sid in ids or ():
        _pool.submit(_run, sid)


@event.listens_for(Session, "after_rollback")
def _discard(session: Session) -> None:
    session.info.pop(_KEY, None)
