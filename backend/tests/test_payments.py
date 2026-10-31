"""
Brightloop — Payment & Settlement Unit & API Tests.

Covers:
- Authentication & authorization (401 for anonymous).
- Customer data isolation & tenancy checks.
- Partial payment and balance reduction.
- Full settlement and automatic invoice transition to PAID.
- Overpayment prevention.
- Zero and negative amount validation.
- Cancelled and already paid invoice guards.
- Idempotency key handling (safe retry vs parameter conflict).
- Currency mismatch rejection.
- Traceable payment records and audit fields.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from app.dependencies.auth import User
from app.repositories.invoice_repository import InMemoryInvoiceRepository
from app.schemas.invoice import InvoiceResponse, InvoiceStatus
from app.schemas.payment import PaymentMethod, PaymentResponse, PaymentStatus


@pytest.fixture
async def sample_invoice(
    invoice_repo: InMemoryInvoiceRepository,
    customer_user: User,
) -> InvoiceResponse:
    now = datetime.now(timezone.utc)
    inv = InvoiceResponse(
        id=uuid4(),
        invoice_number="INV-PAY-TEST-001",
        customer_id=customer_user.id,
        subscription_id=None,
        quotation_id=None,
        status=InvoiceStatus.CONFIRMED,
        currency="INR",
        subtotal=Decimal("5000.00"),
        discount_total=Decimal("0.00"),
        tax_total=Decimal("0.00"),
        total_amount=Decimal("5000.00"),
        amount_paid=Decimal("0.00"),
        balance=Decimal("5000.00"),
        invoice_date=date.today(),
        due_date=date.today(),
        billing_period_start=None,
        billing_period_end=None,
        confirmed_at=now,
        paid_at=None,
        cancelled_at=None,
        notes="Test invoice for payments",
        created_by=customer_user.id,
        created_at=now,
        updated_at=now,
        lines=[],
    )
    return await invoice_repo.create(inv)


@pytest.mark.asyncio
async def test_payment_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/payments")
    assert resp.status_code == 401

    resp = await client.post("/api/v1/payments", json={})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_record_partial_payment(
    customer_client: AsyncClient,
    sample_invoice: InvoiceResponse,
    invoice_repo: InMemoryInvoiceRepository,
):
    inv_id = str(sample_invoice.id)
    payload = {
        "invoice_id": inv_id,
        "amount": "2000.00",
        "currency": "INR",
        "payment_method": "upi",
        "transaction_reference": "UPI-REF-12345",
        "notes": "Partial installment",
    }
    resp = await customer_client.post("/api/v1/payments", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert data["amount"] == "2000.00"
    assert data["currency"] == "INR"
    assert data["payment_status"] == "completed"
    assert data["payment_method"] == "upi"
    assert data["transaction_reference"] == "UPI-REF-12345"

    # Verify invoice balance updated
    inv = await invoice_repo.get(sample_invoice.id)
    assert inv is not None
    assert inv.amount_paid == Decimal("2000.00")
    assert inv.balance == Decimal("3000.00")
    assert inv.status == InvoiceStatus.CONFIRMED


@pytest.mark.asyncio
async def test_record_full_settlement(
    customer_client: AsyncClient,
    sample_invoice: InvoiceResponse,
    invoice_repo: InMemoryInvoiceRepository,
):
    inv_id = str(sample_invoice.id)
    payload = {
        "invoice_id": inv_id,
        "amount": "5000.00",
        "currency": "INR",
        "payment_method": "bank_transfer",
    }
    resp = await customer_client.post("/api/v1/payments", json=payload)
    assert resp.status_code == 201

    # Verify invoice transition to PAID
    inv = await invoice_repo.get(sample_invoice.id)
    assert inv is not None
    assert inv.amount_paid == Decimal("5000.00")
    assert inv.balance == Decimal("0.00")
    assert inv.status == InvoiceStatus.PAID
    assert inv.paid_at is not None


@pytest.mark.asyncio
async def test_overpayment_rejected(
    customer_client: AsyncClient,
    sample_invoice: InvoiceResponse,
):
    inv_id = str(sample_invoice.id)
    payload = {
        "invoice_id": inv_id,
        "amount": "5000.01",  # Exceeds 5000.00
        "currency": "INR",
    }
    resp = await customer_client.post("/api/v1/payments", json=payload)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "OVERPAYMENT_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_zero_and_negative_amount_rejected(
    customer_client: AsyncClient,
    sample_invoice: InvoiceResponse,
):
    inv_id = str(sample_invoice.id)

    # Zero
    resp = await customer_client.post("/api/v1/payments", json={"invoice_id": inv_id, "amount": "0.00"})
    assert resp.status_code == 422

    # Negative
    resp = await customer_client.post("/api/v1/payments", json={"invoice_id": inv_id, "amount": "-50.00"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_cancelled_invoice_payment_rejected(
    customer_client: AsyncClient,
    sample_invoice: InvoiceResponse,
    invoice_repo: InMemoryInvoiceRepository,
):
    await invoice_repo.update_status(sample_invoice.id, InvoiceStatus.CANCELLED)

    resp = await customer_client.post(
        "/api/v1/payments",
        json={"invoice_id": str(sample_invoice.id), "amount": "100.00"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.asyncio
async def test_already_paid_invoice_payment_rejected(
    customer_client: AsyncClient,
    sample_invoice: InvoiceResponse,
    invoice_repo: InMemoryInvoiceRepository,
):
    await invoice_repo.record_payment_credit(sample_invoice.id, Decimal("5000.00"))

    resp = await customer_client.post(
        "/api/v1/payments",
        json={"invoice_id": str(sample_invoice.id), "amount": "100.00"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.asyncio
async def test_customer_payment_isolation(
    customer_client: AsyncClient,
    invoice_repo: InMemoryInvoiceRepository,
):
    other_customer_id = uuid4()
    now = datetime.now(timezone.utc)
    other_inv = await invoice_repo.create(
        InvoiceResponse(
            id=uuid4(),
            invoice_number="INV-OTHER-999",
            customer_id=other_customer_id,
            subscription_id=None,
            quotation_id=None,
            status=InvoiceStatus.CONFIRMED,
            currency="INR",
            subtotal=Decimal("1000.00"),
            discount_total=Decimal("0.00"),
            tax_total=Decimal("0.00"),
            total_amount=Decimal("1000.00"),
            amount_paid=Decimal("0.00"),
            balance=Decimal("1000.00"),
            invoice_date=date.today(),
            due_date=date.today(),
            billing_period_start=None,
            billing_period_end=None,
            confirmed_at=now,
            paid_at=None,
            cancelled_at=None,
            notes=None,
            created_by=other_customer_id,
            created_at=now,
            updated_at=now,
            lines=[],
        )
    )

    # Customer cannot pay another customer's invoice
    resp = await customer_client.post(
        "/api/v1/payments",
        json={"invoice_id": str(other_inv.id), "amount": "100.00"},
    )
    assert resp.status_code == 404

    # List payments returns only own records
    list_resp = await customer_client.get("/api/v1/payments")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_idempotent_payment_retry(
    customer_client: AsyncClient,
    sample_invoice: InvoiceResponse,
    invoice_repo: InMemoryInvoiceRepository,
):
    inv_id = str(sample_invoice.id)
    payload = {
        "invoice_id": inv_id,
        "amount": "1500.00",
        "currency": "INR",
        "idempotency_key": "idemp-key-test-001",
    }

    # First attempt
    resp1 = await customer_client.post("/api/v1/payments", json=payload)
    assert resp1.status_code == 201
    pay1_id = resp1.json()["id"]

    # Retry attempt with identical parameters and key
    resp2 = await customer_client.post("/api/v1/payments", json=payload)
    assert resp2.status_code == 201
    pay2_id = resp2.json()["id"]

    # Must return same payment ID
    assert pay1_id == pay2_id

    # Invoice balance should only be debited ONCE
    inv = await invoice_repo.get(sample_invoice.id)
    assert inv is not None
    assert inv.amount_paid == Decimal("1500.00")
    assert inv.balance == Decimal("3500.00")


@pytest.mark.asyncio
async def test_idempotency_conflict_rejected(
    customer_client: AsyncClient,
    sample_invoice: InvoiceResponse,
):
    inv_id = str(sample_invoice.id)
    key = "idemp-key-conflict-002"

    # First attempt with amount 1000
    resp1 = await customer_client.post(
        "/api/v1/payments",
        json={"invoice_id": inv_id, "amount": "1000.00", "idempotency_key": key},
    )
    assert resp1.status_code == 201

    # Second attempt with conflicting amount 2000 using SAME key
    resp2 = await customer_client.post(
        "/api/v1/payments",
        json={"invoice_id": inv_id, "amount": "2000.00", "idempotency_key": key},
    )
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_currency_mismatch_rejected(
    customer_client: AsyncClient,
    sample_invoice: InvoiceResponse,
):
    inv_id = str(sample_invoice.id)
    resp = await customer_client.post(
        "/api/v1/payments",
        json={"invoice_id": inv_id, "amount": "1000.00", "currency": "USD"},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "CURRENCY_MISMATCH"


# =============================================================================
# SupabasePaymentRepository RPC & Safety Unit Tests
# =============================================================================

from app.core.errors import AppError
from app.repositories.payment_repository import (
    SupabasePaymentRepository,
    get_payment_repository,
)


class MockRpcQuery:
    def __init__(self, data=None, error=None):
        self._data = data
        self._error = error

    def execute(self):
        if self._error:
            raise self._error
        class Res:
            pass
        r = Res()
        r.data = self._data
        return r


class MockTableQuery:
    def __init__(self, data=None, error=None):
        self._data = data
        self._error = error

    def insert(self, payload):
        return self

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def range(self, *args, **kwargs):
        return self

    def delete(self):
        return self

    def execute(self):
        if self._error:
            raise self._error
        class Res:
            pass
        r = Res()
        r.data = self._data
        r.count = len(self._data) if isinstance(self._data, list) else 1
        return r


class MockSupabaseClient:
    def __init__(self, rpc_data=None, rpc_error=None, table_data=None, table_error=None):
        self.rpc_data = rpc_data
        self.rpc_error = rpc_error
        self.table_data = table_data
        self.table_error = table_error
        self.last_rpc = None
        self.last_rpc_params = None

    def rpc(self, func_name, params):
        self.last_rpc = func_name
        self.last_rpc_params = params
        return MockRpcQuery(data=self.rpc_data, error=self.rpc_error)

    def table(self, table_name):
        return MockTableQuery(data=self.table_data, error=self.table_error)


@pytest.mark.asyncio
async def test_supabase_payment_repository_rpc_success():
    pay_id = uuid4()
    inv_id = uuid4()
    cust_id = uuid4()

    mock_db_row = {
        "id": str(pay_id),
        "payment_number": "PAY-202610-00100",
        "invoice_id": str(inv_id),
        "customer_id": str(cust_id),
        "amount": "2500.00",
        "currency": "INR",
        "payment_method": "upi",
        "payment_status": "completed",
        "payment_date": "2026-10-31T12:00:00Z",
        "transaction_reference": "TXN-12345",
        "idempotency_key": "IDEMP-999",
        "notes": "Settlement payment",
        "recorded_by": str(cust_id),
        "created_at": "2026-10-31T12:00:00Z",
        "updated_at": "2026-10-31T12:00:00Z",
    }

    client = MockSupabaseClient(rpc_data=mock_db_row)
    repo = SupabasePaymentRepository(client)

    payment_in = PaymentResponse(
        id=pay_id,
        payment_number="PAY-202610-00100",
        invoice_id=inv_id,
        customer_id=cust_id,
        amount=Decimal("2500.00"),
        currency="INR",
        payment_method=PaymentMethod.UPI,
        payment_status=PaymentStatus.COMPLETED,
        payment_date=datetime.now(timezone.utc),
        transaction_reference="TXN-12345",
        idempotency_key="IDEMP-999",
        notes="Settlement payment",
        recorded_by=cust_id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    result = await repo.create(payment_in)
    assert client.last_rpc == "record_payment_atomic"
    assert client.last_rpc_params["p_payment"]["amount"] == "2500.00"
    assert client.last_rpc_params["p_payment"]["idempotency_key"] == "IDEMP-999"

    assert result.id == pay_id
    assert result.amount == Decimal("2500.00")
    assert result.payment_status == PaymentStatus.COMPLETED


@pytest.mark.asyncio
async def test_supabase_payment_repository_rpc_overpayment_rejected():
    client = MockSupabaseClient(
        rpc_error=Exception("Payment amount (5000.00) exceeds outstanding invoice balance (2000.00)")
    )
    repo = SupabasePaymentRepository(client)

    payment_in = PaymentResponse(
        id=uuid4(),
        payment_number="PAY-202610-00101",
        invoice_id=uuid4(),
        customer_id=uuid4(),
        amount=Decimal("5000.00"),
        currency="INR",
        payment_method=PaymentMethod.MANUAL,
        payment_status=PaymentStatus.COMPLETED,
        payment_date=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    with pytest.raises(AppError) as exc_info:
        await repo.create(payment_in)
    assert exc_info.value.code == "OVERPAYMENT_NOT_ALLOWED"
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_supabase_payment_repository_rpc_conflict_rejected():
    client = MockSupabaseClient(
        rpc_error=Exception("Idempotency key has already been used with different payment parameters")
    )
    repo = SupabasePaymentRepository(client)

    payment_in = PaymentResponse(
        id=uuid4(),
        payment_number="PAY-202610-00102",
        invoice_id=uuid4(),
        customer_id=uuid4(),
        amount=Decimal("1000.00"),
        currency="INR",
        payment_method=PaymentMethod.MANUAL,
        payment_status=PaymentStatus.COMPLETED,
        payment_date=datetime.now(timezone.utc),
        idempotency_key="CLASH-KEY",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    with pytest.raises(AppError) as exc_info:
        await repo.create(payment_in)
    assert exc_info.value.code == "CONFLICT"
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_supabase_payment_repository_rpc_fallback_on_pgrst202():
    pay_id = uuid4()
    mock_db_row = {
        "id": str(pay_id),
        "payment_number": "PAY-202610-00103",
        "invoice_id": str(uuid4()),
        "customer_id": str(uuid4()),
        "amount": "1200.00",
        "currency": "INR",
        "payment_method": "cash",
        "status": "completed",
        "payment_date": "2026-10-31T12:00:00Z",
        "created_at": "2026-10-31T12:00:00Z",
        "updated_at": "2026-10-31T12:00:00Z",
    }

    client = MockSupabaseClient(
        rpc_error=Exception("PGRST202: Could not find the function record_payment_atomic in schema"),
        table_data=[mock_db_row],
    )
    repo = SupabasePaymentRepository(client)

    payment_in = PaymentResponse(
        id=pay_id,
        payment_number="PAY-202610-00103",
        invoice_id=UUID(mock_db_row["invoice_id"]),
        customer_id=UUID(mock_db_row["customer_id"]),
        amount=Decimal("1200.00"),
        currency="INR",
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.COMPLETED,
        payment_date=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    res = await repo.create(payment_in)
    assert res.id == pay_id
    assert res.amount == Decimal("1200.00")


def test_payment_repository_fail_fast_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "")

    from app.core.config import get_settings
    get_settings.cache_clear()

    with pytest.raises(RuntimeError) as exc_info:
        get_payment_repository()
    assert "Production environment requires Supabase credentials" in str(exc_info.value)
    get_settings.cache_clear()


