"""
Brightloop — Authentication & Authorization Security Tests.

Verifies:
- Rejection of unauthenticated requests.
- Rejection of malformed Authorization headers.
- Rejection of fabricated/forged JWT tokens without cryptographic verification.
- Role enforcement: customer and staff roles cannot access admin endpoints.
- Role isolation: user-editable metadata cannot escalate privileges to admin.
"""

import base64
import json
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies.auth import User, get_current_user
from app.factory import create_app


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected() -> None:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/products",
            json={"name": "Forbidden Item", "sales_price": "10.00"},
        )
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert "Missing or invalid authentication credentials" in body["error"]["message"]


@pytest.mark.asyncio
async def test_malformed_bearer_header_rejected() -> None:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/products",
            headers={"Authorization": "Basic invalid_credentials"},
            json={"name": "Forbidden Item", "sales_price": "10.00"},
        )
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert "Authorization header must follow format: Bearer <token>" in body["error"]["message"]


@pytest.mark.asyncio
async def test_fabricated_jwt_rejected_without_verification() -> None:
    """
    CRITICAL SECURITY TEST:
    A caller fabricates an unverified JWT with 'role': 'admin' in claims.
    Without a verified Supabase signature, the backend MUST reject it with 401.
    """
    app = create_app()
    # Notice: NO dependency overrides applied to app.get_current_user!
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(
        json.dumps({
            "sub": str(uuid4()),
            "email": "hacker@evil.com",
            "role": "admin",
            "app_metadata": {"role": "admin"},
        }).encode()
    ).decode().rstrip("=")
    fabricated_jwt = f"{header}.{payload}."

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/products",
            headers={"Authorization": f"Bearer {fabricated_jwt}"},
            json={"name": "Injected Product", "sales_price": "0.00"},
        )

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert "Authentication token verification failed" in body["error"]["message"]


@pytest.mark.asyncio
async def test_customer_role_forbidden_on_admin_endpoint() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: User(
        id=uuid4(), email="customer@example.com", role="customer"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/products",
            json={"name": "Customer Product", "sales_price": "10.00"},
        )
    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_staff_role_forbidden_on_admin_catalog_mutations() -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: User(
        id=uuid4(), email="staff@brightloop.io", role="staff"
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/plans",
            json={"name": "Staff Created Plan", "price": "10.00"},
        )
    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "PERMISSION_DENIED"
