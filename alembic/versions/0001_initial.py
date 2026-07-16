"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("tg_id", sa.BigInteger, nullable=False, unique=True),
        sa.Column("username", sa.String(64), nullable=True),
        sa.Column("first_name", sa.String(128), nullable=False),
        sa.Column("last_name", sa.String(128), nullable=True),
        sa.Column("language", sa.String(2), nullable=False, server_default="ru"),
        sa.Column("phone", sa.String(32), nullable=True),
        sa.Column("email", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_tg_id", "users", ["tg_id"])

    # cities
    op.create_table(
        "cities",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("manager_tg_id", sa.BigInteger, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
    )

    # admins
    op.create_table(
        "admins",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("tg_id", sa.BigInteger, nullable=False, unique=True),
        sa.Column("role", sa.String(32), nullable=False, server_default="admin"),
        sa.Column(
            "city_id",
            sa.BigInteger,
            sa.ForeignKey("cities.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_admins_tg_id", "admins", ["tg_id"])

    # locations
    op.create_table(
        "locations",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("city_id", sa.BigInteger, sa.ForeignKey("cities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("address", sa.String(512), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("curator_tg_username", sa.String(64), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
    )
    op.create_index("ix_locations_city_id", "locations", ["city_id"])

    # categories
    op.create_table(
        "categories",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("name_ru", sa.String(128), nullable=False),
        sa.Column("name_pl", sa.String(128), nullable=False),
        sa.Column("name_uk", sa.String(128), nullable=False),
        sa.Column("sort_order", sa.BigInteger, nullable=False, server_default="0"),
    )

    # products
    op.create_table(
        "products",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("category_id", sa.BigInteger, sa.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name_ru", sa.String(256), nullable=False),
        sa.Column("name_pl", sa.String(256), nullable=False),
        sa.Column("name_uk", sa.String(256), nullable=False),
        sa.Column("description_ru", sa.Text, nullable=True),
        sa.Column("description_pl", sa.Text, nullable=True),
        sa.Column("description_uk", sa.Text, nullable=True),
        sa.Column("image_file_id", sa.String(512), nullable=True),
        sa.Column("base_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
    )
    op.create_index("ix_products_category_id", "products", ["category_id"])

    # product_variants
    op.create_table(
        "product_variants",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("product_id", sa.BigInteger, sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name_ru", sa.String(256), nullable=False),
        sa.Column("name_pl", sa.String(256), nullable=False),
        sa.Column("name_uk", sa.String(256), nullable=False),
        sa.Column("image_file_id", sa.String(512), nullable=True),
        sa.Column("price_override", sa.Numeric(10, 2), nullable=True),
    )
    op.create_index("ix_product_variants_product_id", "product_variants", ["product_id"])

    # location_stock
    op.create_table(
        "location_stock",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("location_id", sa.BigInteger, sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", sa.BigInteger, sa.ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_sold_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("location_id", "variant_id", name="uq_location_variant"),
    )

    # carts
    op.create_table(
        "carts",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("location_id", sa.BigInteger, sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_carts_user_id", "carts", ["user_id"])

    # cart_items
    op.create_table(
        "cart_items",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("cart_id", sa.BigInteger, sa.ForeignKey("carts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", sa.BigInteger, sa.ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.UniqueConstraint("cart_id", "variant_id", name="uq_cart_variant"),
    )
    op.create_index("ix_cart_items_cart_id", "cart_items", ["cart_id"])

    # orders
    op.create_table(
        "orders",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("location_id", sa.BigInteger, sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("delivery_type", sa.String(16), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="new"),
        sa.Column("customer_name", sa.String(256), nullable=False),
        sa.Column("customer_phone", sa.String(32), nullable=False),
        sa.Column("customer_email", sa.String(256), nullable=False),
        sa.Column("delivery_address", sa.String(512), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("products_total", sa.Numeric(10, 2), nullable=False),
        sa.Column("delivery_cost", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_method", sa.String(32), nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"])

    # order_items
    op.create_table(
        "order_items",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.BigInteger, sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", sa.BigInteger, sa.ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("price_at_order", sa.Numeric(10, 2), nullable=False),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])


def downgrade() -> None:
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("cart_items")
    op.drop_table("carts")
    op.drop_table("location_stock")
    op.drop_table("product_variants")
    op.drop_table("products")
    op.drop_table("categories")
    op.drop_table("locations")
    op.drop_table("admins")
    op.drop_table("cities")
    op.drop_table("users")
