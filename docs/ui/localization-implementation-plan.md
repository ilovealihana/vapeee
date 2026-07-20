# UI Localization and API Error Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Russian UI localization infrastructure across the customer Mini App and admin panel, persist user language preference, and standardize backend API errors as `{ code, message, details }`.

**Architecture:** Backend owns stable technical error codes and user language persistence; frontend owns all user-facing copy through a lightweight project i18n layer. The first slice ships only the `ru` dictionary while preserving visible disabled future language options for `en`, `pl` and `uk`.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, unittest, React, Vite, TypeScript, Zustand, Node test runner.

**Repo rule:** Do not commit from this plan unless the user explicitly asks. The checklist uses verification steps instead of commit steps.

---

## File Structure

### Preflight

- Read-only baseline:
  - `git status --short`
  - `git branch --show-current`
  - `git diff --stat`
- Rules:
  - do not revert existing user/generated changes;
  - do not delete unrelated files;
  - keep implementation scoped to listed files unless a test proves another file is required;
  - do not commit unless the user explicitly asks.

### Backend

- Create `webapp/errors.py`
  - Defines `ApiError`, `FieldError`, `api_error()`, `validation_error()`, FastAPI exception handlers, and Pydantic validation conversion helpers.
- Modify `webapp/main.py`
  - Registers global exception handlers.
- Modify `webapp/auth.py`
  - Replaces auth `HTTPException(detail=...)` with canonical auth errors.
- Modify `webapp/deps.py`
  - Replaces auth/admin dependency errors with canonical auth/admin errors.
- Modify `webapp/routes/user.py`
  - Uses canonical auth helper and returns/persists `language_code`.
- Modify `webapp/routes/auth.py`
  - Removes dead 501 endpoints or converts their errors to canonical responses if kept.
- Modify `webapp/routes/catalog.py`
  - Converts not-found/unavailable errors to canonical catalog errors.
- Modify `webapp/routes/cart.py`
  - Converts cart errors to canonical cart errors and shares auth helper.
- Modify `webapp/routes/orders.py`
  - Converts order errors to canonical order errors.
- Modify `webapp/routes/admin.py`
  - Converts admin CRUD and permission errors to canonical admin errors.
- Modify `webapp/schemas.py`
  - Adds `language_code` to user responses, accepts `ru/en/pl/uk`, and uses Pydantic constraints where useful.
- Modify `db/models/user.py`
  - Keep existing `language` column for storage unless a migration is strictly required; expose it as `language_code` at API layer.
- Modify `db/repositories/user.py`
  - Ensure `set_language` accepts `ru/en/pl/uk` and returns persisted user.
- Test `tests/test_api_errors.py`
  - Covers canonical error envelope and validation envelope.
- Test `tests/test_user_language.py`
  - Covers `language_code` response and accepted/rejected language codes.

### Frontend

- Create `frontend/src/i18n/locales/ru.ts`
  - Complete Russian dictionary for customer UI, admin UI, errors, validation and labels.
- Create `frontend/src/i18n/index.ts`
  - Exposes supported language metadata, active dictionary resolution, `translate()`, `useI18n()`, localStorage helpers and missing-key behavior.
- Modify `frontend/src/api/client.ts`
  - Adds typed `ApiErrorResponse`, `ApiClientError`, canonical error parsing, and `language_code` user shape.
- Modify `frontend/src/api/admin.ts`
  - Reuses the same canonical error parser or imports a shared helper from `frontend/src/api/errors.ts`.
- Create `frontend/src/api/errors.ts`
  - Shared fetch error parser and `getErrorCode()` helpers.
- Modify `frontend/src/store/user.ts`
  - Resolves language source priority: backend profile, localStorage, Telegram language, fallback `ru`.
- Modify customer pages/components:
  - `frontend/src/pages/Home.tsx`
  - `frontend/src/pages/Cities.tsx`
  - `frontend/src/pages/Locations.tsx`
  - `frontend/src/pages/Products.tsx`
  - `frontend/src/pages/ProductDetail.tsx`
  - `frontend/src/pages/Cart.tsx`
  - `frontend/src/pages/Checkout.tsx`
  - `frontend/src/pages/Profile.tsx`
  - `frontend/src/pages/OrderSuccess.tsx`
  - `frontend/src/components/BottomNav.tsx`
  - `frontend/src/components/CopiedBottomNav.tsx`
  - `frontend/src/components/CopiedPageTitle.tsx`
  - `frontend/src/components/CopiedTopBar.tsx`
  - `frontend/src/components/ProductCard.tsx`
- Modify admin pages/components:
  - `frontend/src/pages/admin/AdminLayout.tsx`
  - `frontend/src/pages/admin/AdminUI.tsx`
  - `frontend/src/pages/admin/AdminCities.tsx`
  - `frontend/src/pages/admin/AdminProducts.tsx`
  - `frontend/src/pages/admin/AdminStock.tsx`
  - `frontend/src/pages/admin/AdminOrders.tsx`
- Create `frontend/tests/i18n.test.mjs`
  - Static/source-level tests for dictionary behavior.
- Create `frontend/tests/i18n.runtime.test.mjs`
  - Runtime tests for `translate()`, missing keys and language resolution.
- Create `frontend/tests/apiErrors.test.mjs`
  - Static/source-level tests for canonical error parser.
- Create `frontend/tests/apiErrors.runtime.test.mjs`
  - Runtime tests for `parseApiError()`, `ApiClientError`, unknown-code fallback helpers and validation field details.
- Modify `frontend/tests/profileSurface.test.mjs`
  - Updates assertions for `RU/EN/PL/UK`, only `RU` enabled.
- Create `frontend/scripts/check-hardcoded-ui.mjs`
  - Lightweight static scan for obvious visible hardcoded strings.
- Modify `frontend/package.json`
  - Adds `check:ui-strings` and a `test` script if absent.

### Documentation

- Modify `docs/ui/localization.md` only if implementation discovers a necessary spec correction.
- Modify `docs/backend/error-handling.md` only if implementation discovers a missing code required by current endpoints.

---

## Task 0: Preflight and Dirty Worktree Guard

**Files:**
- Read only: repository status and diff.

- [ ] **Step 1: Record current branch and status**

Run:

```powershell
git branch --show-current
git status --short
git diff --stat
```

Expected:

- current branch is reported;
- dirty worktree is expected;
- no files are reverted or deleted.

- [ ] **Step 2: Confirm scoped write set**

Before editing, compare intended files against the File Structure section. If a required file is outside the listed write set, add a short note to the implementation summary explaining why it was necessary.

- [ ] **Step 3: Capture per-target baselines before edits**

For every target file that already exists, record a local baseline before editing:

```powershell
git diff -- <target-file>
```

Expected:

- if the file is already modified, read the current content before patching it;
- do not replace whole files from snippets when the file already has unrelated UI/Stage 1 changes;
- preserve existing untracked files and generated UI work.

- [ ] **Step 4: Sequence shared write sets**

Do not dispatch parallel implementers that write the same shared files. These files must be edited sequentially:

- `frontend/src/i18n/locales/ru.ts`;
- `frontend/package.json`;
- `frontend/src/api/client.ts`;
- `frontend/src/api/admin.ts`;
- `frontend/src/api/errors.ts`;
- `frontend/src/store/user.ts`;
- existing frontend tests under `frontend/tests`.

- [ ] **Step 5: Protect existing changes**

Do not run destructive commands such as:

