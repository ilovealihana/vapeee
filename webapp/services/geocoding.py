from __future__ import annotations

from decimal import Decimal

import httpx

from config import settings


class GeocodingConfigError(Exception):
    pass


class GeocodingAddressNotFound(Exception):
    def __init__(self, address: str) -> None:
        super().__init__(address)
        self.address = address


class GeocodingTransientError(Exception):
    pass


class GoogleGeocoder:
    async def geocode(self, address: str) -> tuple[Decimal, Decimal]:
        if not settings.GOOGLE_GEOCODING_API_KEY:
            raise GeocodingConfigError("GOOGLE_GEOCODING_API_KEY is not configured")

        try:
            async with httpx.AsyncClient(timeout=settings.GOOGLE_GEOCODING_TIMEOUT_SECONDS) as client:
                response = await client.get(
                    "https://maps.googleapis.com/maps/api/geocode/json",
                    params={
                        "address": address,
                        "key": settings.GOOGLE_GEOCODING_API_KEY,
                    },
                )
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            raise GeocodingTransientError(str(exc)) from exc

        if response.status_code >= 500:
            raise GeocodingTransientError(f"Google geocoding returned {response.status_code}")
        if response.status_code != 200:
            raise GeocodingAddressNotFound(address)

        payload = response.json()
        status = payload.get("status")
        results = payload.get("results") or []
        if status == "ZERO_RESULTS" or not results:
            raise GeocodingAddressNotFound(address)
        if status != "OK":
            raise GeocodingTransientError(f"Google geocoding status {status}")

        location = results[0]["geometry"]["location"]
        return Decimal(str(location["lat"])), Decimal(str(location["lng"]))
