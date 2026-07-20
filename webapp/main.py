"""FastAPI application — Telegram Mini App backend."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from webapp.errors import register_error_handlers
from webapp.routes import auth, catalog, cart, orders, user, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run migrations on startup if using SQLite dev mode
    from config import settings
    if settings.DATABASE_URL.startswith("sqlite"):
        import subprocess, sys
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=False)
    yield


app = FastAPI(
    title="VapeShop Mini App API",
    version="1.0.0",
    description="Backend for Telegram Mini App vape shop",
    lifespan=lifespan,
)

# CORS — allow Telegram WebApp and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

# Include routers
app.include_router(auth.router)
app.include_router(user.router)
app.include_router(catalog.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "vapebot-webapp"}