```powershell
git reset --hard
git checkout -- .
git clean -fd
```

Expected: existing Stage 1/UI changes remain intact.

---

## Task 1: Backend Error Infrastructure

**Files:**
- Create: `webapp/errors.py`
- Modify: `webapp/main.py`
- Test: `tests/test_api_errors.py`

- [ ] **Step 1: Write failing backend error tests**

Create `tests/test_api_errors.py`:

```python
import unittest

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from webapp.errors import ApiError, ErrorCode, register_error_handlers


class Payload(BaseModel):
    quantity: int


def build_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/api-error")
    async def api_error_route():
        raise ApiError(status_code=404, code=ErrorCode.CART_ITEM_NOT_FOUND, message="Cart item not found")

    @app.get("/unexpected")
    async def unexpected_route():
        raise RuntimeError("database password must not leak")

    @app.get("/legacy-http")
    async def legacy_http_route():
        raise HTTPException(status_code=404, detail="Legacy text")

    @app.post("/validation")
    async def validation_route(payload: Payload):
        return payload

    return app


class ApiErrorEnvelopeTest(unittest.TestCase):
    def test_api_error_uses_canonical_envelope(self):
        response = TestClient(build_app()).get("/api-error")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {"code": "cart.item_not_found", "message": "Cart item not found", "details": {}},
        )

    def test_validation_errors_use_field_envelope(self):
        response = TestClient(build_app()).post("/validation", json={"quantity": "bad"})

        self.assertEqual(response.status_code, 422)
        body = response.json()
        self.assertEqual(body["code"], "validation.failed")
        self.assertEqual(body["message"], "Validation failed")
        self.assertIn("fields", body["details"])
        self.assertEqual(body["details"]["fields"][0]["field"], "quantity")
        self.assertTrue(body["details"]["fields"][0]["code"].startswith("validation."))

    def test_unexpected_errors_use_safe_internal_error(self):
        client = TestClient(build_app(), raise_server_exceptions=False)
        response = client.get("/unexpected")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json(),
            {"code": "common.internal_error", "message": "Internal server error", "details": {}},
        )
        self.assertNotIn("password", response.text)

    def test_legacy_http_exception_uses_known_common_code(self):
        response = TestClient(build_app()).get("/legacy-http")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"code": "common.not_found", "message": "Not found", "details": {}})

    def test_error_code_constants_cover_documented_catalog(self):
        from pathlib import Path
        import re

        docs = Path("docs/backend/error-handling.md").read_text(encoding="utf-8")
        documented = set(re.findall(r"\|\s*`([a-z_]+(?:\.[a-z_]+)+)`\s*\|", docs))
        constants = {
            value
            for name, value in vars(ErrorCode).items()
            if name.isupper() and isinstance(value, str)
        }

        self.assertEqual(documented - constants, set())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
python -m unittest tests.test_api_errors -v
```

Expected: FAIL because `webapp.errors` does not exist.

- [ ] **Step 3: Implement `webapp/errors.py`**

Create `webapp/errors.py`:

```python
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


logger = logging.getLogger(__name__)
SAFE_DETAIL_KEYS = {"field", "fields", "min", "max", "allowed", "available", "requested"}


class ErrorCode:
    # Keep synchronized one-to-one with docs/backend/error-handling.md.
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


def api_error(status_code: int, code: str, message: str, details: dict[str, Any] | None = None) -> ApiError:
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


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    fallback = HTTP_STATUS_FALLBACKS.get(exc.status_code)
    status_code = exc.status_code if fallback else 500
    code, message = fallback or (ErrorCode.COMMON_INTERNAL_ERROR, "Internal server error")
    return JSONResponse(
        status_code=status_code,
        content=error_body(code, message, {}),
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
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
```

- [ ] **Step 4: Register handlers in `webapp/main.py`**

Add import:

```python
from webapp.errors import register_error_handlers
```

After app creation, before routers:

```python
register_error_handlers(app)
```

- [ ] **Step 5: Verify backend error infrastructure**

Run:

```powershell
python -m unittest tests.test_api_errors -v
```

Expected: PASS.

---

## Task 2: User Language Profile Contract

**Files:**
- Modify: `webapp/schemas.py`
- Modify: `webapp/routes/user.py`
- Modify: `db/repositories/user.py`
- Test: `tests/test_user_language.py`

- [ ] **Step 1: Inspect existing user repository**

Run:

```powershell
Get-Content -LiteralPath 'db\repositories\user.py' -Encoding UTF8
```

Expected: repository has `upsert`, `get_by_tg_id`, and `set_language` or equivalent methods.

- [ ] **Step 2: Write failing language tests**

Create `tests/test_user_language.py`:

```python
from datetime import datetime, timezone
import unittest

from pydantic import ValidationError

from db.models.user import User
from webapp.schemas import SetLanguageRequest, UserSchema


class UserLanguageSchemaTest(unittest.TestCase):
    def test_user_schema_exposes_language_code_from_existing_language_column(self):
        user = User(
            id=1,
            tg_id=123,
            username="tester",
            first_name="Tester",
            last_name=None,
            language="en",
            phone=None,
            email=None,
            created_at=datetime.now(timezone.utc),
        )

        schema = UserSchema.model_validate(user)

        self.assertEqual(schema.language_code, "en")
        self.assertNotIn("language", schema.model_dump())

    def test_language_request_accepts_future_supported_codes(self):
        for code in ("ru", "en", "pl", "uk"):
            self.assertEqual(SetLanguageRequest(language_code=code).language_code, code)

    def test_language_request_rejects_unknown_code(self):
        with self.assertRaises(ValidationError):
            SetLanguageRequest(language_code="de")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run failing language tests**

Run:

```powershell
python -m unittest tests.test_user_language -v
```

Expected: FAIL because `language_code` is not exposed yet and `en` is rejected.

- [ ] **Step 4: Update `webapp/schemas.py` user language fields**

In `webapp/schemas.py`, import `Field`:

```python
from pydantic import BaseModel, Field, field_validator
```

In `UserSchema`, replace `language: str` with this exact field. This is the required compatibility contract because the database column remains `User.language`, while the API response field becomes `language_code`:

```python
language_code: str = Field(validation_alias="language")
```

Keep response JSON field as `language_code`; do not expose `language` in new API responses.

Update `SetLanguageRequest` to:

```python
class SetLanguageRequest(BaseModel):
    language_code: str

    @field_validator("language_code")
    @classmethod
    def validate_language_code(cls, value: str) -> str:
        if value not in ("ru", "en", "pl", "uk"):
            raise ValueError("language_code must be ru, en, pl or uk")
        return value
```

- [ ] **Step 5: Update `webapp/routes/user.py` language setter**

Change:

```python
await repo.set_language(user.tg_id, body.language)
```

to:

```python
await repo.set_language(user.tg_id, body.language_code)
```

- [ ] **Step 6: Update `db/repositories/user.py` accepted values if hardcoded**

If `set_language` validates values, include `"en"`:

```python
if language_code not in {"ru", "en", "pl", "uk"}:
    raise api_error(422, ErrorCode.USER_INVALID_LANGUAGE, "Invalid language")
