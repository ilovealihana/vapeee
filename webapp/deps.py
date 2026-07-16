"""FastAPI dependencies: DB session + current user."""
from __future__ import annotations

from typing import AsyncGenerator

from fastapi import Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import async_session_maker
from db.repositories.user import UserRepository
from db.models.user import User
from webapp.auth import verify_init_data


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_current_user(
    authorization: str = Header(..., description="tma <initData>"),
    session: AsyncSession = None,
) -> User:
    """
    Validate Telegram initData from Authorization header.
    Header format: 'tma <url-encoded-initData>'
    """
    if not authorization.startswith("tma "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must start with 'tma '",
        )

    init_data = authorization[4:]  # strip "tma "
    user_data = verify_init_data(init_data)

    tg_id = user_data.get("id")
    if not tg_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user id")

    repo = UserRepository(session)
    user = await repo.upsert(
        tg_id=tg_id,
        first_name=user_data.get("first_name", ""),
        last_name=user_data.get("last_name"),
        username=user_data.get("username"),
    )
    return user


# Convenience dependency that injects both session and user
from fastapi import Depends


def get_session_dep():
    return Depends(get_session)


async def get_user_with_session(
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
) -> tuple[User, AsyncSession]:
    user = await get_current_user(authorization=authorization, session=session)
    return user, session


async def get_admin_user(
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Validate that current user is an admin (tg_id in ADMIN_IDS)."""
    from config import settings

    user = await get_current_user(authorization=authorization, session=session)
    if user.tg_id not in settings.ADMIN_IDS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


async def get_admin_user_with_session(
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
) -> tuple[User, AsyncSession]:
    user = await get_admin_user(authorization=authorization, session=session)
    return user, session
