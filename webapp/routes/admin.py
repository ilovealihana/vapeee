"""Admin API routes — protected by ADMIN_IDS check."""
from __future__ import annotations

import re
from fastapi import APIRouter, Depends
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from db.models.city import City
from db.models.cart import Cart
from db.models.inpost_stock import InpostStock
from db.models.location import Location
from db.models.location_stock import LocationStock
from db.models.order import Order
from db.models.order_item import OrderItem
from db.models.product import Product
from db.models.product_request import (
    PRODUCT_REQUEST_ADD_STOCK,
    PRODUCT_REQUEST_ADD_VARIANT,
    PRODUCT_REQUEST_ACTIVE_STATUSES,
    PRODUCT_REQUEST_FINAL_STATUSES,
    PRODUCT_REQUEST_PENDING_REVIEW,
    PRODUCT_REQUEST_STATUSES,
    PRODUCT_REQUEST_TYPES,
    ProductRequest,
)
from db.models.product_variant import ProductVariant
from db.models.staff import (
    ROLE_CITY_CURATOR,
    ROLE_INPOST_CURATOR,
    ROLE_POINT_MANAGER,
    ROLE_PROJECT_ADMIN,
    STAFF_ROLES,
    StaffAssignment,
    StaffMember,
)
from db.repositories.catalog import CatalogRepository
from db.repositories.order import OrderRepository
from webapp.deps import (
    get_admin_user,
    get_current_user,
    get_project_admin_role,
    get_project_admin_user,
    get_session,
    is_project_admin_user,
)
from webapp.errors import ErrorCode, api_error
from webapp.services import product_request_events
from webapp.services.product_request_lifecycle import (
    approve_product_request,
    edit_product_request,
    lock_product_request,
    reject_product_request,
    release_product_request,
    request_product_request_changes,
)
from webapp.services.geocoding import (
    GeocodingAddressNotFound,
    GeocodingConfigError,
    GeocodingTransientError,
    GoogleGeocoder,
)
from webapp.schemas import (
    CitySchema, LocationSchema,
    ProductSchema, VariantSchema,
    OrderSchema, StockRow,
    CreateCityRequest, UpdateCityRequest,
    CreateLocationRequest, UpdateLocationRequest,
    CreateProductRequest, UpdateProductRequest,
    CreateVariantRequest, UpdateVariantRequest,
    UpdateStockRequest, UpdateOrderStatusRequest,
    CreateStaffMemberRequest, UpdateStaffMemberRequest,
    AdminAccessSchema, StaffAssignmentSchema, StaffMemberSchema,
    CreateProductRequestRequest, ProductRequestLocationOption, ProductRequestOptions,
    ProductRequestSchema, RejectProductRequestRequest, UpdateProductRequestReviewRequest,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def _geocode_admin_location_address(address: str):
    if not settings.GOOGLE_GEOCODING_API_KEY and not settings.REQUIRE_GOOGLE_GEOCODING:
        return None
    try:
        return await GoogleGeocoder().geocode(address)
    except GeocodingAddressNotFound:
        raise api_error(
            422,
            ErrorCode.VALIDATION_FAILED,
            "Address not found",
            {"field": "address"},
        )
    except GeocodingConfigError:
        raise api_error(
            503,
            ErrorCode.COMMON_SERVICE_UNAVAILABLE,
            "Geocoding is not configured",
        )
    except GeocodingTransientError:
        raise api_error(
            503,
            ErrorCode.COMMON_SERVICE_UNAVAILABLE,
            "Geocoding service unavailable",
        )


async def _clear_location_delete_dependencies(session: AsyncSession, location_ids: list[int]) -> None:
    if not location_ids:
        return
    await session.execute(update(Cart).where(Cart.location_id.in_(location_ids)).values(location_id=None))
    await session.execute(update(Order).where(Order.location_id.in_(location_ids)).values(location_id=None))
    await session.execute(delete(ProductRequest).where(ProductRequest.location_id.in_(location_ids)))
    await session.execute(delete(StaffAssignment).where(StaffAssignment.location_id.in_(location_ids)))
    await session.execute(delete(LocationStock).where(LocationStock.location_id.in_(location_ids)))


# Staff

@router.get("/access", response_model=AdminAccessSchema)
async def admin_get_access(
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    role = await get_project_admin_role(actor, session)
    if role is None and hasattr(actor, "tg_id"):
        result = await session.execute(
            select(StaffMember.role).where(
                StaffMember.tg_id == actor.tg_id,
                StaffMember.is_active == True,
            )
        )
        role = result.scalar_one_or_none()
    return AdminAccessSchema(has_access=role is not None, role=role)


async def _require_project_admin(actor, session: AsyncSession) -> None:
    if not hasattr(actor, "tg_id") or not await is_project_admin_user(actor, session):
        raise api_error(403, ErrorCode.STAFF_PROJECT_ADMIN_REQUIRED, "Project admin access required")


def _validate_tg_id(tg_id: int) -> None:
    if tg_id == 0:
        raise api_error(422, ErrorCode.STAFF_TG_ID_REQUIRED, "Telegram ID is required")
    if tg_id < 0:
        raise api_error(422, ErrorCode.STAFF_INVALID_TG_ID, "Telegram ID is invalid")


def _normalize_username(username: str | None) -> str | None:
    if username is None:
        return None
    normalized = username.strip().lstrip("@")
    if not normalized:
        return None
    if not re.fullmatch(r"[A-Za-z0-9_]{5,32}", normalized):
        raise api_error(422, ErrorCode.STAFF_INVALID_USERNAME, "Telegram username is invalid")
    return normalized


def _validate_role(role: str) -> None:
    if role not in STAFF_ROLES:
        raise api_error(422, ErrorCode.STAFF_ROLE_INVALID, "Staff role is invalid")


def _ensure_unique_targets(ids: list[int]) -> None:
    if len(ids) != len(set(ids)):
        raise api_error(409, ErrorCode.STAFF_ASSIGNMENT_DUPLICATE, "Staff assignment duplicate")


def _is_protected_bootstrap_admin(tg_id: int) -> bool:
    from config import settings

    return tg_id in settings.ADMIN_IDS


async def _load_staff_member(session: AsyncSession, staff_id: int) -> StaffMember | None:
    result = await session.execute(
        select(StaffMember)
        .options(
            selectinload(StaffMember.assignments).selectinload(StaffAssignment.city),
            selectinload(StaffMember.assignments).selectinload(StaffAssignment.location),
        )
        .where(StaffMember.id == staff_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()


async def _staff_schema(session: AsyncSession, staff_id: int) -> StaffMemberSchema:
    member = await _load_staff_member(session, staff_id)
    if member is None:
        raise api_error(404, ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Staff member not found")

    assignments = [
        StaffAssignmentSchema(
            id=assignment.id,
            city_id=assignment.city_id,
            city_name=assignment.city.name if assignment.city else None,
            location_id=assignment.location_id,
            location_name=assignment.location.name if assignment.location else None,
        )
        for assignment in sorted(
            member.assignments,
            key=lambda item: (item.city_id or 0, item.location_id or 0, item.id or 0),
        )
    ]
    return StaffMemberSchema(
        id=member.id,
        tg_id=member.tg_id,
        username=member.username,
        role=member.role,
        is_active=member.is_active,
        created_at=member.created_at,
        updated_at=member.updated_at,
        assignments=assignments,
    )


async def _location_point_manager(session: AsyncSession, location_id: int) -> StaffMember | None:
    result = await session.execute(
        select(StaffMember)
        .join(StaffAssignment, StaffAssignment.staff_member_id == StaffMember.id)
        .where(
            StaffMember.role == ROLE_POINT_MANAGER,
            StaffMember.is_active == True,
            StaffAssignment.location_id == location_id,
        )
        .order_by(StaffMember.id)
    )
    return result.scalar_one_or_none()


async def _location_schema(session: AsyncSession, location: Location) -> LocationSchema:
    manager = await _location_point_manager(session, location.id)
    schema = LocationSchema.model_validate(location)
    schema.has_manager = manager is not None
    schema.manager_tg_id = manager.tg_id if manager else None
    schema.manager_tg_username = getattr(manager, "username", None) if manager else None
    schema.catalog_available = schema.has_manager and location.is_active
    return schema


async def _ensure_point_manager_locations_available(
    session: AsyncSession,
    location_ids: list[int],
    current_staff_id: int | None,
) -> None:
    if not location_ids:
        return
    result = await session.execute(
        select(StaffAssignment.location_id)
        .join(StaffMember, StaffMember.id == StaffAssignment.staff_member_id)
        .where(
            StaffAssignment.location_id.in_(location_ids),
            StaffMember.role == ROLE_POINT_MANAGER,
            StaffMember.is_active == True,
            StaffMember.id != current_staff_id,
        )
    )
    if result.scalars().first() is not None:
        raise api_error(409, ErrorCode.STAFF_ASSIGNMENT_DUPLICATE, "Local Point already has active manager")


async def _build_assignments(
    session: AsyncSession,
    member_id: int | None,
    role: str,
    is_active: bool,
    city_ids: list[int] | None,
    location_ids: list[int] | None,
) -> list[StaffAssignment]:
    city_ids = city_ids or []
    location_ids = location_ids or []

    if role == ROLE_CITY_CURATOR:
        if not city_ids:
            raise api_error(422, ErrorCode.STAFF_LOCATION_REQUIRED, "Role requires at least one city")
        if location_ids:
            raise api_error(404, ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Staff assignment target not found")
        _ensure_unique_targets(city_ids)
        result = await session.execute(
            select(City.id).where(City.id.in_(city_ids), City.is_active == True)
        )
        found = set(result.scalars().all())
        if found != set(city_ids):
            raise api_error(404, ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Staff assignment target not found")
        return [StaffAssignment(city_id=city_id) for city_id in city_ids]

    if role == ROLE_POINT_MANAGER:
        if not location_ids:
            raise api_error(422, ErrorCode.STAFF_LOCATION_REQUIRED, "Role requires at least one location")
        if city_ids:
            raise api_error(404, ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Staff assignment target not found")
        _ensure_unique_targets(location_ids)
        result = await session.execute(
            select(Location.id)
            .join(City, City.id == Location.city_id)
            .where(Location.id.in_(location_ids), Location.is_active == True, City.is_active == True)
        )
        found = set(result.scalars().all())
        if found != set(location_ids):
            raise api_error(404, ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Staff assignment target not found")
        if is_active:
            await _ensure_point_manager_locations_available(session, location_ids, member_id)
        return [StaffAssignment(location_id=location_id) for location_id in location_ids]

    return []


async def _apply_staff_payload(
    session: AsyncSession,
    member: StaffMember,
    role: str,
    is_active: bool,
    city_ids: list[int] | None,
    location_ids: list[int] | None,
) -> None:
    assignments = await _build_assignments(session, member.id, role, is_active, city_ids, location_ids)
    member.role = role
    await session.flush()
    await session.execute(delete(StaffAssignment).where(StaffAssignment.staff_member_id == member.id))
    for assignment in assignments:
        assignment.staff_member_id = member.id
        session.add(assignment)


@router.get("/staff", response_model=list[StaffMemberSchema])
async def admin_list_staff_members(
    actor=Depends(get_project_admin_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_project_admin(actor, session)
    result = await session.execute(select(StaffMember).order_by(StaffMember.tg_id))
    members = result.scalars().all()
    return [await _staff_schema(session, member.id) for member in members]


@router.post("/staff", response_model=StaffMemberSchema)
async def admin_create_staff_member(
    body: CreateStaffMemberRequest,
    actor=Depends(get_project_admin_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_project_admin(actor, session)
    _validate_tg_id(body.tg_id)
    _validate_role(body.role)
    if _is_protected_bootstrap_admin(body.tg_id) and body.role != ROLE_PROJECT_ADMIN:
        raise api_error(403, ErrorCode.STAFF_CANNOT_DELETE_PROTECTED_ADMIN, "Cannot change protected admin")

    result = await session.execute(
        select(StaffMember)
        .options(selectinload(StaffMember.assignments))
        .where(StaffMember.tg_id == body.tg_id)
    )
    member = result.scalar_one_or_none()
    if member and member.is_active:
        raise api_error(409, ErrorCode.STAFF_ASSIGNMENT_DUPLICATE, "Staff member already exists")

    if member is None:
        member = StaffMember(
            tg_id=body.tg_id,
            username=_normalize_username(body.username),
            role=body.role,
            is_active=True,
        )
        session.add(member)
    else:
        member.username = _normalize_username(body.username)
        member.is_active = True

    await _apply_staff_payload(session, member, body.role, True, body.city_ids, body.location_ids)
    await session.commit()
    return await _staff_schema(session, member.id)


@router.put("/staff/{staff_id}", response_model=StaffMemberSchema)
async def admin_update_staff_member(
    staff_id: int,
    body: UpdateStaffMemberRequest,
    actor=Depends(get_project_admin_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_project_admin(actor, session)
    member = await _load_staff_member(session, staff_id)
    if member is None:
        raise api_error(404, ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Staff member not found")

    next_role = body.role if body.role is not None else member.role
    _validate_role(next_role)
    if _is_protected_bootstrap_admin(member.tg_id) and (
        next_role != ROLE_PROJECT_ADMIN or body.is_active is False
    ):
        raise api_error(403, ErrorCode.STAFF_CANNOT_DELETE_PROTECTED_ADMIN, "Cannot change protected admin")

    assignments_changed = body.role is not None or body.city_ids is not None or body.location_ids is not None
    if assignments_changed:
        city_ids = body.city_ids if body.city_ids is not None else [
            assignment.city_id for assignment in member.assignments if assignment.city_id is not None
        ]
        location_ids = body.location_ids if body.location_ids is not None else [
            assignment.location_id for assignment in member.assignments if assignment.location_id is not None
        ]
        next_active = body.is_active if body.is_active is not None else member.is_active
        await _apply_staff_payload(session, member, next_role, next_active, city_ids, location_ids)

    if not assignments_changed and body.is_active is True and member.role == ROLE_POINT_MANAGER:
        location_ids = [
            assignment.location_id for assignment in member.assignments if assignment.location_id is not None
        ]
        await _ensure_point_manager_locations_available(session, location_ids, member.id)

    if body.is_active is not None:
        member.is_active = body.is_active
    if "username" in body.model_fields_set:
        member.username = _normalize_username(body.username)

    await session.commit()
    return await _staff_schema(session, member.id)


@router.delete("/staff/{staff_id}", status_code=204)
async def admin_delete_staff_member(
    staff_id: int,
    actor=Depends(get_project_admin_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_project_admin(actor, session)
    member = await _load_staff_member(session, staff_id)
    if member is None:
        raise api_error(404, ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Staff member not found")
    if _is_protected_bootstrap_admin(member.tg_id):
        raise api_error(403, ErrorCode.STAFF_CANNOT_DELETE_PROTECTED_ADMIN, "Cannot delete protected admin")

    member.is_active = False
    await session.commit()


# ── Cities ────────────────────────────────────────────────

@router.delete("/staff/{staff_id}/hard-delete", status_code=204)
async def admin_hard_delete_staff_member(
    staff_id: int,
    actor=Depends(get_project_admin_user),
    session: AsyncSession = Depends(get_session),
):
    await _require_project_admin(actor, session)
    member = await _load_staff_member(session, staff_id)
    if member is None:
        raise api_error(404, ErrorCode.STAFF_ASSIGNMENT_NOT_FOUND, "Staff member not found")
    if _is_protected_bootstrap_admin(member.tg_id):
        raise api_error(403, ErrorCode.STAFF_CANNOT_DELETE_PROTECTED_ADMIN, "Cannot delete protected admin")

    await session.delete(member)
    await session.commit()


# Product requests

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


def _staff_location_ids(member: StaffMember | None) -> set[int]:
    if member is None:
        return set()
    return {assignment.location_id for assignment in member.assignments if assignment.location_id is not None}


async def _load_product_request(session: AsyncSession, request_id: int) -> ProductRequest | None:
    result = await session.execute(
        select(ProductRequest)
        .options(
            selectinload(ProductRequest.city),
            selectinload(ProductRequest.location),
            selectinload(ProductRequest.product),
            selectinload(ProductRequest.variant),
        )
        .where(ProductRequest.id == request_id)
    )
    return result.scalar_one_or_none()


def _product_request_schema(request: ProductRequest) -> ProductRequestSchema:
    return ProductRequestSchema(
        id=request.id,
        request_type=request.request_type,
        status=request.status,
        requester_user_id=request.requester_user_id,
        requester_tg_id=request.requester_tg_id,
        city_id=request.city_id,
        city_name=request.city.name if request.city else None,
        location_id=request.location_id,
        location_name=request.location.name if request.location else None,
        product_id=request.product_id,
        product_name=request.product.name_ru if request.product else None,
        variant_id=request.variant_id,
        variant_name=request.variant.name_ru if request.variant else None,
        variant_name_ru=request.variant_name_ru,
        variant_name_pl=request.variant_name_pl,
        variant_name_uk=request.variant_name_uk,
        price_override=request.price_override,
        quantity=request.quantity,
        reject_reason=request.reject_reason,
        review_comment=request.review_comment or request.reject_reason,
        published_variant_id=request.published_variant_id,
        reviewer_tg_id=request.reviewer_tg_id,
        locked_by_tg_id=request.locked_by_tg_id,
        locked_at=request.locked_at,
        created_at=request.created_at,
        updated_at=request.updated_at,
        reviewed_at=request.reviewed_at,
    )


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


async def _ensure_point_manager_can_create(actor, session: AsyncSession, location_id: int) -> None:
    member = await _active_staff_for_actor(actor, session)
    if member is None or member.role != ROLE_POINT_MANAGER:
        raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "Point manager access required")
    if location_id not in _staff_location_ids(member):
        raise api_error(403, ErrorCode.PRODUCT_REQUEST_LOCATION_FORBIDDEN, "Local Point is not assigned")


async def _ensure_reviewer_can_review(actor, session: AsyncSession, city_id: int) -> None:
    if await is_project_admin_user(actor, session):
        return
    member = await _active_staff_for_actor(actor, session)
    if member and member.role == ROLE_CITY_CURATOR and city_id in _staff_city_ids(member):
        return
    raise api_error(403, ErrorCode.PRODUCT_REQUEST_REVIEW_PERMISSION_DENIED, "Review access denied")


@router.get("/product-requests", response_model=list[ProductRequestSchema])
async def admin_list_product_requests(
    mode: str | None = None,
    status: str | None = None,
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if mode is not None and mode not in {"active", "archive"}:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_STATUS_INVALID, "Product request mode is invalid")
    if status is not None and status not in PRODUCT_REQUEST_STATUSES:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_STATUS_INVALID, "Product request status is invalid")

    q = (
        select(ProductRequest)
        .options(
            selectinload(ProductRequest.city),
            selectinload(ProductRequest.location),
            selectinload(ProductRequest.product),
            selectinload(ProductRequest.variant),
        )
        .order_by(ProductRequest.created_at.desc(), ProductRequest.id.desc())
    )
    allowed_statuses: set[str] | None = None
    if mode == "active":
        allowed_statuses = set(PRODUCT_REQUEST_ACTIVE_STATUSES)
    elif mode == "archive":
        allowed_statuses = set(PRODUCT_REQUEST_FINAL_STATUSES)

    if status is not None:
        allowed_statuses = {status} if allowed_statuses is None else allowed_statuses & {status}
    if allowed_statuses is not None:
        q = q.where(ProductRequest.status.in_(allowed_statuses or {"__none__"}))

    if not await is_project_admin_user(actor, session):
        member = await _active_staff_for_actor(actor, session)
        if member is None:
            raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "Product request access denied")
        if member.role == ROLE_CITY_CURATOR:
            q = q.where(ProductRequest.city_id.in_(_staff_city_ids(member) or {-1}))
        elif member.role == ROLE_POINT_MANAGER:
            q = q.where(ProductRequest.location_id.in_(_staff_location_ids(member) or {-1}))
        else:
            raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "Product request access denied")
    result = await session.execute(q)
    return [_product_request_schema(request) for request in result.scalars().all()]


@router.get("/product-requests/options", response_model=ProductRequestOptions)
async def admin_get_product_request_options(
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    location_q = (
        select(Location, City)
        .join(City, City.id == Location.city_id)
        .where(Location.is_active == True, City.is_active == True)
        .order_by(City.name, Location.name)
    )
    if not await is_project_admin_user(actor, session):
        member = await _active_staff_for_actor(actor, session)
        if member is None:
            raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "Product request access denied")
        if member.role == ROLE_CITY_CURATOR:
            location_q = location_q.where(Location.city_id.in_(_staff_city_ids(member) or {-1}))
        elif member.role == ROLE_POINT_MANAGER:
            location_q = location_q.where(Location.id.in_(_staff_location_ids(member) or {-1}))
        else:
            raise api_error(403, ErrorCode.PRODUCT_REQUEST_PERMISSION_DENIED, "Product request access denied")

    location_result = await session.execute(location_q)
    locations = [
        ProductRequestLocationOption(id=location.id, city_id=city.id, city_name=city.name, name=location.name)
        for location, city in location_result.all()
    ]
    product_result = await session.execute(
        select(Product)
        .options(selectinload(Product.variants))
        .where(Product.is_active == True)
        .order_by(Product.name_ru)
    )
    products = [ProductSchema.model_validate(product) for product in product_result.scalars().all()]
    return ProductRequestOptions(locations=locations, products=products)


@router.post("/product-requests", response_model=ProductRequestSchema)
async def admin_create_product_request(
    body: CreateProductRequestRequest,
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if body.request_type not in PRODUCT_REQUEST_TYPES:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_TYPE_INVALID, "Product request type is invalid")
    if body.quantity <= 0:
        raise api_error(422, ErrorCode.PRODUCT_REQUEST_QUANTITY_INVALID, "Quantity must be positive")
    city, location = await _ensure_request_location(session, body.location_id)
    await _ensure_point_manager_can_create(actor, session, location.id)
    await _ensure_active_product(session, body.product_id)

    if body.request_type == PRODUCT_REQUEST_ADD_STOCK:
        await _ensure_active_variant(session, body.product_id, body.variant_id)
        variant_name_ru = variant_name_pl = variant_name_uk = None
    else:
        variant_name_ru = _clean_variant_name(body.variant_name_ru)
        variant_name_pl = _clean_variant_name(body.variant_name_pl or variant_name_ru)
        variant_name_uk = _clean_variant_name(body.variant_name_uk or variant_name_ru)

    request = ProductRequest(
        request_type=body.request_type,
        status=PRODUCT_REQUEST_PENDING_REVIEW,
        requester_user_id=getattr(actor, "id", None),
        requester_tg_id=actor.tg_id,
        city_id=city.id,
        location_id=location.id,
        product_id=body.product_id,
        variant_id=body.variant_id,
        variant_name_ru=variant_name_ru,
        variant_name_pl=variant_name_pl,
        variant_name_uk=variant_name_uk,
        price_override=body.price_override,
        quantity=body.quantity,
    )
    session.add(request)
    await session.flush()
    event_type = product_request_events.PRODUCT_REQUEST_CREATED
    product_request_events.emit_product_request_event(
        event_type,
        product_request_events.ProductRequestEventContext(
            request_id=request.id,
            event_type=event_type,
            actor_tg_id=actor.tg_id,
            requester_tg_id=request.requester_tg_id,
            city_id=request.city_id,
            location_id=request.location_id,
            current_status=request.status,
        ),
    )
    await session.commit()
    return _product_request_schema(await _load_product_request(session, request.id))


@router.post("/product-requests/{request_id}/approve", response_model=ProductRequestSchema)
async def admin_approve_product_request(
    request_id: int,
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    request = await approve_product_request(request_id, actor=actor, session=session)
    return _product_request_schema(await _load_product_request(session, request.id))


@router.post("/product-requests/{request_id}/reject", response_model=ProductRequestSchema)
async def admin_reject_product_request(
    request_id: int,
    body: RejectProductRequestRequest,
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    request = await reject_product_request(
        request_id,
        body.effective_comment,
        actor=actor,
        session=session,
    )
    return _product_request_schema(await _load_product_request(session, request.id))


@router.post("/product-requests/{request_id}/need-changes", response_model=ProductRequestSchema)
async def admin_request_product_request_changes(
    request_id: int,
    body: RejectProductRequestRequest,
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    request = await request_product_request_changes(
        request_id,
        body.effective_comment,
        actor=actor,
        session=session,
    )
    return _product_request_schema(await _load_product_request(session, request.id))


@router.post("/product-requests/{request_id}/lock", response_model=ProductRequestSchema)
async def admin_lock_product_request(
    request_id: int,
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    request = await lock_product_request(request_id, actor=actor, session=session)
    return _product_request_schema(await _load_product_request(session, request.id))


@router.post("/product-requests/{request_id}/release", response_model=ProductRequestSchema)
async def admin_release_product_request(
    request_id: int,
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    request = await release_product_request(request_id, actor=actor, session=session)
    return _product_request_schema(await _load_product_request(session, request.id))


@router.patch("/product-requests/{request_id}", response_model=ProductRequestSchema)
async def admin_edit_product_request(
    request_id: int,
    body: UpdateProductRequestReviewRequest,
    actor=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    request = await edit_product_request(request_id, body, actor=actor, session=session)
    return _product_request_schema(await _load_product_request(session, request.id))


@router.get("/cities", response_model=list[CitySchema])
async def admin_list_cities(
    _=Depends(get_project_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(City).order_by(City.name))
    return [CitySchema.model_validate(c) for c in result.scalars().all()]


@router.post("/cities", response_model=CitySchema)
async def admin_create_city(
    body: CreateCityRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    city = City(name=body.name, slug=body.slug, manager_tg_id=body.manager_tg_id)
    session.add(city)
    await session.commit()
    await session.refresh(city)
    return CitySchema.model_validate(city)


@router.put("/cities/{city_id}", response_model=CitySchema)
async def admin_update_city(
    city_id: int,
    body: UpdateCityRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(City).where(City.id == city_id))
    city = result.scalar_one_or_none()
    if not city:
        raise api_error(404, ErrorCode.ADMIN_CITY_NOT_FOUND, "City not found")
    if body.name is not None:
        city.name = body.name
    if body.slug is not None:
        city.slug = body.slug
    if body.manager_tg_id is not None:
        city.manager_tg_id = body.manager_tg_id
    if body.is_active is not None:
        city.is_active = body.is_active
    await session.commit()
    await session.refresh(city)
    return CitySchema.model_validate(city)


@router.delete("/cities/{city_id}", status_code=204)
async def admin_delete_city(
    city_id: int,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(City).where(City.id == city_id))
    city = result.scalar_one_or_none()
    if not city:
        raise api_error(404, ErrorCode.ADMIN_CITY_NOT_FOUND, "City not found")
    location_ids = (
        await session.execute(select(Location.id).where(Location.city_id == city_id))
    ).scalars().all()
    await _clear_location_delete_dependencies(session, list(location_ids))
    await session.execute(delete(ProductRequest).where(ProductRequest.city_id == city_id))
    await session.execute(delete(StaffAssignment).where(StaffAssignment.city_id == city_id))
    await session.execute(delete(Location).where(Location.city_id == city_id))
    await session.execute(delete(City).where(City.id == city_id))
    await session.commit()


# ── Locations ─────────────────────────────────────────────

@router.get("/cities/{city_id}/locations", response_model=list[LocationSchema])
async def admin_list_locations(
    city_id: int,
    _=Depends(get_project_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Location).where(Location.city_id == city_id).order_by(Location.name)
    )
    return [await _location_schema(session, l) for l in result.scalars().all()]


@router.post("/cities/{city_id}/locations", response_model=LocationSchema)
async def admin_create_location(
    city_id: int,
    body: CreateLocationRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    coordinates = await _geocode_admin_location_address(body.address)
    loc = Location(
        city_id=city_id,
        name=body.name,
        address=body.address,
        description=body.description,
        curator_tg_username=body.curator_tg_username,
    )
    if coordinates is not None:
        loc.latitude, loc.longitude = coordinates
    session.add(loc)
    await session.commit()
    await session.refresh(loc)
    return await _location_schema(session, loc)


@router.put("/locations/{location_id}", response_model=LocationSchema)
async def admin_update_location(
    location_id: int,
    body: UpdateLocationRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Location).where(Location.id == location_id))
    loc = result.scalar_one_or_none()
    if not loc:
        raise api_error(404, ErrorCode.ADMIN_LOCATION_NOT_FOUND, "Location not found")
    if body.name is not None:
        loc.name = body.name
    if body.address is not None:
        if body.address != loc.address:
            coordinates = await _geocode_admin_location_address(body.address)
            if coordinates is not None:
                loc.latitude, loc.longitude = coordinates
        loc.address = body.address
    if body.description is not None:
        loc.description = body.description
    if body.curator_tg_username is not None:
        loc.curator_tg_username = body.curator_tg_username
    if body.is_active is not None:
        loc.is_active = body.is_active
    await session.commit()
    await session.refresh(loc)
    return await _location_schema(session, loc)


@router.delete("/locations/{location_id}", status_code=204)
async def admin_delete_location(
    location_id: int,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Location).where(Location.id == location_id))
    loc = result.scalar_one_or_none()
    if not loc:
        raise api_error(404, ErrorCode.ADMIN_LOCATION_NOT_FOUND, "Location not found")
    await _clear_location_delete_dependencies(session, [location_id])
    await session.execute(delete(Location).where(Location.id == location_id))
    await session.commit()


# ── Products ──────────────────────────────────────────────

@router.get("/products", response_model=list[ProductSchema])
async def admin_list_products(
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Product).where(Product.is_active == True).order_by(Product.name_ru)
    )
    return [ProductSchema.model_validate(p) for p in result.scalars().all()]


@router.post("/products", response_model=ProductSchema)
async def admin_create_product(
    body: CreateProductRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    product = Product(
        name_ru=body.name_ru, name_pl=body.name_pl, name_uk=body.name_uk,
        base_price=body.base_price, category_id=body.category_id,
        description_ru=body.description_ru, description_pl=body.description_pl,
        description_uk=body.description_uk,
    )
    session.add(product)
    await session.commit()
    await session.refresh(product)
    return ProductSchema.model_validate(product)


@router.put("/products/{product_id}", response_model=ProductSchema)
async def admin_update_product(
    product_id: int,
    body: UpdateProductRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise api_error(404, ErrorCode.ADMIN_PRODUCT_NOT_FOUND, "Product not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    await session.commit()
    await session.refresh(product)
    return ProductSchema.model_validate(product)


@router.delete("/products/{product_id}", status_code=204)
async def admin_delete_product(
    product_id: int,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise api_error(404, ErrorCode.ADMIN_PRODUCT_NOT_FOUND, "Product not found")
    product.is_active = False
    await session.commit()


# ── Variants ──────────────────────────────────────────────

@router.post("/products/{product_id}/variants", response_model=VariantSchema)
async def admin_create_variant(
    product_id: int,
    body: CreateVariantRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    variant = ProductVariant(
        product_id=product_id,
        name_ru=body.name_ru, name_pl=body.name_pl, name_uk=body.name_uk,
        price_override=body.price_override,
    )
    session.add(variant)
    await session.commit()
    await session.refresh(variant)
    return VariantSchema.model_validate(variant)


@router.put("/variants/{variant_id}", response_model=VariantSchema)
async def admin_update_variant(
    variant_id: int,
    body: UpdateVariantRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(ProductVariant).where(ProductVariant.id == variant_id))
    variant = result.scalar_one_or_none()
    if not variant:
        raise api_error(404, ErrorCode.ADMIN_VARIANT_NOT_FOUND, "Variant not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(variant, field, value)
    await session.commit()
    await session.refresh(variant)
    return VariantSchema.model_validate(variant)


@router.delete("/variants/{variant_id}", status_code=204)
async def admin_delete_variant(
    variant_id: int,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(ProductVariant).where(ProductVariant.id == variant_id))
    variant = result.scalar_one_or_none()
    if not variant:
        raise api_error(404, ErrorCode.ADMIN_VARIANT_NOT_FOUND, "Variant not found")
    await session.execute(delete(ProductVariant).where(ProductVariant.id == variant_id))
    await session.commit()


# ── Stock ─────────────────────────────────────────────────

@router.get("/stock", response_model=list[StockRow])
async def admin_get_stock(
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Return editable stock matrix for every active location and active variant."""
    from sqlalchemy.orm import selectinload

    stock_result = await session.execute(
        select(LocationStock)
        .options(
            selectinload(LocationStock.location),
            selectinload(LocationStock.variant),
        )
    )
    stock_by_location_variant = {
        (stock.location_id, stock.variant_id): stock.quantity
        for stock in stock_result.scalars().all()
    }
    inpost_stock_result = await session.execute(select(InpostStock))
    inpost_stock_by_variant = {
        stock.variant_id: stock.quantity
        for stock in inpost_stock_result.scalars().all()
    }

    location_result = await session.execute(
        select(Location, City)
        .join(City, City.id == Location.city_id)
        .where(Location.is_active == True, City.is_active == True)
        .order_by(City.name, Location.name)
    )
    locations = location_result.all()

    variant_result = await session.execute(
        select(ProductVariant, Product)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(Product.is_active == True)
        .order_by(Product.name_ru, ProductVariant.name_ru)
    )
    variants = variant_result.all()

    rows = []
    for loc, city in locations:
        for var, prod in variants:
            rows.append(StockRow(
                source_type="local_point",
                location_id=loc.id,
                location_name=loc.name,
                city_name=city.name,
                variant_id=var.id,
                variant_name=var.name_ru,
                product_name=prod.name_ru,
                quantity=stock_by_location_variant.get((loc.id, var.id), 0),
            ))
    for var, prod in variants:
        rows.append(StockRow(
            source_type="inpost",
            location_id=None,
            location_name="InPost",
            city_name="InPost",
            variant_id=var.id,
            variant_name=var.name_ru,
            product_name=prod.name_ru,
            quantity=inpost_stock_by_variant.get(var.id, 0),
        ))
    return rows


@router.put("/stock", status_code=200)
async def admin_update_stock(
    body: UpdateStockRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    for item in body.items:
        if item.source_type not in ("local_point", "inpost"):
            raise api_error(422, ErrorCode.ADMIN_STOCK_ROW_INVALID, "Stock source invalid")

        variant_result = await session.execute(
            select(ProductVariant, Product)
            .join(Product, Product.id == ProductVariant.product_id)
            .where(
                ProductVariant.id == item.variant_id,
                Product.is_active == True,
            )
        )
        if variant_result.one_or_none() is None:
            raise api_error(404, ErrorCode.ADMIN_VARIANT_NOT_FOUND, "Variant not found")

        if item.source_type == "inpost":
            result = await session.execute(
                select(InpostStock).where(InpostStock.variant_id == item.variant_id)
            )
            stock = result.scalar_one_or_none()
            if stock is None:
                stock = InpostStock(
                    variant_id=item.variant_id,
                    quantity=item.quantity,
                )
                session.add(stock)
            else:
                stock.quantity = item.quantity
            continue

        if item.location_id is None:
            raise api_error(404, ErrorCode.ADMIN_LOCATION_NOT_FOUND, "Location not found")

        location_result = await session.execute(
            select(Location, City)
            .join(City, City.id == Location.city_id)
            .where(
                Location.id == item.location_id,
                Location.is_active == True,
                City.is_active == True,
            )
        )
        if location_result.one_or_none() is None:
            raise api_error(404, ErrorCode.ADMIN_LOCATION_NOT_FOUND, "Location not found")

        result = await session.execute(
            select(LocationStock).where(
                LocationStock.location_id == item.location_id,
                LocationStock.variant_id == item.variant_id,
            )
        )
        stock = result.scalar_one_or_none()
        if stock is None:
            stock = LocationStock(
                location_id=item.location_id,
                variant_id=item.variant_id,
                quantity=item.quantity,
            )
            session.add(stock)
        else:
            stock.quantity = item.quantity
    await session.commit()
    return {"ok": True}


# ── Orders ────────────────────────────────────────────────

@router.get("/orders", response_model=list[OrderSchema])
async def admin_list_orders(
    status: str | None = None,
    page: int = 0,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy.orm import selectinload
    q = select(Order).order_by(Order.created_at.desc()).offset(page * 20).limit(20)
    if status:
        q = q.where(Order.status == status)
    result = await session.execute(q.options(selectinload(Order.items)))
    return [OrderSchema.model_validate(o) for o in result.scalars().all()]


@router.put("/orders/{order_id}/status", response_model=OrderSchema)
async def admin_update_order_status(
    order_id: int,
    body: UpdateOrderStatusRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    repo = OrderRepository(session)
    order = await repo.set_status(order_id, body.status)
    if not order:
        raise api_error(404, ErrorCode.ADMIN_ORDER_NOT_FOUND, "Order not found")
    return OrderSchema.model_validate(order)
