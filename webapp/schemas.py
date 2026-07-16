"""Pydantic schemas for API request/response."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, field_validator


# ── User ──────────────────────────────────────────────────

class UserSchema(BaseModel):
    id: int
    tg_id: int
    username: Optional[str]
    first_name: str
    last_name: Optional[str]
    language: str
    phone: Optional[str]
    email: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Catalog ───────────────────────────────────────────────

class CategorySchema(BaseModel):
    id: int
    name_ru: str
    name_pl: str
    name_uk: str
    sort_order: int

    class Config:
        from_attributes = True


class VariantSchema(BaseModel):
    id: int
    product_id: int
    name_ru: str
    name_pl: str
    name_uk: str
    image_file_id: Optional[str]
    price_override: Optional[Decimal]

    class Config:
        from_attributes = True


class ProductSchema(BaseModel):
    id: int
    category_id: Optional[int]
    name_ru: str
    name_pl: str
    name_uk: str
    description_ru: Optional[str]
    description_pl: Optional[str]
    description_uk: Optional[str]
    image_file_id: Optional[str]
    base_price: Decimal
    is_active: bool
    variants: List[VariantSchema] = []

    class Config:
        from_attributes = True


class LocationStockSummary(BaseModel):
    total_qty: int
    last_sold: Optional[datetime]


class LocationSchema(BaseModel):
    id: int
    city_id: int
    name: str
    address: str
    description: Optional[str]
    curator_tg_username: Optional[str]
    is_active: bool
    stock_summary: Optional[LocationStockSummary] = None

    class Config:
        from_attributes = True


class CitySchema(BaseModel):
    id: int
    name: str
    slug: str
    manager_tg_id: Optional[int]
    is_active: bool

    class Config:
        from_attributes = True


# ── Cart ──────────────────────────────────────────────────

class CartItemSchema(BaseModel):
    id: int
    variant_id: int
    quantity: int
    variant: Optional[VariantSchema]
    product: Optional[ProductSchema] = None
    price: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None

    class Config:
        from_attributes = True


class CartSchema(BaseModel):
    id: int
    user_id: int
    location_id: Optional[int]
    items: List[CartItemSchema] = []
    total: Decimal = Decimal("0")

    class Config:
        from_attributes = True


class AddCartItemRequest(BaseModel):
    variant_id: int
    quantity: int = 1
    location_id: Optional[int] = None


class UpdateCartItemRequest(BaseModel):
    quantity: int


# ── Orders ────────────────────────────────────────────────

class OrderItemSchema(BaseModel):
    id: int
    variant_id: Optional[int]
    quantity: int
    price_at_order: Decimal
    variant: Optional[VariantSchema] = None

    class Config:
        from_attributes = True


class OrderSchema(BaseModel):
    id: int
    delivery_type: str
    status: str
    customer_name: str
    customer_phone: str
    customer_email: str
    delivery_address: Optional[str]
    scheduled_at: Optional[datetime]
    products_total: Decimal
    delivery_cost: Decimal
    total: Decimal
    payment_method: str
    comment: Optional[str]
    created_at: datetime
    items: List[OrderItemSchema] = []

    class Config:
        from_attributes = True


class CreateOrderRequest(BaseModel):
    delivery_type: str          # "pickup" | "door_delivery"
    customer_name: str
    customer_phone: str
    customer_email: str
    delivery_address: Optional[str] = None
    location_id: Optional[int] = None
    scheduled_date: str         # "2025-03-15"
    scheduled_time: str         # "14:00"
    payment_method: str         # "cash" | "blik" | "monobank"
    comment: Optional[str] = None


# ── Admin request schemas ─────────────────────────────────

class CreateCityRequest(BaseModel):
    name: str
    slug: str
    manager_tg_id: Optional[int] = None

class UpdateCityRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    manager_tg_id: Optional[int] = None
    is_active: Optional[bool] = None

class CreateLocationRequest(BaseModel):
    name: str
    address: str
    description: Optional[str] = None
    curator_tg_username: Optional[str] = None

class UpdateLocationRequest(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    curator_tg_username: Optional[str] = None
    is_active: Optional[bool] = None

class CreateProductRequest(BaseModel):
    name_ru: str
    name_pl: str
    name_uk: str
    base_price: Decimal
    category_id: Optional[int] = None
    description_ru: Optional[str] = None
    description_pl: Optional[str] = None
    description_uk: Optional[str] = None

class UpdateProductRequest(BaseModel):
    name_ru: Optional[str] = None
    name_pl: Optional[str] = None
    name_uk: Optional[str] = None
    base_price: Optional[Decimal] = None
    category_id: Optional[int] = None
    description_ru: Optional[str] = None
    description_pl: Optional[str] = None
    description_uk: Optional[str] = None
    is_active: Optional[bool] = None

class CreateVariantRequest(BaseModel):
    name_ru: str
    name_pl: str
    name_uk: str
    price_override: Optional[Decimal] = None

class UpdateVariantRequest(BaseModel):
    name_ru: Optional[str] = None
    name_pl: Optional[str] = None
    name_uk: Optional[str] = None
    price_override: Optional[Decimal] = None

class StockItem(BaseModel):
    location_id: int
    variant_id: int
    quantity: int

class UpdateStockRequest(BaseModel):
    items: List[StockItem]

class StockRow(BaseModel):
    location_id: int
    location_name: str
    city_name: str
    variant_id: int
    variant_name: str
    product_name: str
    quantity: int

class UpdateOrderStatusRequest(BaseModel):
    status: str

class AdminOrderSchema(OrderSchema):
    customer_name: str
    customer_phone: str
    customer_email: str
    location_name: Optional[str] = None

    class Config:
        from_attributes = True


# ── Auth ──────────────────────────────────────────────────

class AuthRequest(BaseModel):
    init_data: str


class AuthResponse(BaseModel):
    user: UserSchema
    token: str  # base64 initData (used as bearer token)


# ── Language ──────────────────────────────────────────────

class SetLanguageRequest(BaseModel):
    language: str

    @field_validator("language")
    @classmethod
    def validate_language(cls, v):
        if v not in ("ru", "pl", "uk"):
            raise ValueError("language must be ru, pl or uk")
        return v
