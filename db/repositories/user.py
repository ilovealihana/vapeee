from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_tg_id(self, tg_id: int) -> User | None:
        result = await self.session.execute(select(User).where(User.tg_id == tg_id))
        return result.scalar_one_or_none()

    async def upsert(
        self,
        tg_id: int,
        first_name: str,
        last_name: str | None = None,
        username: str | None = None,
    ) -> User:
        user = await self.get_by_tg_id(tg_id)
        if user is None:
            user = User(
                tg_id=tg_id,
                first_name=first_name,
                last_name=last_name,
                username=username,
            )
            self.session.add(user)
        else:
            user.first_name = first_name
            user.last_name = last_name
            user.username = username
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def set_language(self, tg_id: int, language: str) -> None:
        user = await self.get_by_tg_id(tg_id)
        if user:
            user.language = language
            await self.session.commit()

    async def update_contact(
        self, tg_id: int, phone: str | None = None, email: str | None = None
    ) -> None:
        user = await self.get_by_tg_id(tg_id)
        if user:
            if phone is not None:
                user.phone = phone
            if email is not None:
                user.email = email
            await self.session.commit()
