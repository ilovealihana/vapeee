"""
Simple Fluent-based i18n helper.
Usage:
    t = get_translator(locale)
    text = t("welcome", name="Alice")
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from fluent.runtime import FluentBundle, FluentResource

LOCALES_DIR = Path(__file__).parent.parent.parent / "locales"
SUPPORTED = ("ru", "pl", "uk")


@lru_cache(maxsize=8)
def _load_bundle(locale: str) -> FluentBundle:
    bundle = FluentBundle([locale])
    ftl_path = LOCALES_DIR / locale / "main.ftl"
    if ftl_path.exists():
        resource = FluentResource(ftl_path.read_text(encoding="utf-8"))
        errors = bundle.add_resource(resource)
        if errors:
            for e in errors:
                print(f"[i18n] FTL parse error ({locale}): {e}")
    return bundle


def get_translator(locale: str):
    """Return a callable t(key, **kwargs) for the given locale."""
    if locale not in SUPPORTED:
        locale = "ru"
    bundle = _load_bundle(locale)

    def t(key: str, **kwargs) -> str:
        msg = bundle.get_message(key)
        if msg is None or msg.value is None:
            # Fallback to RU
            fb = _load_bundle("ru")
            msg = fb.get_message(key)
            if msg is None or msg.value is None:
                return f"[{key}]"
            bundle_fb = fb
        else:
            bundle_fb = bundle

        val, errors = bundle_fb.format_pattern(msg.value, kwargs)
        return val

    return t
