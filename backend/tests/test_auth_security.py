"""
Brightloop — Authentication & Authorization Security Tests.

Verifies:
1. Fabricated JWTs without cryptographic verification are rejected (401 UNAUTHORIZED).
2. Unauthenticated requests to protected endpoints fail (401 UNAUTHORIZED).
3. Malformed Authorization headers fail (401 UNAUTHORIZED).
4. User-metadata role claims are never trusted for admin privileges.
5. Customer roles cannot access admin-only endpoints (403 PERMISSION_DENIED).
6. Staff roles cannot perform admin catalog mutations (403 PERMISSION_DENIED).
7. Missing credentials do not silently grant default access.
"""

import base64
import json
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.dependencies.auth import User, get_current_user
from app.factory import create_app
from app.repositories.plan_repository import InMemoryPlanRepository, get_plan_repository
from app.repositories.product_repository import InMemoryProductRepository, get_product_repository


@pytest_asyncio.fixture
async def unoverridden_client() -> AsyncClient:
    """Client with REAL auth dependency (NO dependency override for get_current_user)."""
    app = create_app()
    app.dependency_overrides[get_plan_repository] = lambda: InMemoryPlanRepository()
    app.dependency_overrides[get_product_repository] = lambda: InMemoryProductRepository()
    # Explicitly do NOT override get_current_user so real auth execution is tested

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(unoverridden_client: AsyncClient) -> None:
    """Protected admin endpoint rejects request with no Authorization header."""
    res = await unoverridden_client.post(
        "/api/v1/products",
        json={
            "name": "Unauthorized Test Product",
            "type": "service",
            "sales_price": "10.00",
        },
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_malformed_auth_header_rejected(unoverridden_client: AsyncClient) -> None:
    """Authorization header not starting with 'Bearer ' is rejected."""
    res = await unoverridden_client.post(
        "/api/v1/products",
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
        json={"name": "Malformed Auth", "type": "service", "sales_price": "10.00"},
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_fabricated_jwt_rejected(unoverridden_client: AsyncClient) -> None:
    """
    CRITICAL SECURITY TEST:
    A caller constructs a forged JWT with role: 'admin' in user_metadata or app_metadata
    and unsigned or unsigned 'none' algorithm.
    The system MUST reject this with 401 UNAUTHORIZED rather than granting admin access.
    """
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(
        json.dumps({
            "sub": str(uuid4()),
            "email": "hacker@evil.com",
            "role": "admin",
            "app_metadata": {"role": "admin"},
            "user_metadata": {"role": "admin"},
        }).encode()
    ).decode().rstrip("=")
    fabricated_token = f"{header}.{payload}."

    res = await unoverridden_client.post(
        "/api/v1/products",
        headers={"Authorization": f"Bearer {fabricated_token}"},
        json={
            "name": "Exploit Product",
            "type": "service",
            "sales_price": "999.00",
        },
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_customer_role_cannot_create_product(customer_user: User) -> None:
    """Customer role calling admin endpoint is rejected with 403 PERMISSION_DENIED."""
    app = create_app()
    app.dependency_overrides[get_plan_repository] = lambda: InMemoryPlanRepository()
    app.dependency_overrides[get_product_repository] = lambda: InMemoryProductRepository()
    app.dependency_overrides[get_current_user] = lambda: customer_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/products",
            json={"name": "Customer Product", "type": "service", "sales_price": "10.00"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_customer_role_cannot_create_plan(customer_user: User) -> None:
    """Customer role calling admin plan endpoint is rejected with 403 PERMISSION_DENIED."""
    app = create_app()
    app.dependency_overrides[get_plan_repository] = lambda: InMemoryPlanRepository()
    app.dependency_overrides[get_product_repository] = lambda: InMemoryProductRepository()
    app.dependency_overrides[get_current_user] = lambda: customer_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/plans",
            json={
                "name": "Customer Plan",
                "price": "10.00",
                "billing_frequency": "monthly",
            },
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_staff_role_forbidden_on_admin_catalog_mutations() -> None:
    """Staff role cannot create new plans or products (admin only)."""
    app = create_app()
    app.dependency_overrides[get_plan_repository] = lambda: InMemoryPlanRepository()
    app.dependency_overrides[get_product_repository] = lambda: InMemoryProductRepository()
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
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"
