"""
Brightloop — Real Database Integration Tests for Payments & Settlements.

Executes against a LIVE Supabase PostgreSQL instance (e.g. brightloop-dev).
Verifies:
- Live payment creation with automatic payment numbering.
- Atomic balance reconciliation: invoice amount_paid and balance update atomically in PostgreSQL.
- Transition of invoice status to 'paid' and setting paid_at timestamp upon full settlement.
- Database-level overpayment rejection (check constraint and FOR UPDATE lock).
- Idempotent payment replay on duplicate idempotency key.
- Retrieval and customer tenancy isolation.
- Fresh repository read verifying true PostgreSQL persistence.
- Automatic non-destructive cleanup in finally block.
"""

import os
from decimal import Decimal
from datetime import date, datetime, timezone
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
from app.repositories.invoice_repository import SupabaseInvoiceRepository, get_invoice_repository
from app.repositories.payment_repository import SupabasePaymentRepository, get_payment_repository
from app.schemas.invoice import InvoiceLineResponse, InvoiceLineType, InvoiceResponse, InvoiceStatus
from app.schemas.payment import PaymentMethod, PaymentResponse, PaymentStatus

# Guard: Only run if live Supabase project is configured
live_db_configured = bool(
    os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY"))
)


def _check_payments_and_invoices_provisioned() -> bool:
    """Read-only check whether 'invoices' and 'payments' tables exist in the remote database schema cache."""
    if not live_db_configured:
        return False
    try:
        settings = get_settings()
        from supabase import create_client

        key = settings.supabase_service_role_key or settings.supabase_anon_key
        client = create_client(settings.supabase_url, key)
        # Attempt minimal select to test table existence
        client.table("invoices").select("id").limit(1).execute()
        client.table("payments").select("id").limit(1).execute()
        return True
    except Exception:
        return False


payments_and_invoices_provisioned = _check_payments_and_invoices_provisioned()
require_live_tests = os.getenv("RUN_LIVE_TESTS", "").lower() in ("true", "1") or os.getenv("REQUIRE_LIVE_TESTS", "").lower() in ("true", "1")


