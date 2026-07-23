"""Add product requests

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-23 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_requests",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("request_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending_review"),
        sa.Column("requester_user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("requester_tg_id", sa.BigInteger, nullable=False),
        sa.Column("city_id", sa.Integer, sa.ForeignKey("cities.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("location_id", sa.Integer, sa.ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("product_id", sa.Integer, sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("variant_id", sa.Integer, sa.ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("variant_name_ru", sa.String(256), nullable=True),
        sa.Column("variant_name_pl", sa.String(256), nullable=True),
        sa.Column("variant_name_uk", sa.String(256), nullable=True),
        sa.Column("price_override", sa.Numeric(10, 2), nullable=True),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("reject_reason", sa.Text, nullable=True),
        sa.Column(
            "published_variant_id",
            sa.Integer,
            sa.ForeignKey("product_variants.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewer_tg_id", sa.BigInteger, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("request_type IN ('ADD_VARIANT', 'ADD_STOCK')", name="ck_product_requests_type"),
        sa.CheckConstraint(
            "status IN ('pending_review', 'approved', 'rejected')",
            name="ck_product_requests_status",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_product_requests_positive_quantity"),
    )
    for column in (
        "request_type",
        "status",
        "requester_user_id",
        "requester_tg_id",
        "city_id",
        "location_id",
        "product_id",
        "variant_id",
        "published_variant_id",
        "reviewer_tg_id",
    ):
        op.create_index(f"ix_product_requests_{column}", "product_requests", [column])


def downgrade() -> None:
    for column in (
        "reviewer_tg_id",
        "published_variant_id",
        "variant_id",
        "product_id",
        "location_id",
        "city_id",
        "requester_tg_id",
        "requester_user_id",
        "status",
        "request_type",
    ):
        op.drop_index(f"ix_product_requests_{column}", table_name="product_requests")
    op.drop_table("product_requests")
