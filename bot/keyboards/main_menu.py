from __future__ import annotations

from aiogram.types import KeyboardButton, ReplyKeyboardMarkup

from bot.utils.i18n import get_translator


def main_menu_kb(locale: str, cart_count: int = 0) -> ReplyKeyboardMarkup:
    t = get_translator(locale)
    cart_label = t("btn-cart", count=cart_count) if cart_count > 0 else t("btn-cart-empty")
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text=t("btn-catalog")),
                KeyboardButton(text=t("btn-pickup")),
            ],
            [
                KeyboardButton(text=t("btn-inpost")),
                KeyboardButton(text=cart_label),
            ],
            [
                KeyboardButton(text=t("btn-profile")),
            ],
        ],
        resize_keyboard=True,
    )
