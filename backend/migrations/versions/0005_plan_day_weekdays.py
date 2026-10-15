"""plan_day weekdays: ein Trainingstag an mehreren Wochentagen

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-14 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("plan_day", schema=None) as batch_op:
        batch_op.add_column(sa.Column("weekdays", sa.JSON(), server_default="[]", nullable=False))
    op.execute("UPDATE plan_day SET weekdays = '[' || weekday || ']' WHERE weekday IS NOT NULL")
    with op.batch_alter_table("plan_day", schema=None) as batch_op:
        batch_op.drop_column("weekday")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("plan_day", schema=None) as batch_op:
        batch_op.add_column(sa.Column("weekday", sa.Integer(), nullable=True))
    # Bei mehreren Wochentagen bleibt nur der erste erhalten
    op.execute("UPDATE plan_day SET weekday = json_extract(weekdays, '$[0]')")
    with op.batch_alter_table("plan_day", schema=None) as batch_op:
        batch_op.drop_column("weekdays")
