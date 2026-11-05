import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.core.audit  # noqa: F401  registers the audit before_flush hook
import app.jobs.evaluation  # noqa: F401  registers the after-commit evaluation job dispatcher
from app.core.config import get_settings
from app.core.db import SessionLocal, get_engine
from app.routers import (
    admin,
    admin_details,
    agent_runs,
    auth,
    candidates,
    courses,
    evaluation,
    exams,
    health,
    identity,
    internship,
    invite,
    join,
    mentor,
    mentor_proctoring,
    notes,
    proctoring,
    questions,
    results,
    sessions,
    ws,
)

API_PREFIX = "/api/v1"

# Routers listed here without a role guard must be in tests/test_role_guards.PUBLIC_ROUTES.
ROUTERS = [
    health.router,
    auth.public,
    auth.router,
    admin.router,
    courses.router,
    questions.router,
    exams.router,
    internship.router,
    invite.router,
    join.router,
    sessions.router,
    identity.router,
    mentor.router,
    proctoring.router,
    mentor_proctoring.router,
    ws.router,
    results.router,
    evaluation.router,
    candidates.router,
    notes.router,
    agent_runs.router,
    admin_details.router,
]

log = logging.getLogger(__name__)


async def _deadline_sweeper(interval: int) -> None:
    """Auto-submit sessions whose server deadline passed (the only automatic submit)."""
    from app.services.sessions import sweep_deadlines

    while True:
        await asyncio.sleep(interval)
        try:
            get_engine()
            with SessionLocal() as db:
                await asyncio.to_thread(sweep_deadlines, db)
        except Exception:  # keep the loop alive; the lazy per-request check still applies
            log.exception("deadline sweep failed")


async def _internship_jobs(interval: int) -> None:
    """Attendance auto-close, stall scan, Friday quiz drafts and 30/60/90 appraisal drafts."""
    from app.jobs.internship import run_internship_jobs

    while True:
        await asyncio.sleep(interval)
        try:
            get_engine()
            with SessionLocal() as db:
                await asyncio.to_thread(run_internship_jobs, db)
        except Exception:
            log.exception("internship jobs failed")


async def _daily_retention() -> None:
    from app.jobs.retention import run_retention

    while True:
        try:
            get_engine()
            with SessionLocal() as db:
                await asyncio.to_thread(run_retention, db)
        except Exception:
            log.exception("retention job failed")
        await asyncio.sleep(24 * 3600)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    tasks = []
    if settings.environment != "test":
        if any(h in settings.web_base_url for h in ("localhost", "127.0.0.1")):
            log.warning(
                "WEB_BASE_URL is %s: links in emails (invitations, login, password reset) will only work on this "
                "machine. On a deployment, set WEB_BASE_URL to the public web app URL.", settings.web_base_url,
            )
        # Add new nullable columns on create_all-managed DBs (TiDB) and backfill Assessment IDs.
        try:
            from app.core.schema_sync import run as sync_schema

            sync_schema(get_engine())
        except Exception:  # never block startup; the error is visible in the log
            log.exception("schema_sync failed")
        tasks.append(asyncio.create_task(_deadline_sweeper(settings.deadline_sweep_interval_s)))
        tasks.append(asyncio.create_task(_daily_retention()))
        tasks.append(asyncio.create_task(_internship_jobs(settings.internship_scheduler_interval_s)))
    yield
    for task in tasks:
        task.cancel()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=r"^https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for r in ROUTERS:
        app.include_router(r, prefix=API_PREFIX)
    return app


app = create_app()
