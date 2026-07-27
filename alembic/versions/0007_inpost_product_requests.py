"""inpost product request source

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("product_requests") as batch_op:
        batch_op.add_column(
            sa.Column("source_type", sa.String(length=32), server_default="local_point", nullable=False)
        )
        batch_op.alter_column("city_id", existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column("location_id", existing_type=sa.Integer(), nullable=True)
        batch_op.create_index(batch_op.f("ix_product_requests_source_type"), ["source_type"], unique=False)
        batch_op.create_check_constraint(
            "ck_product_requests_source_type",
            "source_type IN ('local_point', 'inpost')",
        )
        batch_op.create_check_constraint(
            "ck_product_requests_source_target",
            "(source_type = 'local_point' AND city_id IS NOT NULL AND location_id IS NOT NULL) OR "
            "(source_type = 'inpost' AND city_id IS NULL AND location_id IS NULL)",
        )


def downgrade() -> None:
    with op.batch_alter_table("product_requests") as batch_op:
        batch_op.drop_constraint("ck_product_requests_source_target", type_="check")
        batch_op.drop_constraint("ck_product_requests_source_type", type_="check")
        batch_op.drop_index(batch_op.f("ix_product_requests_source_type"))
        batch_op.alter_column("location_id", existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column("city_id", existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column("source_type")
