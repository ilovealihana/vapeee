from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models.category import Category
from db.models.city import City
from db.models.location import Location
from db.models.location_stock import LocationStock
from db.models.product import Product
from db.models.product_variant import ProductVariant


class CatalogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- Cities ---

    async def get_cities(self) -> list[City]:
        result = await self.session.execute(
            select(City).where(City.is_active == True).order_by(City.name)
        )
        return list(result.scalars().all())

    async def get_city(self, city_id: int) -> City | None:
        result = await self.session.execute(select(City).where(City.id == city_id))
        return result.scalar_one_or_none()

    async def create_city(self, name: str, slug: str, manager_tg_id: int | None = None) -> City:
        city = City(name=name, slug=slug, manager_tg_id=manager_tg_id)
        self.session.add(city)
        await self.session.commit()
        await self.session.refresh(city)
        return city

    # --- Locations ---

    async def get_locations_for_city(self, city_id: int) -> list[Location]:
        result = await self.session.execute(
            select(Location)
            .where(Location.city_id == city_id, Location.is_active == True)
            .order_by(Location.name)
        )
        return list(result.scalars().all())

    async def get_location(self, location_id: int) -> Location | None:
        result = await self.session.execute(
            select(Location)
            .where(Location.id == location_id)
            .options(selectinload(Location.city))
        )
        return result.scalar_one_or_none()

    async def create_location(
        self,
        city_id: int,
        name: str,
        address: str,
        description: str | None = None,
        curator_tg_username: str | None = None,
    ) -> Location:
        location = Location(
            city_id=city_id,
            name=name,
            address=address,
            description=description,
            curator_tg_username=curator_tg_username,
        )
        self.session.add(location)
        await self.session.commit()
        await self.session.refresh(location)
        return location

    # --- Stock ---

    async def get_location_stock_summary(self, location_id: int) -> dict:
        """Return total qty and last sale timestamp for a location."""
        result = await self.session.execute(
            select(
                func.sum(LocationStock.quantity).label("total_qty"),
                func.max(LocationStock.last_sold_at).label("last_sold"),
            ).where(LocationStock.location_id == location_id)
        )
        row = result.one()
        return {"total_qty": row.total_qty or 0, "last_sold": row.last_sold}

    async def get_stock_for_location(self, location_id: int) -> list[LocationStock]:
        result = await self.session.execute(
            select(LocationStock)
            .where(LocationStock.location_id == location_id)
            .options(selectinload(LocationStock.variant))
        )
        return list(result.scalars().all())

    async def upsert_stock(
        self, location_id: int, variant_id: int, quantity: int
    ) -> LocationStock:
        result = await self.session.execute(
            select(LocationStock).where(
                LocationStock.location_id == location_id,
                LocationStock.variant_id == variant_id,
            )
        )
        stock = result.scalar_one_or_none()
        if stock is None:
            stock = LocationStock(location_id=location_id, variant_id=variant_id, quantity=quantity)
            self.session.add(stock)
        else:
            stock.quantity = quantity
        await self.session.commit()
        await self.session.refresh(stock)
        return stock

    # --- Categories ---

    async def get_categories(self) -> list[Category]:
        result = await self.session.execute(select(Category).order_by(Category.sort_order))
        return list(result.scalars().all())

    async def get_category(self, category_id: int) -> Category | None:
        result = await self.session.execute(select(Category).where(Category.id == category_id))
        return result.scalar_one_or_none()

    async def create_category(self, name_ru: str, name_pl: str, name_uk: str) -> Category:
        cat = Category(name_ru=name_ru, name_pl=name_pl, name_uk=name_uk)
        self.session.add(cat)
        await self.session.commit()
        await self.session.refresh(cat)
        return cat

    # --- Products ---

    async def get_products(
        self,
        category_id: int | None = None,
        location_id: int | None = None,
        page: int = 0,
        page_size: int = 5,
    ) -> list[Product]:
        q = select(Product).where(Product.is_active == True).options(
            selectinload(Product.variants).selectinload(ProductVariant.stock_items)
        )
        if category_id is not None:
            q = q.where(Product.category_id == category_id)
        if location_id is not None:
            q = (
                q.join(ProductVariant, ProductVariant.product_id == Product.id)
                .join(LocationStock, LocationStock.variant_id == ProductVariant.id)
                .where(
                    LocationStock.location_id == location_id,
                    LocationStock.quantity > 0,
                )
                .distinct()
            )
        q = q.order_by(Product.id).offset(page * page_size).limit(page_size)
        result = await self.session.execute(q)
        return list(result.scalars().unique().all())

    async def count_products(self, category_id: int | None = None) -> int:
        q = select(func.count()).select_from(Product).where(Product.is_active == True)
        if category_id is not None:
            q = q.where(Product.category_id == category_id)
        result = await self.session.execute(q)
        return result.scalar_one()

    async def get_product(self, product_id: int) -> Product | None:
        result = await self.session.execute(
            select(Product)
            .where(Product.id == product_id)
            .options(selectinload(Product.variants).selectinload(ProductVariant.stock_items))
        )
        return result.scalar_one_or_none()

    async def create_product(
        self,
        name_ru: str,
        name_pl: str,
        name_uk: str,
        base_price: float,
        category_id: int | None = None,
        description_ru: str | None = None,
        description_pl: str | None = None,
        description_uk: str | None = None,
        image_file_id: str | None = None,
    ) -> Product:
        product = Product(
            name_ru=name_ru,
            name_pl=name_pl,
            name_uk=name_uk,
            base_price=base_price,
            category_id=category_id,
            description_ru=description_ru,
            description_pl=description_pl,
            description_uk=description_uk,
            image_file_id=image_file_id,
        )
        self.session.add(product)
        await self.session.commit()
        await self.session.refresh(product)
        return product

    async def toggle_product(self, product_id: int) -> Product | None:
        product = await self.get_product(product_id)
        if product:
            product.is_active = not product.is_active
            await self.session.commit()
        return product

    # --- Variants ---

    async def get_variant(self, variant_id: int) -> ProductVariant | None:
        result = await self.session.execute(
            select(ProductVariant).where(ProductVariant.id == variant_id)
        )
        return result.scalar_one_or_none()

    async def create_variant(
        self,
        product_id: int,
        name_ru: str,
        name_pl: str,
        name_uk: str,
        price_override: float | None = None,
        image_file_id: str | None = None,
    ) -> ProductVariant:
        variant = ProductVariant(
            product_id=product_id,
            name_ru=name_ru,
            name_pl=name_pl,
            name_uk=name_uk,
            price_override=price_override,
            image_file_id=image_file_id,
        )
        self.session.add(variant)
        await self.session.commit()
        await self.session.refresh(variant)
        return variant
