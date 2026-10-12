"""social cycles: plan sharing, training cycles, avatars, online status

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-11 16:18:25.137406

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "user_avatar",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_user_avatar_user_id"), "user_avatar", ["user_id"], unique=False)

    op.create_table(
        "training_cycle",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("note", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("plan_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plan.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_training_cycle_user_id"), "training_cycle", ["user_id"], unique=False)

    with op.batch_alter_table("plan", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_public", sa.Boolean(), server_default=sa.false(), nullable=False)
        )

    with op.batch_alter_table("user", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("last_seen_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("avatar_updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True)
        )

    with op.batch_alter_table("workout_session", schema=None) as batch_op:
        batch_op.add_column(sa.Column("cycle_id", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("cycle_name", sqlmodel.sql.sqltypes.AutoString(), nullable=True)
        )
        batch_op.create_index(batch_op.f("ix_workout_session_cycle_id"), ["cycle_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_workout_session_cycle_id_training_cycle",
            "training_cycle",
            ["cycle_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("workout_session", schema=None) as batch_op:
        batch_op.drop_constraint("fk_workout_session_cycle_id_training_cycle", type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_workout_session_cycle_id"))
        batch_op.drop_column("cycle_name")
        batch_op.drop_column("cycle_id")

    with op.batch_alter_table("user", schema=None) as batch_op:
        batch_op.drop_column("avatar_updated_at")
        batch_op.drop_column("last_seen_at")

    with op.batch_alter_table("plan", schema=None) as batch_op:
        batch_op.drop_column("is_public")

    op.drop_index(op.f("ix_training_cycle_user_id"), table_name="training_cycle")
    op.drop_table("training_cycle")
    op.drop_index(op.f("ix_user_avatar_user_id"), table_name="user_avatar")
    op.drop_table("user_avatar")
