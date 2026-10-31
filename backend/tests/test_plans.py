"""
Automated tests for Subscription Plans endpoints.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_plan_admin(admin_client: AsyncClient) -> None:
    payload = {
        "name": "Standard Monthly",
        "description": "Standard business tier billed monthly",
        "price": "49.00",
        "currency": "usd",
        "billing_frequency": "monthly",
        "billing_interval": 1,
        "minimum_quantity": 1,
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "end_of_term_behavior": "renew",
        "status": "active",
    }
    response = await admin_client.post("/api/v1/plans", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Standard Monthly"
    assert data["price"] == "49.00"
    assert data["currency"] == "USD"
    assert data["billing_frequency"] == "monthly"
    assert data["end_of_term_behavior"] == "renew"
    assert data["status"] == "active"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_plan_customer_forbidden(customer_client: AsyncClient) -> None:
    payload = {
        "name": "Unauthorized Plan",
        "price": "99.00",
    }
    response = await customer_client.post("/api/v1/plans", json=payload)
    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_create_plan_unauthenticated(client: AsyncClient) -> None:
    payload = {
        "name": "Anonymous Plan",
        "price": "99.00",
    }
    response = await client.post("/api/v1/plans", json=payload)
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_create_plan_invalid_dates(admin_client: AsyncClient) -> None:
    payload = {
        "name": "Inverted Dates Plan",
        "price": "50.00",
        "start_date": "2026-12-01",
        "end_date": "2026-01-01",  # End before start
    }
    response = await admin_client.post("/api/v1/plans", json=payload)
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "INVALID_DATE_RANGE"


@pytest.mark.asyncio
async def test_get_plan_by_id(admin_client: AsyncClient) -> None:
    create_res = await admin_client.post(
        "/api/v1/plans",
        json={"name": "Enterprise Annual", "price": "999.00", "billing_frequency": "yearly"},
    )
    plan_id = create_res.json()["id"]

    get_res = await admin_client.get(f"/api/v1/plans/{plan_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == plan_id
    assert get_res.json()["name"] == "Enterprise Annual"


@pytest.mark.asyncio
async def test_get_plan_not_found(client: AsyncClient) -> None:
    fake_id = uuid4()
    response = await client.get(f"/api/v1/plans/{fake_id}")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "PLAN_NOT_FOUND"


@pytest.mark.asyncio
async def test_list_plans_with_filters(admin_client: AsyncClient) -> None:
    await admin_client.post(
        "/api/v1/plans",
        json={"name": "Daily Plan", "price": "5.00", "billing_frequency": "daily"},
    )
    await admin_client.post(
        "/api/v1/plans",
        json={"name": "Annual Plan", "price": "100.00", "billing_frequency": "yearly"},
    )

    # Filter by yearly
    res = await admin_client.get("/api/v1/plans?billing_frequency=yearly")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Annual Plan"


@pytest.mark.asyncio
async def test_update_plan(admin_client: AsyncClient) -> None:
    create_res = await admin_client.post(
        "/api/v1/plans",
        json={"name": "Active Plan", "price": "25.00"},
    )
    plan_id = create_res.json()["id"]

    patch_res = await admin_client.patch(
        f"/api/v1/plans/{plan_id}",
        json={"name": "Closed Plan", "status": "closed"},
    )
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["name"] == "Closed Plan"
    assert data["status"] == "closed"



@pytest.mark.asyncio
async def test_create_plan_with_database_schema_aliases(admin_client: AsyncClient) -> None:
    # Verifies that database teammate's proposed column names (available_from, available_until) are accepted
    payload = {
        "name": "Database Aligned Plan",
        "price": "79.00",
        "available_from": "2026-01-01",
        "available_until": "2026-12-31",
    }
    response = await admin_client.post("/api/v1/plans", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Database Aligned Plan"
    assert data["start_date"] == "2026-01-01"
    assert data["end_date"] == "2026-12-31"


@pytest.mark.asyncio
async def test_plan_statuses_draft_and_archived(admin_client: AsyncClient) -> None:
    # Verify support for new DB statuses: draft and archived
    draft_res = await admin_client.post(
        "/api/v1/plans",
        json={"name": "Draft Plan", "price": "19.00", "status": "draft"},
    )
    assert draft_res.status_code == 201
    assert draft_res.json()["status"] == "draft"

    archived_res = await admin_client.post(
        "/api/v1/plans",
        json={"name": "Archived Plan", "price": "19.00", "status": "archived"},
    )
    assert archived_res.status_code == 201
    assert archived_res.json()["status"] == "archived"


@pytest.mark.asyncio
async def test_plan_end_of_term_behavior_close_and_cancel(admin_client: AsyncClient) -> None:
    # Verify both close (DB schema standard) and cancel (legacy alias) work
    close_res = await admin_client.post(
        "/api/v1/plans",
        json={"name": "Close Plan", "price": "29.00", "end_of_term_behavior": "close"},
    )
    assert close_res.status_code == 201
    assert close_res.json()["end_of_term_behavior"] == "close"

    cancel_res = await admin_client.post(
        "/api/v1/plans",
        json={"name": "Cancel Plan", "price": "29.00", "end_of_term_behavior": "cancel"},
    )
    assert cancel_res.status_code == 201
    assert cancel_res.json()["end_of_term_behavior"] == "cancel"


@pytest.mark.asyncio
async def test_plan_is_active_support(admin_client: AsyncClient) -> None:
    # Verify is_active flag defaults to true and can be modified
    res = await admin_client.post(
        "/api/v1/plans",
        json={"name": "Inactive Plan", "price": "39.00", "is_active": False},
    )
    assert res.status_code == 201
    plan_data = res.json()
    assert plan_data["is_active"] is False

    patch_res = await admin_client.patch(
        f"/api/v1/plans/{plan_data['id']}",
        json={"is_active": True},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_active"] is True


def test_supabase_plan_repository_row_to_plan_mapping() -> None:
    from datetime import date
    from decimal import Decimal
    from app.repositories.plan_repository import SupabasePlanRepository
    from app.schemas.plan import BillingFrequency, EndOfTermBehavior, PlanStatus

    repo = SupabasePlanRepository(supabase_client=None)
    fake_id = str(uuid4())
    mock_db_row = {
        "id": fake_id,
        "name": "Live DB Plan Row",
        "description": "Direct DB row mapping test",
        "price": "149.50",
        "currency": "USD",
        "billing_interval": "monthly",
        "interval_count": 3,
        "minimum_quantity": 2,
        "start_date": "2026-02-01",
        "end_date": "2026-11-30",
        "end_of_term_behavior": "close",
        "status": "draft",
        "is_active": True,
        "created_at": "2026-10-31T10:00:00+00:00",
        "updated_at": "2026-10-31T10:00:00+00:00",
    }
    plan = repo._row_to_plan(mock_db_row)
    assert plan.name == "Live DB Plan Row"
    assert plan.price == Decimal("149.50")
    assert plan.billing_frequency == BillingFrequency.MONTHLY
    assert plan.billing_interval == 3
    assert plan.minimum_quantity == 2
    assert plan.start_date == date(2026, 2, 1)
    assert plan.end_date == date(2026, 11, 30)
    assert plan.end_of_term_behavior == EndOfTermBehavior.CLOSE
    assert plan.status == PlanStatus.DRAFT
    assert plan.is_active is True


@pytest.mark.asyncio
async def test_invalid_billing_frequency_rejected(admin_client: AsyncClient) -> None:
    res = await admin_client.post(
        "/api/v1/plans",
        json={
            "name": "Invalid Freq Plan",
            "price": "50.00",
            "billing_frequency": "biweekly",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_invalid_end_of_term_behavior_rejected(admin_client: AsyncClient) -> None:
    res = await admin_client.post(
        "/api/v1/plans",
        json={
            "name": "Invalid EOT Plan",
            "price": "50.00",
            "billing_frequency": "monthly",
            "end_of_term_behavior": "explode",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_staff_can_list_plans(staff_client: AsyncClient) -> None:
    res = await staff_client.get("/api/v1/plans")
    assert res.status_code == 200
    assert "items" in res.json()
