"""
Automated tests for Products and Product Variants endpoints.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_product_admin(admin_client: AsyncClient) -> None:
    payload = {
        "name": "Cloud Storage Pro",
        "type": "service",
        "sales_price": "29.99",
        "cost_price": "10.00",
        "currency": "usd",
        "notes": "Premium cloud storage tier",
        "is_active": True,
    }
    response = await admin_client.post("/api/v1/products", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Cloud Storage Pro"
    assert data["sales_price"] == "29.99"
    assert data["cost_price"] == "10.00"
    assert data["currency"] == "USD"  # normalized to uppercase
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_product_customer_forbidden(customer_client: AsyncClient) -> None:
    payload = {
        "name": "Unauthorized Product",
        "sales_price": "50.00",
    }
    response = await customer_client.post("/api/v1/products", json=payload)
    assert response.status_code == 403
    body = response.json()
    assert body["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_create_product_unauthenticated(client: AsyncClient) -> None:
    payload = {
        "name": "Anonymous Product",
        "sales_price": "50.00",
    }
    response = await client.post("/api/v1/products", json=payload)
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_create_product_negative_price_rejected(admin_client: AsyncClient) -> None:
    payload = {
        "name": "Invalid Price Product",
        "sales_price": "-10.00",
    }
    response = await admin_client.post("/api/v1/products", json=payload)
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_get_product_by_id(admin_client: AsyncClient) -> None:
    # 1. Create product
    create_res = await admin_client.post(
        "/api/v1/products",
        json={"name": "Analytics Addon", "sales_price": "15.00"},
    )
    product_id = create_res.json()["id"]

    # 2. Retrieve product
    get_res = await admin_client.get(f"/api/v1/products/{product_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == product_id
    assert get_res.json()["name"] == "Analytics Addon"


@pytest.mark.asyncio
async def test_get_product_not_found(client: AsyncClient) -> None:
    fake_id = uuid4()
    response = await client.get(f"/api/v1/products/{fake_id}")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "PRODUCT_NOT_FOUND"


@pytest.mark.asyncio
async def test_list_products_pagination(admin_client: AsyncClient) -> None:
    # Seed 3 products
    for i in range(3):
        await admin_client.post(
            "/api/v1/products",
            json={"name": f"Product {i}", "sales_price": f"{10 + i}.00"},
        )

    # Fetch page 1 with page_size=2
    response = await admin_client.get("/api/v1/products?page=1&page_size=2")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2


@pytest.mark.asyncio
async def test_update_product(admin_client: AsyncClient) -> None:
    create_res = await admin_client.post(
        "/api/v1/products",
        json={"name": "Old Name", "sales_price": "10.00"},
    )
    product_id = create_res.json()["id"]

    patch_res = await admin_client.patch(
        f"/api/v1/products/{product_id}",
        json={"name": "Updated Name", "sales_price": "19.99"},
    )
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["name"] == "Updated Name"
    assert data["sales_price"] == "19.99"


@pytest.mark.asyncio
async def test_create_and_list_variants(admin_client: AsyncClient) -> None:
    # 1. Create product
    prod_res = await admin_client.post(
        "/api/v1/products",
        json={"name": "CRM Base", "sales_price": "50.00"},
    )
    product_id = prod_res.json()["id"]

    # 2. Add variant
    var_res = await admin_client.post(
        f"/api/v1/products/{product_id}/variants",
        json={
            "name": "User Seat",
            "value": "10-User Pack",
            "price_adjustment": "25.00",
            "sku": "CRM-10U",
        },
    )
    assert var_res.status_code == 201
    var_data = var_res.json()
    assert var_data["name"] == "User Seat"
    assert var_data["value"] == "10-User Pack"
    assert var_data["price_adjustment"] == "25.00"
    assert var_data["product_id"] == product_id

    # 3. List variants
    list_res = await admin_client.get(f"/api/v1/products/{product_id}/variants")
    assert list_res.status_code == 200
    variants = list_res.json()
    assert len(variants) == 1
    assert variants[0]["id"] == var_data["id"]


@pytest.mark.asyncio
async def test_create_variant_nonexistent_product(admin_client: AsyncClient) -> None:
    fake_id = uuid4()
    response = await admin_client.post(
        f"/api/v1/products/{fake_id}/variants",
        json={"name": "Seat", "value": "1-User", "price_adjustment": "5.00"},
    )
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "PRODUCT_NOT_FOUND"



@pytest.mark.asyncio
async def test_create_product_with_database_schema_aliases(admin_client: AsyncClient) -> None:
    # Verifies that database teammate's proposed column names (product_type) are accepted
    payload = {
        "name": "Cloud Backup Enterprise",
        "product_type": "service",
        "sales_price": "99.00",
    }
    response = await admin_client.post("/api/v1/products", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Cloud Backup Enterprise"
    assert data["type"] == "service"


@pytest.mark.asyncio
async def test_create_variant_with_database_schema_aliases(admin_client: AsyncClient) -> None:
    # 1. Create product
    prod_res = await admin_client.post(
        "/api/v1/products",
        json={"name": "Database Server", "sales_price": "150.00"},
    )
    product_id = prod_res.json()["id"]

    # 2. Create variant using variant_name and variant_value
    var_res = await admin_client.post(
        f"/api/v1/products/{product_id}/variants",
        json={
            "variant_name": "RAM",
            "variant_value": "64GB",
            "price_adjustment": "50.00",
        },
    )
    assert var_res.status_code == 201
    data = var_res.json()
    assert data["name"] == "RAM"
    assert data["value"] == "64GB"


@pytest.mark.asyncio
async def test_create_variant_with_attribute_name_aliases(admin_client: AsyncClient) -> None:
    # 1. Create product
    prod_res = await admin_client.post(
        "/api/v1/products",
        json={"name": "Compute Node", "sales_price": "200.00"},
    )
    product_id = prod_res.json()["id"]

    # 2. Create variant using database schema column names attribute_name & attribute_value
    var_res = await admin_client.post(
        f"/api/v1/products/{product_id}/variants",
        json={
            "attribute_name": "vCPU",
            "attribute_value": "8-Core",
            "price_adjustment": "75.00",
        },
    )
    assert var_res.status_code == 201
    data = var_res.json()
    assert data["name"] == "vCPU"
    assert data["value"] == "8-Core"


def test_supabase_product_repository_row_to_variant_mapping() -> None:
    from decimal import Decimal
    from app.repositories.product_repository import SupabaseProductRepository

    repo = SupabaseProductRepository(supabase_client=None)
    fake_id = str(uuid4())
    fake_prod_id = str(uuid4())
    mock_db_row = {
        "id": fake_id,
        "product_id": fake_prod_id,
        "attribute_name": "Bandwidth",
        "attribute_value": "10Gbps",
        "price_adjustment": "35.50",
        "sku": "BW-10G",
        "is_active": True,
        "created_at": "2026-10-31T10:00:00+00:00",
        "updated_at": "2026-10-31T10:00:00+00:00",
    }
    variant = repo._row_to_variant(mock_db_row)
    assert variant.name == "Bandwidth"
    assert variant.value == "10Gbps"
    assert variant.price_adjustment == Decimal("35.50")
    assert variant.sku == "BW-10G"
    assert variant.is_active is True


def test_supabase_product_repository_internal_notes_mapping() -> None:
    from decimal import Decimal
    from app.repositories.product_repository import SupabaseProductRepository

    repo = SupabaseProductRepository(supabase_client=None)
    fake_id = str(uuid4())
    mock_db_row = {
        "id": fake_id,
        "name": "Database Mapping Test",
        "product_type": "service",
        "sales_price": "49.99",
        "cost_price": "15.00",
        "currency": "INR",
        "internal_notes": "Internal warehouse note",
        "is_active": True,
        "created_at": "2026-10-31T10:00:00+00:00",
        "updated_at": "2026-10-31T10:00:00+00:00",
    }
    product = repo._row_to_product(mock_db_row)
    assert product.name == "Database Mapping Test"
    assert product.notes == "Internal warehouse note"
    assert product.sales_price == Decimal("49.99")
    assert product.currency == "INR"


@pytest.mark.asyncio
async def test_staff_can_list_products(staff_client: AsyncClient) -> None:
    res = await staff_client.get("/api/v1/products")
    assert res.status_code == 200
    assert "items" in res.json()


@pytest.mark.asyncio
async def test_create_product_default_currency_inr(admin_client: AsyncClient) -> None:
    """When currency is omitted, it defaults to INR."""
    payload = {
        "name": "INR Default Product",
        "sales_price": "100.00",
    }
    response = await admin_client.post("/api/v1/products", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["currency"] == "INR"


@pytest.mark.asyncio
async def test_customer_cannot_read_internal_notes_in_get(
    admin_client: AsyncClient, customer_client: AsyncClient, staff_client: AsyncClient
) -> None:
    """Customer-facing description is returned, but staff-only internal notes are redacted for customers."""
    # 1. Admin creates product with both description and internal notes
    create_res = await admin_client.post(
        "/api/v1/products",
        json={
            "name": "Confidential Product",
            "sales_price": "500.00",
            "description": "Public customer-facing description",
            "notes": "Highly sensitive internal staff notes",
            "is_active": True,
        },
    )
    assert create_res.status_code == 201
    prod_id = create_res.json()["id"]

    # 2. Staff reads product -> notes and internal_notes are visible
    staff_res = await staff_client.get(f"/api/v1/products/{prod_id}")
    assert staff_res.status_code == 200
    staff_data = staff_res.json()
    assert staff_data["description"] == "Public customer-facing description"
    assert staff_data["notes"] == "Highly sensitive internal staff notes"
    assert staff_data["internal_notes"] == "Highly sensitive internal staff notes"

    # 3. Customer reads product -> description is visible, notes and internal_notes are None
    cust_res = await customer_client.get(f"/api/v1/products/{prod_id}")
    assert cust_res.status_code == 200
    cust_data = cust_res.json()
    assert cust_data["description"] == "Public customer-facing description"
    assert cust_data["notes"] is None
    assert cust_data["internal_notes"] is None


@pytest.mark.asyncio
async def test_customer_cannot_read_internal_notes_in_list(
    admin_client: AsyncClient, customer_client: AsyncClient
) -> None:
    """In product listings, customers receive items with redacted internal notes."""
    await admin_client.post(
        "/api/v1/products",
        json={
            "name": "Listing Note Test",
            "sales_price": "120.00",
            "notes": "Hidden internal note",
            "is_active": True,
        },
    )
    cust_res = await customer_client.get("/api/v1/products")
    assert cust_res.status_code == 200
    items = cust_res.json()["items"]
    assert len(items) > 0
    for item in items:
        assert item["notes"] is None
        assert item["internal_notes"] is None


@pytest.mark.asyncio
async def test_customer_receives_404_for_inactive_product(
    admin_client: AsyncClient, customer_client: AsyncClient, staff_client: AsyncClient
) -> None:
    """Inactive products are hidden from customers (404 Not Found), matching database RLS."""
    create_res = await admin_client.post(
        "/api/v1/products",
        json={
            "name": "Draft Inactive Product",
            "sales_price": "200.00",
            "is_active": False,
        },
    )
    assert create_res.status_code == 201
    prod_id = create_res.json()["id"]

    # Staff can see inactive product
    staff_res = await staff_client.get(f"/api/v1/products/{prod_id}")
    assert staff_res.status_code == 200

    # Customer gets 404
    cust_res = await customer_client.get(f"/api/v1/products/{prod_id}")
    assert cust_res.status_code == 404
    assert cust_res.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


@pytest.mark.asyncio
async def test_variant_response_includes_all_contract_and_db_aliases(
    admin_client: AsyncClient,
) -> None:
    """Variant responses include name/value as well as variant_name/variant_value and attribute_name/attribute_value."""
    prod_res = await admin_client.post(
        "/api/v1/products",
        json={"name": "Variant Parent", "sales_price": "100.00"},
    )
    prod_id = prod_res.json()["id"]

    var_res = await admin_client.post(
        f"/api/v1/products/{prod_id}/variants",
        json={
            "name": "Storage Size",
            "value": "500GB",
            "price_adjustment": "50.00",
            "sku": "STORAGE-500",
        },
    )
    assert var_res.status_code == 201
    data = var_res.json()
    assert data["name"] == "Storage Size"
    assert data["value"] == "500GB"
    assert data["variant_name"] == "Storage Size"
    assert data["variant_value"] == "500GB"
    assert data["attribute_name"] == "Storage Size"
    assert data["attribute_value"] == "500GB"
    assert data["sku"] == "STORAGE-500"
