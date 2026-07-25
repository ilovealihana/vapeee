from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.city import City
from db.models.location import Location
from db.models.location_stock import LocationStock
from db.models.product import Product
from db.models.product_request import (
    PRODUCT_REQUEST_ADD_STOCK,
    PRODUCT_REQUEST_ADD_VARIANT,
    PRODUCT_REQUEST_APPROVED,
    PRODUCT_REQUEST_NEED_CHANGES,
    PRODUCT_REQUEST_PENDING_REVIEW,
    PRODUCT_REQUEST_REJECTED,
    ProductRequest,
)
from db.models.product_variant import ProductVariant
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


async def _ensure_request_location(session: AsyncSession, location_id: int) -> tuple[City, Location]:
    result = await session.execute(
        select(City, Location)
        .join(Location, Location.city_id == City.id)
        .where(Location.id == location_id, Location.is_active == True, City.is_active == True)
    )
    row = result.one_or_none()
    if row is None:
        raise api_error(404, ErrorCode.PRODUCT_REQUEST_LOCATION_REQUIRED, "Local Point not found")
    return row


async def _ensure_active_product(session: AsyncSession, product_id: int) -> Product:
    result = await session.execute(select(Product).where(Product.id == product_id, Product.is_active == True))
    product = result.scalar_one_or_none()
    if product is None:
        raise api_error(404, ErrorCode.PRODUCT_REQUEST_PRODUCT_NOT_FOUND, "Product not found")
    return product


async def _ensure_active_variant(session: AsyncSession, product_id: int, variant_id: int | None) -> ProductVariant:
    if variant_id is None:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_VARIANT_REQUIRED, "Variant is required")
    result = await session.execute(
        select(ProductVariant)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(ProductVariant.id == variant_id, ProductVariant.product_id == product_id, Product.is_active == True)
    )
    variant = result.scalar_one_or_none()
    if variant is None:
        raise api_error(404, ErrorCode.PRODUCT_REQUEST_VARIANT_NOT_FOUND, "Variant not found")
    return variant


def _clean_variant_name(value: str | None) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_VARIANT_NAME_REQUIRED, "Variant name is required")
    return cleaned


def _clean_comment(comment: str) -> str:
    cleaned = comment.strip()
    if not cleaned:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_COMMENT_REQUIRED, "Product request comment is required")
    return cleaned


def _clear_lock(request: ProductRequest) -> None:
    request.locked_by_tg_id = None
    request.locked_at = None


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


async def approve_product_request(request_id: int, *, actor, session: AsyncSession) -> ProductRequest:
    request = await _load_product_request_for_update(session, request_id)
    if request.status != PRODUCT_REQUEST_PENDING_REVIEW:
        raise api_error(409, ErrorCode.PRODUCT_REQUEST_TRANSITION_INVALID, "Request is not pending review")
    await ensure_request_lock_owner(request, actor=actor, session=session)
    await _ensure_request_location(session, request.location_id)
    await _ensure_active_product(session, request.product_id)

    if request.request_type == PRODUCT_REQUEST_ADD_VARIANT:
        variant = ProductVariant(
            product_id=request.product_id,
            name_ru=_clean_variant_name(request.variant_name_ru),
            name_pl=_clean_variant_name(request.variant_name_pl or request.variant_name_ru),
            name_uk=_clean_variant_name(request.variant_name_uk or request.variant_name_ru),
            price_override=request.price_override,
        )
        session.add(variant)
        await session.flush()
        request.published_variant_id = variant.id
        stock_variant_id = variant.id
    elif request.request_type == PRODUCT_REQUEST_ADD_STOCK:
        variant = await _ensure_active_variant(session, request.product_id, request.variant_id)
        request.published_variant_id = variant.id
        stock_variant_id = variant.id
    else:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_TYPE_INVALID, "Product request type is invalid")

    result = await session.execute(
        select(LocationStock).where(
            LocationStock.location_id == request.location_id,
            LocationStock.variant_id == stock_variant_id,
        )
    )
    stock = result.scalar_one_or_none()
    if stock is None:
        stock = LocationStock(location_id=request.location_id, variant_id=stock_variant_id, quantity=request.quantity)
        session.add(stock)
    elif request.request_type == PRODUCT_REQUEST_ADD_STOCK:
        stock.quantity += request.quantity
    else:
        stock.quantity = request.quantity

    request.status = PRODUCT_REQUEST_APPROVED
    request.reviewer_tg_id = actor.tg_id
    request.reviewed_at = datetime.now(tz=timezone.utc)
    _clear_lock(request)
    await session.flush()
    event_type = product_request_events.PRODUCT_REQUEST_APPROVED
    product_request_events.emit_product_request_event(
        event_type,
        _event_context(request, event_type, actor.tg_id),
    )
    await session.commit()
    return request


async def reject_product_request(
    request_id: int,
    comment: str,
    *,
    actor,
    session: AsyncSession,
) -> ProductRequest:
    request = await _load_product_request_for_update(session, request_id)
    if request.status != PRODUCT_REQUEST_PENDING_REVIEW:
        raise api_error(409, ErrorCode.PRODUCT_REQUEST_TRANSITION_INVALID, "Request is not pending review")
    await ensure_request_lock_owner(request, actor=actor, session=session)
    cleaned_comment = _clean_comment(comment)

    request.status = PRODUCT_REQUEST_REJECTED
    request.reject_reason = cleaned_comment
    request.review_comment = cleaned_comment
    request.reviewer_tg_id = actor.tg_id
    request.reviewed_at = datetime.now(tz=timezone.utc)
    _clear_lock(request)
    await session.flush()
    event_type = product_request_events.PRODUCT_REQUEST_REJECTED
    product_request_events.emit_product_request_event(
        event_type,
        _event_context(request, event_type, actor.tg_id, cleaned_comment),
    )
    await session.commit()
    return request


async def request_product_request_changes(
    request_id: int,
    comment: str,
    *,
    actor,
    session: AsyncSession,
) -> ProductRequest:
    request = await _load_product_request_for_update(session, request_id)
    if request.status != PRODUCT_REQUEST_PENDING_REVIEW:
        raise api_error(409, ErrorCode.PRODUCT_REQUEST_TRANSITION_INVALID, "Request is not pending review")
    await ensure_request_lock_owner(request, actor=actor, session=session)
    cleaned_comment = _clean_comment(comment)

    request.status = PRODUCT_REQUEST_NEED_CHANGES
    request.review_comment = cleaned_comment
    request.reject_reason = None
    request.reviewer_tg_id = actor.tg_id
    request.reviewed_at = datetime.now(tz=timezone.utc)
    _clear_lock(request)
    await session.flush()
    event_type = product_request_events.PRODUCT_REQUEST_NEED_CHANGES
    product_request_events.emit_product_request_event(
        event_type,
        _event_context(request, event_type, actor.tg_id, cleaned_comment),
    )
    await session.commit()
    return request