```

If repository does not validate, leave validation in schema.

- [ ] **Step 7: Verify language tests and imports**

Run:

```powershell
python -m unittest tests.test_user_language tests.test_backend_import -v
```

Expected: PASS.

---

## Task 3: Convert Backend Routes to Canonical Errors

**Files:**
- Modify: `webapp/auth.py`
- Modify: `webapp/deps.py`
- Modify: `webapp/routes/auth.py`
- Modify: `webapp/routes/catalog.py`
- Modify: `webapp/routes/cart.py`
- Modify: `webapp/routes/orders.py`
- Modify: `webapp/routes/admin.py`
- Test: `tests/test_api_errors.py`

- [ ] **Step 1: Extend backend error tests with route-level runtime checks**

Append to `tests/test_api_errors.py`:

```python
from fastapi import status

from webapp.errors import ErrorCode, api_error, register_error_handlers


class RouteErrorFactoryTest(unittest.TestCase):
    def test_api_error_factory_preserves_safe_details(self):
        exc = api_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.CART_INSUFFICIENT_STOCK,
            "Insufficient stock",
            {"field": "quantity", "available": 2},
        )

        self.assertEqual(exc.status_code, 409)
        self.assertEqual(exc.code, ErrorCode.CART_INSUFFICIENT_STOCK)
        self.assertEqual(exc.details, {"field": "quantity", "available": 2})

    def test_api_error_factory_drops_unsafe_detail_keys(self):
        exc = api_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.COMMON_INTERNAL_ERROR,
            "Internal server error",
            {
                "field": "quantity",
                "stack": "traceback",
                "sql": "select * from users",
                "token": "secret",
                "path": "C:/secret/file.py",
            },
        )

        self.assertEqual(exc.details, {"field": "quantity"})


class RuntimeRouteErrorEnvelopeTest(unittest.TestCase):
    def test_missing_authorization_uses_auth_code(self):
        from webapp.main import app

        response = TestClient(app).get("/api/cart")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["code"], ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER)

    def test_admin_permission_uses_admin_code_with_isolated_dependencies(self):
        from fastapi import FastAPI

        app = FastAPI()
        register_error_handlers(app)

        @app.get("/admin-only")
        async def admin_only():
            raise api_error(status.HTTP_403_FORBIDDEN, ErrorCode.ADMIN_ACCESS_REQUIRED, "Admin access required")

        response = TestClient(app).get("/admin-only")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], ErrorCode.ADMIN_ACCESS_REQUIRED)

    def test_representative_domain_route_codes_are_declared(self):
        self.assertEqual(ErrorCode.CATALOG_PRODUCT_NOT_FOUND, "catalog.product_not_found")
        self.assertEqual(ErrorCode.CATALOG_LOCATION_NOT_FOUND, "catalog.location_not_found")
        self.assertEqual(ErrorCode.CART_INSUFFICIENT_STOCK, "cart.insufficient_stock")
        self.assertEqual(ErrorCode.ORDER_CART_EMPTY, "order.cart_empty")
        self.assertEqual(ErrorCode.ADMIN_PRODUCT_NOT_FOUND, "admin.product_not_found")

    def test_migrated_routes_do_not_keep_legacy_http_exception_detail_contract(self):
        from pathlib import Path

        files = [
            "webapp/auth.py",
            "webapp/deps.py",
            "webapp/routes/auth.py",
            "webapp/routes/catalog.py",
            "webapp/routes/cart.py",
            "webapp/routes/orders.py",
            "webapp/routes/admin.py",
        ]

        offenders = []
        for file in files:
            source = Path(file).read_text(encoding="utf-8")
            if "HTTPException(" in source or "detail=" in source:
                offenders.append(file)

        self.assertEqual(offenders, [])
```

Runtime route tests that touch database-backed catalog/cart/order/admin paths must be deterministic:

- do not call real Postgres-backed `webapp.main.app` for DB not-found tests;
- either override `webapp.deps.get_session` with a seeded in-memory SQLite session, or mock the route repository methods directly;
- clear `app.dependency_overrides` in `tearDown`/`addCleanup`;
- keep at least one real dependency test for missing Authorization returning HTTP 401 and `auth.invalid_authorization_header`;
- cover representative domain codes for auth/admin/catalog/cart/order either through isolated route calls or constants plus static route migration checks.

- [ ] **Step 2: Run tests**

Run:

```powershell
python -m unittest tests.test_api_errors -v
```

Expected before route edits: missing Authorization and static migration tests FAIL because dependencies/routes still return legacy FastAPI envelopes. Helper factory tests should PASS after Task 1.

- [ ] **Step 3: Replace auth errors**

In `webapp/auth.py`, import:

```python
from webapp.errors import ErrorCode, api_error
```

Replace each `HTTPException` with:

```python
raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.AUTH_INVALID_INIT_DATA_FORMAT, "Invalid initData format")
raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.AUTH_MISSING_HASH, "Missing hash")
raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.AUTH_INVALID_SIGNATURE, "Invalid signature")
raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.AUTH_MISSING_USER, "Missing user")
raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.AUTH_INVALID_USER_JSON, "Invalid user JSON")
```

- [ ] **Step 4: Replace dependency errors**

In `webapp/deps.py`, import:

```python
from webapp.errors import ErrorCode, api_error
```

Change protected dependency signatures so a missing Authorization header reaches our canonical auth code instead of FastAPI's automatic 422 validation:

```python
async def get_current_user(
    authorization: str | None = Header(None, description="tma <initData>"),
    session: AsyncSession = None,
) -> User:
    if not authorization or not authorization.startswith("tma "):
        raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER, "Invalid authorization header")
```

Apply the same optional-header pattern to every dependency wrapper that accepts `authorization`, including `get_user_with_session`, `get_admin_user`, and `get_admin_user_with_session`.

Replace auth/admin dependency errors with:

```python
raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.AUTH_INVALID_AUTHORIZATION_HEADER, "Invalid authorization header")
raise api_error(status.HTTP_401_UNAUTHORIZED, ErrorCode.AUTH_MISSING_USER_ID, "Missing user id")
raise api_error(status.HTTP_403_FORBIDDEN, ErrorCode.ADMIN_ACCESS_REQUIRED, "Admin access required")
```

- [ ] **Step 5: Clean `webapp/routes/auth.py` legacy endpoints**

`webapp/routes/auth.py` currently contains dead `/me` and `/language` endpoints that return `501` with legacy `detail` text. Remove those duplicate endpoints entirely because the active contract is:

- `POST /api/auth` for login;
- `GET /api/user/me` for profile;
- `PATCH /api/user/language` for language.

If keeping a compatibility endpoint becomes necessary, it must raise:

```python
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.COMMON_NOT_FOUND, "Not found")
```

Do not leave `HTTPException(..., detail=...)` in migrated route files.

- [ ] **Step 6: Replace catalog route errors**

In `webapp/routes/catalog.py`, import:

```python
from fastapi import status
from webapp.errors import ErrorCode, api_error
```

Use:

```python
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.CATALOG_LOCATION_NOT_FOUND, "Location not found")
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.CATALOG_PRODUCT_NOT_FOUND, "Product not found")
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.CATALOG_PRODUCT_UNAVAILABLE, "Product unavailable")
```

- [ ] **Step 7: Replace cart route errors**

In `webapp/routes/cart.py`, import:

```python
from fastapi import status
from webapp.errors import ErrorCode, api_error
```

Use:

```python
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.CART_NOT_FOUND, "Cart not found")
```

For invalid quantities, rely on validation envelope first. If repository can accept invalid quantities, add route guard:

```python
if body.quantity < 1:
    raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, ErrorCode.CART_INVALID_QUANTITY, "Invalid quantity", {"field": "quantity", "min": 1})
