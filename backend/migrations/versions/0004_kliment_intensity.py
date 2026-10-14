"""kliment intensity: Häufigkeit des Kliment-Modus

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-14 09:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("app_config", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("kliment_intensity", sa.String(), server_default="normal", nullable=False)
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("app_config", schema=None) as batch_op:
        batch_op.drop_column("kliment_intensity")
