"""Catalog routes: cities, locations, products, categories."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from db.repositories.catalog import CatalogRepository
from webapp.deps import get_session
from webapp.schemas import (
    CategorySchema,
    CitySchema,
    LocationSchema,
    LocationStockSummary,
    ProductSchema,
)

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/cities", response_model=list[CitySchema])
async def get_cities(session: AsyncSession = Depends(get_session)):
    repo = CatalogRepository(session)
    cities = await repo.get_cities()
    return [CitySchema.model_validate(c) for c in cities]


@router.get("/cities/{city_id}/locations", response_model=list[LocationSchema])
async def get_locations(city_id: int, session: AsyncSession = Depends(get_session)):
    repo = CatalogRepository(session)
    locations = await repo.get_locations_for_city(city_id)
    result = []
    for loc in locations:
        summary = await repo.get_location_stock_summary(loc.id)
        loc_schema = LocationSchema.model_validate(loc)
        loc_schema.stock_summary = LocationStockSummary(
            total_qty=summary["total_qty"],
            last_sold=summary["last_sold"],
        )
        result.append(loc_schema)
    return result


@router.get("/locations/{location_id}", response_model=LocationSchema)
async def get_location(location_id: int, session: AsyncSession = Depends(get_session)):
    repo = CatalogRepository(session)
    loc = await repo.get_location(location_id)
    if not loc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Location not found")
    summary = await repo.get_location_stock_summary(location_id)
    loc_schema = LocationSchema.model_validate(loc)
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
    page: int = Query(0, ge=0),
    page_size: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
):
    repo = CatalogRepository(session)
    products = await repo.get_products(category_id=category_id, page=page, page_size=page_size)
    return [ProductSchema.model_validate(p) for p in products]


@router.get("/products/{product_id}", response_model=ProductSchema)
async def get_product(product_id: int, session: AsyncSession = Depends(get_session)):
    repo = CatalogRepository(session)
    product = await repo.get_product(product_id)
    if not product:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductSchema.model_validate(product)
