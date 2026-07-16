from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from db.models.order import Order


def fmt_price(price: Decimal | float) -> str:
    return f"{float(price):.2f}"


def fmt_date(dt: datetime | None) -> str:
    if dt is None:
        return "—"
    return dt.strftime("%d.%m.%Y %H:%M")


def fmt_order_items(order: Order, locale: str = "ru") -> str:
    lines = []
    for item in order.items:
        variant = item.variant
        if variant:
            name_attr = f"name_{locale}"
            name = getattr(variant, name_attr, None) or variant.name_ru
            product_name_attr = f"name_{locale}"
            product_name = (
                getattr(variant.product, product_name_attr, None)
                if hasattr(variant, "product") and variant.product
                else ""
            )
            full_name = f"{product_name} — {name}" if product_name else name
        else:
            full_name = "???"
        lines.append(f"• {full_name} × {item.quantity} = {fmt_price(item.price_at_order * item.quantity)} zł")
    return "\n".join(lines)


def order_status_emoji(status: str) -> str:
    mapping = {
        "new": "🆕",
        "confirmed": "✅",
        "ready": "📦",
        "completed": "✔️",
        "cancelled": "❌",
    }
    return mapping.get(status, "❓")