```

- [ ] **Step 8: Replace order route errors**

In `webapp/routes/orders.py`, import:

```python
from fastapi import status
from webapp.errors import ErrorCode, api_error
```

Use:

```python
raise api_error(status.HTTP_400_BAD_REQUEST, ErrorCode.ORDER_CART_EMPTY, "Cart is empty")
raise api_error(status.HTTP_400_BAD_REQUEST, ErrorCode.ORDER_LOCATION_REQUIRED, "Location is required")
```

If scheduled date/time is invalid and currently becomes `None`, keep current behavior unless tests establish rejection. Do not add unapproved business behavior.

- [ ] **Step 9: Replace admin route errors**

In `webapp/routes/admin.py`, import:

```python
from fastapi import status
from webapp.errors import ErrorCode, api_error
```

Use:

```python
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.ADMIN_CITY_NOT_FOUND, "City not found")
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.ADMIN_LOCATION_NOT_FOUND, "Location not found")
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.ADMIN_PRODUCT_NOT_FOUND, "Product not found")
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.ADMIN_VARIANT_NOT_FOUND, "Variant not found")
raise api_error(status.HTTP_404_NOT_FOUND, ErrorCode.ADMIN_ORDER_NOT_FOUND, "Order not found")
```

- [ ] **Step 10: Verify backend suite**

Run:

```powershell
python -m unittest discover -s tests -v
```

Expected: all tests PASS.

---

## Task 4: Frontend API Error Parser

**Files:**
- Create: `frontend/src/api/errors.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/admin.ts`
- Create: `frontend/tests/apiErrors.test.mjs`
- Create: `frontend/tests/apiErrors.runtime.test.mjs`
- Modify: `frontend/package.json`

- [ ] **Step 1: Add frontend test script before new frontend tests**

In `frontend/package.json`, update scripts now, before adding new tests:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "node --test tests/*.test.mjs"
}
```

The backend implementation must complete `ErrorCode` with every code from `docs/backend/error-handling.md`. The `ru.errors` coverage guard belongs to Task 5 after `frontend/src/i18n/locales/ru.ts` exists.

- [ ] **Step 2: Write source-level test for shared parser**

Create `frontend/tests/apiErrors.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const errorsSource = readFileSync(new URL('../src/api/errors.ts', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../src/api/admin.ts', import.meta.url), 'utf8');

test('api errors module exposes canonical ApiClientError parser', () => {
  assert.match(errorsSource, /export class ApiClientError extends Error/);
  assert.match(errorsSource, /code: string/);
  assert.match(errorsSource, /details: Record<string, unknown>/);
  assert.match(errorsSource, /parseApiError/);
  assert.match(errorsSource, /formatApiError/);
  assert.match(errorsSource, /formatValidationFieldErrors/);
  assert.match(errorsSource, /common\.internal_error/);
});

test('customer and admin clients use shared api error parser', () => {
  assert.match(clientSource, /parseApiError/);
  assert.match(adminSource, /parseApiError/);
  assert.doesNotMatch(clientSource, /throw new Error\(err\.detail/);
  assert.doesNotMatch(adminSource, /throw new Error\(err\.detail/);
});
```

- [ ] **Step 3: Write runtime parser test**

Create `frontend/tests/apiErrors.runtime.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  ApiClientError,
  parseApiError,
  formatApiError,
  formatValidationFieldErrors,
} = await import('../src/api/errors.ts');

const t = (key) => ({
  'errors.cart.item_not_found': 'Товар не найден в корзине.',
  'errors.common.internal_error': 'Не удалось выполнить действие. Попробуйте еще раз.',
  'validation.required': 'Заполните поле.',
  'validation.min_value': 'Минимальное значение: {min}.',
}[key] || key);

test('parseApiError reads canonical envelope', async () => {
  const error = await parseApiError(new Response(JSON.stringify({
    code: 'cart.item_not_found',
    message: 'Cart item not found',
    details: {},
  }), { status: 404, headers: { 'content-type': 'application/json' } }));

  assert.equal(error instanceof ApiClientError, true);
  assert.equal(error.code, 'cart.item_not_found');
  assert.equal(formatApiError(error, t), 'Товар не найден в корзине.');
});

test('unknown code formats as generic localized error', () => {
  const error = new ApiClientError(500, 'unknown.code', 'Unknown', {});
  assert.equal(formatApiError(error, t), 'Не удалось выполнить действие. Попробуйте еще раз.');
});

test('validation field details are localized for forms and keep params', () => {
  const error = new ApiClientError(422, 'validation.failed', 'Validation failed', {
    fields: [
      { field: 'customer_phone', code: 'validation.required', params: {} },
      { field: 'quantity', code: 'validation.min_value', params: { min: 1 } },
    ],
  });

  assert.deepEqual(formatValidationFieldErrors(error, t), {
    customer_phone: 'Заполните поле.',
    quantity: 'Минимальное значение: 1.',
  });
});
```

- [ ] **Step 4: Run failing parser tests**

Run:

```powershell
cd frontend
npm test
```

Expected: FAIL because `src/api/errors.ts` does not exist.

- [ ] **Step 5: Create `frontend/src/api/errors.ts`**

Create:

```ts
export type ApiErrorDetails = Record<string, unknown>;

export type ApiErrorResponse = {
  code?: string;
  message?: string;
  details?: ApiErrorDetails;
  detail?: unknown;
};

export class ApiClientError extends Error {
  code: string;
  details: ApiErrorDetails;
  status: number;

  constructor(status: number, code: string, message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type Translator = (key: string) => string;

export async function parseApiError(response: Response): Promise<ApiClientError> {
  const payload = await response.json().catch(() => null) as ApiErrorResponse | null;
  if (payload?.code) {
    return new ApiClientError(
      response.status,
      payload.code,
      payload.message || payload.code,
      payload.details || {},
    );
  }
  return new ApiClientError(
    response.status,
    'common.internal_error',
    typeof payload?.detail === 'string' ? payload.detail : `HTTP ${response.status}`,
    {},
  );
}

export function getErrorCode(error: unknown): string {
  return error instanceof ApiClientError ? error.code : 'common.internal_error';
}

export function formatApiError(error: unknown, t: Translator): string {
  const code = getErrorCode(error);
  const key = `errors.${code}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return t('errors.common.internal_error');
}

function interpolate(template: string, params: Record<string, unknown>): string {
  return Object.entries(params).reduce(
    (value, [key, param]) => value.replaceAll(`{${key}}`, String(param)),
    template,
  );
}

export function formatValidationFieldErrors(error: unknown, t: Translator): Record<string, string> {
  if (!(error instanceof ApiClientError) || error.code !== 'validation.failed') return {};
  const fields = Array.isArray(error.details.fields) ? error.details.fields : [];
  return fields.reduce<Record<string, string>>((acc, item) => {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { field?: unknown }).field === 'string' &&
      typeof (item as { code?: unknown }).code === 'string'
    ) {
      const field = (item as { field: string }).field;
      const code = (item as { code: string }).code;
      const params = ((item as { params?: unknown }).params || {}) as Record<string, unknown>;
      const key = code.startsWith('validation.') ? code : `validation.${code}`;
      const translated = t(key);
      acc[field] = interpolate(translated === key ? t('errors.common.internal_error') : translated, params);
    }
    return acc;
  }, {});
}
```

- [ ] **Step 6: Update `frontend/src/api/client.ts`**

Import:

```ts
import { parseApiError } from './errors';
```

Replace non-ok block with:

```ts
if (!res.ok) {
  throw await parseApiError(res);
}
```

Update `User` type:

```ts
language_code: string;
```

Update language call:

```ts
setLanguage: (language_code: string) =>
  request<User>('/api/user/language', {
    method: 'PATCH',
    body: JSON.stringify({ language_code }),
  }),
