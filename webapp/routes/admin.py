"""Admin API routes — protected by ADMIN_IDS check."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.city import City
from db.models.location import Location
from db.models.location_stock import LocationStock
from db.models.order import Order
from db.models.order_item import OrderItem
from db.models.product import Product
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
    get_project_admin_role,
    get_project_admin_user,
    get_session,
    is_project_admin_user,
)
from webapp.errors import ErrorCode, api_error
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
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# Staff

@router.get("/access", response_model=AdminAccessSchema)
async def admin_get_access(
    actor=Depends(get_project_admin_user),
    session: AsyncSession = Depends(get_session),
):
    role = await get_project_admin_role(actor, session)
    return AdminAccessSchema(has_access=role is not None, role=role)


async def _require_project_admin(actor, session: AsyncSession) -> None:
    if not hasattr(actor, "tg_id") or not await is_project_admin_user(actor, session):
        raise api_error(403, ErrorCode.STAFF_PROJECT_ADMIN_REQUIRED, "Project admin access required")


def _validate_tg_id(tg_id: int) -> None:
    if tg_id == 0:
        raise api_error(422, ErrorCode.STAFF_TG_ID_REQUIRED, "Telegram ID is required")
    if tg_id < 0:
        raise api_error(422, ErrorCode.STAFF_INVALID_TG_ID, "Telegram ID is invalid")


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
        role=member.role,
        is_active=member.is_active,
        created_at=member.created_at,
        updated_at=member.updated_at,
        assignments=assignments,
    )


async def _build_assignments(
    session: AsyncSession,
    role: str,
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
        return [StaffAssignment(location_id=location_id) for location_id in location_ids]

    return []


async def _apply_staff_payload(
    session: AsyncSession,
    member: StaffMember,
    role: str,
    city_ids: list[int] | None,
    location_ids: list[int] | None,
) -> None:
    assignments = await _build_assignments(session, role, city_ids, location_ids)
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
        member = StaffMember(tg_id=body.tg_id, role=body.role, is_active=True)
        session.add(member)
    else:
        member.is_active = True

    await _apply_staff_payload(session, member, body.role, body.city_ids, body.location_ids)
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

    if body.role is not None or body.city_ids is not None or body.location_ids is not None:
        city_ids = body.city_ids if body.city_ids is not None else [
            assignment.city_id for assignment in member.assignments if assignment.city_id is not None
        ]
        location_ids = body.location_ids if body.location_ids is not None else [
            assignment.location_id for assignment in member.assignments if assignment.location_id is not None
        ]
        await _apply_staff_payload(session, member, next_role, city_ids, location_ids)

    if body.is_active is not None:
        member.is_active = body.is_active

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
    return [LocationSchema.model_validate(l) for l in result.scalars().all()]


@router.post("/cities/{city_id}/locations", response_model=LocationSchema)
async def admin_create_location(
    city_id: int,
    body: CreateLocationRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    loc = Location(
        city_id=city_id,
        name=body.name,
        address=body.address,
        description=body.description,
        curator_tg_username=body.curator_tg_username,
    )
    session.add(loc)
    await session.commit()
    await session.refresh(loc)
    return LocationSchema.model_validate(loc)


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
        loc.address = body.address
    if body.description is not None:
        loc.description = body.description
    if body.curator_tg_username is not None:
        loc.curator_tg_username = body.curator_tg_username
    if body.is_active is not None:
        loc.is_active = body.is_active
    await session.commit()
    await session.refresh(loc)
    return LocationSchema.model_validate(loc)


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
                location_id=loc.id,
                location_name=loc.name,
                city_name=city.name,
                variant_id=var.id,
                variant_name=var.name_ru,
                product_name=prod.name_ru,
                quantity=stock_by_location_variant.get((loc.id, var.id), 0),
            ))
    return rows


@router.put("/stock", status_code=200)
async def admin_update_stock(
    body: UpdateStockRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    for item in body.items:
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
