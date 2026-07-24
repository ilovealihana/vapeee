from __future__ import annotations

from dataclasses import dataclass


PRODUCT_REQUEST_CREATED = "product_request.created"
PRODUCT_REQUEST_LOCKED = "product_request.locked"
PRODUCT_REQUEST_RELEASED = "product_request.released"
PRODUCT_REQUEST_NEED_CHANGES = "product_request.need_changes"
PRODUCT_REQUEST_UPDATED = "product_request.updated"
PRODUCT_REQUEST_APPROVED = "product_request.approved"
PRODUCT_REQUEST_REJECTED = "product_request.rejected"


@dataclass(frozen=True)
class ProductRequestEventContext:
    request_id: int
    event_type: str
    actor_tg_id: int
    requester_tg_id: int
    city_id: int
    location_id: int
    current_status: str
    comment: str | None = None


def emit_product_request_event(event_type: str, context: ProductRequestEventContext) -> None:
    return None
