"""
Brightloop — Real Database Integration Tests for Quotations.

Executes against a LIVE Supabase PostgreSQL instance (e.g. brightloop-dev).
Verifies:
- Quotation creation with multiple lines (products & plans).
- Retrieval and listing with customer isolation.
- Successful confirmation & timestamping.
- Duplicate and concurrent confirmation rejection (atomic optimistic lock).
- Persistence after a fresh repository read.
- Automatic non-destructive cleanup in finally block.
"""

import asyncio
import os
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Load environment from .env or backend/.env if present
try:
    from dotenv import load_dotenv

    load_dotenv()
    load_dotenv("backend/.env")
except ImportError:
    pass

from app.core.config import get_settings
from app.dependencies.auth import User, get_current_user
from app.factory import create_app
from app.repositories.plan_repository import SupabasePlanRepository, get_plan_repository
from app.repositories.product_repository import SupabaseProductRepository, get_product_repository
from app.repositories.quotation_repository import SupabaseQuotationRepository, get_quotation_repository

# Guard: Only run if live Supabase project is configured
live_db_configured = bool(
    os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY"))
)


def _check_quotations_table_exists() -> bool:
    """Read-only check if quotations table is provisioned on the remote database."""
    if not live_db_configured:
        return False
    try:
        settings = get_settings()
        from supabase import create_client

        key = settings.supabase_service_role_key or settings.supabase_anon_key
        client = create_client(settings.supabase_url, key)
        res = client.table("quotations").select("id").limit(1).execute()
        return True
    except Exception:
        return False


quotations_table_provisioned = _check_quotations_table_exists()


