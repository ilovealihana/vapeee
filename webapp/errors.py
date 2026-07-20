"""Canonical API error envelope helpers."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


logger = logging.getLogger(__name__)

SAFE_DETAIL_KEYS = {"field", "fields", "min", "max", "allowed", "available", "requested"}


class ErrorCode:
    VALIDATION_FAILED = "validation.failed"
    VALIDATION_REQUIRED = "validation.required"
    VALIDATION_INVALID_TYPE = "validation.invalid_type"
    VALIDATION_INVALID_ENUM = "validation.invalid_enum"
    VALIDATION_TOO_SHORT = "validation.too_short"
    VALIDATION_TOO_LONG = "validation.too_long"
    VALIDATION_MIN_VALUE = "validation.min_value"
    VALIDATION_MAX_VALUE = "validation.max_value"
    VALIDATION_PHONE_INVALID = "validation.phone_invalid"
    VALIDATION_EMAIL_INVALID = "validation.email_invalid"

    AUTH_INVALID_INIT_DATA_FORMAT = "auth.invalid_init_data_format"
    AUTH_MISSING_HASH = "auth.missing_hash"
    AUTH_INVALID_SIGNATURE = "auth.invalid_signature"
    AUTH_MISSING_USER = "auth.missing_user"
    AUTH_INVALID_USER_JSON = "auth.invalid_user_json"
    AUTH_MISSING_USER_ID = "auth.missing_user_id"
    AUTH_INVALID_AUTHORIZATION_HEADER = "auth.invalid_authorization_header"
    AUTH_NOT_AUTHENTICATED = "auth.not_authenticated"

    USER_NOT_FOUND = "user.not_found"
    USER_INVALID_LANGUAGE = "user.invalid_language"
    USER_PROFILE_UPDATE_FAILED = "user.profile_update_failed"

    CATALOG_CITY_NOT_FOUND = "catalog.city_not_found"
    CATALOG_LOCATION_NOT_FOUND = "catalog.location_not_found"
    CATALOG_LOCATION_INACTIVE = "catalog.location_inactive"
    CATALOG_CATEGORY_NOT_FOUND = "catalog.category_not_found"
    CATALOG_PRODUCT_NOT_FOUND = "catalog.product_not_found"
    CATALOG_PRODUCT_UNAVAILABLE = "catalog.product_unavailable"
    CATALOG_VARIANT_NOT_FOUND = "catalog.variant_not_found"
    CATALOG_VARIANT_UNAVAILABLE = "catalog.variant_unavailable"

    CART_NOT_FOUND = "cart.not_found"
    CART_EMPTY = "cart.empty"
    CART_ITEM_NOT_FOUND = "cart.item_not_found"
    CART_INVALID_QUANTITY = "cart.invalid_quantity"
    CART_SOURCE_MISMATCH = "cart.source_mismatch"
    CART_VARIANT_UNAVAILABLE = "cart.variant_unavailable"
    CART_INSUFFICIENT_STOCK = "cart.insufficient_stock"

    ORDER_CART_EMPTY = "order.cart_empty"
    ORDER_LOCATION_REQUIRED = "order.location_required"
    ORDER_INVALID_DELIVERY_TYPE = "order.invalid_delivery_type"
    ORDER_INVALID_PAYMENT_METHOD = "order.invalid_payment_method"
    ORDER_INVALID_SCHEDULE = "order.invalid_schedule"
    ORDER_INSUFFICIENT_STOCK = "order.insufficient_stock"
    ORDER_NOT_FOUND = "order.not_found"
    ORDER_STATUS_INVALID = "order.status_invalid"

    ADMIN_ACCESS_REQUIRED = "admin.access_required"
    ADMIN_PROJECT_ADMIN_REQUIRED = "admin.project_admin_required"
    ADMIN_CITY_NOT_FOUND = "admin.city_not_found"
    ADMIN_LOCATION_NOT_FOUND = "admin.location_not_found"
    ADMIN_PRODUCT_NOT_FOUND = "admin.product_not_found"
    ADMIN_VARIANT_NOT_FOUND = "admin.variant_not_found"
    ADMIN_ORDER_NOT_FOUND = "admin.order_not_found"
    ADMIN_STOCK_ROW_INVALID = "admin.stock_row_invalid"
    ADMIN_PROTECTED_ASSIGNMENT = "admin.protected_assignment"

    STAFF_TG_ID_REQUIRED = "staff.tg_id_required"
    STAFF_INVALID_TG_ID = "staff.invalid_tg_id"
    STAFF_ROLE_INVALID = "staff.role_invalid"
    STAFF_ASSIGNMENT_NOT_FOUND = "staff.assignment_not_found"
    STAFF_ASSIGNMENT_DUPLICATE = "staff.assignment_duplicate"
    STAFF_LOCATION_REQUIRED = "staff.location_required"
    STAFF_LOCATION_NOT_ALLOWED = "staff.location_not_allowed"
    STAFF_CANNOT_DELETE_PROTECTED_ADMIN = "staff.cannot_delete_protected_admin"
    STAFF_PROJECT_ADMIN_REQUIRED = "staff.project_admin_required"

    SETTINGS_KEY_NOT_FOUND = "settings.key_not_found"
    SETTINGS_INVALID_VALUE = "settings.invalid_value"
    SETTINGS_PROJECT_ADMIN_REQUIRED = "settings.project_admin_required"

    PRODUCT_REQUEST_TYPE_INVALID = "product_request.type_invalid"
    PRODUCT_REQUEST_SOURCE_INVALID = "product_request.source_invalid"
    PRODUCT_REQUEST_PERMISSION_DENIED = "product_request.permission_denied"
    PRODUCT_REQUEST_REVIEW_PERMISSION_DENIED = "product_request.review_permission_denied"
    PRODUCT_REQUEST_NOT_FOUND = "product_request.not_found"
    PRODUCT_REQUEST_STATUS_INVALID = "product_request.status_invalid"
    PRODUCT_REQUEST_TRANSITION_INVALID = "product_request.transition_invalid"
    PRODUCT_REQUEST_LOCK_REQUIRED = "product_request.lock_required"
    PRODUCT_REQUEST_LOCK_EXISTS = "product_request.lock_exists"
    PRODUCT_REQUEST_LOCK_NOT_OWNER = "product_request.lock_not_owner"
    PRODUCT_REQUEST_LOCK_NOT_ALLOWED_FOR_STATUS = "product_request.lock_not_allowed_for_status"
    PRODUCT_REQUEST_EDIT_LOCKED = "product_request.edit_locked"
    PRODUCT_REQUEST_PRODUCT_REQUIRED = "product_request.product_required"
    PRODUCT_REQUEST_PRODUCT_NOT_FOUND = "product_request.product_not_found"
    PRODUCT_REQUEST_VARIANT_REQUIRED = "product_request.variant_required"
    PRODUCT_REQUEST_VARIANT_NOT_FOUND = "product_request.variant_not_found"
    PRODUCT_REQUEST_DUPLICATE_VARIANT = "product_request.duplicate_variant"
    PRODUCT_REQUEST_VARIANT_NAME_REQUIRED = "product_request.variant_name_required"
    PRODUCT_REQUEST_QUANTITY_INVALID = "product_request.quantity_invalid"
    PRODUCT_REQUEST_PRICE_INVALID = "product_request.price_invalid"
    PRODUCT_REQUEST_LOCATION_REQUIRED = "product_request.location_required"
    PRODUCT_REQUEST_LOCATION_FORBIDDEN = "product_request.location_forbidden"
    PRODUCT_REQUEST_INPOST_INACTIVE = "product_request.inpost_inactive"
    PRODUCT_REQUEST_RESUBMIT_NOT_ALLOWED = "product_request.resubmit_not_allowed"
    PRODUCT_REQUEST_CANCEL_NOT_ALLOWED = "product_request.cancel_not_allowed"
    PRODUCT_REQUEST_APPROVAL_FAILED = "product_request.approval_failed"

    MEDIA_FILE_TOO_LARGE = "media.file_too_large"
    MEDIA_UNSUPPORTED_TYPE = "media.unsupported_type"
    MEDIA_INVALID_IMAGE = "media.invalid_image"
    MEDIA_OPTIMIZATION_FAILED = "media.optimization_failed"
    MEDIA_STORAGE_FAILED = "media.storage_failed"
    MEDIA_DELETE_FAILED = "media.delete_failed"

    COMMON_BAD_REQUEST = "common.bad_request"
    COMMON_NOT_FOUND = "common.not_found"
    COMMON_METHOD_NOT_ALLOWED = "common.method_not_allowed"
    COMMON_CONFLICT = "common.conflict"
    COMMON_INTERNAL_ERROR = "common.internal_error"
    COMMON_NOT_IMPLEMENTED = "common.not_implemented"
    COMMON_SERVICE_UNAVAILABLE = "common.service_unavailable"


HTTP_STATUS_FALLBACKS = {
    400: (ErrorCode.COMMON_BAD_REQUEST, "Bad request"),
    401: (ErrorCode.AUTH_NOT_AUTHENTICATED, "Not authenticated"),
    403: (ErrorCode.ADMIN_ACCESS_REQUIRED, "Access required"),
    404: (ErrorCode.COMMON_NOT_FOUND, "Not found"),
    405: (ErrorCode.COMMON_METHOD_NOT_ALLOWED, "Method not allowed"),
    409: (ErrorCode.COMMON_CONFLICT, "Conflict"),
    422: (ErrorCode.VALIDATION_FAILED, "Validation failed"),
    501: (ErrorCode.COMMON_NOT_IMPLEMENTED, "Not implemented"),
    503: (ErrorCode.COMMON_SERVICE_UNAVAILABLE, "Service unavailable"),
}


@dataclass
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)


def safe_details(details: dict[str, Any] | None = None) -> dict[str, Any]:
    if not details:
        return {}
    return {key: value for key, value in details.items() if key in SAFE_DETAIL_KEYS}


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"code": code, "message": message, "details": safe_details(details)}


def api_error(
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> ApiError:
    return ApiError(status_code=status_code, code=code, message=message, details=safe_details(details))


def _validation_code(error_type: str) -> str:
    if "missing" in error_type:
        return ErrorCode.VALIDATION_REQUIRED
    if "enum" in error_type or "literal_error" in error_type:
        return ErrorCode.VALIDATION_INVALID_ENUM
    if "string_too_short" in error_type:
        return ErrorCode.VALIDATION_TOO_SHORT
    if "string_too_long" in error_type:
        return ErrorCode.VALIDATION_TOO_LONG
    if "greater_than_equal" in error_type:
        return ErrorCode.VALIDATION_MIN_VALUE
    if "less_than_equal" in error_type:
        return ErrorCode.VALIDATION_MAX_VALUE
    if "int_parsing" in error_type or "float_parsing" in error_type or "decimal_parsing" in error_type:
        return ErrorCode.VALIDATION_INVALID_TYPE
    return ErrorCode.VALIDATION_INVALID_TYPE


def _field_name(loc: tuple[Any, ...] | list[Any]) -> str:
    parts = [str(part) for part in loc if part not in {"body", "query", "path", "header"}]
    return ".".join(parts) if parts else "request"


async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.details),
    )


async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    fallback = HTTP_STATUS_FALLBACKS.get(exc.status_code)
    status_code = exc.status_code if fallback else 500
    code, message = fallback or (ErrorCode.COMMON_INTERNAL_ERROR, "Internal server error")
    return JSONResponse(
        status_code=status_code,
        content=error_body(code, message, {}),
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    fields = []
    for error in exc.errors():
        error_type = str(error.get("type", ""))
        fields.append(
            {
                "field": _field_name(error.get("loc", [])),
                "code": _validation_code(error_type),
                "params": {},
            }
        )
    return JSONResponse(
        status_code=422,
        content=error_body(ErrorCode.VALIDATION_FAILED, "Validation failed", {"fields": fields}),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=error_body(ErrorCode.COMMON_INTERNAL_ERROR, "Internal server error", {}),
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
