from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class InpostStock(Base):
    """Current warehouse stock of a variant for InPost fulfillment."""

    __tablename__ = "inpost_stock"
    __table_args__ = (UniqueConstraint("variant_id", name="uq_inpost_variant"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    variant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_sold_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    variant: Mapped["ProductVariant"] = relationship("ProductVariant", lazy="selectin")
