"""
Brightloop — Invoice Unit & API Tests.

Covers:
- Authentication & authorization (401 for anonymous).
- Customer data isolation & tenancy checks.
- Direct invoice creation with line-item financial snapshots.
- Server-authoritative calculations and 2-decimal precision.
- Generating recurring invoices from subscriptions.
- Idempotency per subscription billing period (prevents duplicate billing).
- Lifecycle state transitions (draft -> confirmed -> cancelled).
- Validation error handling.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from app.dependencies.auth import User
from app.repositories.invoice_repository import InMemoryInvoiceRepository
from app.repositories.plan_repository import InMemoryPlanRepository
from app.repositories.product_repository import InMemoryProductRepository
from app.repositories.subscription_repository import InMemorySubscriptionRepository
from app.schemas.invoice import InvoiceResponse, InvoiceStatus
from app.schemas.plan import BillingFrequency, PlanResponse
from app.schemas.product import ProductResponse
from app.schemas.subscription import (
    SubscriptionLineResponse,
    SubscriptionLineType,
    SubscriptionResponse,
    SubscriptionStatus,
)


@pytest.fixture
async def sample_plan(plan_repo: InMemoryPlanRepository) -> PlanResponse:
    plan = PlanResponse(
        id=uuid4(),
        name="Enterprise Monthly",
        code="ENT-M",
        price=Decimal("4900.00"),
        billing_frequency=BillingFrequency.MONTHLY,
        billing_interval=1,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    return await plan_repo.create_plan(plan)


@pytest.fixture
async def sample_product(prod_repo: InMemoryProductRepository) -> ProductResponse:
    product = ProductResponse(
        id=uuid4(),
        name="Dedicated IP Addon",
        sales_price=Decimal("1000.00"),
        cost_price=Decimal("300.00"),
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    return await prod_repo.create_product(product)


@pytest.fixture
async def sample_subscription(
    subscription_repo: InMemorySubscriptionRepository,
    customer_user: User,
    sample_plan: PlanResponse,
    sample_product: ProductResponse,
) -> SubscriptionResponse:
    now = datetime.now(timezone.utc)
    sub_id = uuid4()
    sub = SubscriptionResponse(
        id=sub_id,
        subscription_number="SUB-TEST-INV-001",
        customer_id=customer_user.id,
        plan_id=sample_plan.id,
        quotation_id=None,
        status=SubscriptionStatus.ACTIVE,
        currency="INR",
        billing_frequency="monthly",
        subtotal=Decimal("5900.00"),
        discount_total=Decimal("0.00"),
        tax_total=Decimal("0.00"),
        total_amount=Decimal("5900.00"),
        start_date=date(2026, 11, 1),
        end_date=None,
        next_billing_date=date(2026, 12, 1),
        notes="Active subscription for invoice test",
        created_by=customer_user.id,
        created_at=now,
        updated_at=now,
        lines=[
            SubscriptionLineResponse(
                id=uuid4(),
                subscription_id=sub_id,
                line_type=SubscriptionLineType.PLAN,
                plan_id=sample_plan.id,
                line_number=1,
                description="Plan: Enterprise Monthly",
                quantity=Decimal("1.00"),
                unit_price=Decimal("4900.00"),
                discount_percentage=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                tax_rate=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                line_total=Decimal("4900.00"),
                created_at=now,
            ),
            SubscriptionLineResponse(
                id=uuid4(),
                subscription_id=sub_id,
                line_type=SubscriptionLineType.PRODUCT,
                product_id=sample_product.id,
                line_number=2,
                description="Dedicated IP Addon",
                quantity=Decimal("1.00"),
                unit_price=Decimal("1000.00"),
                discount_percentage=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                tax_rate=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                line_total=Decimal("1000.00"),
                created_at=now,
            ),
        ],
    )
    return await subscription_repo.create(sub)


@pytest.mark.asyncio
async def test_invoice_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/invoices")
    assert resp.status_code == 401

    resp = await client.post("/api/v1/invoices", json={})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_invoice_direct_with_financials(
    admin_client: AsyncClient,
    customer_user: User,
    sample_plan: PlanResponse,
    sample_product: ProductResponse,
):
    payload = {
        "customer_id": str(customer_user.id),
        "currency": "INR",
        "lines": [
            {
                "plan_id": str(sample_plan.id),
                "quantity": "1.00",
                "discount_percentage": "10.00",
                "tax_rate": "18.00",
            },
            {
                "product_id": str(sample_product.id),
                "quantity": "2.00",
                "discount_percentage": "5.00",
                "tax_rate": "18.00",
            },
        ],
    }
    resp = await admin_client.post("/api/v1/invoices", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    # Plan: 4900.00 * 1 = 4900, disc 10% = 490.00, taxable = 4410.00, tax 18% = 793.80, line_total = 5203.80
    # Product: 1000.00 * 2 = 2000, disc 5% = 100.00, taxable = 1900.00, tax 18% = 342.00, line_total = 2242.00
    # Subtotal gross = 4900 + 2000 = 6900.00
    # Discount total = 490.00 + 100.00 = 590.00
    # Tax total = 793.80 + 342.00 = 1135.80
    # Total amount = 5203.80 + 2242.00 = 7445.80
    assert data["status"] == "draft"
    assert data["customer_id"] == str(customer_user.id)
    assert data["subtotal"] == "6900.00"
    assert data["discount_total"] == "590.00"
    assert data["tax_total"] == "1135.80"
    assert data["total_amount"] == "7445.80"
    assert data["amount_paid"] == "0.00"
    assert data["balance"] == "7445.80"
    assert len(data["lines"]) == 2


@pytest.mark.asyncio
async def test_create_invoice_validation_empty_lines(customer_client: AsyncClient):
    payload = {"currency": "INR", "lines": []}
    resp = await customer_client.post("/api/v1/invoices", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_invoice_nonexistent_product(
    admin_client: AsyncClient,
    customer_user: User,
):
    fake_id = str(uuid4())
    payload = {
        "customer_id": str(customer_user.id),
        "lines": [{"product_id": fake_id, "quantity": "1.00"}],
    }
    resp = await admin_client.post("/api/v1/invoices", json=payload)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


@pytest.mark.asyncio
async def test_create_invoice_from_subscription(
    customer_client: AsyncClient,
    sample_subscription: SubscriptionResponse,
):
    sub_id = str(sample_subscription.id)
    payload = {
        "billing_period_start": "2026-11-01",
        "billing_period_end": "2026-12-01",
    }
    resp = await customer_client.post(
        f"/api/v1/invoices/from-subscription/{sub_id}",
        json=payload,
    )
    assert resp.status_code == 201
    data = resp.json()

    assert data["subscription_id"] == sub_id
    assert data["customer_id"] == str(sample_subscription.customer_id)
    assert data["status"] == "draft"
    assert data["subtotal"] == "5900.00"
    assert data["total_amount"] == "5900.00"
    assert data["balance"] == "5900.00"
    assert len(data["lines"]) == 2


@pytest.mark.asyncio
async def test_create_invoice_from_subscription_idempotency(
    customer_client: AsyncClient,
    sample_subscription: SubscriptionResponse,
):
    sub_id = str(sample_subscription.id)
    payload = {
        "billing_period_start": "2026-11-01",
        "billing_period_end": "2026-12-01",
    }

    # First run
    resp1 = await customer_client.post(
        f"/api/v1/invoices/from-subscription/{sub_id}",
        json=payload,
    )
    assert resp1.status_code == 201
    inv1_id = resp1.json()["id"]

    # Second run (billing worker retry)
    resp2 = await customer_client.post(
        f"/api/v1/invoices/from-subscription/{sub_id}",
        json=payload,
    )
    assert resp2.status_code == 201
    inv2_id = resp2.json()["id"]

    # Must be identical invoice instance (idempotent duplicate prevention)
    assert inv1_id == inv2_id


@pytest.mark.asyncio
async def test_customer_invoice_isolation(
    customer_client: AsyncClient,
    invoice_repo: InMemoryInvoiceRepository,
):
    other_customer_id = uuid4()
    now = datetime.now(timezone.utc)
    other_inv = await invoice_repo.create(
        InvoiceResponse(
            id=uuid4(),
            invoice_number="INV-OTHER-001",
            customer_id=other_customer_id,
            subscription_id=None,
            quotation_id=None,
            status=InvoiceStatus.DRAFT,
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
            confirmed_at=None,
            paid_at=None,
            cancelled_at=None,
            notes=None,
            created_by=other_customer_id,
            created_at=now,
            updated_at=now,
            lines=[],
        )
    )

    # Customer cannot get other customer's invoice (404)
    resp = await customer_client.get(f"/api/v1/invoices/{other_inv.id}")
    assert resp.status_code == 404

    # Customer list does not include other customer's invoice
    list_resp = await customer_client.get("/api/v1/invoices")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_invoice_confirm_lifecycle(
    customer_client: AsyncClient,
    sample_subscription: SubscriptionResponse,
):
    sub_id = str(sample_subscription.id)
    resp = await customer_client.post(
        f"/api/v1/invoices/from-subscription/{sub_id}",
        json={"billing_period_start": "2026-11-01", "billing_period_end": "2026-12-01"},
    )
    inv_id = resp.json()["id"]

    # Confirm
    confirm_resp = await customer_client.post(f"/api/v1/invoices/{inv_id}/confirm")
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "confirmed"
    assert confirm_resp.json()["confirmed_at"] is not None

    # Confirming again -> 400
    confirm_again = await customer_client.post(f"/api/v1/invoices/{inv_id}/confirm")
    assert confirm_again.status_code == 400
    assert confirm_again.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.asyncio
async def test_invoice_cancel_lifecycle(
    customer_client: AsyncClient,
    sample_subscription: SubscriptionResponse,
):
    sub_id = str(sample_subscription.id)
    resp = await customer_client.post(
        f"/api/v1/invoices/from-subscription/{sub_id}",
        json={"billing_period_start": "2026-11-01", "billing_period_end": "2026-12-01"},
    )
    inv_id = resp.json()["id"]

    # Cancel
    cancel_resp = await customer_client.post(f"/api/v1/invoices/{inv_id}/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"
    assert cancel_resp.json()["cancelled_at"] is not None

    # Cancelling again -> 400
    cancel_again = await customer_client.post(f"/api/v1/invoices/{inv_id}/cancel")
    assert cancel_again.status_code == 400
    assert cancel_again.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.asyncio
async def test_cannot_confirm_cancelled_invoice(
    customer_client: AsyncClient,
    sample_subscription: SubscriptionResponse,
):
    sub_id = str(sample_subscription.id)
    resp = await customer_client.post(
        f"/api/v1/invoices/from-subscription/{sub_id}",
        json={"billing_period_start": "2026-11-01", "billing_period_end": "2026-12-01"},
    )
    inv_id = resp.json()["id"]

    # Cancel first
    await customer_client.post(f"/api/v1/invoices/{inv_id}/cancel")

    # Confirming cancelled invoice -> 400
    confirm_resp = await customer_client.post(f"/api/v1/invoices/{inv_id}/confirm")
    assert confirm_resp.status_code == 400
    assert confirm_resp.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

