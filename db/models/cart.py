from __future__ import annotations

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    # Which location the user is browsing (None = InPost mode)
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped["User"] = relationship("User", back_populates="cart")
    items: Mapped[list["CartItem"]] = relationship(
        "CartItem", back_populates="cart", lazy="selectin", cascade="all, delete-orphan"
    )
    location: Mapped["Location | None"] = relationship("Location", lazy="selectin")
