"""Keep databases created with ``Base.metadata.create_all`` (TiDB Cloud / MySQL dev setup) in step with
the models. ``create_all`` creates missing tables but never adds columns to existing ones, and this
database has no alembic_version table, so Alembic migrations cannot be applied to it.

Only additive, nullable columns are handled here (idempotent: skipped when already present).
PostgreSQL deployments use the Alembic migrations instead (see alembic/versions/0008).

    python -m app.core.schema_sync     # run manually; also runs automatically at API startup
"""

import logging

from sqlalchemy import inspect, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

# (table, column, MySQL DDL, unique index name or None)
_ADDITIVE_COLUMNS: list[tuple[str, str, str, str | None]] = [
    ("users", "username", "VARCHAR(80) NULL", "uq_users_username"),
    ("exams", "code", "VARCHAR(20) NULL", "uq_exams_code"),
    ("exams", "candidate_password_enc", "VARCHAR(255) NULL", None),
    ("exams", "pass_pct", "INT NULL", None),
    ("users", "issued_password_enc", "VARCHAR(255) NULL", None),
]


def sync_mysql_columns(engine: Engine) -> list[str]:
    if engine.dialect.name != "mysql":
        return []
    insp = inspect(engine)
    added: list[str] = []
    with engine.begin() as conn:
        for table, column, ddl, unique_index in _ADDITIVE_COLUMNS:
            if not insp.has_table(table):
                continue  # create_all will build it with every column
            if column in {c["name"] for c in insp.get_columns(table)}:
                continue
            conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {ddl}"))
            if unique_index:
                conn.execute(text(f"CREATE UNIQUE INDEX `{unique_index}` ON `{table}` (`{column}`)"))
            added.append(f"{table}.{column}")
    if added:
        log.warning("schema_sync added columns: %s", ", ".join(added))
    return added


def backfill_exam_codes(engine: Engine) -> int:
    """Give every assessment created before Assessment IDs existed its ID."""
    from app.models import Exam
    from app.services.credentials import generate_exam_code

    with Session(engine) as db:
        exams = list(db.scalars(select(Exam).where(Exam.code.is_(None))))
        for exam in exams:
            exam.code = generate_exam_code(db)
            db.flush()
        db.commit()
        return len(exams)


def create_missing_tables(engine: Engine) -> None:
    """create_all-managed DBs (TiDB): add brand-new tables such as the internship ones (existing ones untouched)."""
    if engine.dialect.name != "mysql":
        return
    import app.models  # noqa: F401  registers every model on the metadata
    from app.models.base import Base

    Base.metadata.create_all(engine)


def run(engine: Engine) -> None:
    create_missing_tables(engine)
    sync_mysql_columns(engine)
    n = backfill_exam_codes(engine)
    if n:
        log.warning("schema_sync assigned Assessment IDs to %d existing assessment(s)", n)


if __name__ == "__main__":  # pragma: no cover
    from app.core.db import get_engine

    logging.basicConfig(level=logging.INFO)
    run(get_engine())
    print("schema in sync")
