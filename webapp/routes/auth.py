"""POST /api/auth — verify Telegram initData, upsert user, return profile."""
from __future__ import annotations

import base64

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.user import UserRepository
from webapp.auth import verify_init_data
from webapp.deps import get_session
from webapp.schemas import AuthRequest, AuthResponse, SetLanguageRequest, UserSchema

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("", response_model=AuthResponse)
async def auth(body: AuthRequest, session: AsyncSession = Depends(get_session)):
    """Verify Telegram Mini App initData and return user profile + token."""
    user_data = verify_init_data(body.init_data)

    tg_id = user_data.get("id")
    if not tg_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user id in initData")

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


@router.get("/me", response_model=UserSchema)
async def get_me(
    authorization: str = Depends(lambda authorization="": authorization),
    session: AsyncSession = Depends(get_session),
):
    """Get current user profile."""
    from webapp.deps import get_current_user
    from fastapi import Header

    # This route is handled via get_current_user dependency directly
    # Simplified version:
    raise HTTPException(status_code=501, detail="Use /api/user/me")


@router.patch("/language", response_model=UserSchema)
async def set_language(
    body: SetLanguageRequest,
    session: AsyncSession = Depends(get_session),
    authorization: str = "",
):
    """Change user language preference."""
    from fastapi import Header
    from webapp.deps import get_current_user
    # Handled in user router
    raise HTTPException(status_code=501, detail="Use /api/user/language")
