from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name_ru: Mapped[str] = mapped_column(String(256), nullable=False)
    name_pl: Mapped[str] = mapped_column(String(256), nullable=False)
    name_uk: Mapped[str] = mapped_column(String(256), nullable=False)
    description_ru: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_pl: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_uk: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_file_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    category: Mapped["Category | None"] = relationship("Category", back_populates="products")
    variants: Mapped[list["ProductVariant"]] = relationship(
        "ProductVariant", back_populates="product", lazy="selectin", cascade="all, delete-orphan"
    )
