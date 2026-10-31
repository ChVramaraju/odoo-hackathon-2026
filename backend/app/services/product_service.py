"""
Brightloop — Product & Variant Business Service.

Encapsulates business rules:
- Verifies product existence before variant operations.
- Validates currency codes and positive pricing invariants.
- Applies consistent error handling via AppError.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import status

from app.core.errors import AppError
from app.repositories.product_repository import ProductRepositoryProtocol
from app.schemas.product import (
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantResponse,
)


class ProductService:
    def __init__(self, repo: ProductRepositoryProtocol) -> None:
        self.repo = repo

    async def create_product(self, data: ProductCreate) -> ProductResponse:
        # Business validation: Normalize currency
        data.currency = data.currency.upper()
        return await self.repo.create_product(data)

    async def get_product(self, product_id: UUID) -> ProductResponse:
        product = await self.repo.get_product(product_id)
        if not product:
            raise AppError(
                code="PRODUCT_NOT_FOUND",
                message=f"Product with id '{product_id}' was not found.",
                status_code=status.HTTP_404_NOT_FOUND,
                details=[{"product_id": str(product_id)}],
            )
        return product

    async def list_products(
        self, active_only: bool = False, page: int = 1, page_size: int = 20
    ) -> ProductListResponse:
        if page < 1:
            page = 1
        if page_size < 1 or page_size > 100:
            page_size = 20

        items, total = await self.repo.list_products(
            active_only=active_only, page=page, page_size=page_size
        )
        return ProductListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def update_product(
        self, product_id: UUID, data: ProductUpdate
    ) -> ProductResponse:
        # Ensure product exists first
        await self.get_product(product_id)

        if data.currency:
            data.currency = data.currency.upper()

        updated = await self.repo.update_product(product_id, data)
        if not updated:
            raise AppError(
                code="PRODUCT_NOT_FOUND",
                message=f"Product with id '{product_id}' was not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return updated

    async def create_variant(
        self, product_id: UUID, data: ProductVariantCreate
    ) -> ProductVariantResponse:
        # Enforce referential integrity: parent product must exist
        await self.get_product(product_id)
        return await self.repo.create_variant(product_id, data)

    async def list_variants(
        self, product_id: UUID, active_only: bool = False
    ) -> list[ProductVariantResponse]:
        # Enforce referential integrity: parent product must exist
        await self.get_product(product_id)
        return await self.repo.list_variants(product_id, active_only=active_only)