```

- [ ] **Step 7: Update `frontend/src/api/admin.ts`**

Import:

```ts
import { parseApiError } from './errors';
```

Replace non-ok block with:

```ts
if (!res.ok) {
  throw await parseApiError(res);
}
```

- [ ] **Step 8: Verify parser tests**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: tests PASS and build PASS.

---

## Task 5: Frontend I18n Core

**Files:**
- Create: `frontend/src/i18n/locales/ru.ts`
- Create: `frontend/src/i18n/index.ts`
- Create: `frontend/tests/i18n.test.mjs`
- Create: `frontend/tests/i18n.runtime.test.mjs`
- Modify: `frontend/src/store/user.ts`

- [ ] **Step 1: Write i18n source-level tests**

Create `frontend/tests/i18n.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const i18nSource = readFileSync(new URL('../src/i18n/index.ts', import.meta.url), 'utf8');
const ruSource = readFileSync(new URL('../src/i18n/locales/ru.ts', import.meta.url), 'utf8');
const userStoreSource = readFileSync(new URL('../src/store/user.ts', import.meta.url), 'utf8');

test('i18n core uses project-owned translation helper and ru fallback', () => {
  assert.match(i18nSource, /export function translate/);
  assert.match(i18nSource, /export function useI18n/);
  assert.match(i18nSource, /ACTIVE_LOCALES\s*=\s*\['ru'\]/);
  assert.match(i18nSource, /return key/);
});

test('ru dictionary contains required namespaces', () => {
  for (const namespace of ['common', 'nav', 'home', 'catalog', 'cart', 'checkout', 'profile', 'admin', 'errors', 'validation']) {
    assert.match(ruSource, new RegExp(`${namespace}:\\\\s*{`));
  }
});

test('user store resolves backend language_code and local fallback', () => {
  assert.match(userStoreSource, /language_code/);
  assert.match(userStoreSource, /localStorage/);
  assert.match(userStoreSource, /resolvePreferredLanguage/);
});
```

- [ ] **Step 2: Write runtime i18n tests**

Create `frontend/tests/i18n.runtime.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  translate,
  resolveActiveLocale,
  resolvePreferredLanguage,
  isSupportedLanguage,
} = await import('../src/i18n/index.ts');

test('translate returns ru value and missing key returns the key', () => {
  assert.equal(translate('common.save'), 'Сохранить');
  assert.equal(translate('missing.key'), 'missing.key');
});

test('only ru is active in the first slice', () => {
  assert.equal(resolveActiveLocale('ru'), 'ru');
  assert.equal(resolveActiveLocale('en'), 'ru');
  assert.equal(resolveActiveLocale('pl'), 'ru');
  assert.equal(resolveActiveLocale('uk'), 'ru');
});

test('supported language accepts future codes', () => {
  for (const code of ['ru', 'en', 'pl', 'uk']) assert.equal(isSupportedLanguage(code), true);
  assert.equal(isSupportedLanguage('de'), false);
});

test('backend profile language has priority when supported', () => {
  globalThis.localStorage = { getItem: () => 'en', setItem: () => {} };
  globalThis.window = { Telegram: { WebApp: { initDataUnsafe: { user: { language_code: 'uk' } } } } };
  assert.equal(resolvePreferredLanguage('pl'), 'pl');
});

test('language priority falls back through localStorage, Telegram and ru', () => {
  globalThis.localStorage = { getItem: () => 'en', setItem: () => {} };
  globalThis.window = { Telegram: { WebApp: { initDataUnsafe: { user: { language_code: 'uk' } } } } };
  assert.equal(resolvePreferredLanguage(null), 'en');

  globalThis.localStorage = { getItem: () => 'de', setItem: () => {} };
  assert.equal(resolvePreferredLanguage(undefined), 'uk');

  delete globalThis.window;
  delete globalThis.localStorage;
  assert.equal(resolvePreferredLanguage(undefined), 'ru');
});

test('language helpers are safe outside browser globals', () => {
  delete globalThis.window;
  delete globalThis.localStorage;
  assert.equal(resolvePreferredLanguage(null), 'ru');
});

test('ru dictionary covers required backend error codes', () => {
  const docs = readFileSync(new URL('../../docs/backend/error-handling.md', import.meta.url), 'utf8');
  const requiredCodes = [...docs.matchAll(/\|\s*`([a-z_]+(?:\.[a-z_]+)+)`\s*\|/g)].map((match) => match[1]);

  for (const code of requiredCodes) {
    const key = `errors.${code}`;
    assert.notEqual(translate(key), key, `${key} must be translated`);
  }
});
```

- [ ] **Step 3: Run failing i18n tests**

Run:

```powershell
cd frontend
npm test
```

Expected: FAIL because `src/i18n` does not exist.

- [ ] **Step 4: Create `frontend/src/i18n/locales/ru.ts`**

Create a complete namespace object with these root keys and a full `errors` catalog. The first implementation must not leave `ru.errors` as a partial starter because `frontend/tests/i18n.runtime.test.mjs` checks every documented backend error code.

```ts
const ru = {
  common: {
    loading: 'Загрузка...',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    close: 'Закрыть',
    back: 'Назад',
    retry: 'Попробовать снова',
    genericError: 'Не удалось выполнить действие. Попробуйте еще раз.',
  },
  nav: {
    home: 'Главная',
    catalog: 'Каталог',
    cart: 'Корзина',
    profile: 'Профиль',
  },
  home: {},
  catalog: {},
  cart: {},
  checkout: {},
  profile: {},
  admin: {},
  errors: {
    common: {
      internal_error: 'Не удалось выполнить действие. Попробуйте еще раз.',
    },
    product_request: {
      permission_denied: 'Недостаточно прав для этой заявки.',
      transition_invalid: 'Нельзя изменить статус заявки из текущего состояния.',
      edit_locked: 'Заявка сейчас проверяется и недоступна для редактирования.',
      product_not_found: 'Выбранный товар не найден.',
      variant_not_found: 'Выбранный вариант не найден.',
    },
  },
  validation: {
    required: 'Заполните поле.',
    invalid_type: 'Проверьте формат значения.',
    invalid_enum: 'Выберите доступное значение.',
  },
} as const;

