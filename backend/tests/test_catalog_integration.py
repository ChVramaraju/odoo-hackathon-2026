"""
Brightloop — Real Database Integration Tests for Catalog.

These tests execute against a LIVE Supabase PostgreSQL instance.
They are automatically skipped when SUPABASE_URL is not set in the environment,
ensuring unit tests remain fast, offline, and reliable.

To execute against the development database:
    1. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env
    2. Apply migration supabase/migrations/20261031000001_catalog.sql
    3. Run: pytest -m integration
"""

import os
from decimal import Decimal
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.dependencies.auth import User, get_current_user
from app.factory import create_app
from app.repositories.plan_repository import SupabasePlanRepository, get_plan_repository
from app.repositories.product_repository import SupabaseProductRepository, get_product_repository

# Guard: Only run if live Supabase project is configured
live_db_configured = bool(
    os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY"))
)


@pytest.mark.skipif(not live_db_configured, reason="Live Supabase database credentials not configured in environment")
@pytest.mark.integration
class TestLiveCatalogDatabaseIntegration:
    @pytest.fixture(autouse=True)
    def setup_live_client(self):
        settings = get_settings()
        from supabase import create_client
        key = settings.supabase_service_role_key or settings.supabase_anon_key
        self.sb_client = create_client(settings.supabase_url, key)
        self.prod_repo = SupabaseProductRepository(self.sb_client)
        self.plan_repo = SupabasePlanRepository(self.sb_client)

    @pytest_asyncio.fixture
    async def live_admin_client(self):
        app = create_app()
        app.dependency_overrides[get_product_repository] = lambda: self.prod_repo
        app.dependency_overrides[get_plan_repository] = lambda: self.plan_repo
        app.dependency_overrides[get_current_user] = lambda: User(
            id=uuid4(), email="admin@brightloop.io", role="admin"
        )
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    @pytest.mark.asyncio
    async def test_live_product_lifecycle(self, live_admin_client: AsyncClient):
        # 1. Create product in real database
        name = f"Live DB Test Product {uuid4().hex[:6]}"
        create_res = await live_admin_client.post(
            "/api/v1/products",
            json={
                "name": name,
                "type": "service",
                "sales_price": "89.99",
                "cost_price": "20.00",
                "currency": "USD",
                "is_active": True,
            },
        )
        assert create_res.status_code == 201
        prod = create_res.json()
        product_id = prod["id"]

        try:
            # 2. Add variant in real database
            var_res = await live_admin_client.post(
                f"/api/v1/products/{product_id}/variants",
                json={
                    "name": "Live Tier",
                    "value": "Enterprise",
                    "price_adjustment": "50.00",
                },
            )
            assert var_res.status_code == 201

            # 3. Retrieve product and variants
            get_res = await live_admin_client.get(f"/api/v1/products/{product_id}")
            assert get_res.status_code == 200
            assert get_res.json()["sales_price"] == "89.99"

            vars_res = await live_admin_client.get(f"/api/v1/products/{product_id}/variants")
            assert vars_res.status_code == 200
            assert len(vars_res.json()) >= 1
        finally:
            # Clean up test record from live database
            self.sb_client.table("products").delete().eq("id", product_id).execute()

    @pytest.mark.asyncio
    async def test_live_plan_lifecycle(self, live_admin_client: AsyncClient):
        # 1. Create plan in real database
        name = f"Live DB Plan {uuid4().hex[:6]}"
        create_res = await live_admin_client.post(
            "/api/v1/plans",
            json={
                "name": name,
                "price": "199.00",
                "currency": "USD",
                "billing_frequency": "yearly",
                "billing_interval": 1,
                "status": "active",
            },
        )
        assert create_res.status_code == 201
        plan = create_res.json()
        plan_id = plan["id"]

        try:
            # 2. Get plan from real database
            get_res = await live_admin_client.get(f"/api/v1/plans/{plan_id}")
            assert get_res.status_code == 200
            assert get_res.json()["price"] == "199.00"
            assert get_res.json()["billing_frequency"] == "yearly"
        finally:
            # Clean up test record from live database
            self.sb_client.table("plans").delete().eq("id", plan_id).execute()

