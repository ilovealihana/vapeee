from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


ROLE_PROJECT_ADMIN = "project_admin"
ROLE_CITY_CURATOR = "city_curator"
ROLE_POINT_MANAGER = "point_manager"
ROLE_INPOST_CURATOR = "inpost_curator"
STAFF_ROLES = {ROLE_PROJECT_ADMIN, ROLE_CITY_CURATOR, ROLE_POINT_MANAGER, ROLE_INPOST_CURATOR}


class StaffMember(Base):
    __tablename__ = "staff_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tg_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    assignments: Mapped[list["StaffAssignment"]] = relationship(
        "StaffAssignment",
        back_populates="staff_member",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class StaffAssignment(Base):
    __tablename__ = "staff_assignments"
    __table_args__ = (
        CheckConstraint(
            "(city_id IS NOT NULL AND location_id IS NULL) OR "
            "(city_id IS NULL AND location_id IS NOT NULL)",
            name="ck_staff_assignment_exactly_one_target",
        ),
        UniqueConstraint("staff_member_id", "city_id", name="uq_staff_member_city"),
        UniqueConstraint("staff_member_id", "location_id", name="uq_staff_member_location"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    staff_member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("staff_members.id", ondelete="CASCADE"), nullable=False, index=True
    )
    city_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("cities.id", ondelete="CASCADE"), nullable=True, index=True
    )
    location_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    staff_member: Mapped[StaffMember] = relationship("StaffMember", back_populates="assignments")
    city: Mapped["City | None"] = relationship("City", lazy="selectin")
    location: Mapped["Location | None"] = relationship("Location", lazy="selectin")
