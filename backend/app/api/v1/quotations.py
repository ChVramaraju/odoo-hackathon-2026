"""
Brightloop — Quotation Endpoints (API v1).

Endpoints:
- POST /api/v1/quotations (Create quotation)
- GET  /api/v1/quotations (List quotations - role scoped)
- GET  /api/v1/quotations/{id} (Retrieve quotation)
- POST /api/v1/quotations/{id}/confirm (Confirm quotation)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies.auth import User, get_current_user
from app.dependencies.services import get_quotation_service
from app.schemas.quotation import (
    QuotationCreate,
    QuotationListResponse,
    QuotationResponse,
)
from app.services.quotation_service import QuotationService

router = APIRouter(prefix="/quotations", tags=["Quotations"])


@router.post(
    "",
    response_model=QuotationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create quotation",
)
async def create_quotation(
    payload: QuotationCreate,
    current_user: User = Depends(get_current_user),
    service: QuotationService = Depends(get_quotation_service),
) -> QuotationResponse:
    """Creates a new quotation with validated line items and server-calculated totals."""
    return await service.create_quotation(payload, current_user)


@router.get(
    "",
    response_model=QuotationListResponse,
    summary="List quotations",
)
async def list_quotations(
    customer_id: Optional[UUID] = Query(None, description="Filter by customer ID (Staff/Admin only)"),
    status: Optional[str] = Query(None, description="Filter by status (draft, sent, confirmed, cancelled)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    service: QuotationService = Depends(get_quotation_service),
) -> QuotationListResponse:
    """Returns paginated quotations. Customers only receive their own records."""
    return await service.list_quotations(
        customer_id=customer_id,
        status=status,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get(
    "/{quotation_id}",
    response_model=QuotationResponse,
    summary="Get quotation by ID",
)
async def get_quotation(
    quotation_id: UUID,
    current_user: User = Depends(get_current_user),
    service: QuotationService = Depends(get_quotation_service),
) -> QuotationResponse:
    """Retrieves a quotation and its line items. Enforces customer data isolation."""
    return await service.get_quotation(quotation_id, current_user)


@router.post(
    "/{quotation_id}/confirm",
    response_model=QuotationResponse,
    summary="Confirm quotation",
)
async def confirm_quotation(
    quotation_id: UUID,
    current_user: User = Depends(get_current_user),
    service: QuotationService = Depends(get_quotation_service),
) -> QuotationResponse:
    """Confirms a valid draft quotation and locks it against duplicate confirmations."""
    return await service.confirm_quotation(quotation_id, current_user)
