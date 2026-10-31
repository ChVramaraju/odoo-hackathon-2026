"""
Brightloop — /api/v1/health endpoint.

Returns application liveness only.  Database readiness is intentionally
separate and will be added once the Supabase connection is wired.

Contract:
  GET /api/v1/health
  → 200  { "status": "ok", "version": "0.1.0" }

No authentication required for the health check.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application liveness check",
    tags=["System"],
)
async def health_check() -> HealthResponse:
    """
    Returns `ok` when the application process is running.

    Does **not** check database connectivity.
    A separate `/health/db` endpoint will be added after the Supabase
    connection is configured and verified.
    """
    settings = get_settings()
    return HealthResponse(status="ok", version=settings.app_version)

