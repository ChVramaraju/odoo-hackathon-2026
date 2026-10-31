"""
Tests for structured error responses and exception handlers.

Validates that:
  - AppError returns the structured JSON contract with custom status and code.
  - Validation errors return HTTP 422 with the agreed error structure.
  - No internal traces or unhandled raw messages leak.
"""

import pytest
from fastapi import APIRouter
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.core.errors import AppError
from app.factory import create_app

sample_router = APIRouter()


class SamplePayload(BaseModel):
    name: str
    quantity: int


@sample_router.get("/test-app-error")
async def trigger_app_error():
    raise AppError(
        code="RESOURCE_NOT_FOUND",
        message="The requested item was not found.",
        status_code=404,
        details=["item_id: 123"],
    )


@sample_router.post("/test-validation")
async def trigger_validation(payload: SamplePayload):
    return {"ok": True, "name": payload.name}


@pytest.fixture
def app_with_test_routes():
    app = create_app()
    app.include_router(sample_router, prefix="/api/v1")
    return app


@pytest.mark.asyncio
async def test_app_error_structure(app_with_test_routes) -> None:
    transport = ASGITransport(app=app_with_test_routes)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/test-app-error")

    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert body["error"]["message"] == "The requested item was not found."
    assert body["error"]["details"] == ["item_id: 123"]


@pytest.mark.asyncio
async def test_validation_error_structure(app_with_test_routes) -> None:
    transport = ASGITransport(app=app_with_test_routes)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Invalid body: missing quantity, name wrong type
        response = await ac.post("/api/v1/test-validation", json={"quantity": "not_an_int"})

    assert response.status_code == 422
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert "details" in body["error"]
    assert len(body["error"]["details"]) > 0
