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
from datetime import datetime
from uuid import UUID, uuid4

from app.schemas.quotation import (
    QuotationLineResponse,
    QuotationLineType,
    QuotationResponse,
    QuotationStatus,
)

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
        # Create genuine test users in auth.users so foreign key constraint quotations_customer_id_fkey is satisfied
        admin_u = self.sb_client.auth.admin.create_user(
            {"email": f"admin_{uuid4().hex[:6]}@brightloop.io", "password": "TestPassword123!", "email_confirm": True}
        )
        cust_a_u = self.sb_client.auth.admin.create_user(
            {"email": f"cust_a_{uuid4().hex[:6]}@brightloop.io", "password": "TestPassword123!", "email_confirm": True}
        )
        cust_b_u = self.sb_client.auth.admin.create_user(
            {"email": f"cust_b_{uuid4().hex[:6]}@brightloop.io", "password": "TestPassword123!", "email_confirm": True}
        )

        admin_id = UUID(admin_u.user.id)
        customer_a_id = UUID(cust_a_u.user.id)
        customer_b_id = UUID(cust_b_u.user.id)

        def make_client(user: User):
            app_inst = create_app()
            app_inst.dependency_overrides[get_product_repository] = lambda: self.prod_repo
            app_inst.dependency_overrides[get_plan_repository] = lambda: self.plan_repo
            app_inst.dependency_overrides[get_quotation_repository] = lambda: self.quotation_repo
            app_inst.dependency_overrides[get_current_user] = lambda: user
            return AsyncClient(transport=ASGITransport(app=app_inst), base_url="http://test")

        admin_c = make_client(User(id=admin_id, email=admin_u.user.email, role="admin"))
        cust_a_c = make_client(User(id=customer_a_id, email=cust_a_u.user.email, role="customer"))
        cust_b_c = make_client(User(id=customer_b_id, email=cust_b_u.user.email, role="customer"))

        try:
            yield {
                "admin": admin_c,
                "cust_a": cust_a_c,
                "cust_b": cust_b_c,
                "cust_a_id": customer_a_id,
                "cust_b_id": customer_b_id,
            }
        finally:
            for uid in [admin_id, customer_a_id, customer_b_id]:
                try:
                    self.sb_client.auth.admin.delete_user(str(uid))
                except Exception:
                    pass

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

    @pytest.mark.asyncio
    async def test_live_quotation_atomic_rollback_on_constraint_violation(self, live_clients: dict):
        """
        Verifies that quotation creation via create_quotation_atomic RPC is genuinely all-or-nothing:
        if a line item violates a database constraint (e.g. invalid foreign key reference or
        chk_quotation_line_item check constraint violation), the entire database transaction aborts.
        Neither the quotation header nor any lines are persisted in PostgreSQL.
        """
        admin = live_clients["admin"]
        cust_a_id = live_clients["cust_a_id"]

        prod_id = None
        invalid_quote_id = uuid4()

        try:
            # 1. Seed a valid test product in the live DB
            p_res = await admin.post(
                "/api/v1/products",
                json={
                    "name": f"Atomic Test Prod {uuid4().hex[:6]}",
                    "sales_price": "2500.00",
                    "cost_price": "500.00",
                    "currency": "INR",
                    "is_active": True,
                },
            )
            assert p_res.status_code == 201
            prod_id = p_res.json()["id"]

            # 2. Construct a QuotationResponse with one valid line and one line that violates DB check constraint:
            # chk_quotation_line_item CHECK (
            #     (line_type = 'product' AND product_id IS NOT NULL AND plan_id IS NULL) OR
            #     (line_type = 'plan' AND plan_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL)
            # )
            now = datetime.now()
            invalid_quotation = QuotationResponse(
                id=invalid_quote_id,
                quotation_number=f"QUOT-FAIL-{uuid4().hex[:6].upper()}",
                customer_id=cust_a_id,
                status=QuotationStatus.DRAFT,
                currency="INR",
                subtotal=Decimal("5000.00"),
                discount_total=Decimal("0.00"),
                tax_total=Decimal("0.00"),
                total_amount=Decimal("5000.00"),
                valid_until=None,
                notes="Atomic rollback test",
                created_by=cust_a_id,
                confirmed_at=None,
                created_at=now,
                updated_at=now,
                lines=[
                    # Line 1: valid product line
                    QuotationLineResponse(
                        id=uuid4(),
                        quotation_id=invalid_quote_id,
                        line_type=QuotationLineType.PRODUCT,
                        product_id=UUID(prod_id),
                        variant_id=None,
                        plan_id=None,
                        description="Valid Product Line",
                        quantity=Decimal("2.00"),
                        unit_price=Decimal("2500.00"),
                        discount_percentage=Decimal("0.00"),
                        discount_amount=Decimal("0.00"),
                        tax_rate=Decimal("0.00"),
                        tax_amount=Decimal("0.00"),
                        line_total=Decimal("5000.00"),
                        created_at=now,
                    ),
                    # Line 2: INVALID line that violates chk_quotation_line_item constraint (dual product & plan IDs)
                    QuotationLineResponse(
                        id=uuid4(),
                        quotation_id=invalid_quote_id,
                        line_type=QuotationLineType.PRODUCT,
                        product_id=UUID(prod_id),
                        variant_id=None,
                        plan_id=uuid4(),  # Violates constraint: line_type = product but plan_id IS NOT NULL!
                        description="Invalid Conflicting Line",
                        quantity=Decimal("1.00"),
                        unit_price=Decimal("100.00"),
                        discount_percentage=Decimal("0.00"),
                        discount_amount=Decimal("0.00"),
                        tax_rate=Decimal("0.00"),
                        tax_amount=Decimal("0.00"),
                        line_total=Decimal("100.00"),
                        created_at=now,
                    ),
                ],
            )

            # 3. Call quotation_repo.create() which invokes create_quotation_atomic RPC.
            # It must raise an exception due to PostgreSQL transaction abort on constraint violation.
            with pytest.raises(Exception):
                await self.quotation_repo.create(invalid_quotation)

            # 4. Prove all-or-nothing atomicity: verify that NO quotation header was persisted
            header_query = (
                self.sb_client.table("quotations")
                .select("id")
                .eq("id", str(invalid_quote_id))
                .execute()
            )
            assert len(header_query.data) == 0, "Quotation header must not be persisted on transaction abort"

            # 5. Prove all-or-nothing atomicity: verify that NO quotation lines were persisted
            lines_query = (
                self.sb_client.table("quotation_lines")
                .select("id")
                .eq("quotation_id", str(invalid_quote_id))
                .execute()
            )
            assert len(lines_query.data) == 0, "Quotation lines must not be persisted on transaction abort"

        finally:
            # Safe non-destructive cleanup
            try:
                self.sb_client.table("quotations").delete().eq("id", str(invalid_quote_id)).execute()
            except Exception:
                pass
            if prod_id:
                try:
                    self.sb_client.table("products").delete().eq("id", prod_id).execute()
                except Exception:
                    pass

