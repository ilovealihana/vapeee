"""User profile routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.order import OrderRepository
from db.repositories.user import UserRepository
from db.models.user import User
from webapp.deps import get_current_user, get_session
from webapp.schemas import OrderSchema, SetLanguageRequest, UpdateContactRequest, UserSchema

router = APIRouter(prefix="/api/user", tags=["user"])


async def build_user_schema(user: User, session: AsyncSession) -> UserSchema:
    order_repo = OrderRepository(session)
    first_order_at = await order_repo.get_first_order_at(user.id)
    return UserSchema.model_validate(user).model_copy(
        update={"first_order_at": first_order_at}
    )


@router.get("/me", response_model=UserSchema)
async def get_me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await build_user_schema(user, session)


@router.patch("/language", response_model=UserSchema)
async def set_language(
    body: SetLanguageRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = UserRepository(session)
    await repo.set_language(user.tg_id, body.language_code)
    updated = await repo.get_by_tg_id(user.tg_id)
    return await build_user_schema(updated, session)


@router.patch("/contact", response_model=UserSchema)
async def set_contact(
    body: UpdateContactRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = UserRepository(session)
    updated = await repo.update_contact(
        user.tg_id,
        phone=body.phone,
        email=body.email,
        update_phone="phone" in body.model_fields_set,
        update_email="email" in body.model_fields_set,
    )
    return await build_user_schema(updated, session)


@router.get("/orders", response_model=list[OrderSchema])
async def get_orders(
    page: int = 0,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = OrderRepository(session)
    orders = await repo.get_user_orders(user.id, page=page, page_size=10)
    return [OrderSchema.model_validate(o) for o in orders]
