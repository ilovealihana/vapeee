from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


PRODUCT_REQUEST_ADD_VARIANT = "ADD_VARIANT"
PRODUCT_REQUEST_ADD_STOCK = "ADD_STOCK"
PRODUCT_REQUEST_TYPES = {PRODUCT_REQUEST_ADD_VARIANT, PRODUCT_REQUEST_ADD_STOCK}

PRODUCT_REQUEST_SOURCE_LOCAL_POINT = "local_point"
PRODUCT_REQUEST_SOURCE_INPOST = "inpost"
PRODUCT_REQUEST_SOURCES = {PRODUCT_REQUEST_SOURCE_LOCAL_POINT, PRODUCT_REQUEST_SOURCE_INPOST}

PRODUCT_REQUEST_PENDING_REVIEW = "pending_review"
PRODUCT_REQUEST_NEED_CHANGES = "need_changes"
PRODUCT_REQUEST_APPROVED = "approved"
PRODUCT_REQUEST_REJECTED = "rejected"
PRODUCT_REQUEST_STATUSES = {
    PRODUCT_REQUEST_PENDING_REVIEW,
    PRODUCT_REQUEST_NEED_CHANGES,
    PRODUCT_REQUEST_APPROVED,
    PRODUCT_REQUEST_REJECTED,
}
PRODUCT_REQUEST_ACTIVE_STATUSES = {
    PRODUCT_REQUEST_PENDING_REVIEW,
    PRODUCT_REQUEST_NEED_CHANGES,
}
PRODUCT_REQUEST_FINAL_STATUSES = {
    PRODUCT_REQUEST_APPROVED,
    PRODUCT_REQUEST_REJECTED,
}


class ProductRequest(Base):
    __tablename__ = "product_requests"
    __table_args__ = (
        CheckConstraint(
            "request_type IN ('ADD_VARIANT', 'ADD_STOCK')",
            name="ck_product_requests_type",
        ),
        CheckConstraint(
            "status IN ('pending_review', 'need_changes', 'approved', 'rejected')",
            name="ck_product_requests_status",
        ),
        CheckConstraint(
            "source_type IN ('local_point', 'inpost')",
            name="ck_product_requests_source_type",
        ),
        CheckConstraint(
            "(source_type = 'local_point' AND city_id IS NOT NULL AND location_id IS NOT NULL) OR "
            "(source_type = 'inpost' AND city_id IS NULL AND location_id IS NULL)",
            name="ck_product_requests_source_target",
        ),
        CheckConstraint("quantity > 0", name="ck_product_requests_positive_quantity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PRODUCT_REQUEST_SOURCE_LOCAL_POINT,
        server_default=PRODUCT_REQUEST_SOURCE_LOCAL_POINT,
        index=True,
    )
    request_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PRODUCT_REQUEST_PENDING_REVIEW,
        server_default=PRODUCT_REQUEST_PENDING_REVIEW,
        index=True,
    )
    requester_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    requester_tg_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    city_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("cities.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    variant_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    variant_name_ru: Mapped[str | None] = mapped_column(String(256), nullable=True)
    variant_name_pl: Mapped[str | None] = mapped_column(String(256), nullable=True)
    variant_name_uk: Mapped[str | None] = mapped_column(String(256), nullable=True)
    price_override: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_variant_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reviewer_tg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    locked_by_tg_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    requester: Mapped["User | None"] = relationship("User", lazy="selectin")
    city: Mapped["City | None"] = relationship("City", lazy="selectin")
    location: Mapped["Location | None"] = relationship("Location", lazy="selectin")
    product: Mapped["Product"] = relationship("Product", foreign_keys=[product_id], lazy="selectin")
    variant: Mapped["ProductVariant | None"] = relationship(
        "ProductVariant", foreign_keys=[variant_id], lazy="selectin"
    )
    published_variant: Mapped["ProductVariant | None"] = relationship(
        "ProductVariant", foreign_keys=[published_variant_id], lazy="selectin"
    )
