"""
Brightloop — Payment Endpoints (API v1).

Endpoints:
- POST /api/v1/payments (Record payment against an invoice)
- GET  /api/v1/payments (List payments - role scoped)
- GET  /api/v1/payments/{payment_id} (Retrieve payment)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies.auth import User, get_current_user
from app.dependencies.services import get_payment_service
from app.schemas.payment import (
    PaymentCreate,
    PaymentListResponse,
    PaymentResponse,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post(
    "",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record payment",
)
async def record_payment(
    payload: PaymentCreate,
    current_user: User = Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentResponse:
    """Records a payment against an invoice and updates its outstanding balance."""
    return await service.record_payment(payload, current_user)


@router.get(
    "",
    response_model=PaymentListResponse,
    summary="List payments",
)
async def list_payments(
    customer_id: Optional[UUID] = Query(None, description="Filter by customer ID (Staff/Admin only)"),
    invoice_id: Optional[UUID] = Query(None, description="Filter by linked invoice ID"),
    status: Optional[str] = Query(None, description="Filter by payment status (completed, pending, failed, refunded)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentListResponse:
    """Returns paginated payments. Customers only receive their own records."""
    return await service.list_payments(
        customer_id=customer_id,
        invoice_id=invoice_id,
        status=status,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
    summary="Get payment by ID",
)
async def get_payment(
    payment_id: UUID,
    current_user: User = Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentResponse:
    """Retrieves a payment record. Enforces customer data isolation."""
    return await service.get_payment(payment_id, current_user)

