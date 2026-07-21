"""Add staff members and assignments

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff_members",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("tg_id", sa.BigInteger, nullable=False, unique=True),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_staff_members_tg_id", "staff_members", ["tg_id"])

    op.create_table(
        "staff_assignments",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "staff_member_id",
            sa.Integer,
            sa.ForeignKey("staff_members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("city_id", sa.Integer, sa.ForeignKey("cities.id", ondelete="CASCADE"), nullable=True),
        sa.Column("location_id", sa.Integer, sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "(city_id IS NOT NULL AND location_id IS NULL) OR "
            "(city_id IS NULL AND location_id IS NOT NULL)",
            name="ck_staff_assignment_exactly_one_target",
        ),
        sa.UniqueConstraint("staff_member_id", "city_id", name="uq_staff_member_city"),
        sa.UniqueConstraint("staff_member_id", "location_id", name="uq_staff_member_location"),
    )
    op.create_index("ix_staff_assignments_staff_member_id", "staff_assignments", ["staff_member_id"])
    op.create_index("ix_staff_assignments_city_id", "staff_assignments", ["city_id"])
    op.create_index("ix_staff_assignments_location_id", "staff_assignments", ["location_id"])


def downgrade() -> None:
    op.drop_index("ix_staff_assignments_location_id", table_name="staff_assignments")
    op.drop_index("ix_staff_assignments_city_id", table_name="staff_assignments")
    op.drop_index("ix_staff_assignments_staff_member_id", table_name="staff_assignments")
    op.drop_table("staff_assignments")
    op.drop_index("ix_staff_members_tg_id", table_name="staff_members")
    op.drop_table("staff_members")