export default ru;
```

Before Step 7 verification, `ru.errors` must include Russian strings for every documented backend code from `docs/backend/error-handling.md`.

Required `errors` domain keys:

```text
errors.validation.failed
errors.validation.required
errors.validation.invalid_type
errors.validation.invalid_enum
errors.validation.too_short
errors.validation.too_long
errors.validation.min_value
errors.validation.max_value
errors.validation.phone_invalid
errors.validation.email_invalid
errors.auth.invalid_init_data_format
errors.auth.missing_hash
errors.auth.invalid_signature
errors.auth.missing_user
errors.auth.invalid_user_json
errors.auth.missing_user_id
errors.auth.invalid_authorization_header
errors.auth.not_authenticated
errors.user.not_found
errors.user.invalid_language
errors.user.profile_update_failed
errors.catalog.city_not_found
errors.catalog.location_not_found
errors.catalog.location_inactive
errors.catalog.category_not_found
errors.catalog.product_not_found
errors.catalog.product_unavailable
errors.catalog.variant_not_found
errors.catalog.variant_unavailable
errors.cart.not_found
errors.cart.empty
errors.cart.item_not_found
errors.cart.invalid_quantity
errors.cart.source_mismatch
errors.cart.variant_unavailable
errors.cart.insufficient_stock
errors.order.cart_empty
errors.order.location_required
errors.order.invalid_delivery_type
errors.order.invalid_payment_method
errors.order.invalid_schedule
errors.order.insufficient_stock
errors.order.not_found
errors.order.status_invalid
errors.admin.access_required
errors.admin.project_admin_required
errors.admin.city_not_found
errors.admin.location_not_found
errors.admin.product_not_found
errors.admin.variant_not_found
errors.admin.order_not_found
errors.admin.stock_row_invalid
errors.admin.protected_assignment
errors.staff.tg_id_required
errors.staff.invalid_tg_id
errors.staff.role_invalid
errors.staff.assignment_not_found
errors.staff.assignment_duplicate
errors.staff.location_required
errors.staff.location_not_allowed
errors.staff.cannot_delete_protected_admin
errors.staff.project_admin_required
errors.settings.key_not_found
errors.settings.invalid_value
errors.settings.project_admin_required
errors.product_request.type_invalid
errors.product_request.source_invalid
errors.product_request.permission_denied
errors.product_request.review_permission_denied
errors.product_request.not_found
errors.product_request.status_invalid
errors.product_request.transition_invalid
errors.product_request.lock_required
errors.product_request.lock_exists
errors.product_request.lock_not_owner
errors.product_request.lock_not_allowed_for_status
errors.product_request.edit_locked
errors.product_request.product_required
errors.product_request.product_not_found
errors.product_request.variant_required
errors.product_request.variant_not_found
errors.product_request.duplicate_variant
errors.product_request.variant_name_required
errors.product_request.quantity_invalid
errors.product_request.price_invalid
errors.product_request.location_required
errors.product_request.location_forbidden
errors.product_request.inpost_inactive
errors.product_request.resubmit_not_allowed
errors.product_request.cancel_not_allowed
errors.product_request.approval_failed
errors.media.file_too_large
errors.media.unsupported_type
errors.media.invalid_image
errors.media.optimization_failed
errors.media.storage_failed
errors.media.delete_failed
errors.common.bad_request
errors.common.not_found
errors.common.method_not_allowed
errors.common.conflict
errors.common.internal_error
errors.common.not_implemented
errors.common.service_unavailable
```

During UI migration tasks, fill non-error UI namespaces with actual Russian strings before replacing component text.

- [ ] **Step 5: Create `frontend/src/i18n/index.ts`**

Create:

```ts
import { useMemo } from 'react';
import ru from './locales/ru';

export const SUPPORTED_LANGUAGES = ['ru', 'en', 'pl', 'uk'] as const;
export const ACTIVE_LOCALES = ['ru'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export type ActiveLocale = typeof ACTIVE_LOCALES[number];

const dictionaries = { ru };
const STORAGE_KEY = 'vapeshop.language';

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export function resolveActiveLocale(value: string | null | undefined): ActiveLocale {
  return value === 'ru' ? 'ru' : 'ru';
}

export function readStoredLanguage(): SupportedLanguage | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  const value = globalThis.localStorage.getItem(STORAGE_KEY);
  return isSupportedLanguage(value) ? value : null;
}

export function storeLanguage(value: SupportedLanguage): void {
  if (typeof globalThis.localStorage !== 'undefined') globalThis.localStorage.setItem(STORAGE_KEY, value);
}

export function telegramLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  const value = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  return isSupportedLanguage(value) ? value : null;
}

export function resolvePreferredLanguage(profileLanguage?: string | null): SupportedLanguage {
  if (isSupportedLanguage(profileLanguage)) return profileLanguage;
  const stored = readStoredLanguage();
  if (stored) return stored;
  const telegram = telegramLanguage();
  if (telegram) return telegram;
  return 'ru';
}

function lookup(path: string, locale: ActiveLocale): string | undefined {
  return path.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) return (node as Record<string, unknown>)[part];
    return undefined;
  }, dictionaries[locale]) as string | undefined;
}

export function translate(key: string, locale: ActiveLocale = 'ru'): string {
  return lookup(key, locale) || key;
}

export function useI18n(locale: ActiveLocale = 'ru') {
  return useMemo(() => ({ locale, t: (key: string) => translate(key, locale) }), [locale]);
}
```

- [ ] **Step 6: Update `frontend/src/store/user.ts`**

Import:

```ts
import { resolveActiveLocale, resolvePreferredLanguage, storeLanguage, type ActiveLocale, type SupportedLanguage } from '../i18n';
```

Update state:

```ts
language: SupportedLanguage;
activeLocale: ActiveLocale;
```

In `fetchUser`, set:

```ts
const preferred = resolvePreferredLanguage(user.language_code);
set({ user, language: preferred, activeLocale: resolveActiveLocale(preferred), loading: false });
```

In `setLanguage`, allow only supported codes but UI will call only `ru` initially:

```ts
storeLanguage(lang as SupportedLanguage);
const user = await api.auth.setLanguage(lang);
const preferred = resolvePreferredLanguage(user.language_code);
set({ user, language: preferred, activeLocale: resolveActiveLocale(preferred) });
```

- [ ] **Step 7: Verify i18n tests and build**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: tests PASS and build PASS.

---

## Task 6: Profile Language UI Integration

**Files:**
- Modify: `frontend/src/pages/Profile.tsx`
- Modify: `frontend/tests/profileSurface.test.mjs`

- [ ] **Step 1: Update profile language test**

In `frontend/tests/profileSurface.test.mjs`, add:

```js
test('profile language selector shows future languages but only ru is enabled', () => {
  assert.match(profileSource, /data-profile-language-code="ru"/);
  assert.match(profileSource, /data-profile-language-code="en"/);
  assert.match(profileSource, /data-profile-language-code="pl"/);
  assert.match(profileSource, /data-profile-language-code="uk"/);
  assert.match(profileSource, /data-profile-language-code="ru"[^>]*aria-disabled="false"/);
  assert.match(profileSource, /data-profile-language-code="en"[^>]*disabled/);
  assert.match(profileSource, /data-profile-language-code="pl"[^>]*disabled/);
  assert.match(profileSource, /data-profile-language-code="uk"[^>]*disabled/);
});
```

- [ ] **Step 2: Run failing profile test**

Run:

```powershell
cd frontend
npm test
```

Expected: FAIL because `en`/`uk` and disabled states are not present.

- [ ] **Step 3: Update `Profile.tsx` language markup**

In `profileMarkup`, make four language buttons:

```html
<button class="profile-language-option is-selected" type="button" data-profile-language-code="ru" data-profile-language="Русский" role="radio" aria-checked="true" aria-disabled="false">
  <span class="profile-language-code">RU</span>
  <span>
    <strong>Русский</strong>
    <small>Текущий язык</small>
  </span>
  <span class="material-symbols-outlined">check</span>
</button>
<button class="profile-language-option is-disabled" type="button" data-profile-language-code="en" data-profile-language="English" role="radio" aria-checked="false" aria-disabled="true" disabled>
  <span class="profile-language-code">EN</span>
  <span>
    <strong>English</strong>
    <small>Скоро</small>
  </span>
  <span class="material-symbols-outlined">lock</span>