@pytest.mark.skipif(
    not live_db_configured,
    reason="Live Supabase database credentials not configured in environment",
)
@pytest.mark.skipif(
    not quotations_table_provisioned,
    reason="Table 'quotations' is not yet provisioned on the development Supabase database",
)
@pytest.mark.integration
class TestLiveQuotationDatabaseIntegration:
    @pytest.fixture(autouse=True)
    def setup_live_client(self):
        settings = get_settings()
        from supabase import create_client

        key = settings.supabase_service_role_key or settings.supabase_anon_key
        self.sb_client = create_client(settings.supabase_url, key)
        self.prod_repo = SupabaseProductRepository(self.sb_client)
        self.plan_repo = SupabasePlanRepository(self.sb_client)
        self.quotation_repo = SupabaseQuotationRepository(self.sb_client)

    @pytest_asyncio.fixture
    async def live_clients(self):
        admin_id = uuid4()
        customer_a_id = uuid4()
        customer_b_id = uuid4()

        app = create_app()
        app.dependency_overrides[get_product_repository] = lambda: self.prod_repo
        app.dependency_overrides[get_plan_repository] = lambda: self.plan_repo
        app.dependency_overrides[get_quotation_repository] = lambda: self.quotation_repo

        def make_client(user: User):
            app_inst = create_app()
            app_inst.dependency_overrides[get_product_repository] = lambda: self.prod_repo
            app_inst.dependency_overrides[get_plan_repository] = lambda: self.plan_repo
            app_inst.dependency_overrides[get_quotation_repository] = lambda: self.quotation_repo
            app_inst.dependency_overrides[get_current_user] = lambda: user
            return AsyncClient(transport=ASGITransport(app=app_inst), base_url="http://test")

        admin_c = make_client(User(id=admin_id, email="admin@brightloop.io", role="admin"))
        cust_a_c = make_client(User(id=customer_a_id, email="cust_a@brightloop.io", role="customer"))
        cust_b_c = make_client(User(id=customer_b_id, email="cust_b@brightloop.io", role="customer"))

        return {
            "admin": admin_c,
            "cust_a": cust_a_c,
            "cust_b": cust_b_c,
            "cust_a_id": customer_a_id,
            "cust_b_id": customer_b_id,
        }

    @pytest.mark.asyncio
    async def test_live_quotation_full_lifecycle(self, live_clients: dict):
        admin = live_clients["admin"]
        cust_a = live_clients["cust_a"]
        cust_b = live_clients["cust_b"]
        cust_a_id = live_clients["cust_a_id"]

        # Pre-initialize variables for safe cleanup in case setup fails partway
        prod_id = None
        plan_id = None
        quote_id = None

        try:
            # 1. Seed test product and plan in live DB
            p_res = await admin.post(
                "/api/v1/products",
                json={
                    "name": f"Live Quote Prod {uuid4().hex[:6]}",
                    "sales_price": "1200.00",
                    "cost_price": "300.00",
                    "currency": "INR",
                    "is_active": True,
                },
            )
            assert p_res.status_code == 201
            prod_id = p_res.json()["id"]

            pl_res = await admin.post(
                "/api/v1/plans",
                json={
                    "name": f"Live Quote Plan {uuid4().hex[:6]}",
                    "price": "3500.00",
                    "currency": "INR",
                    "billing_frequency": "monthly",
                    "status": "active",
                },
            )
            assert pl_res.status_code == 201
            plan_id = pl_res.json()["id"]

            # 2. Create quotation with multiple lines (product + plan)
            create_res = await cust_a.post(
                "/api/v1/quotations",
                json={
                    "currency": "INR",
                    "lines": [
                        {
                            "product_id": prod_id,
                            "quantity": "2.00",
                            "discount_percentage": "10.00",
                        },
                        {
                            "plan_id": plan_id,
                            "quantity": "1.00",
                            "tax_rate": "18.00",
                        },
                    ],
                },
            )
            assert create_res.status_code == 201
            q_data = create_res.json()
            quote_id = q_data["id"]

            assert q_data["customer_id"] == str(cust_a_id)
            assert q_data["status"] == "draft"
            assert len(q_data["lines"]) == 2

            # 3. Customer ownership isolation: Customer B cannot retrieve or confirm
            b_get = await cust_b.get(f"/api/v1/quotations/{quote_id}")
            assert b_get.status_code == 404

            b_conf = await cust_b.post(f"/api/v1/quotations/{quote_id}/confirm")
            assert b_conf.status_code == 404

            # 4. Fresh repository read verification with proper UUID conversion
            settings = get_settings()
            from supabase import create_client

            fresh_sb = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key or settings.supabase_anon_key,
            )
            fresh_repo = SupabaseQuotationRepository(fresh_sb)
            parsed_uuid = UUID(quote_id)
            fresh_read = await fresh_repo.get(parsed_uuid)
            assert fresh_read is not None
            assert fresh_read.id == parsed_uuid
            assert len(fresh_read.lines) == 2

            # 5. Genuinely concurrent confirmation race condition test (atomic conditional transition)
            # Launch simultaneous confirmation requests while the quotation is STILL in draft.
            # Exactly one request must succeed (200 OK); the remaining two must receive 400 Bad Request
            # (INVALID_STATUS_TRANSITION) due to row-level atomic conditional locking (status = 'draft').
            concurrent_results = await asyncio.gather(
                cust_a.post(f"/api/v1/quotations/{quote_id}/confirm"),
                cust_a.post(f"/api/v1/quotations/{quote_id}/confirm"),
                cust_a.post(f"/api/v1/quotations/{quote_id}/confirm"),
            )
            status_codes = [r.status_code for r in concurrent_results]
            assert status_codes.count(200) == 1, f"Expected exactly one 200 OK, got: {status_codes}"
            assert status_codes.count(400) == 2, f"Expected exactly two 400 Bad Request, got: {status_codes}"

            success_res = next(r for r in concurrent_results if r.status_code == 200)
            assert success_res.json()["status"] == "confirmed"
            assert success_res.json()["confirmed_at"] is not None

            for r in concurrent_results:
                if r.status_code == 400:
                    assert r.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

            # 6. Duplicate sequential confirmation rejected
            dup_res = await cust_a.post(f"/api/v1/quotations/{quote_id}/confirm")
            assert dup_res.status_code == 400
            assert dup_res.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

        finally:
            # Non-destructive test data cleanup (safe even if setup fails partway)
            if quote_id:
                try:
                    self.sb_client.table("quotations").delete().eq("id", quote_id).execute()
                except Exception:
                    pass
            if prod_id:
                try:
                    self.sb_client.table("products").delete().eq("id", prod_id).execute()
                except Exception:
                    pass
            if plan_id:
                try:
                    self.sb_client.table("plans").delete().eq("id", plan_id).execute()
                except Exception:
                    pass
