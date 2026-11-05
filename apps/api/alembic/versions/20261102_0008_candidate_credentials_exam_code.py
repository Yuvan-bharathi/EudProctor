"""candidate usernames, assessment IDs and per-assessment candidate password

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-02

Existing assessments get their Assessment ID at API startup (app.core.schema_sync.backfill_exam_codes).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(length=80), nullable=True))
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.add_column("exams", sa.Column("code", sa.String(length=20), nullable=True))
    op.create_index(op.f("ix_exams_code"), "exams", ["code"], unique=True)
    op.add_column("exams", sa.Column("candidate_password_enc", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("exams", "candidate_password_enc")
    op.drop_index(op.f("ix_exams_code"), table_name="exams")
    op.drop_column("exams", "code")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_column("users", "username")