</button>
<button class="profile-language-option is-disabled" type="button" data-profile-language-code="pl" data-profile-language="Polski" role="radio" aria-checked="false" aria-disabled="true" disabled>
  <span class="profile-language-code">PL</span>
  <span>
    <strong>Polski</strong>
    <small>Скоро</small>
  </span>
  <span class="material-symbols-outlined">lock</span>
</button>
<button class="profile-language-option is-disabled" type="button" data-profile-language-code="uk" data-profile-language="Українська" role="radio" aria-checked="false" aria-disabled="true" disabled>
  <span class="profile-language-code">UK</span>
  <span>
    <strong>Українська</strong>
    <small>Скоро</small>
  </span>
  <span class="material-symbols-outlined">lock</span>
</button>
```

In language click handler, ignore disabled buttons:

```ts
if (button.disabled || button.getAttribute('aria-disabled') === 'true') return;
```

- [ ] **Step 4: Verify profile tests**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: tests PASS and build PASS.

---

## Task 7: Customer UI Text Migration

**Files:**
- Modify customer pages/components listed in File Structure
- Modify `frontend/src/i18n/locales/ru.ts`
- Modify existing source-level tests that assert old literal UI labels:
  - `frontend/tests/copiedBottomNav.test.mjs`
  - `frontend/tests/responsiveLayout.test.mjs` if it asserts visible labels/titles
  - `frontend/tests/profileSurface.test.mjs` if profile text moves to `t(...)`
- Test: existing frontend tests plus representative render/source checks and build

**Subagent work packages:**

- Task 7A raw HTML customer pages: `Home.tsx`, `Products.tsx`, `Cart.tsx`, `Profile.tsx`; convert module-level `String.raw` constants to render-time template factories.
- Task 7B React customer pages/forms: `Cities.tsx`, `Locations.tsx`, `ProductDetail.tsx`, `Checkout.tsx`, `OrderSuccess.tsx`; replace visible text and form errors.
- Task 7C shared customer components/utils: `BottomNav.tsx`, `CopiedBottomNav.tsx`, `CopiedPageTitle.tsx`, `CopiedTopBar.tsx`, `ProductCard.tsx`, `frontend/src/utils/*`; replace visible labels while preserving catalog content.

Do not run Task 7A, 7B and 7C in parallel if they all edit `frontend/src/i18n/locales/ru.ts`; either sequence them or assign one subagent to dictionary integration after page edits.

- [ ] **Step 1: Inventory customer UI strings across all frontend source**

Run:

```powershell
rg -n "([А-Яа-яЁё]{2,}|aria-label=\"[^\"]+\"|placeholder=\"[^\"]+\"|title=\"[^\"]+\"|>[A-Za-z][A-Za-z ]{2,}<)" frontend/src
```

Expected: list of hardcoded visible strings. Product names/descriptions inside copied catalog mockups may remain only if treated as catalog content.

- [ ] **Step 2: Fill `ru` dictionary customer namespaces**

Add keys for current visible customer UI:

```ts
home: {
  greeting: 'Привет, {name}!',
  searchPrompt: 'Что ищешь?',
  pickupTitle: 'Самовывоз',
  pickupDescription: 'Выбери точку в своем городе',
  deliveryTitle: 'Доставка',
  deliveryDescription: 'InPost в постомат',
  categories: 'Категории',
  allCategories: 'Все категории',
  popular: 'Популярное',
},
cart: {
  total: 'Итого',
  checkout: 'Оформить заказ',
  emptyTitle: 'Корзина пуста',
  emptyDescription: 'Добавьте товары из каталога.',
},
checkout: {
  steps: {
    delivery: 'Доставка',
    contacts: 'Контакты',
    time: 'Время',
    payment: 'Оплата',
  },
},
profile: {
  tabs: {
    profile: 'Профиль',
    orders: 'Заказы',
    language: 'Язык',
  },
},
```

Extend with every string found by inventory before replacing component markup.

- [ ] **Step 2a: Update customer source tests for translation keys**

Update tests that currently assert copied literal labels/titles so they assert translation-key usage or rendered Russian values through `translate()`:

- `frontend/tests/copiedBottomNav.test.mjs` must stop expecting hardcoded nav labels in `CopiedBottomNav`, `CopiedPageTitle`, or utils;
- `frontend/tests/responsiveLayout.test.mjs` must keep layout/responsive assertions but not require old literal UI text;
- add at least one representative customer assertion that a migrated page/component uses `t('nav.home')`, `t('cart.checkout')`, or equivalent dictionary-backed key.

- [ ] **Step 3: Replace simple TSX strings with `t()`**

For normal React markup, use:

```ts
const { t } = useI18n();
```

Then:

```tsx
<button>{t('cart.checkout')}</button>
```

- [ ] **Step 4: Replace copied raw HTML strings with render-time template factories**

For pages using `String.raw`, do not translate at module import time. Convert module-level constants to render-time factories:

```ts
function buildHomeMarkup(t: (key: string) => string) {
  return String.raw`
    <h2>${t('home.greeting').replace('{name}', 'paranoia')}</h2>
  `;
}
```

In the component:

```ts
const { activeLocale } = useUserStore();
const { t } = useI18n(activeLocale);
const markup = useMemo(() => buildHomeMarkup(t), [t]);
```

Render:

```tsx
<div dangerouslySetInnerHTML={{ __html: markup }} />
```

Do not translate product names, variant names, prices or image alt prompt data that represent catalog/content data.

- [ ] **Step 5: Add API error UI mapping where customer forms show errors**

For `Checkout.tsx` and other customer form screens, replace raw `e.message` display with:

```ts
import { formatApiError, formatValidationFieldErrors } from '../api/errors';
import { useI18n } from '../i18n';

const { activeLocale } = useUserStore();
const { t } = useI18n(activeLocale);

catch (error) {
  setError(formatApiError(error, t));
  setFieldErrors(formatValidationFieldErrors(error, t));
}
```

- [ ] **Step 6: Verify customer UI**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: tests PASS and build PASS.

Representative customer test expectation: at least one test proves customer UI labels come from `ru` dictionary values instead of old inline literals.

---

## Task 8: Admin UI Text Migration

**Files:**
- Modify admin pages/components listed in File Structure
- Modify `frontend/src/i18n/locales/ru.ts`
- Modify: `frontend/tests/adminCms.test.mjs`
- Modify: other existing frontend tests if they assert admin visible literals

**Subagent work packages:**

- Task 8A admin layout/shared UI: `AdminLayout.tsx`, `AdminUI.tsx`, admin access state and shared modal/default labels.
- Task 8B admin CRUD pages: `AdminCities.tsx`, `AdminProducts.tsx`; labels, forms, confirmations and API error messages.
- Task 8C admin stock/orders pages: `AdminStock.tsx`, `AdminOrders.tsx`; filters, statuses, save bars, modals and API error messages.

Do not run Task 8A, 8B and 8C in parallel if they all edit `frontend/src/i18n/locales/ru.ts`; either sequence them or assign one subagent to dictionary integration after page edits.

- [ ] **Step 1: Inventory admin UI strings**

Run:

```powershell
rg -n "[А-Яа-яЁё][^'\"`<>]*(?=['\"`<])" frontend/src/pages/admin
```

Expected: list of visible admin strings to move into `admin` namespace.

- [ ] **Step 2: Fill `ru.admin` dictionary**

Add keys:

```ts
admin: {
  layout: {
    title: 'Панель управления',
    subtitle: 'VapeShop CMS',
    noAccessTitle: 'Нет доступа к CMS',
    backToApp: 'Вернуться в приложение',
    tabs: {
      cities: 'Города',
      products: 'Товары',
      stock: 'Остатки',
      orders: 'Заказы',
    },
  },
  common: {
    save: 'Сохранить',
    delete: 'Удалить',
    cancel: 'Отмена',
    close: 'Закрыть',
  },
}
```

Extend with every string found in `AdminCities`, `AdminProducts`, `AdminStock`, `AdminOrders`, and `AdminUI`.

Product request UI is documented but not yet present in the current frontend route set. Do not create product request screens in this localization slice. Reserve `admin.productRequests.*` label namespace and `errors.product_request.*` messages in the dictionary so future product request implementation does not need to change i18n structure.

- [ ] **Step 3: Update admin tests from literal labels to translation usage**

In `frontend/tests/adminCms.test.mjs`, replace assertions like:

```js
assert.match(layoutSource, /label: 'Города'/);
```

with:

```js
assert.match(layoutSource, /labelKey: 'admin\.layout\.tabs\.cities'/);
```

or with direct `t('admin.layout.tabs.cities')` usage if tabs are built inside component.

Add at least one representative admin assertion that a migrated admin component renders or references Russian values through dictionary-backed keys such as `admin.layout.tabs.cities`, `admin.common.save`, or `admin.orders.title`.

- [ ] **Step 4: Replace admin text with translation keys**

For `AdminLayout.tsx`, change tabs:

```ts
const tabs = [
  { path: '/admin/cities', labelKey: 'admin.layout.tabs.cities', icon: 'mapPin' as const },
]
```

In render:

```tsx
<Icon name={tab.icon} size={16} /> {t(tab.labelKey)}
```

For reusable components, accept already translated strings as props or call `useI18n()` only when the text is internal default such as close/delete labels.

- [ ] **Step 5: Add admin API error UI mapping**

For admin pages that catch API errors, replace raw `e.message` with:

```ts
import { formatApiError } from '../../api/errors';
import { useI18n } from '../../i18n';
import { useUserStore } from '../../store/user';

const { activeLocale } = useUserStore();
const { t } = useI18n(activeLocale);

catch (error) {
  setError(formatApiError(error, t));
}
```

- [ ] **Step 6: Verify admin tests**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: tests PASS and build PASS.

---

## Task 9: Hardcoded UI String Check

**Files:**
- Create: `frontend/scripts/check-hardcoded-ui.mjs`
- Modify: `frontend/package.json`

- [ ] **Step 1: Create scanner script**

Create `frontend/scripts/check-hardcoded-ui.mjs`:

```js
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.CHECK_UI_STRINGS_ROOT || fileURLToPath(new URL('../src', import.meta.url));
const allowed = [
  /src\/i18n\/locales\//,
  /src\/assets\//,
];
const extensions = new Set(['.ts', '.tsx']);
const visibleText = />([^<>{}]*\p{L}[\p{L}\p{N}\s.,!?:"'()/-]{2,})<|(?:aria-label|placeholder|title)=["']([^"']*\p{L}[^"']*)["']|(?:title|subtitle|message|confirmLabel|label|description):\s*["']([^"']*\p{L}[^"']*)["']/u;
const allowLine = /data-alt=|name_ru|name_pl|name_uk|description_ru|description_pl|description_uk|console\.|material-symbols|path:|to:|href:|src:|icon:|id:/;
const failures = [];

function normalizePath(path) {
  return path.split(sep).join('/');
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!extensions.has(extname(path))) continue;
    const normalized = normalizePath(path);
    if (allowed.some((pattern) => pattern.test(normalized))) continue;
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (allowLine.test(line)) return;
      if (visibleText.test(line)) failures.push(`${normalized}:${index + 1}: ${line.trim()}`);
    });
  }
}

walk(root);

if (failures.length) {
  console.error('Hardcoded UI strings found:');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('No obvious hardcoded UI strings found.');
```

- [ ] **Step 2: Add scanner coverage test**

Create `frontend/tests/hardcodedUiScanner.test.mjs` with a negative fixture that proves visible text on a line containing `className` is still detected:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

test('hardcoded UI scanner flags visible text on className lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-string-scan-'));
  try {
    writeFileSync(join(root, 'Fixture.tsx'), `export function Fixture() { return <div className="title">Hardcoded Visible Text</div>; }`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-hardcoded-ui.mjs'],
      {
        cwd: frontendRoot,
        env: { ...process.env, CHECK_UI_STRINGS_ROOT: root },
        encoding: 'utf8',
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Hardcoded Visible Text/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hardcoded UI scanner allowlists locale dictionaries with platform paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'ui-string-scan-'));
  try {
    const localeDir = join(root, 'src', 'i18n', 'locales');
    mkdirSync(localeDir, { recursive: true });
    writeFileSync(join(localeDir, 'ru.ts'), `export default { common: { save: 'Сохранить' } };`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-hardcoded-ui.mjs'],
      {
        cwd: frontendRoot,
        env: { ...process.env, CHECK_UI_STRINGS_ROOT: root },
        encoding: 'utf8',
      },
    );

    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 3: Add hardcoded string npm script**

In `frontend/package.json`, add `check:ui-strings` while keeping the `test` script from Task 4:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "node --test tests/*.test.mjs",
  "check:ui-strings": "node scripts/check-hardcoded-ui.mjs"
}
```

- [ ] **Step 4: Run scanner**

Run:

```powershell
cd frontend
npm run check:ui-strings
```

Expected: PASS after Tasks 7 and 8. If it flags intentional product content, add a narrow allowlist pattern and document it in the script.

---

## Task 10: Full Verification and Documentation Sync

**Files:**
- Modify docs only if implementation diverged from current spec.

- [ ] **Step 1: Run backend tests**

Run:

```powershell
python -m unittest discover -s tests -v
```

Expected: all tests PASS.

- [ ] **Step 2: Run frontend tests**

Run:

```powershell
cd frontend
npm test
```

Expected: all Node tests PASS.

- [ ] **Step 3: Run hardcoded UI string check**

Run:

```powershell
cd frontend
npm run check:ui-strings
```

Expected: PASS or only approved allowlisted content.

- [ ] **Step 4: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: `tsc && vite build` succeeds.

- [ ] **Step 5: Run backend import smoke**

Run:

```powershell
python -c "from webapp.main import app; print(app.title); print(any(r.path == '/health' for r in app.routes))"
```

Expected output includes:

```text
VapeShop Mini App API
True
```

- [ ] **Step 6: Self-review changed files**

Run:

```powershell
git diff --stat
git diff -- docs/ui/localization.md docs/backend/error-handling.md
```

Expected: docs match implemented behavior. If code required a new error code or different language behavior, update the matching doc before final review.

---

## Subagent Review Gates

Before implementation starts:

1. Dispatch Reviewer A to check plan/spec coverage.
2. Dispatch Reviewer B to check implementation risk, task ordering and test adequacy.
3. Fix any accepted plan issues before touching code.

During implementation:

1. Use one implementer subagent per task where practical.
2. After each task, run a spec compliance review.
3. After spec compliance passes, run a code quality review.
4. Do not move to the next task with open reviewer findings.

Final review:

1. Dispatch a final whole-change reviewer.
2. Run all verification commands locally.
3. Report any commands that could not be run.
