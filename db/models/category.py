from __future__ import annotations

from sqlalchemy import BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name_ru: Mapped[str] = mapped_column(String(128), nullable=False)
    name_pl: Mapped[str] = mapped_column(String(128), nullable=False)
    name_uk: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")

    products: Mapped[list["Product"]] = relationship("Product", back_populates="category", lazy="selectin")
