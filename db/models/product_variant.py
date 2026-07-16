from __future__ import annotations

from decimal import Decimal

from sqlalchemy import BigInteger, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class ProductVariant(Base):
    """Flavor, color, or other variant of a product."""

    __tablename__ = "product_variants"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name_ru: Mapped[str] = mapped_column(String(256), nullable=False)
    name_pl: Mapped[str] = mapped_column(String(256), nullable=False)
    name_uk: Mapped[str] = mapped_column(String(256), nullable=False)
    image_file_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # If None → use product.base_price
    price_override: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    product: Mapped["Product"] = relationship("Product", back_populates="variants")
    stock_items: Mapped[list["LocationStock"]] = relationship(
        "LocationStock", back_populates="variant", lazy="selectin", cascade="all, delete-orphan"
    )