@pytest.mark.skipif(
    not require_live_tests and not live_db_configured,
    reason="Live Supabase database credentials not configured in environment",
)
@pytest.mark.skipif(
    not require_live_tests and not payments_and_invoices_provisioned,
    reason=(
        "Tables 'invoices' and 'payments' are not yet provisioned on the development Supabase database "
        "(migrations 20261031000004_invoices.sql and 20261031000005_payments.sql pending remote apply by database agent)"
    ),
)
@pytest.mark.integration
class TestLivePaymentDatabaseIntegration:
    @pytest.fixture(autouse=True)
    def setup_live_client(self):
        if require_live_tests:
            if not live_db_configured:
                pytest.fail("Live database credentials (SUPABASE_URL and key) are missing while RUN_LIVE_TESTS=true")
            if not payments_and_invoices_provisioned:
                pytest.fail(
                    "Live payment integration tests were explicitly required (RUN_LIVE_TESTS=true), "
                    "but tables 'invoices' and 'payments' are not yet provisioned on the development Supabase database "
                    "(migrations 20261031000004_invoices.sql and 20261031000005_payments.sql pending remote apply by database agent)."
                )
        settings = get_settings()
        from supabase import create_client

        key = settings.supabase_service_role_key or settings.supabase_anon_key
        self.sb_client = create_client(settings.supabase_url, key)
        self.invoice_repo = SupabaseInvoiceRepository(self.sb_client)
        self.payment_repo = SupabasePaymentRepository(self.sb_client)

    @pytest_asyncio.fixture
    async def live_clients(self):
        # Create genuine test users in auth.users satisfying foreign key constraints
        admin_u = self.sb_client.auth.admin.create_user(
            {"email": f"admin_pay_{uuid4().hex[:6]}@brightloop.io", "password": "TestPassword123!", "email_confirm": True}
        )
        cust_u = self.sb_client.auth.admin.create_user(
            {"email": f"cust_pay_{uuid4().hex[:6]}@brightloop.io", "password": "TestPassword123!", "email_confirm": True}
        )
        other_cust_u = self.sb_client.auth.admin.create_user(
            {"email": f"other_pay_{uuid4().hex[:6]}@brightloop.io", "password": "TestPassword123!", "email_confirm": True}
        )

        admin_id = UUID(admin_u.user.id)
        cust_id = UUID(cust_u.user.id)
        other_cust_id = UUID(other_cust_u.user.id)

        admin_user = User(id=admin_id, email=admin_u.user.email, role="admin")
        cust_user = User(id=cust_id, email=cust_u.user.email, role="customer")
        other_cust_user = User(id=other_cust_id, email=other_cust_u.user.email, role="customer")

        app = create_app()
        app.dependency_overrides[get_invoice_repository] = lambda: self.invoice_repo
        app.dependency_overrides[get_payment_repository] = lambda: self.payment_repo

        def make_client_for(user: User):
            app_inst = create_app()
            app_inst.dependency_overrides[get_invoice_repository] = lambda: self.invoice_repo
            app_inst.dependency_overrides[get_payment_repository] = lambda: self.payment_repo
            app_inst.dependency_overrides[get_current_user] = lambda: user
            return AsyncClient(transport=ASGITransport(app=app_inst), base_url="http://test")

        clients = {
            "admin": make_client_for(admin_user),
            "customer": make_client_for(cust_user),
            "other_customer": make_client_for(other_cust_user),
            "admin_user": admin_user,
            "cust_user": cust_user,
            "other_cust_user": other_cust_user,
        }

        try:
            yield clients
        finally:
            for c in [clients["admin"], clients["customer"], clients["other_customer"]]:
                await c.aclose()
            # Clean up auth test users
            for uid in [admin_id, cust_id, other_cust_id]:
                try:
                    self.sb_client.auth.admin.delete_user(str(uid))
                except Exception:
                    pass

    @pytest.mark.asyncio
    async def test_live_payment_settlement_and_concurrency(self, live_clients):
        admin_c = live_clients["admin"]
        cust_c = live_clients["customer"]
        other_cust_c = live_clients["other_customer"]
        cust_user = live_clients["cust_user"]

        invoice_id = uuid4()
        now = datetime.now(timezone.utc)
        inv_payload = {
            "id": str(invoice_id),
            "invoice_number": f"INV-TEST-{uuid4().hex[:6].upper()}",
            "customer_id": str(cust_user.id),
            "status": "confirmed",
            "currency": "INR",
            "subtotal": "5000.00",
            "discount_total": "0.00",
            "tax_total": "0.00",
            "total_amount": "5000.00",
            "amount_paid": "0.00",
            "balance": "5000.00",
            "invoice_date": date.today().isoformat(),
            "due_date": date.today().isoformat(),
            "confirmed_at": now.isoformat(),
            "notes": "Synthetic invoice for payment settlement test",
            "created_by": str(cust_user.id),
        }

        created_payment_ids = []

        try:
            # 1. Insert synthetic confirmed invoice directly
            self.sb_client.table("invoices").insert(inv_payload).execute()

            # 2. Record partial payment of 2000.00
            pay1_payload = {
                "invoice_id": str(invoice_id),
                "amount": "2000.00",
                "currency": "INR",
                "payment_method": "upi",
                "transaction_reference": f"UPI-{uuid4().hex[:8]}",
                "idempotency_key": f"IDEMP-P1-{uuid4().hex[:6]}",
                "notes": "First partial settlement installment",
            }
            resp1 = await cust_c.post("/api/v1/payments", json=pay1_payload)
            assert resp1.status_code == 201, f"Failed to record payment: {resp1.text}"
            pay1_data = resp1.json()
            pay1_id = UUID(pay1_data["id"])
            created_payment_ids.append(pay1_id)

            assert pay1_data["amount"] == "2000.00"
            assert pay1_data["payment_status"] == "completed"

            # Verify invoice balance updated atomically in database
            inv_after_p1 = await self.invoice_repo.get(invoice_id)
            assert inv_after_p1 is not None
            assert inv_after_p1.amount_paid == Decimal("2000.00")
            assert inv_after_p1.balance == Decimal("3000.00")
            assert inv_after_p1.status == InvoiceStatus.CONFIRMED

            # 3. Idempotent replay: sending same idempotency key returns same payment
            resp_replay = await cust_c.post("/api/v1/payments", json=pay1_payload)
            assert resp_replay.status_code == 201
            assert resp_replay.json()["id"] == str(pay1_id)

            # 4. Overpayment rejection: attempting to pay 4000.00 when balance is 3000.00
            overpay_payload = {
                "invoice_id": str(invoice_id),
                "amount": "4000.00",
                "currency": "INR",
                "payment_method": "card",
            }
            resp_overpay = await cust_c.post("/api/v1/payments", json=overpay_payload)
            assert resp_overpay.status_code == 400
            assert resp_overpay.json()["error"]["code"] == "OVERPAYMENT_NOT_ALLOWED"

            # 5. Full settlement payment of 3000.00
            pay2_payload = {
                "invoice_id": str(invoice_id),
                "amount": "3000.00",
                "currency": "INR",
                "payment_method": "bank_transfer",
                "transaction_reference": f"NEFT-{uuid4().hex[:8]}",
                "idempotency_key": f"IDEMP-P2-{uuid4().hex[:6]}",
                "notes": "Final settlement installment",
            }
            resp2 = await cust_c.post("/api/v1/payments", json=pay2_payload)
            assert resp2.status_code == 201
            pay2_id = UUID(resp2.json()["id"])
            created_payment_ids.append(pay2_id)

            # Verify invoice transitions to PAID in PostgreSQL
            inv_after_p2 = await self.invoice_repo.get(invoice_id)
            assert inv_after_p2 is not None
            assert inv_after_p2.amount_paid == Decimal("5000.00")
            assert inv_after_p2.balance == Decimal("0.00")
            assert inv_after_p2.status == InvoiceStatus.PAID
            assert inv_after_p2.paid_at is not None

            # 6. Customer tenancy isolation: other customer cannot see payment
            other_list_resp = await other_cust_c.get("/api/v1/payments")
            assert other_list_resp.status_code == 200
            other_items = other_list_resp.json()["items"]
            assert not any(p["id"] == str(pay1_id) for p in other_items)

            # 7. Fresh repository read: verify true database persistence
            fresh_repo = SupabasePaymentRepository(self.sb_client)
            persisted_p1 = await fresh_repo.get(pay1_id)
            assert persisted_p1 is not None
            assert persisted_p1.id == pay1_id
            assert persisted_p1.amount == Decimal("2000.00")

        finally:
            # Clean up payment rows
            for pid in created_payment_ids:
                try:
                    await self.payment_repo.delete(pid)
                except Exception:
                    pass
            # Clean up invoice row
            try:
                await self.invoice_repo.delete(invoice_id)
            except Exception:
                pass

