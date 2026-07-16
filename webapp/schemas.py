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
    delivery_type: str          # "pickup" | "inpost"
    customer_name: str
    customer_phone: str
    customer_email: str
    delivery_address: Optional[str] = None
    location_id: Optional[int] = None
    scheduled_date: str         # "2025-03-15"
    scheduled_time: str         # "14:00"
    payment_method: str         # "cash" | "blik" | "monobank"
    comment: Optional[str] = None


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
