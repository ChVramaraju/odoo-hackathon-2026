"""
Brightloop — Subscription Unit & API Tests.

Covers:
- Authentication & authorization (401 for anonymous).
- Customer data isolation & tenancy checks.
- Direct subscription creation with plans and product lines.
- Financial arithmetic and 2-decimal precision.
- Conversion from quotation (requires confirmed status).
- Conversion idempotency (multiple calls return identical subscription).
- Lifecycle state transitions (active <-> paused -> closed).
- Renewal billing date advancement.
- Validation errors and edge cases.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from app.dependencies.auth import User
from app.repositories.plan_repository import InMemoryPlanRepository
from app.repositories.product_repository import InMemoryProductRepository
from app.repositories.quotation_repository import InMemoryQuotationRepository
from app.repositories.subscription_repository import InMemorySubscriptionRepository
from app.schemas.plan import BillingFrequency, PlanCreate, PlanResponse
from app.schemas.product import ProductCreate, ProductResponse
from app.schemas.quotation import (
    QuotationLineResponse,
    QuotationLineType,
    QuotationResponse,
    QuotationStatus,
)
from app.schemas.subscription import SubscriptionResponse, SubscriptionStatus


@pytest.fixture
async def sample_plan(plan_repo: InMemoryPlanRepository) -> PlanResponse:
    plan = PlanResponse(
        id=uuid4(),
        name="Pro Monthly",
        code="PRO-M",
        price=Decimal("1500.00"),
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
        name="Security Shield Addon",
        sales_price=Decimal("500.00"),
        cost_price=Decimal("200.00"),
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    return await prod_repo.create_product(product)


@pytest.fixture
async def sample_confirmed_quotation(
    quotation_repo: InMemoryQuotationRepository,
    customer_user: User,
    sample_plan: PlanResponse,
) -> QuotationResponse:
    now = datetime.now(timezone.utc)
    qid = uuid4()
    q = QuotationResponse(
        id=qid,
        quotation_number="QT-TEST-0001",
        customer_id=customer_user.id,
        status=QuotationStatus.CONFIRMED,
        currency="INR",
        subtotal=Decimal("1500.00"),
        discount_total=Decimal("0.00"),
        tax_total=Decimal("0.00"),
        total_amount=Decimal("1500.00"),
        valid_until=None,
        notes="Pre-confirmed quotation for test",
        created_by=customer_user.id,
        confirmed_at=now,
        created_at=now,
        updated_at=now,
        lines=[
            QuotationLineResponse(
                id=uuid4(),
                quotation_id=qid,
                line_type=QuotationLineType.PLAN,
                plan_id=sample_plan.id,
                description="Plan: Pro Monthly",
                quantity=Decimal("1.00"),
                unit_price=Decimal("1500.00"),
                discount_percentage=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                tax_rate=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                line_total=Decimal("1500.00"),
                created_at=now,
            )
        ],
    )
    return await quotation_repo.create(q)


@pytest.mark.asyncio
async def test_subscription_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/subscriptions")
    assert resp.status_code == 401

    resp = await client.post("/api/v1/subscriptions", json={})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_subscription_with_plan(
    admin_client: AsyncClient,
    customer_user: User,
    sample_plan: PlanResponse,
):
    payload = {
        "customer_id": str(customer_user.id),
        "plan_id": str(sample_plan.id),
        "currency": "INR",
        "billing_frequency": "monthly",
    }
    resp = await admin_client.post("/api/v1/subscriptions", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert data["status"] == "active"
    assert data["customer_id"] == str(customer_user.id)
    assert data["plan_id"] == str(sample_plan.id)
    assert data["subtotal"] == "1500.00"
    assert data["total_amount"] == "1500.00"
    assert len(data["lines"]) == 1
    assert data["lines"][0]["line_type"] == "plan"
    assert data["lines"][0]["unit_price"] == "1500.00"


@pytest.mark.asyncio
async def test_create_subscription_with_explicit_lines_and_financials(
    admin_client: AsyncClient,
    customer_user: User,
    sample_product: ProductResponse,
    sample_plan: PlanResponse,
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
                "discount_percentage": "0.00",
                "tax_rate": "18.00",
            },
        ],
    }
    resp = await admin_client.post("/api/v1/subscriptions", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    # Plan: 1500 * 1 = 1500, disc 10% = 150.00, taxable = 1350.00, tax 18% = 243.00, line_total = 1593.00
    # Product: 500 * 2 = 1000, disc 0, taxable = 1000.00, tax 18% = 180.00, line_total = 1180.00
    # Subtotal gross = 1500 + 1000 = 2500.00
    # Discount total = 150.00
    # Tax total = 243.00 + 180.00 = 423.00
    # Total amount = 1593.00 + 1180.00 = 2773.00
    assert data["subtotal"] == "2500.00"
    assert data["discount_total"] == "150.00"
    assert data["tax_total"] == "423.00"
    assert data["total_amount"] == "2773.00"


@pytest.mark.asyncio
async def test_create_subscription_validation_empty(customer_client: AsyncClient):
    payload = {"currency": "INR"}
    resp = await customer_client.post("/api/v1/subscriptions", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_subscription_nonexistent_product(
    admin_client: AsyncClient,
    customer_user: User,
):
    fake_id = str(uuid4())
    payload = {
        "customer_id": str(customer_user.id),
        "lines": [{"product_id": fake_id, "quantity": "1.00"}],
    }
    resp = await admin_client.post("/api/v1/subscriptions", json=payload)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


@pytest.mark.asyncio
async def test_convert_quotation_to_subscription(
    customer_client: AsyncClient,
    sample_confirmed_quotation: QuotationResponse,
):
    qid = str(sample_confirmed_quotation.id)
    resp = await customer_client.post(f"/api/v1/subscriptions/from-quotation/{qid}")
    assert resp.status_code == 201
    data = resp.json()

    assert data["quotation_id"] == qid
    assert data["status"] == "active"
    assert data["subtotal"] == "1500.00"
    assert data["total_amount"] == "1500.00"
    assert len(data["lines"]) == 1


@pytest.mark.asyncio
async def test_convert_quotation_idempotent(
    customer_client: AsyncClient,
    sample_confirmed_quotation: QuotationResponse,
):
    qid = str(sample_confirmed_quotation.id)
    # First conversion
    resp1 = await customer_client.post(f"/api/v1/subscriptions/from-quotation/{qid}")
    assert resp1.status_code == 201
    sub1_id = resp1.json()["id"]

    # Second conversion - must return same subscription without creating duplicate
    resp2 = await customer_client.post(f"/api/v1/subscriptions/from-quotation/{qid}")
    assert resp2.status_code == 201
    sub2_id = resp2.json()["id"]

    assert sub1_id == sub2_id


@pytest.mark.asyncio
async def test_convert_unconfirmed_quotation_rejected(
    customer_client: AsyncClient,
    customer_user: User,
    quotation_repo: InMemoryQuotationRepository,
):
    now = datetime.now(timezone.utc)
    qid = uuid4()
    draft_quotation = QuotationResponse(
        id=qid,
        quotation_number="QT-DRAFT-001",
        customer_id=customer_user.id,
        status=QuotationStatus.DRAFT,
        currency="INR",
        subtotal=Decimal("100.00"),
        discount_total=Decimal("0.00"),
        tax_total=Decimal("0.00"),
        total_amount=Decimal("100.00"),
        valid_until=None,
        notes=None,
        created_by=customer_user.id,
        confirmed_at=None,
        created_at=now,
        updated_at=now,
        lines=[],
    )
    await quotation_repo.create(draft_quotation)

    resp = await customer_client.post(f"/api/v1/subscriptions/from-quotation/{qid}")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.asyncio
async def test_customer_data_isolation(
    customer_client: AsyncClient,
    sample_plan: PlanResponse,
    subscription_repo: InMemorySubscriptionRepository,
):
    # Subscription belonging to another customer
    other_customer_id = uuid4()
    now = datetime.now(timezone.utc)
    other_sub = await subscription_repo.create(
        SubscriptionResponse(
            id=uuid4(),
            subscription_number="SUB-OTHER-001",
            customer_id=other_customer_id,
            plan_id=sample_plan.id,
            quotation_id=None,
            status=SubscriptionStatus.ACTIVE,
            currency="INR",
            billing_frequency="monthly",
            subtotal=Decimal("1500.00"),
            discount_total=Decimal("0.00"),
            tax_total=Decimal("0.00"),
            total_amount=Decimal("1500.00"),
            start_date=date.today(),
            end_date=None,
            next_billing_date=date.today(),
            notes=None,
            created_by=other_customer_id,
            created_at=now,
            updated_at=now,
            lines=[],
        )
    )

    # Access by logged in customer should 404
    resp = await customer_client.get(f"/api/v1/subscriptions/{other_sub.id}")
    assert resp.status_code == 404

    # List by logged in customer should not contain other customer's subscription
    list_resp = await customer_client.get("/api/v1/subscriptions")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_subscription_pause_and_resume_lifecycle(
    customer_client: AsyncClient,
    sample_confirmed_quotation: QuotationResponse,
):
    qid = str(sample_confirmed_quotation.id)
    resp = await customer_client.post(f"/api/v1/subscriptions/from-quotation/{qid}")
    sub_id = resp.json()["id"]

    # Pause
    pause_resp = await customer_client.post(f"/api/v1/subscriptions/{sub_id}/pause")
    assert pause_resp.status_code == 200
    assert pause_resp.json()["status"] == "paused"
    assert pause_resp.json()["paused_at"] is not None

    # Pause again -> 400
    pause_again = await customer_client.post(f"/api/v1/subscriptions/{sub_id}/pause")
    assert pause_again.status_code == 400
    assert pause_again.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

    # Resume
    resume_resp = await customer_client.post(f"/api/v1/subscriptions/{sub_id}/resume")
    assert resume_resp.status_code == 200
    assert resume_resp.json()["status"] == "active"

    # Resume again -> 400
    resume_again = await customer_client.post(f"/api/v1/subscriptions/{sub_id}/resume")
    assert resume_again.status_code == 400
    assert resume_again.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.asyncio
async def test_subscription_close(
    customer_client: AsyncClient,
    sample_confirmed_quotation: QuotationResponse,
):
    qid = str(sample_confirmed_quotation.id)
    resp = await customer_client.post(f"/api/v1/subscriptions/from-quotation/{qid}")
    sub_id = resp.json()["id"]

    close_resp = await customer_client.post(f"/api/v1/subscriptions/{sub_id}/close")
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "closed"
    assert close_resp.json()["closed_at"] is not None

    # Closing again -> 400
    close_again = await customer_client.post(f"/api/v1/subscriptions/{sub_id}/close")
    assert close_again.status_code == 400
    assert close_again.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.asyncio
async def test_subscription_renewal(
    customer_client: AsyncClient,
    sample_confirmed_quotation: QuotationResponse,
):
    qid = str(sample_confirmed_quotation.id)
    resp = await customer_client.post(f"/api/v1/subscriptions/from-quotation/{qid}")
    sub = resp.json()
    sub_id = sub["id"]
    initial_next_billing = sub["next_billing_date"]

    renew_resp = await customer_client.post(f"/api/v1/subscriptions/{sub_id}/renew")
    assert renew_resp.status_code == 200
    renewed = renew_resp.json()
    assert renewed["next_billing_date"] > initial_next_billing


@pytest.mark.asyncio
async def test_subscription_update_notes(
    customer_client: AsyncClient,
    sample_confirmed_quotation: QuotationResponse,
):
    qid = str(sample_confirmed_quotation.id)
    resp = await customer_client.post(f"/api/v1/subscriptions/from-quotation/{qid}")
    sub_id = resp.json()["id"]

    patch_resp = await customer_client.patch(
        f"/api/v1/subscriptions/{sub_id}",
        json={"notes": "Updated subscription notes by customer"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["notes"] == "Updated subscription notes by customer"
