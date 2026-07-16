from __future__ import annotations

from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Update
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.user import UserRepository


class UserLocaleMiddleware(BaseMiddleware):
    """
    Fetches user language from DB and stores it in data['locale'].
    Must run AFTER DbSessionMiddleware so data['session'] is available.
    """

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        locale = "ru"  # default

        if isinstance(event, Update):
            tg_user = None
            if event.message:
                tg_user = event.message.from_user
            elif event.callback_query:
                tg_user = event.callback_query.from_user

            if tg_user:
                session: AsyncSession | None = data.get("session")
                if session:
                    repo = UserRepository(session)
                    user = await repo.get_by_tg_id(tg_user.id)
                    if user:
                        locale = user.language

        data["locale"] = locale
        return await handler(event, data)
