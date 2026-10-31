"""
Brightloop — Shared Test Fixtures.

Configures:
- AsyncClient with ASGITransport.
- In-memory repository isolation per test.
- Authenticated client fixtures for admin, staff, and customer roles.
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.dependencies.auth import User, get_current_user
from app.factory import create_app
from app.repositories.plan_repository import InMemoryPlanRepository, get_plan_repository
from app.repositories.product_repository import InMemoryProductRepository, get_product_repository


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture
def admin_user() -> User:
    return User(
        id=uuid4(),
        email="admin@brightloop.io",
        role="admin",
        is_active=True,
    )


@pytest.fixture
def staff_user() -> User:
    return User(
        id=uuid4(),
        email="staff@brightloop.io",
        role="staff",
        is_active=True,
    )


@pytest.fixture
def customer_user() -> User:
    return User(
        id=uuid4(),
        email="customer@brightloop.io",
        role="customer",
        is_active=True,
    )


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """Anonymous / unauthenticated client."""
    app = create_app()
    # Ensure fresh in-memory repositories
    plan_repo = InMemoryPlanRepository()
    prod_repo = InMemoryProductRepository()
    app.dependency_overrides[get_plan_repository] = lambda: plan_repo
    app.dependency_overrides[get_product_repository] = lambda: prod_repo

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_client(admin_user: User) -> AsyncClient:
    """Client authenticated with 'admin' role."""
    app = create_app()
    plan_repo = InMemoryPlanRepository()
    prod_repo = InMemoryProductRepository()
    app.dependency_overrides[get_plan_repository] = lambda: plan_repo
    app.dependency_overrides[get_product_repository] = lambda: prod_repo
    app.dependency_overrides[get_current_user] = lambda: admin_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def staff_client(staff_user: User) -> AsyncClient:
    """Client authenticated with 'staff' role."""
    app = create_app()
    plan_repo = InMemoryPlanRepository()
    prod_repo = InMemoryProductRepository()
    app.dependency_overrides[get_plan_repository] = lambda: plan_repo
    app.dependency_overrides[get_product_repository] = lambda: prod_repo
    app.dependency_overrides[get_current_user] = lambda: staff_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def customer_client(customer_user: User) -> AsyncClient:
    """Client authenticated with 'customer' role."""
    app = create_app()
    plan_repo = InMemoryPlanRepository()
    prod_repo = InMemoryProductRepository()
    app.dependency_overrides[get_plan_repository] = lambda: plan_repo
    app.dependency_overrides[get_product_repository] = lambda: prod_repo
    app.dependency_overrides[get_current_user] = lambda: customer_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
