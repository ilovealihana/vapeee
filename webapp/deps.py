"""FastAPI dependencies: DB session + current user."""
from __future__ import annotations

from typing import AsyncGenerator

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.staff import ROLE_PROJECT_ADMIN, StaffMember
from db.session import async_session_maker
from db.repositories.user import UserRepository
from db.models.user import User
from webapp.auth import verify_init_data
from webapp.errors import ErrorCode, api_error


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


def get_tma_user_data(authorization: str | None = Header(None, description="tma <initData>")) -> dict:
    """Validate Telegram Mini App auth header and return verified user data."""
    if not authorization or not authorization.startswith("tma "):
        raise api_error(401, ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER, "Invalid authorization header")

    init_data = authorization[4:]
    user_data = verify_init_data(init_data)
    tg_id = user_data.get("id")
    if not tg_id:
        raise api_error(401, ErrorCode.AUTH_MISSING_USER_ID, "Missing user id")
    return user_data


async def upsert_user_from_data(user_data: dict, session: AsyncSession) -> User:
    repo = UserRepository(session)
    return await repo.upsert(
        tg_id=user_data["id"],
        first_name=user_data.get("first_name", ""),
        last_name=user_data.get("last_name"),
        username=user_data.get("username"),
    )


async def get_current_user(
    authorization: str | None = Header(None, description="tma <initData>"),
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    Validate Telegram initData from Authorization header.
    Header format: 'tma <url-encoded-initData>'
    """
    return await upsert_user_from_data(get_tma_user_data(authorization), session)


def get_session_dep():
    return Depends(get_session)


async def get_user_with_session(
    authorization: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> tuple[User, AsyncSession]:
    user = await get_current_user(authorization=authorization, session=session)
    return user, session


async def get_admin_user(
    authorization: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Validate that current user is a project admin."""
    user = await get_current_user(authorization=authorization, session=session)
    if not await is_project_admin_user(user, session):
        raise api_error(403, ErrorCode.ADMIN_ACCESS_REQUIRED, "Admin access required")
    return user


async def get_admin_user_with_session(
    authorization: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> tuple[User, AsyncSession]:
    user = await get_admin_user(authorization=authorization, session=session)
    return user, session


async def is_project_admin_user(user: User, session: AsyncSession) -> bool:
    return await get_project_admin_role(user, session) == "project_admin"


async def get_project_admin_role(user: User, session: AsyncSession) -> str | None:
    from config import settings

    if user.tg_id in settings.ADMIN_IDS:
        return "project_admin"

    result = await session.execute(
        select(StaffMember.role).where(
            StaffMember.tg_id == user.tg_id,
            StaffMember.role == ROLE_PROJECT_ADMIN,
            StaffMember.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def get_project_admin_user(
    authorization: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> User:
    user = await get_current_user(authorization=authorization, session=session)
    if not await is_project_admin_user(user, session):
        raise api_error(403, ErrorCode.STAFF_PROJECT_ADMIN_REQUIRED, "Project admin access required")
    return user
