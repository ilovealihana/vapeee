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

    BOT_TOKEN: str

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://vapebot:vapebot_secret@localhost:5432/vapebot"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

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

    # Support
    SUPPORT_USERNAME: str = "support"

    # Webhook (empty = polling)
    WEBHOOK_HOST: str = ""
    WEBHOOK_PATH: str = "/webhook"
    WEBHOOK_PORT: int = 8443

    @property
    def webhook_url(self) -> str | None:
        if self.WEBHOOK_HOST:
            return f"{self.WEBHOOK_HOST}{self.WEBHOOK_PATH}"
        return None


settings = Settings()
