"""Add product request review loop fields

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_STATUS_CHECK = "status IN ('pending_review', 'need_changes', 'approved', 'rejected')"
OLD_STATUS_CHECK = "status IN ('pending_review', 'approved', 'rejected')"


def upgrade() -> None:
    with op.batch_alter_table("product_requests") as batch_op:
        batch_op.drop_constraint("ck_product_requests_status", type_="check")
        batch_op.add_column(sa.Column("review_comment", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("locked_by_tg_id", sa.BigInteger(), nullable=True))
        batch_op.add_column(sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_check_constraint("ck_product_requests_status", NEW_STATUS_CHECK)
        batch_op.create_index("ix_product_requests_locked_by_tg_id", ["locked_by_tg_id"])

    op.execute("UPDATE product_requests SET review_comment = reject_reason WHERE reject_reason IS NOT NULL")


def downgrade() -> None:
    bind = op.get_bind()
    need_changes_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM product_requests WHERE status = 'need_changes'")
    ).scalar_one()
    if need_changes_count:
        raise RuntimeError("Cannot downgrade while product_requests contains need_changes rows")

    with op.batch_alter_table("product_requests") as batch_op:
        batch_op.drop_index("ix_product_requests_locked_by_tg_id")
        batch_op.drop_constraint("ck_product_requests_status", type_="check")
        batch_op.create_check_constraint("ck_product_requests_status", OLD_STATUS_CHECK)
        batch_op.drop_column("locked_at")
        batch_op.drop_column("locked_by_tg_id")
        batch_op.drop_column("review_comment")
