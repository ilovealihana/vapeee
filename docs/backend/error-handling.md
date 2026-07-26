# Error Handling

**Version:** 1.1.0  
**Status:** Approved

## Purpose

This document defines backend API error handling rules and the canonical error-code catalog for the frontend localization layer.

Backend must return stable machine-readable error codes. Frontend translates them through the UI i18n layer.

## Scope

In scope:

- API error response format;
- validation error format;
- error-code naming;
- existing endpoint error migration;
- frontend localization expectations;
- safe `details` rules.

Out of scope:

- bot message localization;
- external observability systems;
- payment provider errors;
- legal/compliance copy.

## Related documents

- `docs/MASTER_PROMPT.md`
- `docs/core/00-project-rules.md`
- `docs/ui/localization.md`
- `docs/backend/api.md`
- `docs/backend/security.md`
- `docs/backend/permissions.md`
- `docs/admin/product-requests.md`
- `docs/products/inventory.md`
- `docs/products/moderation.md`

## Error response format

Canonical API error response:

```json
{
  "code": "cart.item_not_found",
  "message": "Cart item not found",
  "details": {}
}
```

Rules:

- `code` is required for all backend API errors.
- `code` is stable and not localized.
- `message` is a stable English developer fallback, not user-facing UI copy.
- `details` is an object and may be empty.
- HTTP status must still describe the error class correctly.
- Frontend must use `code` for user-facing translations.

Backend must not return localized API error text as the primary error contract.

## Validation error format

Field validation errors use one envelope:

```json
{
  "code": "validation.failed",
  "message": "Validation failed",
  "details": {
    "fields": [
      {
        "field": "phone",
        "code": "validation.phone_invalid",
        "params": {}
      }
    ]
  }
}
```

Rules:

- top-level `code` is `validation.failed`;
- `details.fields` is an array;
- every field item has `field`, `code` and `params`;
- `params` must contain only safe values needed for UI messages;
- forms may show field errors near the relevant controls;
- unknown fields are shown as a general form error.

## Safe details

Allowed `details` content:

- form field names;
- min/max limits;
- allowed enum values;
- safe entity identifiers when useful and not sensitive;
- safe business context needed by the UI.

Forbidden `details` content:

- stack traces;
- SQL queries;
- raw internal exceptions;
- tokens or secrets;
- filesystem paths;
- private user data not required for the UI.

## Error-code naming

Format:

```text
<domain>.<specific_error>
```

Examples:

- `auth.invalid_signature`
- `cart.empty`
- `product_request.duplicate_variant`
- `media.file_too_large`

Codes must use:

- lowercase;
- dot-separated namespace;
- snake_case final segment;
- no spaces;
- no localized words.

## Frontend localization

Frontend maps backend `code` values to localized messages.

Translation key convention:

```text
errors.<domain>.<specific_error>
```

Example:

- backend code: `product_request.duplicate_variant`;
- frontend key: `errors.product_request.duplicate_variant`.

The exact frontend object shape may use namespace objects, but it must map one-to-one to backend codes.

Frontend fallback rules:

1. Known `code`: show localized translation.
2. Unknown `code`: show generic localized error.
3. Legacy FastAPI text-only response: show generic localized error unless explicitly mapped by compatibility code.

Frontend must not compare localized error text in logic.

## Existing endpoint migration catalog

### Validation

| Error code | HTTP | When |
| --- | ---: | --- |
| `validation.failed` | 422 | One or more fields failed validation. |
| `validation.required` | 422 | Required field is missing. |
| `validation.invalid_type` | 422 | Field value has the wrong type. |
| `validation.invalid_enum` | 422 | Field value is not one of the allowed values. |
| `validation.too_short` | 422 | Field value is shorter than allowed. |
| `validation.too_long` | 422 | Field value is longer than allowed. |
| `validation.min_value` | 422 | Numeric value is below the minimum. |
| `validation.max_value` | 422 | Numeric value is above the maximum. |
| `validation.phone_invalid` | 422 | Phone field is invalid. |
| `validation.email_invalid` | 422 | Email field is invalid. |

### Auth

| Error code | HTTP | When |
| --- | ---: | --- |
| `auth.invalid_init_data_format` | 401 | Telegram initData cannot be parsed. |
| `auth.missing_hash` | 401 | Telegram initData hash is missing. |
| `auth.invalid_signature` | 401 | Telegram initData signature validation failed. |
| `auth.missing_user` | 401 | Telegram initData does not contain user data. |
| `auth.invalid_user_json` | 401 | Telegram user payload is invalid JSON. |
| `auth.missing_user_id` | 401 | Parsed Telegram user has no id. |
| `auth.invalid_authorization_header` | 401 | Authorization header is missing or does not start with `tma `. |
| `auth.not_authenticated` | 401 | Current user cannot be authenticated. |

### User/Profile

| Error code | HTTP | When |
| --- | ---: | --- |
| `user.not_found` | 404 | Requested user profile cannot be found. |
| `user.invalid_language` | 422 | Language is not one of `ru`, `en`, `pl`, `uk`. |
| `user.profile_update_failed` | 400 | User profile update cannot be applied. |

