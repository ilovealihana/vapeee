"""Pydantic schemas for API request/response."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ── User ──────────────────────────────────────────────────

class UserSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tg_id: int
    username: Optional[str]
    first_name: str
    last_name: Optional[str]
    language_code: str = Field(validation_alias="language")
    phone: Optional[str]
    email: Optional[str]
    created_at: datetime


# ── Catalog ───────────────────────────────────────────────

class CategorySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_ru: str
    name_pl: str
    name_uk: str
    sort_order: int


class VariantSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    name_ru: str
    name_pl: str
    name_uk: str
    image_file_id: Optional[str]
    price_override: Optional[Decimal]


class ProductSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class LocationStockSummary(BaseModel):
    total_qty: int
    last_sold: Optional[datetime]


class LocationSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    city_id: int
    name: str
    address: str
    description: Optional[str]
    curator_tg_username: Optional[str]
    is_active: bool
    has_manager: bool = False
    manager_tg_id: Optional[int] = None
    catalog_available: bool = False
    stock_summary: Optional[LocationStockSummary] = None


class CitySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    manager_tg_id: Optional[int]
    is_active: bool


# ── Cart ──────────────────────────────────────────────────

class CartItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    variant_id: int
    quantity: int
    variant: Optional[VariantSchema]
    product: Optional[ProductSchema] = None
    price: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None


class CartSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    location_id: Optional[int]
    items: List[CartItemSchema] = []
    total: Decimal = Decimal("0")


class AddCartItemRequest(BaseModel):
    variant_id: int
    quantity: int = 1
    location_id: Optional[int] = None


class UpdateCartItemRequest(BaseModel):
    quantity: int


# ── Orders ────────────────────────────────────────────────

class OrderItemSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    variant_id: Optional[int]
    quantity: int
    price_at_order: Decimal
    variant: Optional[VariantSchema] = None


class OrderSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    model_config = ConfigDict(from_attributes=True)

    customer_name: str
    customer_phone: str
    customer_email: str
    location_name: Optional[str] = None


class StaffAssignmentSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    city_id: Optional[int] = None
    city_name: Optional[str] = None
    location_id: Optional[int] = None
    location_name: Optional[str] = None


class StaffMemberSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tg_id: int
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    assignments: List[StaffAssignmentSchema] = []


class CreateStaffMemberRequest(BaseModel):
    tg_id: int
    role: str
    city_ids: List[int] = []
    location_ids: List[int] = []


class UpdateStaffMemberRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    city_ids: Optional[List[int]] = None
    location_ids: Optional[List[int]] = None


class AdminAccessSchema(BaseModel):
    has_access: bool
    role: Optional[str] = None


# ── Auth ──────────────────────────────────────────────────

class AuthRequest(BaseModel):
    init_data: str


class AuthResponse(BaseModel):
    user: UserSchema
    token: str  # base64 initData (used as bearer token)


# ── Language ──────────────────────────────────────────────

class SetLanguageRequest(BaseModel):
    language_code: str

    @model_validator(mode="before")
    @classmethod
    def accept_legacy_language_alias(cls, data):
        if isinstance(data, dict) and "language_code" not in data and "language" in data:
            return {**data, "language_code": data["language"]}
        return data

    @field_validator("language_code")
    @classmethod
    def validate_language_code(cls, value: str) -> str:
        if value not in ("ru", "en", "pl", "uk"):
            raise ValueError("language_code must be ru, en, pl or uk")
        return value
