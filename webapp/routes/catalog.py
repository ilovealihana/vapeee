"""Catalog routes: cities, locations, products, categories."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.catalog import CatalogRepository
from webapp.deps import get_session
from webapp.errors import ErrorCode, api_error
from webapp.schemas import (
    CatalogSourceCitySchema,
    CatalogSourceInpostSchema,
    CatalogSourceLocationSchema,
    CatalogSourcesSchema,
    CategorySchema,
    CitySchema,
    LocationSchema,
    LocationStockSummary,
    ProductSchema,
    VariantSchema,
)

router = APIRouter(prefix="/api", tags=["catalog"])


def _direct_default(value, default):
    if hasattr(value, "default"):
        return value.default
    return value


async def _product_schema_for_source(
    repo: CatalogRepository,
    product,
    location_id: int | None = None,
    source: str | None = None,
) -> ProductSchema:
    schema = ProductSchema.model_validate(product)
    if location_id is None and source is None:
        return schema

    if source == "inpost":
        schema.variants = []
        for variant in product.variants:
            if await repo.get_inpost_variant_quantity(variant.id) > 0:
                schema.variants.append(VariantSchema.model_validate(variant))
    else:
        schema.variants = [
            VariantSchema.model_validate(variant)
            for variant in product.variants
            if any(
                stock.location_id == location_id and stock.quantity > 0
                for stock in variant.stock_items
            )
        ]
    return schema


def _location_city_is_active(location) -> bool:
    city = getattr(location, "city", None)
    return bool(city and getattr(city, "is_active", False))


async def _location_schema(repo: CatalogRepository, location) -> LocationSchema:
    manager = await repo.get_location_point_manager(location.id)
    loc_schema = LocationSchema.model_validate(location)
    loc_schema.has_manager = manager is not None
    loc_schema.manager_tg_id = manager.tg_id if manager else None
    loc_schema.manager_tg_username = getattr(manager, "username", None) if manager else None
    loc_schema.catalog_available = loc_schema.has_manager
    return loc_schema


async def _get_active_catalog_location(repo: CatalogRepository, location_id: int):
    location = await repo.get_location(location_id)
    if not location:
        raise api_error(404, ErrorCode.CATALOG_LOCATION_NOT_FOUND, "Location not found")
    if not location.is_active or not _location_city_is_active(location):
        raise api_error(404, ErrorCode.CATALOG_LOCATION_INACTIVE, "Location inactive")
    if not await repo.get_location_point_manager(location_id):
        raise api_error(404, ErrorCode.CATALOG_LOCATION_INACTIVE, "Location inactive")
    return location


async def _validate_catalog_location(repo: CatalogRepository, location_id: int | None) -> None:
    if location_id is None:
        return
    await _get_active_catalog_location(repo, location_id)


def _validate_product_source(source: str | None, location_id: int | None) -> None:
    if source is not None and source != "inpost":
        raise api_error(400, ErrorCode.CATALOG_SOURCE_INVALID, "Catalog source invalid")
    if source is not None and location_id is not None:
        raise api_error(400, ErrorCode.CATALOG_SOURCE_INVALID, "Catalog source invalid")


def _source_status_for_location(has_manager: bool) -> str:
    return "available" if has_manager else "coming_soon"


@router.get("/cities", response_model=list[CitySchema])
async def get_cities(session: AsyncSession = Depends(get_session)):
    repo = CatalogRepository(session)
    cities = await repo.get_cities()
    return [CitySchema.model_validate(c) for c in cities]


@router.get("/catalog-sources", response_model=CatalogSourcesSchema)
async def get_catalog_sources(session: AsyncSession = Depends(get_session)):
    repo = CatalogRepository(session)
    inpost_summary = await repo.get_inpost_stock_summary()
    cities = []
    for city in await repo.get_catalog_source_cities():
        locations = []
        for location in sorted(city.locations, key=lambda item: item.name):
            if not location.is_active:
                continue
            manager = await repo.get_location_point_manager(location.id)
            summary = await repo.get_location_stock_summary(location.id)
            locations.append(CatalogSourceLocationSchema(
                id=location.id,
                city_id=city.id,
                name=location.name,
                address=location.address,
                status=_source_status_for_location(manager is not None),
                catalog_available=manager is not None,
                stock_count=summary["total_qty"],
                latitude=location.latitude,
                longitude=location.longitude,
                manager_tg_username=getattr(manager, "username", None) if manager else None,
            ))
        cities.append(CatalogSourceCitySchema(id=city.id, name=city.name, locations=locations))
    return CatalogSourcesSchema(
        inpost=CatalogSourceInpostSchema(
            status="available" if inpost_summary["total_qty"] > 0 else "inactive",
            stock_count=inpost_summary["total_qty"],
        ),
        cities=cities,
    )


@router.get("/cities/{city_id}/locations", response_model=list[LocationSchema])
async def get_locations(city_id: int, session: AsyncSession = Depends(get_session)):
    repo = CatalogRepository(session)
    city = await repo.get_city(city_id)
    if not city or not city.is_active:
        raise api_error(404, ErrorCode.CATALOG_CITY_NOT_FOUND, "City not found")
    locations = await repo.get_locations_for_city(city_id)
    result = []
    for loc in locations:
        summary = await repo.get_location_stock_summary(loc.id)
        loc_schema = await _location_schema(repo, loc)
        loc_schema.stock_summary = LocationStockSummary(
            total_qty=summary["total_qty"],
            last_sold=summary["last_sold"],
        )
        result.append(loc_schema)
    return result


@router.get("/locations/{location_id}", response_model=LocationSchema)
async def get_location(location_id: int, session: AsyncSession = Depends(get_session)):
    repo = CatalogRepository(session)
    loc = await _get_active_catalog_location(repo, location_id)
    summary = await repo.get_location_stock_summary(location_id)
    loc_schema = await _location_schema(repo, loc)
    loc_schema.stock_summary = LocationStockSummary(
        total_qty=summary["total_qty"],
        last_sold=summary["last_sold"],
    )
    return loc_schema


@router.get("/categories", response_model=list[CategorySchema])
async def get_categories(session: AsyncSession = Depends(get_session)):
    repo = CatalogRepository(session)
    cats = await repo.get_categories()
    return [CategorySchema.model_validate(c) for c in cats]


@router.get("/products", response_model=list[ProductSchema])
async def get_products(
    category_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    source: Optional[str] = Query(None),
    page: int = Query(0, ge=0),
    page_size: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    category_id = _direct_default(category_id, None)
    location_id = _direct_default(location_id, None)
    source = _direct_default(source, None)
    page = _direct_default(page, 0)
    page_size = _direct_default(page_size, 20)
    repo = CatalogRepository(session)
    _validate_product_source(source, location_id)
    if category_id is not None:
        category = await repo.get_category(category_id)
        if not category:
            raise api_error(404, ErrorCode.CATALOG_CATEGORY_NOT_FOUND, "Category not found")
    await _validate_catalog_location(repo, location_id)
    products = await repo.get_products(
        category_id=category_id,
        location_id=location_id,
        source=source,
        page=page,
        page_size=page_size,
    )
    return [await _product_schema_for_source(repo, p, location_id, source) for p in products]


@router.get("/products/{product_id}", response_model=ProductSchema)
async def get_product(
    product_id: int,
    location_id: Optional[int] = Query(None),
    source: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    location_id = _direct_default(location_id, None)
    source = _direct_default(source, None)
    repo = CatalogRepository(session)
    _validate_product_source(source, location_id)
    await _validate_catalog_location(repo, location_id)
    product = await repo.get_product(product_id)
    if not product:
        raise api_error(404, ErrorCode.CATALOG_PRODUCT_NOT_FOUND, "Product not found")
    if not product.is_active:
        raise api_error(404, ErrorCode.CATALOG_PRODUCT_UNAVAILABLE, "Product unavailable")
    product_schema = await _product_schema_for_source(repo, product, location_id, source)
    if (location_id is not None or source is not None) and not product_schema.variants:
        raise api_error(404, ErrorCode.CATALOG_PRODUCT_UNAVAILABLE, "Product unavailable")
    return product_schema