### Catalog

| Error code | HTTP | When |
| --- | ---: | --- |
| `catalog.city_not_found` | 404 | City does not exist. |
| `catalog.location_not_found` | 404 | Local Point does not exist. |
| `catalog.location_inactive` | 404 | Local Point is inactive for customer catalog access. |
| `catalog.category_not_found` | 404 | Category does not exist. |
| `catalog.product_not_found` | 404 | Product does not exist. |
| `catalog.product_unavailable` | 404 | Product is not available for requested source. |
| `catalog.variant_not_found` | 404 | Variant does not exist. |
| `catalog.variant_unavailable` | 400 | Variant is inactive or unavailable for requested source. |

### Cart

| Error code | HTTP | When |
| --- | ---: | --- |
| `cart.not_found` | 404 | Cart does not exist. |
| `cart.empty` | 400 | Cart has no items. |
| `cart.item_not_found` | 404 | Cart item does not exist. |
| `cart.invalid_quantity` | 422 | Quantity is less than allowed minimum. |
| `cart.source_mismatch` | 400 | Cart source differs from requested source. |
| `cart.variant_unavailable` | 400 | Variant is inactive or unavailable. |
| `cart.insufficient_stock` | 400 | Requested quantity exceeds source stock. |

### Orders

| Error code | HTTP | When |
| --- | ---: | --- |
| `order.cart_empty` | 400 | Order creation requested with empty cart. |
| `order.location_required` | 400 | Local delivery/pickup requires location. |
| `order.invalid_delivery_type` | 422 | Delivery type is unsupported. |
| `order.invalid_payment_method` | 422 | Payment method is unsupported. |
| `order.invalid_schedule` | 422 | Date/time is invalid or in the past. |
| `order.insufficient_stock` | 400 | Checkout stock validation failed. |
| `order.not_found` | 404 | Order does not exist. |
| `order.status_invalid` | 422 | Order status transition or value is invalid. |

### Admin Existing CRUD

| Error code | HTTP | When |
| --- | ---: | --- |
| `admin.access_required` | 403 | User has no admin/staff access. |
| `admin.project_admin_required` | 403 | Endpoint requires project admin. |
| `admin.city_not_found` | 404 | Admin city operation target does not exist. |
| `admin.location_not_found` | 404 | Admin location operation target does not exist. |
| `admin.product_not_found` | 404 | Admin product operation target does not exist. |
| `admin.variant_not_found` | 404 | Admin variant operation target does not exist. |
| `admin.order_not_found` | 404 | Admin order operation target does not exist. |
| `admin.stock_row_invalid` | 422 | Stock update row references invalid source or variant. |
| `admin.protected_assignment` | 403 | Attempt to delete protected bootstrap project admin access. |

### Staff/settings

| Error code | HTTP | When |
| --- | ---: | --- |
| `staff.tg_id_required` | 422 | Staff Telegram ID is missing. |
| `staff.invalid_tg_id` | 422 | Staff Telegram ID is invalid. |
| `staff.role_invalid` | 422 | Role is not supported. |
| `staff.assignment_not_found` | 404 | Staff assignment does not exist. |
| `staff.assignment_duplicate` | 409 | Same role/target assignment already exists. |
| `staff.location_required` | 422 | Role requires at least one Local Point. |
| `staff.location_not_allowed` | 403 | Target Local Point cannot be assigned by current actor. |
| `staff.cannot_delete_protected_admin` | 403 | Bootstrap `ADMIN_IDS` project admin cannot be removed. |
| `staff.project_admin_required` | 403 | Staff management requires project admin. |
| `settings.key_not_found` | 404 | Setting key does not exist. |
| `settings.invalid_value` | 422 | Setting value has invalid type or format. |
| `settings.project_admin_required` | 403 | Settings mutation requires project admin. |

### Product request

| Error code | HTTP | When |
| --- | ---: | --- |
| `product_request.type_invalid` | 422 | Request type is not supported. |
| `product_request.source_invalid` | 422 | Legacy/source-aware validation code; current product request slice is Local-only. |
| `product_request.permission_denied` | 403 | Actor cannot create/read/edit this request. |
| `product_request.review_permission_denied` | 403 | Actor cannot review product requests. |
| `product_request.not_found` | 404 | Product request does not exist. |
| `product_request.status_invalid` | 422 | Status value is invalid. |
| `product_request.transition_invalid` | 409 | Requested status transition is not allowed. |
| `product_request.lock_required` | 409 | Verdict action requires active review lock. |
| `product_request.lock_exists` | 409 | Another reviewer already holds the review lock. |
| `product_request.lock_not_owner` | 409 | Current admin does not own the active review lock. |
| `product_request.lock_not_allowed_for_status` | 409 | Review lock can only start for `pending_review`. |
| `product_request.edit_locked` | 409 | Request is under review and cannot be edited. |
| `product_request.comment_required` | 422 | Reject or request-changes action requires a non-empty reviewer comment. |
| `product_request.product_required` | 422 | Existing product is required. |
| `product_request.product_not_found` | 404 | Selected product does not exist. |
| `product_request.variant_required` | 422 | Existing variant is required for stock addition. |
| `product_request.variant_not_found` | 404 | Selected variant does not exist. |
| `product_request.duplicate_variant` | 409 | New variant name duplicates an existing variant for the selected product. |
| `product_request.variant_name_required` | 422 | New variant name is required. |
| `product_request.quantity_invalid` | 422 | Quantity violates request-type rules. |
| `product_request.price_invalid` | 422 | Price override is negative or malformed. |
| `product_request.location_required` | 404 | Local Point does not exist or is inactive. |
| `product_request.location_forbidden` | 403 | Actor has no access to selected Local Point. |
| `product_request.inpost_inactive` | 403 | Legacy InPost request guard; InPost requests are not implemented in the current slice. |
| `product_request.resubmit_not_allowed` | 409 | Legacy draft/resubmit guard; current correction loop edits `need_changes` directly back to `pending_review`. |
| `product_request.cancel_not_allowed` | 409 | Legacy cancellation guard; cancellation is not implemented in the current slice. |
| `product_request.approval_failed` | 500 | Atomic publication failed and was rolled back. |

