from __future__ import annotations

from aiogram.filters import BaseFilter
from aiogram.types import Message
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.repositories.user import UserRepository
from sqlalchemy import select
from db.models.admin import Admin


class IsAdmin(BaseFilter):
    """True if user is in ADMIN_IDS config list OR in the admins table."""

    async def __call__(self, message: Message, session: AsyncSession) -> bool:
        tg_id = message.from_user.id if message.from_user else None
        if tg_id is None:
            return False
        if tg_id in settings.ADMIN_IDS:
            return True
        result = await session.execute(select(Admin).where(Admin.tg_id == tg_id))
        return result.scalar_one_or_none() is not None


class IsSuperAdmin(BaseFilter):
    """True if user is in ADMIN_IDS config list."""

    async def __call__(self, message: Message) -> bool:
        tg_id = message.from_user.id if message.from_user else None
        return tg_id in settings.ADMIN_IDS
