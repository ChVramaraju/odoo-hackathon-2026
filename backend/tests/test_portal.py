import pytest
from httpx import AsyncClient
from app.dependencies.auth import User


@pytest.mark.asyncio
async def test_portal_endpoints_require_auth(client: AsyncClient):
    resp = await client.get("/api/v1/portal/dashboard")
    assert resp.status_code == 401

    resp = await client.get("/api/v1/portal/profile")
    assert resp.status_code == 401

    resp = await client.get("/api/v1/portal/subscriptions")
    assert resp.status_code == 401

    resp = await client.get("/api/v1/portal/invoices")
    assert resp.status_code == 401

    resp = await client.get("/api/v1/portal/payments")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_portal_dashboard_summary_for_customer(customer_client: AsyncClient):
    resp = await customer_client.get("/api/v1/portal/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_subscriptions" in data
    assert "total_outstanding_balance" in data
    assert "recent_invoices" in data
    assert "recent_payments" in data


@pytest.mark.asyncio
async def test_portal_profile_and_update(customer_client: AsyncClient, customer_user: User):
    resp = await customer_client.get("/api/v1/portal/profile")
    assert resp.status_code == 200
    profile = resp.json()
    assert profile["id"] == str(customer_user.id)
    assert profile["email"] == customer_user.email

    # Update profile via PATCH
    patch_resp = await customer_client.patch(
        "/api/v1/portal/profile",
        json={"name": "Sarah Chen", "company": "Acme Cloud Corp"},
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["name"] == "Sarah Chen"
    assert updated["company"] == "Acme Cloud Corp"

    # Update profile via PUT alias
    put_resp = await customer_client.put(
        "/api/v1/portal/profile",
        json={"name": "Sarah C. Chen", "company": "Acme Global"},
    )
    assert put_resp.status_code == 200
    updated_put = put_resp.json()
    assert updated_put["name"] == "Sarah C. Chen"
    assert updated_put["company"] == "Acme Global"


@pytest.mark.asyncio
async def test_portal_lists_for_customer(customer_client: AsyncClient):
    subs_resp = await customer_client.get("/api/v1/portal/subscriptions")
    assert subs_resp.status_code == 200
    subs_data = subs_resp.json()
    assert "items" in subs_data
    assert isinstance(subs_data["items"], list)

    inv_resp = await customer_client.get("/api/v1/portal/invoices")
    assert inv_resp.status_code == 200
    inv_data = inv_resp.json()
    assert "items" in inv_data
    assert isinstance(inv_data["items"], list)

    pay_resp = await customer_client.get("/api/v1/portal/payments")
    assert pay_resp.status_code == 200
    pay_data = pay_resp.json()
    assert "items" in pay_data
    assert isinstance(pay_data["items"], list)
