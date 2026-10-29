"""Embedded PostgreSQL 16 (pgserver) for machines without Docker. Dev/test only."""

from pathlib import Path

import psycopg

API_ROOT = Path(__file__).resolve().parent.parent


def local_postgres(name: str, fresh: bool = False) -> str:
    """Start (or reuse) an embedded server and return a SQLAlchemy URL for database `name`."""
    import pgserver  # dev dependency

    srv = pgserver.get_server(API_ROOT / ".data" / "pg", cleanup_mode=None)
    base = srv.get_uri()  # postgresql://postgres:@127.0.0.1:PORT/postgres
    with psycopg.connect(base, autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,)).fetchone()
        if exists and fresh:
            conn.execute(f'DROP DATABASE "{name}" WITH (FORCE)')
            exists = None
        if not exists:
            conn.execute(f'CREATE DATABASE "{name}"')
    return "postgresql+psycopg://" + base.removeprefix("postgresql://").rsplit("/", 1)[0] + "/" + name


def migrate(url: str) -> None:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "alembic"))
    cfg.attributes["database_url"] = url
    command.upgrade(cfg, "head")
