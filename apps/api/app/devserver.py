"""Run the API against TiDB Cloud or embedded Postgres when Docker is unavailable.

uv run python -m app.devserver          # migrate, seed (incl. demo data) if empty, serve on :8000 with reload

Environment overrides (used by the Playwright E2E setup):
  DEV_DB_NAME=eduproctor_e2e  DEV_RESET=1 (fresh database)  DEV_DEMO=0 (base seed only)  API_PORT=8100  RELOAD=0
"""

import os

import uvicorn

os.environ.setdefault("ENVIRONMENT", "dev")  # before settings are first read

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    configured_url = os.environ.get("DATABASE_URL") or settings.database_url

    if "mysql" in configured_url or "tidb" in configured_url:
        print(f"Connecting devserver to TiDB Cloud / MySQL: {configured_url.split('@')[-1]}")
        from app.models.base import Base
        from app.core.db import get_engine
        Base.metadata.create_all(get_engine())
    else:
        from app.devdb import local_postgres, migrate
        url = local_postgres(
            os.environ.get("DEV_DB_NAME", "eduproctor"), fresh=os.environ.get("DEV_RESET") == "1"
        )
        os.environ["DATABASE_URL"] = url
        get_settings.cache_clear()
        from app.core.db import configure_engine
        configure_engine(url)
        migrate(url)

    from app.seed import seed_if_empty
    seed_if_empty(demo=os.environ.get("DEV_DEMO", "1") == "1")

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=int(os.environ.get("API_PORT", "8000")),
        reload=os.environ.get("RELOAD", "1") == "1",
    )


if __name__ == "__main__":
    main()
