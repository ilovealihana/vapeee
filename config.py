from __future__ import annotations

from decimal import Decimal
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",          # ignore POSTGRES_USER/PASSWORD/DB etc.
    )

    BOT_TOKEN: str = ""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://vapebot:vapebot_secret@localhost:5432/vapebot"

    # Admins
    ADMIN_IDS: List[int] = []

    @field_validator("ADMIN_IDS", mode="before")
    @classmethod
    def parse_admin_ids(cls, v):
        if isinstance(v, str):
            return [int(x.strip()) for x in v.split(",") if x.strip()]
        if isinstance(v, int):
            return [v]
        return v

    # Delivery
    INPOST_DELIVERY_COST: Decimal = Decimal("15.00")

    # Google Maps / Geocoding
    GOOGLE_GEOCODING_API_KEY: str | None = None
    GOOGLE_GEOCODING_TIMEOUT_SECONDS: float = 4.0
    REQUIRE_GOOGLE_GEOCODING: bool = False

    # Support
    SUPPORT_USERNAME: str = "support"

    # Mini App WebApp URL
    WEBAPP_URL: str = "https://frontend-vapebot.vercel.app"


settings = Settings()
