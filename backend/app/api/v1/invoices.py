"""
Brightloop — Invoice Endpoints (API v1).

Endpoints:
- POST /api/v1/invoices (Create invoice directly)
- POST /api/v1/invoices/from-subscription/{subscription_id} (Create from subscription, idempotent per billing period)
- GET  /api/v1/invoices (List invoices - role scoped)
- GET  /api/v1/invoices/{id} (Retrieve invoice)
- POST /api/v1/invoices/{id}/confirm (Confirm draft invoice)
- POST /api/v1/invoices/{id}/cancel (Cancel invoice)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies.auth import User, get_current_user
from app.dependencies.services import get_invoice_service
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceFromSubscriptionCreate,
    InvoiceListResponse,
    InvoiceResponse,
)
from app.services.invoice_service import InvoiceService

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.post(
    "",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create invoice",
)
async def create_invoice(
    payload: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceResponse:
    """Creates a new invoice directly with validated line items and server-calculated totals."""
    return await service.create_invoice(payload, current_user)


@router.post(
    "/from-subscription/{subscription_id}",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create invoice from subscription",
)
async def create_invoice_from_subscription(
    subscription_id: UUID,
    payload: InvoiceFromSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceResponse:
    """Generates an invoice from a subscription. Idempotent: returns existing invoice for identical billing period."""
    return await service.create_from_subscription(subscription_id, payload, current_user)


@router.get(
    "",
    response_model=InvoiceListResponse,
    summary="List invoices",
)
async def list_invoices(
    customer_id: Optional[UUID] = Query(None, description="Filter by customer ID (Staff/Admin only)"),
    status: Optional[str] = Query(None, description="Filter by status (draft, confirmed, paid, cancelled, overdue)"),
    subscription_id: Optional[UUID] = Query(None, description="Filter by linked subscription ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceListResponse:
    """Returns paginated invoices. Customers only receive their own records."""
    return await service.list_invoices(
        customer_id=customer_id,
        status=status,
        subscription_id=subscription_id,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get(
    "/{id}",
    response_model=InvoiceResponse,
    summary="Get invoice by ID",
)
async def get_invoice(
    id: UUID,
    current_user: User = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceResponse:
    """Retrieves an invoice and its line items. Enforces customer data isolation."""
    return await service.get_invoice(id, current_user)


@router.post(
    "/{id}/confirm",
    response_model=InvoiceResponse,
    summary="Confirm invoice",
)
async def confirm_invoice(
    id: UUID,
    current_user: User = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceResponse:
    """Transitions a draft invoice to confirmed status."""
    return await service.confirm_invoice(id, current_user)


@router.post(
    "/{id}/cancel",
    response_model=InvoiceResponse,
    summary="Cancel invoice",
)
async def cancel_invoice(
    id: UUID,
    current_user: User = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceResponse:
    """Cancels an un-paid draft or confirmed invoice."""
    return await service.cancel_invoice(id, current_user)

