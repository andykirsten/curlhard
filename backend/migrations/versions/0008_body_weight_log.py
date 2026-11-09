"""body_weight_log: Körpergewicht-Verlauf

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-09 19:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "body_weight_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("measured_on", sa.Date(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "measured_on"),
    )
    with op.batch_alter_table("body_weight_log", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_body_weight_log_user_id"), ["user_id"], unique=False)
    # Bestehendes Körpergewicht als erster Eintrag übernehmen
    op.execute(
        "INSERT INTO body_weight_log (created_at, updated_at, user_id, measured_on, weight_kg) "
        "SELECT CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, id, CURRENT_DATE, body_weight_kg "
        'FROM "user" WHERE body_weight_kg IS NOT NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("body_weight_log", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_body_weight_log_user_id"))
    op.drop_table("body_weight_log")
