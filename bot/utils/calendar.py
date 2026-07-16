"""
Inline calendar widget for aiogram 3.
Returns an InlineKeyboardMarkup for month navigation and day selection.
"""
from __future__ import annotations

import calendar
from datetime import date, timedelta

from aiogram.filters.callback_data import CallbackData
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


class CalendarCallback(CallbackData, prefix="cal"):
    action: str   # "day" | "prev" | "next" | "ignore"
    year: int
    month: int
    day: int


MONTH_NAMES_RU = [
    "", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]
MONTH_NAMES_PL = [
    "", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
]
MONTH_NAMES_UK = [
    "", "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
    "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
]

WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


def _month_name(month: int, locale: str) -> str:
    if locale == "pl":
        return MONTH_NAMES_PL[month]
    if locale == "uk":
        return MONTH_NAMES_UK[month]
    return MONTH_NAMES_RU[month]


def build_calendar(year: int, month: int, locale: str = "ru", min_date: date | None = None) -> InlineKeyboardMarkup:
    if min_date is None:
        min_date = date.today()

    builder = InlineKeyboardBuilder()

    # Header: ← Month Year →
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    next_month = month + 1 if month < 12 else 1
    next_year = year if month < 12 else year + 1

    builder.row(
        InlineKeyboardButton(
            text="◀️",
            callback_data=CalendarCallback(action="prev", year=prev_year, month=prev_month, day=0).pack(),
        ),
        InlineKeyboardButton(
            text=f"{_month_name(month, locale)} {year}",
            callback_data=CalendarCallback(action="ignore", year=year, month=month, day=0).pack(),
        ),
        InlineKeyboardButton(
            text="▶️",
            callback_data=CalendarCallback(action="next", year=next_year, month=next_month, day=0).pack(),
        ),
    )

    # Week day headers
    builder.row(*[
        InlineKeyboardButton(text=d, callback_data=CalendarCallback(action="ignore", year=year, month=month, day=0).pack())
        for d in WEEK_DAYS
    ])

    # Days grid
    cal = calendar.monthcalendar(year, month)
    for week in cal:
        row_buttons = []
        for day in week:
            if day == 0:
                row_buttons.append(
                    InlineKeyboardButton(
                        text=" ",
                        callback_data=CalendarCallback(action="ignore", year=year, month=month, day=0).pack(),
                    )
                )
            else:
                current = date(year, month, day)
                if current < min_date:
                    # past day — show greyed
                    row_buttons.append(
                        InlineKeyboardButton(
                            text=f"·{day}·",
                            callback_data=CalendarCallback(action="ignore", year=year, month=month, day=day).pack(),
                        )
                    )
                else:
                    row_buttons.append(
                        InlineKeyboardButton(
                            text=str(day),
                            callback_data=CalendarCallback(action="day", year=year, month=month, day=day).pack(),
                        )
                    )
        builder.row(*row_buttons)

    return builder.as_markup()


def build_time_slots(locale: str = "ru") -> InlineKeyboardMarkup:
    """Fixed half-hour time slots 10:00–20:00."""
    from aiogram.filters.callback_data import CallbackData

    class TimeCallback(CallbackData, prefix="time"):
        slot: str  # "10:00" etc.

    slots = [f"{h:02d}:{m:02d}" for h in range(10, 21) for m in (0, 30)]
    builder = InlineKeyboardBuilder()
    for slot in slots:
        builder.button(
            text=slot,
            callback_data=f"time:{slot}",
        )
    builder.adjust(4)
    return builder.as_markup()
