"""
Brightloop — Products & Product Variants API Endpoints.

Implements:
- POST  /api/v1/products                  (Admin only)
- GET   /api/v1/products                  (Public / Authenticated; notes masked for customers)
- GET   /api/v1/products/{product_id}     (Public / Authenticated; notes masked for customers)
- PATCH /api/v1/products/{product_id}     (Admin only)
- POST  /api/v1/products/{product_id}/variants (Admin only)
- GET   /api/v1/products/{product_id}/variants (Public / Authenticated)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies.auth import User, get_current_user_optional, require_role
from app.dependencies.services import get_product_service
from app.schemas.product import (
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantResponse,
)
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["Products"])


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new product",
)
async def create_product(
    payload: ProductCreate,
    service: ProductService = Depends(get_product_service),
    current_user: User = Depends(require_role(["admin"])),
) -> ProductResponse:
    """Create a new product catalog entry. Restricted to Admin."""
    return await service.create_product(payload)


@router.get(
    "",
    response_model=ProductListResponse,
    summary="List products",
)
async def list_products(
    active_only: bool = Query(default=False, description="Filter for active items only"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    service: ProductService = Depends(get_product_service),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> ProductListResponse:
    """List products with pagination and active state filter. Staff/admin view internal notes; customer responses mask internal notes."""
    result = await service.list_products(active_only=active_only, page=page, page_size=page_size)
    is_staff = current_user is not None and current_user.role in ("admin", "staff")
    if not is_staff:
        sanitized_items = [
            item.model_copy(update={"notes": None})
            for item in result.items
        ]
        return ProductListResponse(
            items=sanitized_items,
            total=result.total,
            page=result.page,
            page_size=result.page_size,
        )
    return result


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get product by ID",
)
async def get_product(
    product_id: UUID,
    service: ProductService = Depends(get_product_service),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> ProductResponse:
    """Retrieve detailed product record by ID. Staff/admin view internal notes; customer responses mask internal notes."""
    product = await service.get_product(product_id)
    is_staff = current_user is not None and current_user.role in ("admin", "staff")
    if not is_staff:
        return product.model_copy(update={"notes": None})
    return product


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update product",
)
async def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    service: ProductService = Depends(get_product_service),
    current_user: User = Depends(require_role(["admin"])),
) -> ProductResponse:
    """Update fields on an existing product. Restricted to Admin."""
    return await service.update_product(product_id, payload)


@router.post(
    "/{product_id}/variants",
    response_model=ProductVariantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create product variant",
)
async def create_product_variant(
    product_id: UUID,
    payload: ProductVariantCreate,
    service: ProductService = Depends(get_product_service),
    current_user: User = Depends(require_role(["admin"])),
) -> ProductVariantResponse:
    """Add a variant (tier, addon, seat pack) to an existing product. Restricted to Admin."""
    return await service.create_variant(product_id, payload)


@router.get(
    "/{product_id}/variants",
    response_model=list[ProductVariantResponse],
    summary="List product variants",
)
async def list_product_variants(
    product_id: UUID,
    active_only: bool = Query(default=False, description="Filter for active variants only"),
    service: ProductService = Depends(get_product_service),
) -> list[ProductVariantResponse]:
    """List all variants for a given product."""
    return await service.list_variants(product_id, active_only=active_only)
