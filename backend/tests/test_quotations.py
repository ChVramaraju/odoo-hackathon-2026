"""
Brightloop — Quotation Domain & API Unit Tests.

Covers:
- Unauthenticated access rejection (401).
- Customer self-service quotation creation & ownership locking.
- Admin quotation creation with custom pricing, discounts, and taxes.
- Product, variant, and plan line-item support.
- Historical price snapshot isolation (catalog updates do not mutate quotes).
- Customer data isolation & permissions (404 on cross-customer access).
- Validation error handling (422 for empty lines, dual references, invalid foreign keys).
- Confirmation lifecycle, expired quote rejection, and duplicate confirmation prevention.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.dependencies.auth import User
from app.repositories.plan_repository import InMemoryPlanRepository
from app.repositories.product_repository import InMemoryProductRepository
from app.schemas.plan import BillingFrequency, EndOfTermBehavior, PlanResponse, PlanStatus
from app.schemas.product import ProductResponse, ProductVariantCreate, ProductVariantResponse


@pytest.fixture
async def seed_catalog(
    prod_repo: InMemoryProductRepository, plan_repo: InMemoryPlanRepository
) -> dict:
    now = datetime.now(timezone.utc)

    # 1. Active Product
    prod = await prod_repo.create_product(
        ProductResponse(
            id=uuid4(),
            name="Cloud Storage 100GB",
            type="service",
            sales_price=Decimal("1500.00"),
            cost_price=Decimal("500.00"),
            currency="INR",
            description="Enterprise cloud storage",
            notes="Internal supplier note",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
    )

    # 2. Variant
    variant = await prod_repo.create_variant(
        prod.id,
        ProductVariantCreate(
            name="Tier",
            value="High Speed",
            price_adjustment=Decimal("300.00"),
            sku="CS-100-HS",
            is_active=True,
        ),
    )

    # 3. Active Plan
    plan = await plan_repo.create_plan(
        PlanResponse(
            id=uuid4(),
            name="Monthly Professional",
            description="Professional subscription",
            price=Decimal("4999.00"),
            currency="INR",
            billing_frequency=BillingFrequency.MONTHLY,
            billing_interval=1,
            minimum_quantity=1,
            start_date=None,
            end_date=None,
            end_of_term_behavior=EndOfTermBehavior.RENEW,
            status=PlanStatus.ACTIVE,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
    )

    # 4. Inactive Product
    inactive_prod = await prod_repo.create_product(
        ProductResponse(
            id=uuid4(),
            name="Legacy Backup",
            type="service",
            sales_price=Decimal("800.00"),
            cost_price=Decimal("200.00"),
            currency="INR",
            description="Deprecated service",
            is_active=False,
            created_at=now,
            updated_at=now,
        )
    )

    return {
        "product": prod,
        "variant": variant,
        "plan": plan,
        "inactive_product": inactive_prod,
    }


# ---------------------------------------------------------------------------
# 1. Authentication & Security
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_unauthenticated_requests_rejected(client: AsyncClient):
    fake_id = uuid4()
    assert (await client.post("/api/v1/quotations", json={})).status_code == 401
    assert (await client.get("/api/v1/quotations")).status_code == 401
    assert (await client.get(f"/api/v1/quotations/{fake_id}")).status_code == 401
    assert (await client.post(f"/api/v1/quotations/{fake_id}/confirm")).status_code == 401


# ---------------------------------------------------------------------------
# 2. Quotation Creation & Snapshots
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_customer_create_quotation_with_product_snapshot(
    customer_client: AsyncClient, customer_user: User, seed_catalog: dict
):
    prod = seed_catalog["product"]

    res = await customer_client.post(
        "/api/v1/quotations",
        json={
            "lines": [
                {
                    "product_id": str(prod.id),
                    "quantity": "2.00",
                }
            ]
        },
    )
    assert res.status_code == 201
    data = res.json()

    assert data["customer_id"] == str(customer_user.id)
    assert data["status"] == "draft"
    assert data["currency"] == "INR"
    assert data["subtotal"] == "3000.00"
    assert data["discount_total"] == "0.00"
    assert data["tax_total"] == "0.00"
    assert data["total_amount"] == "3000.00"

    assert len(data["lines"]) == 1
    line = data["lines"][0]
    assert line["product_id"] == str(prod.id)
    assert line["unit_price"] == "1500.00"
    assert line["description"] == prod.name
    assert line["line_total"] == "3000.00"


@pytest.mark.asyncio
async def test_quotation_with_variant_snapshot(
    customer_client: AsyncClient, seed_catalog: dict
):
    prod = seed_catalog["product"]
    variant = seed_catalog["variant"]

    res = await customer_client.post(
        "/api/v1/quotations",
        json={
            "lines": [
                {
                    "product_id": str(prod.id),
                    "variant_id": str(variant.id),
                    "quantity": "1.00",
                }
            ]
        },
    )
    assert res.status_code == 201
    data = res.json()

    # Base price 1500 + adjustment 300 = 1800.00
    assert data["total_amount"] == "1800.00"
    line = data["lines"][0]
    assert line["unit_price"] == "1800.00"
    assert "Tier: High Speed" in line["description"]


@pytest.mark.asyncio
async def test_quotation_with_plan_reference(
    customer_client: AsyncClient, seed_catalog: dict
):
    plan = seed_catalog["plan"]

    res = await customer_client.post(
        "/api/v1/quotations",
        json={
            "lines": [
                {
                    "plan_id": str(plan.id),
                    "quantity": "1.00",
                }
            ]
        },
    )
    assert res.status_code == 201
    data = res.json()

    assert data["total_amount"] == "4999.00"
    line = data["lines"][0]
    assert line["line_type"] == "plan"
    assert line["unit_price"] == "4999.00"
    assert "Monthly Professional" in line["description"]


@pytest.mark.asyncio
async def test_admin_create_quotation_with_discount_and_tax(
    admin_client: AsyncClient, seed_catalog: dict
):
    prod = seed_catalog["product"]
    cust_id = uuid4()

    # 3 units @ 1500.00 = Gross 4500.00
    # 10% discount = 450.00 -> Taxable 4050.00
    # 18% tax = 729.00 -> Total 4779.00
    res = await admin_client.post(
        "/api/v1/quotations",
        json={
            "customer_id": str(cust_id),
            "currency": "INR",
            "lines": [
                {
                    "product_id": str(prod.id),
                    "quantity": "3.00",
                    "discount_percentage": "10.00",
                    "tax_rate": "18.00",
                }
            ],
        },
    )
    assert res.status_code == 201
    data = res.json()

    assert data["customer_id"] == str(cust_id)
    assert data["subtotal"] == "4500.00"
    assert data["discount_total"] == "450.00"
    assert data["tax_total"] == "729.00"
    assert data["total_amount"] == "4779.00"


# ---------------------------------------------------------------------------
# 3. Validation & Inactive Catalog Checks
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_empty_lines_rejected(customer_client: AsyncClient):
    res = await customer_client.post("/api/v1/quotations", json={"lines": []})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_dual_product_and_plan_reference_rejected(
    customer_client: AsyncClient, seed_catalog: dict
):
    prod = seed_catalog["product"]
    plan = seed_catalog["plan"]

    res = await customer_client.post(
        "/api/v1/quotations",
        json={
            "lines": [
                {
                    "product_id": str(prod.id),
                    "plan_id": str(plan.id),
                    "quantity": "1.00",
                }
            ]
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_inactive_product_rejected(
    customer_client: AsyncClient, seed_catalog: dict
):
    inact = seed_catalog["inactive_product"]
    res = await customer_client.post(
        "/api/v1/quotations",
        json={"lines": [{"product_id": str(inact.id), "quantity": "1.00"}]},
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


# ---------------------------------------------------------------------------
# 4. Historical Price Snapshot Isolation
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_catalog_price_update_does_not_mutate_existing_quote(
    customer_client: AsyncClient,
    admin_client: AsyncClient,
    prod_repo: InMemoryProductRepository,
    seed_catalog: dict,
):
    prod = seed_catalog["product"]
    now = datetime.now(timezone.utc)

    # 1. Create quote at 1500.00
    create_res = await customer_client.post(
        "/api/v1/quotations",
        json={"lines": [{"product_id": str(prod.id), "quantity": "1.00"}]},
    )
    assert create_res.status_code == 201
    quote_id = create_res.json()["id"]
    assert create_res.json()["total_amount"] == "1500.00"

    # 2. Later, admin updates product price to 3000.00
    await prod_repo.update_product(
        prod.id,
        ProductResponse(
            id=prod.id,
            name=prod.name,
            type=prod.type,
            sales_price=Decimal("3000.00"),
            cost_price=prod.cost_price,
            currency=prod.currency,
            description=prod.description,
            is_active=True,
            created_at=prod.created_at,
            updated_at=now,
        ),
    )

    # 3. Retrieve quotation: price remains frozen at snapshot 1500.00
    get_res = await customer_client.get(f"/api/v1/quotations/{quote_id}")
    assert get_res.status_code == 200
    assert get_res.json()["total_amount"] == "1500.00"
    assert get_res.json()["lines"][0]["unit_price"] == "1500.00"


# ---------------------------------------------------------------------------
# 5. Customer Data Isolation & Authorization
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_customer_cannot_access_other_customer_quotation(
    customer_client: AsyncClient,
    admin_client: AsyncClient,
    seed_catalog: dict,
):
    prod = seed_catalog["product"]
    other_customer_id = uuid4()

    # Admin creates quote for other customer
    create_res = await admin_client.post(
        "/api/v1/quotations",
        json={
            "customer_id": str(other_customer_id),
            "lines": [{"product_id": str(prod.id), "quantity": "1.00"}],
        },
    )
    quote_id = create_res.json()["id"]

    # Customer attempts GET /quotations/{id} -> 404
    get_res = await customer_client.get(f"/api/v1/quotations/{quote_id}")
    assert get_res.status_code == 404

    # Customer attempts confirm -> 404
    confirm_res = await customer_client.post(f"/api/v1/quotations/{quote_id}/confirm")
    assert confirm_res.status_code == 404

    # Customer lists quotations -> other customer's quote is omitted
    list_res = await customer_client.get("/api/v1/quotations")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert not any(i["id"] == quote_id for i in items)


# ---------------------------------------------------------------------------
# 6. Confirmation Lifecycle & State Machine
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_quotation_confirmation_lifecycle(
    customer_client: AsyncClient, seed_catalog: dict
):
    prod = seed_catalog["product"]
    create_res = await customer_client.post(
        "/api/v1/quotations",
        json={"lines": [{"product_id": str(prod.id), "quantity": "1.00"}]},
    )
    quote_id = create_res.json()["id"]

    # Confirm
    conf_res = await customer_client.post(f"/api/v1/quotations/{quote_id}/confirm")
    assert conf_res.status_code == 200
    data = conf_res.json()
    assert data["status"] == "confirmed"
    assert data["confirmed_at"] is not None

    # Duplicate confirmation attempt is rejected
    dup_res = await customer_client.post(f"/api/v1/quotations/{quote_id}/confirm")
    assert dup_res.status_code == 400
    assert dup_res.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"


@pytest.mark.asyncio
async def test_expired_quotation_cannot_be_confirmed(
    admin_client: AsyncClient, seed_catalog: dict
):
    prod = seed_catalog["product"]
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    create_res = await admin_client.post(
        "/api/v1/quotations",
        json={
            "valid_until": yesterday,
            "lines": [{"product_id": str(prod.id), "quantity": "1.00"}],
        },
    )
    quote_id = create_res.json()["id"]

    conf_res = await admin_client.post(f"/api/v1/quotations/{quote_id}/confirm")
    assert conf_res.status_code == 400
    assert conf_res.json()["error"]["code"] == "EXPIRED_QUOTATION"
