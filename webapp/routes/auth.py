"""POST /api/auth — verify Telegram initData, upsert user, return profile."""
from __future__ import annotations

import base64

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.user import UserRepository
from webapp.auth import verify_init_data
from webapp.deps import get_session
from webapp.errors import ErrorCode, api_error
from webapp.schemas import AuthRequest, AuthResponse, SetLanguageRequest, UserSchema

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("", response_model=AuthResponse)
async def auth(body: AuthRequest, session: AsyncSession = Depends(get_session)):
    """Verify Telegram Mini App initData and return user profile + token."""
    user_data = verify_init_data(body.init_data)

    tg_id = user_data.get("id")
    if not tg_id:
        raise api_error(401, ErrorCode.AUTH_MISSING_USER_ID, "Missing user id")

    repo = UserRepository(session)
    user = await repo.upsert(
        tg_id=tg_id,
        first_name=user_data.get("first_name", ""),
        last_name=user_data.get("last_name"),
        username=user_data.get("username"),
    )

    # Token = base64(initData) — client sends it back in Authorization header
    token = base64.b64encode(body.init_data.encode()).decode()

    return AuthResponse(user=UserSchema.model_validate(user), token=token)

