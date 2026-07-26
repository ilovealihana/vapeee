"""global catalog sources

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("latitude", sa.Numeric(9, 6), nullable=True))
    op.add_column("locations", sa.Column("longitude", sa.Numeric(9, 6), nullable=True))
    op.add_column("carts", sa.Column("source_type", sa.String(length=32), nullable=True))
    op.add_column("orders", sa.Column("source_type", sa.String(length=32), nullable=True))
    op.add_column("orders", sa.Column("inpost_delivery_method", sa.String(length=32), nullable=True))
    op.add_column("orders", sa.Column("inpost_point_id", sa.String(length=128), nullable=True))
    op.add_column("orders", sa.Column("inpost_point_label", sa.String(length=256), nullable=True))
    op.add_column("orders", sa.Column("inpost_courier_address_json", sa.Text(), nullable=True))
    op.create_table(
        "inpost_stock",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("variant_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_sold_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("variant_id", name="uq_inpost_variant"),
    )
    op.create_index(op.f("ix_inpost_stock_variant_id"), "inpost_stock", ["variant_id"], unique=False)
    op.execute("UPDATE carts SET source_type = 'local_point' WHERE location_id IS NOT NULL")
    op.execute("UPDATE orders SET source_type = 'local_point' WHERE location_id IS NOT NULL")


def downgrade() -> None:
    op.drop_index(op.f("ix_inpost_stock_variant_id"), table_name="inpost_stock")
    op.drop_table("inpost_stock")
    op.drop_column("orders", "inpost_courier_address_json")
    op.drop_column("orders", "inpost_point_label")
    op.drop_column("orders", "inpost_point_id")
    op.drop_column("orders", "inpost_delivery_method")
    op.drop_column("orders", "source_type")
    op.drop_column("carts", "source_type")
    op.drop_column("locations", "longitude")
    op.drop_column("locations", "latitude")
