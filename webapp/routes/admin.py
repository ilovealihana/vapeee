"""Admin API routes — protected by ADMIN_IDS check."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.city import City
from db.models.location import Location
from db.models.location_stock import LocationStock
from db.models.order import Order
from db.models.order_item import OrderItem
from db.models.product import Product
from db.models.product_variant import ProductVariant
from db.repositories.catalog import CatalogRepository
from db.repositories.order import OrderRepository
from webapp.deps import get_admin_user, get_session
from webapp.schemas import (
    CitySchema, LocationSchema,
    ProductSchema, VariantSchema,
    OrderSchema, StockRow,
    CreateCityRequest, UpdateCityRequest,
    CreateLocationRequest, UpdateLocationRequest,
    CreateProductRequest, UpdateProductRequest,
    CreateVariantRequest, UpdateVariantRequest,
    UpdateStockRequest, UpdateOrderStatusRequest,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Cities ────────────────────────────────────────────────

@router.get("/cities", response_model=list[CitySchema])
async def admin_list_cities(
    _=Depends(get_admin_user),
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
        raise HTTPException(404, "City not found")
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
    await session.execute(delete(City).where(City.id == city_id))
    await session.commit()


# ── Locations ─────────────────────────────────────────────

@router.get("/cities/{city_id}/locations", response_model=list[LocationSchema])
async def admin_list_locations(
    city_id: int,
    _=Depends(get_admin_user),
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
        raise HTTPException(404, "Location not found")
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
    await session.execute(delete(Location).where(Location.id == location_id))
    await session.commit()


# ── Products ──────────────────────────────────────────────

@router.get("/products", response_model=list[ProductSchema])
async def admin_list_products(
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Product).order_by(Product.name_ru))
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
        raise HTTPException(404, "Product not found")
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
    if product:
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
        raise HTTPException(404, "Variant not found")
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
    await session.execute(delete(ProductVariant).where(ProductVariant.id == variant_id))
    await session.commit()


# ── Stock ─────────────────────────────────────────────────

@router.get("/stock", response_model=list[StockRow])
async def admin_get_stock(
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Return all stock rows with city/location/product/variant names."""
    from sqlalchemy.orm import selectinload
    result = await session.execute(
        select(LocationStock)
        .options(
            selectinload(LocationStock.location),
            selectinload(LocationStock.variant),
        )
    )
    rows = []
    for s in result.scalars().all():
        loc = s.location
        var = s.variant
        # Get city
        city_result = await session.execute(select(City).where(City.id == loc.city_id))
        city = city_result.scalar_one_or_none()
        # Get product
        prod_result = await session.execute(select(Product).where(Product.id == var.product_id))
        prod = prod_result.scalar_one_or_none()
        rows.append(StockRow(
            location_id=s.location_id,
            location_name=loc.name if loc else "?",
            city_name=city.name if city else "?",
            variant_id=s.variant_id,
            variant_name=var.name_ru if var else "?",
            product_name=prod.name_ru if prod else "?",
            quantity=s.quantity,
        ))
    return rows


@router.put("/stock", status_code=200)
async def admin_update_stock(
    body: UpdateStockRequest,
    _=Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    for item in body.items:
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
        raise HTTPException(404, "Order not found")
    return OrderSchema.model_validate(order)