### Media upload

| Error code | HTTP | When |
| --- | ---: | --- |
| `media.file_too_large` | 413 | Uploaded image exceeds allowed size. |
| `media.unsupported_type` | 415 | File MIME type is not allowed. |
| `media.invalid_image` | 422 | File cannot be decoded as an image. |
| `media.optimization_failed` | 500 | Image resize/compression failed. |
| `media.storage_failed` | 500 | Optimized file cannot be saved. |
| `media.delete_failed` | 500 | Old file cannot be deleted when required. |

### Common

| Error code | HTTP | When |
| --- | ---: | --- |
| `common.bad_request` | 400 | Legacy or framework-level bad request before a domain-specific code is available. |
| `common.not_found` | 404 | Requested resource is not found. |
| `common.method_not_allowed` | 405 | HTTP method is not allowed for the requested route. |
| `common.conflict` | 409 | Request conflicts with current state. |
| `common.internal_error` | 500 | Unexpected server-side failure. |
| `common.not_implemented` | 501 | Legacy compatibility endpoint is intentionally not implemented. |
| `common.service_unavailable` | 503 | Required external/internal service is unavailable. |

## HTTP status rules

- `400` - invalid request state that is not field-validation.
- `401` - authentication missing or invalid.
- `403` - authenticated actor lacks permission.
- `404` - requested entity is not visible or does not exist.
- `405` - HTTP method is not allowed for the requested route.
- `409` - conflict with current entity state, duplicate, lock or invalid transition.
- `413` - uploaded payload too large.
- `415` - unsupported media type.
- `422` - field-level validation error.
- `500` - unexpected server-side failure.
- `501` - legacy compatibility endpoint is intentionally not implemented.
- `503` - dependent service is unavailable.

## Backend implementation rules

Backend must:

- use helpers/constants for error codes instead of ad hoc strings;
- keep HTTP status and `code` aligned;
- convert FastAPI/Pydantic validation errors to the canonical validation envelope;
- avoid leaking secrets or internal stack traces;
- include structured `details` only when useful and safe;
- log server-side failures with enough context for debugging;
- keep error codes stable once frontend translations depend on them.

Backend must not:

- return localized API error text as the primary error contract;
- expose raw database exceptions to clients;
- rely on frontend validation for permissions or business rules;
- invent new error codes without updating this document.

## Frontend implementation rules

Frontend must:

- read `code` from API error responses;
- translate known codes through the project-owned i18n layer;
- map `validation.failed` field details to form-level or field-level messages;
- fallback to a generic localized error for unknown or legacy response formats;
- avoid comparing localized error text in logic.

## Edge cases

- Legacy endpoint returns text-only `detail`: frontend shows generic localized fallback unless mapped.
- Backend returns unknown `code`: frontend shows generic localized error and may log the unknown code in development.
- Permission denied and not found overlap: backend may return `404` instead of `403` when hiding entity existence is safer.
- Notification sending fails after a successful state change: the state change remains committed and the notification failure is logged.
- Media deletion fails during request edit: backend should log and return `media.delete_failed` only if deletion is required to complete the requested action.

## Test plan

Backend tests:

- auth errors return canonical `code`, `message`, `details`;
- FastAPI/Pydantic validation errors return `validation.failed` with `details.fields`;
- user language validation returns `user.invalid_language` or field validation code;
- admin permission errors return `admin.access_required` or `admin.project_admin_required`;
- cart/order validation errors return expected codes;
- catalog not-found errors return expected codes;
- product/admin CRUD errors return expected codes;
- unexpected exceptions do not leak stack traces to clients.

Frontend tests:

- known `code` renders localized message;
- unknown code renders generic localized error;
- validation field details map to field messages;
- status/role/source labels are translated from technical keys.

## Definition of Done

Error handling is complete when:

- existing backend endpoints use canonical `{ code, message, details }` responses;
- validation errors use `validation.failed` with `details.fields`;
- frontend translates codes through i18n;
- frontend has generic fallback for unknown and legacy errors;
- backend and frontend tests cover representative success and error paths;
- this document remains synchronized with code-level error constants.
