"""User profile routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.order import OrderRepository
from db.repositories.user import UserRepository
from webapp.deps import get_session
from webapp.auth import verify_init_data
from webapp.schemas import OrderSchema, SetLanguageRequest, UserSchema

router = APIRouter(prefix="/api/user", tags=["user"])


async def _get_user(authorization: str, session: AsyncSession):
    init_data = authorization[4:] if authorization.startswith("tma ") else authorization
    user_data = verify_init_data(init_data)
    repo = UserRepository(session)
    return await repo.upsert(
        tg_id=user_data["id"],
        first_name=user_data.get("first_name", ""),
        last_name=user_data.get("last_name"),
        username=user_data.get("username"),
    )


@router.get("/me", response_model=UserSchema)
async def get_me(
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)
    return UserSchema.model_validate(user)


@router.patch("/language", response_model=UserSchema)
async def set_language(
    body: SetLanguageRequest,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)
    repo = UserRepository(session)
    await repo.set_language(user.tg_id, body.language)
    updated = await repo.get_by_tg_id(user.tg_id)
    return UserSchema.model_validate(updated)


@router.get("/orders", response_model=list[OrderSchema])
async def get_orders(
    page: int = 0,
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    user = await _get_user(authorization, session)
    repo = OrderRepository(session)
    orders = await repo.get_user_orders(user.id, page=page, page_size=10)
    return [OrderSchema.model_validate(o) for o in orders]
