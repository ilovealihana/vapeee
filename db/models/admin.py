from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tg_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="admin")
    # 'superadmin' | 'city_manager'
    city_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("cities.id", ondelete="SET NULL"), nullable=True
    )

    city: Mapped["City | None"] = relationship("City", back_populates="managers", lazy="selectin")
