"""User profile routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.order import OrderRepository
from db.repositories.user import UserRepository
from db.models.user import User
from webapp.deps import get_current_user, get_session
from webapp.schemas import OrderSchema, SetLanguageRequest, UserSchema

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/me", response_model=UserSchema)
async def get_me(
    user: User = Depends(get_current_user),
):
    return UserSchema.model_validate(user)


@router.patch("/language", response_model=UserSchema)
async def set_language(
    body: SetLanguageRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = UserRepository(session)
    await repo.set_language(user.tg_id, body.language_code)
    updated = await repo.get_by_tg_id(user.tg_id)
    return UserSchema.model_validate(updated)


@router.get("/orders", response_model=list[OrderSchema])
async def get_orders(
    page: int = 0,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = OrderRepository(session)
    orders = await repo.get_user_orders(user.id, page=page, page_size=10)
    return [OrderSchema.model_validate(o) for o in orders]
