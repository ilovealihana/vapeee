from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True
    )
    delivery_type: Mapped[str] = mapped_column(String(16), nullable=False)
    # 'pickup' | 'inpost'

    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="new", server_default="new"
    )
    # 'new' | 'confirmed' | 'ready' | 'completed' | 'cancelled'

    customer_name: Mapped[str] = mapped_column(String(256), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(32), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(256), nullable=False)
    delivery_address: Mapped[str | None] = mapped_column(String(512), nullable=True)

    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    products_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    delivery_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    payment_method: Mapped[str] = mapped_column(String(32), nullable=False)
    # 'cash' | 'blik' | 'monobank'

    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    user: Mapped["User | None"] = relationship("User", back_populates="orders")
    location: Mapped["Location | None"] = relationship("Location", lazy="selectin")
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", lazy="selectin", cascade="all, delete-orphan"
    )
