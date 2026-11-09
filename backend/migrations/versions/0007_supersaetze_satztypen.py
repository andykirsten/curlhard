"""Supersätze (group_no) und Satztypen (set_type)

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-09 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("plan_exercise", schema=None) as batch_op:
        batch_op.add_column(sa.Column("group_no", sa.Integer(), nullable=True))
    with op.batch_alter_table("session_exercise", schema=None) as batch_op:
        batch_op.add_column(sa.Column("group_no", sa.Integer(), nullable=True))
    with op.batch_alter_table("set_log", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("set_type", sa.String(), server_default="normal", nullable=False)
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("set_log", schema=None) as batch_op:
        batch_op.drop_column("set_type")
    with op.batch_alter_table("session_exercise", schema=None) as batch_op:
        batch_op.drop_column("group_no")
    with op.batch_alter_table("plan_exercise", schema=None) as batch_op:
        batch_op.drop_column("group_no")
