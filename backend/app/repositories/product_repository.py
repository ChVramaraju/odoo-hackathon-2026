"""
Brightloop — Product & Variant Repository.

Handles persistence for products and product_variants tables in Supabase PostgreSQL.
Provides an in-memory fallback for local testing when Supabase credentials are absent.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Protocol
from uuid import UUID, uuid4

from app.core.config import get_settings
from app.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantResponse,
)


class ProductRepositoryProtocol(Protocol):
    async def create_product(self, data: ProductCreate) -> ProductResponse: ...
    async def get_product(self, product_id: UUID) -> Optional[ProductResponse]: ...
    async def list_products(
        self, active_only: bool = False, page: int = 1, page_size: int = 20
    ) -> tuple[list[ProductResponse], int]: ...
    async def update_product(
        self, product_id: UUID, data: ProductUpdate
    ) -> Optional[ProductResponse]: ...
    async def create_variant(
        self, product_id: UUID, data: ProductVariantCreate
    ) -> ProductVariantResponse: ...
    async def list_variants(
        self, product_id: UUID, active_only: bool = False
    ) -> list[ProductVariantResponse]: ...
    async def get_variant(self, variant_id: UUID) -> Optional[ProductVariantResponse]: ...


class InMemoryProductRepository:
    """Fast, reliable in-memory implementation for unit testing and offline development."""

    def __init__(self) -> None:
        self._products: dict[UUID, ProductResponse] = {}
        self._variants: dict[UUID, ProductVariantResponse] = {}

    async def create_product(self, data: ProductCreate) -> ProductResponse:
        now = datetime.now(timezone.utc)
        product = ProductResponse(
            id=uuid4(),
            name=data.name,
            type=data.type,
            sales_price=data.sales_price,
            cost_price=data.cost_price,
            currency=data.currency,
            notes=data.notes,
            is_active=data.is_active,
            created_at=now,
            updated_at=now,
        )
        self._products[product.id] = product
        return product

    async def get_product(self, product_id: UUID) -> Optional[ProductResponse]:
        return self._products.get(product_id)

    async def list_products(
        self, active_only: bool = False, page: int = 1, page_size: int = 20
    ) -> tuple[list[ProductResponse], int]:
        items = list(self._products.values())
        if active_only:
            items = [p for p in items if p.is_active]

        items.sort(key=lambda p: p.created_at, reverse=True)
        total = len(items)

        start = (page - 1) * page_size
        end = start + page_size
        return items[start:end], total

    async def update_product(
        self, product_id: UUID, data: ProductUpdate
    ) -> Optional[ProductResponse]:
        existing = self._products.get(product_id)
        if not existing:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return existing

        now = datetime.now(timezone.utc)
        updated_data = existing.model_dump()
        updated_data.update(update_dict)
        updated_data["updated_at"] = now

        updated_product = ProductResponse(**updated_data)
        self._products[product_id] = updated_product
        return updated_product

    async def create_variant(
        self, product_id: UUID, data: ProductVariantCreate
    ) -> ProductVariantResponse:
        now = datetime.now(timezone.utc)
        variant = ProductVariantResponse(
            id=uuid4(),
            product_id=product_id,
            name=data.name,
            value=data.value,
            price_adjustment=data.price_adjustment,
            sku=data.sku,
            is_active=data.is_active,
            created_at=now,
            updated_at=now,
        )
        self._variants[variant.id] = variant
        return variant

    async def list_variants(
        self, product_id: UUID, active_only: bool = False
    ) -> list[ProductVariantResponse]:
        items = [v for v in self._variants.values() if v.product_id == product_id]
        if active_only:
            items = [v for v in items if v.is_active]
        items.sort(key=lambda v: v.created_at)
        return items

    async def get_variant(self, variant_id: UUID) -> Optional[ProductVariantResponse]:
        return self._variants.get(variant_id)


class SupabaseProductRepository:
    """Supabase PostgreSQL client implementation aligned with 001_catalog.sql."""

    def __init__(self, supabase_client) -> None:
        self.client = supabase_client

    async def create_product(self, data: ProductCreate) -> ProductResponse:
        payload = {
            "name": data.name,
            "product_type": data.type,
            "sales_price": str(data.sales_price),
            "cost_price": str(data.cost_price),
            "currency": data.currency,
            "internal_notes": data.notes,
            "is_active": data.is_active,
        }
        res = self.client.table("products").insert(payload).execute()
        return self._row_to_product(res.data[0])

    async def get_product(self, product_id: UUID) -> Optional[ProductResponse]:
        res = self.client.table("products").select("*").eq("id", str(product_id)).execute()
        if not res.data:
            return None
        return self._row_to_product(res.data[0])

    async def list_products(
        self, active_only: bool = False, page: int = 1, page_size: int = 20
    ) -> tuple[list[ProductResponse], int]:
        query = self.client.table("products").select("*", count="exact")
        if active_only:
            query = query.eq("is_active", True)

        start = (page - 1) * page_size
        end = start + page_size - 1
        res = query.order("created_at", desc=True).range(start, end).execute()
        total = res.count or len(res.data)
        return [self._row_to_product(row) for row in res.data], total

    async def update_product(
        self, product_id: UUID, data: ProductUpdate
    ) -> Optional[ProductResponse]:
        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return await self.get_product(product_id)

        db_payload = {}
        for k, v in update_dict.items():
            if k == "type":
                db_payload["product_type"] = v
            elif k == "notes":
                db_payload["internal_notes"] = v
            elif k in ("sales_price", "cost_price") and v is not None:
                db_payload[k] = str(v)
            else:
                db_payload[k] = v

        res = self.client.table("products").update(db_payload).eq("id", str(product_id)).execute()
        if not res.data:
            return None
        return self._row_to_product(res.data[0])

    async def create_variant(
        self, product_id: UUID, data: ProductVariantCreate
    ) -> ProductVariantResponse:
        payload = {
            "product_id": str(product_id),
            "attribute_name": data.name,
            "attribute_value": data.value,
            "price_adjustment": str(data.price_adjustment),
            "sku": data.sku,
            "is_active": data.is_active,
        }
        res = self.client.table("product_variants").insert(payload).execute()
        return self._row_to_variant(res.data[0])

    async def list_variants(
        self, product_id: UUID, active_only: bool = False
    ) -> list[ProductVariantResponse]:
        query = self.client.table("product_variants").select("*").eq("product_id", str(product_id))
        if active_only:
            query = query.eq("is_active", True)
        res = query.order("created_at").execute()
        return [self._row_to_variant(row) for row in res.data]

    async def get_variant(self, variant_id: UUID) -> Optional[ProductVariantResponse]:
        res = self.client.table("product_variants").select("*").eq("id", str(variant_id)).execute()
        if not res.data:
            return None
        return self._row_to_variant(res.data[0])

    def _row_to_product(self, row: dict) -> ProductResponse:
        return ProductResponse(
            id=UUID(row["id"]),
            name=row["name"],
            type=row.get("product_type") or row.get("type", "service"),
            sales_price=Decimal(str(row["sales_price"])),
            cost_price=Decimal(str(row.get("cost_price", "0.00"))),
            currency=row.get("currency", "USD"),
            notes=row.get("internal_notes") or row.get("notes"),
            is_active=row.get("is_active", True),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    def _row_to_variant(self, row: dict) -> ProductVariantResponse:
        return ProductVariantResponse(
            id=UUID(row["id"]),
            product_id=UUID(row["product_id"]),
            name=row.get("attribute_name") or row.get("variant_name") or row.get("name", ""),
            value=row.get("attribute_value") or row.get("variant_value") or row.get("value", ""),
            price_adjustment=Decimal(str(row.get("price_adjustment", "0.00"))),
            sku=row.get("sku"),
            is_active=row.get("is_active", True),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )


_default_product_repo: Optional[ProductRepositoryProtocol] = None


def get_product_repository() -> ProductRepositoryProtocol:
    global _default_product_repo
    if _default_product_repo is None:
        settings = get_settings()
        if settings.supabase_url and (settings.supabase_service_role_key or settings.supabase_anon_key):
            try:
                from supabase import create_client
                key = settings.supabase_service_role_key or settings.supabase_anon_key
                client = create_client(settings.supabase_url, key)
                _default_product_repo = SupabaseProductRepository(client)
            except Exception:
                _default_product_repo = InMemoryProductRepository()
        else:
            _default_product_repo = InMemoryProductRepository()
    return _default_product_repo
