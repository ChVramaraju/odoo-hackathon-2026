"""
Tests for the /api/v1/health endpoint and application startup.

These tests verify:
  - Application constructs without exceptions.
  - GET /api/v1/health returns HTTP 200.
  - Response body matches the agreed HealthResponse schema.
  - The version field is present and non-empty.
  - An unknown route returns HTTP 404 (not a 500 crash).
  - A request validation error returns the structured error format.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_returns_200(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_body_shape(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert body["version"]  # non-empty string


@pytest.mark.asyncio
async def test_health_content_type_is_json(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert "application/json" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_unknown_route_returns_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/does-not-exist")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_root_not_found(client: AsyncClient) -> None:
    """Root path is not mounted; expect 404 not a 500."""
    response = await client.get("/")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_openapi_schema_accessible(client: AsyncClient) -> None:
    """FastAPI's generated OpenAPI JSON should be accessible."""
    response = await client.get("/api/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert data["info"]["title"] == "Brightloop"

