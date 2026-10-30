from collections.abc import Iterator
from typing import Any

import certifi
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_engine: Engine | None = None
SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False)


def normalise_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url.removeprefix("mysql://")
    if url.startswith("tidb://"):
        return "mysql+pymysql://" + url.removeprefix("tidb://")
    return url


def configure_engine(url: str | None = None) -> Engine:
    global _engine
    if _engine is not None:
        _engine.dispose()

    resolved_url = normalise_url(url or get_settings().database_url)
    connect_args: dict[str, Any] = {}
    engine_kwargs: dict[str, Any] = {
        "pool_pre_ping": True,
    }

    # TiDB / MySQL SSL and connection pool optimization
    if "mysql" in resolved_url or "tidb" in resolved_url:
        connect_args["ssl"] = {"ca": certifi.where()}
        engine_kwargs["pool_recycle"] = 300
        engine_kwargs["pool_size"] = 10
        engine_kwargs["max_overflow"] = 20

    _engine = create_engine(resolved_url, connect_args=connect_args, **engine_kwargs)
    SessionLocal.configure(bind=_engine)
    return _engine


def get_engine() -> Engine:
    return _engine or configure_engine()


def get_db() -> Iterator[Session]:
    get_engine()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
