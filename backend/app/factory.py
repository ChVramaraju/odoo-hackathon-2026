"""
Brightloop — FastAPI application factory.

Kept in a separate factory function so tests can construct isolated
instances without relying on module-level import side effects.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.v1.router import router as v1_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging_config import configure_logging


def create_app() -> FastAPI:
    """Build and return a configured FastAPI application."""

    settings = get_settings()
    configure_logging(debug=settings.debug)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Brightloop Subscription Management API. "
            "All endpoints are prefixed with /api/v1."
        ),
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Allow only the configured frontend origins. In production set
    # CORS_ORIGINS to the deployed frontend URL.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Exception handlers ────────────────────────────────────────────────────
    register_exception_handlers(app)

    # ── Convenient Redirects ──────────────────────────────────────────────────
    @app.get("/docs", include_in_schema=False)
    async def docs_redirect():
        return RedirectResponse(url="/api/docs")

    # ── Routes ───────────────────────────────────────────────────────────────
    app.include_router(v1_router, prefix="/api/v1")

    return app
