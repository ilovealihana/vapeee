from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class LocationStock(Base):
    """Current stock of a variant at a specific pickup location."""

    __tablename__ = "location_stock"
    __table_args__ = (UniqueConstraint("location_id", "variant_id", name="uq_location_variant"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    location_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_sold_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    location: Mapped["Location"] = relationship("Location", back_populates="stock_items")
    variant: Mapped["ProductVariant"] = relationship("ProductVariant", back_populates="stock_items")
