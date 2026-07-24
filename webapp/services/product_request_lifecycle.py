from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.product_request import (
    PRODUCT_REQUEST_PENDING_REVIEW,
    ProductRequest,
)
from db.models.staff import ROLE_CITY_CURATOR, StaffMember
from webapp.deps import is_project_admin_user
from webapp.errors import ErrorCode, api_error
from webapp.services import product_request_events


async def _active_staff_for_actor(actor, session: AsyncSession) -> StaffMember | None:
    if not hasattr(actor, "tg_id"):
        return None
    result = await session.execute(
        select(StaffMember)
        .options(selectinload(StaffMember.assignments))
        .where(StaffMember.tg_id == actor.tg_id, StaffMember.is_active == True)
    )
    return result.scalar_one_or_none()


def _staff_city_ids(member: StaffMember | None) -> set[int]:
    if member is None:
        return set()
    return {assignment.city_id for assignment in member.assignments if assignment.city_id is not None}


async def _ensure_reviewer_can_review(actor, session: AsyncSession, city_id: int) -> None:
    if await is_project_admin_user(actor, session):
        return
    member = await _active_staff_for_actor(actor, session)
    if member and member.role == ROLE_CITY_CURATOR and city_id in _staff_city_ids(member):
        return
    raise api_error(403, ErrorCode.PRODUCT_REQUEST_REVIEW_PERMISSION_DENIED, "Review access denied")


async def _load_product_request_for_update(session: AsyncSession, request_id: int) -> ProductRequest:
    result = await session.execute(
        select(ProductRequest)
        .options(
            selectinload(ProductRequest.city),
            selectinload(ProductRequest.location),
            selectinload(ProductRequest.product),
            selectinload(ProductRequest.variant),
        )
        .where(ProductRequest.id == request_id)
        .with_for_update()
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise api_error(404, ErrorCode.PRODUCT_REQUEST_NOT_FOUND, "Product request not found")
    return request


def _event_context(
    request: ProductRequest,
    event_type: str,
    actor_tg_id: int,
    comment: str | None = None,
) -> product_request_events.ProductRequestEventContext:
    return product_request_events.ProductRequestEventContext(
        request_id=request.id,
        event_type=event_type,
        actor_tg_id=actor_tg_id,
        requester_tg_id=request.requester_tg_id,
        city_id=request.city_id,
        location_id=request.location_id,
        current_status=request.status,
        comment=comment,
    )


async def lock_product_request(request_id: int, *, actor, session: AsyncSession) -> ProductRequest:
    request = await _load_product_request_for_update(session, request_id)
    if request.status != PRODUCT_REQUEST_PENDING_REVIEW:
        raise api_error(
            409,
            ErrorCode.PRODUCT_REQUEST_LOCK_NOT_ALLOWED_FOR_STATUS,
            "Request cannot be locked in its current status",
        )
    await _ensure_reviewer_can_review(actor, session, request.city_id)

    actor_tg_id = actor.tg_id
    if request.locked_by_tg_id == actor_tg_id:
        return request
    if request.locked_by_tg_id is not None and not await is_project_admin_user(actor, session):
        raise api_error(409, ErrorCode.PRODUCT_REQUEST_LOCK_EXISTS, "Product request is already locked")

    request.locked_by_tg_id = actor_tg_id
    request.locked_at = datetime.now(tz=timezone.utc)
    await session.flush()
    event_type = product_request_events.PRODUCT_REQUEST_LOCKED
    product_request_events.emit_product_request_event(
        event_type,
        _event_context(request, event_type, actor_tg_id),
    )
    await session.commit()
    return request


async def release_product_request(request_id: int, *, actor, session: AsyncSession) -> ProductRequest:
    request = await _load_product_request_for_update(session, request_id)
    await _ensure_reviewer_can_review(actor, session, request.city_id)

    is_project_admin = await is_project_admin_user(actor, session)
    actor_tg_id = actor.tg_id
    if request.locked_by_tg_id is not None and request.locked_by_tg_id != actor_tg_id and not is_project_admin:
        raise api_error(409, ErrorCode.PRODUCT_REQUEST_LOCK_NOT_OWNER, "Product request lock is owned by another reviewer")
    if request.locked_by_tg_id is None:
        return request

    request.locked_by_tg_id = None
    request.locked_at = None
    await session.flush()
    event_type = product_request_events.PRODUCT_REQUEST_RELEASED
    product_request_events.emit_product_request_event(
        event_type,
        _event_context(request, event_type, actor_tg_id),
    )
    await session.commit()
    return request


async def ensure_request_lock_owner(request: ProductRequest, *, actor, session: AsyncSession) -> None:
    await _ensure_reviewer_can_review(actor, session, request.city_id)
    if request.locked_by_tg_id != getattr(actor, "tg_id", None):
        raise api_error(409, ErrorCode.PRODUCT_REQUEST_LOCK_REQUIRED, "Product request lock is required")
