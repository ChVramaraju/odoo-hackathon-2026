"""
Brightloop — Subscription Endpoints (API v1).

Endpoints:
- POST  /api/v1/subscriptions (Create subscription directly)
- POST  /api/v1/subscriptions/from-quotation/{quotation_id} (Create/convert from confirmed quotation, idempotent)
- GET   /api/v1/subscriptions (List subscriptions - role scoped)
- GET   /api/v1/subscriptions/{id} (Retrieve subscription)
- PATCH /api/v1/subscriptions/{id} (Update subscription metadata)
- POST  /api/v1/subscriptions/{id}/pause (Pause active subscription)
- POST  /api/v1/subscriptions/{id}/resume (Resume paused subscription)
- POST  /api/v1/subscriptions/{id}/renew (Advance billing date of active subscription)
- POST  /api/v1/subscriptions/{id}/close (Close subscription)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies.auth import User, get_current_user
from app.dependencies.services import get_subscription_service
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionListResponse,
    SubscriptionResponse,
    SubscriptionUpdate,
)
from app.services.subscription_service import SubscriptionService

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.post(
    "",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create subscription",
)
async def create_subscription(
    payload: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    """Creates a new subscription directly with validated line items or plan."""
    return await service.create_subscription(payload, current_user)


@router.post(
    "/from-quotation/{quotation_id}",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Convert confirmed quotation to subscription",
)
async def create_subscription_from_quotation(
    quotation_id: UUID,
    current_user: User = Depends(get_current_user),
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    """Converts a confirmed quotation into an active subscription. Idempotent: returns existing subscription if already converted."""
    return await service.create_from_quotation(quotation_id, current_user)


@router.get(
    "",
    response_model=SubscriptionListResponse,
    summary="List subscriptions",
)
async def list_subscriptions(
    customer_id: Optional[UUID] = Query(None, description="Filter by customer ID (Staff/Admin only)"),
    status: Optional[str] = Query(None, description="Filter by status (active, paused, closed, cancelled)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionListResponse:
    """Returns paginated subscriptions. Customers only receive their own records."""
    return await service.list_subscriptions(
        customer_id=customer_id,
        status=status,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get(
    "/{id}",
    response_model=SubscriptionResponse,
    summary="Get subscription by ID",
)
async def get_subscription(
    id: UUID,
    current_user: User = Depends(get_current_user),
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    """Retrieves a subscription by ID. Enforces customer data isolation."""
    return await service.get_subscription(id, current_user)


@router.patch(
    "/{id}",
    response_model=SubscriptionResponse,
    summary="Update subscription",
)
async def update_subscription(
    id: UUID,
    payload: SubscriptionUpdate,
    current_user: User = Depends(get_current_user),
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    """Updates subscription metadata (notes, end_date, next_billing_date)."""
    return await service.update_subscription(id, payload, current_user)


@router.post(
    "/{id}/pause",
    response_model=SubscriptionResponse,
    summary="Pause subscription",
)
async def pause_subscription(
    id: UUID,
    current_user: User = Depends(get_current_user),
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    """Pauses an active subscription."""
    return await service.pause_subscription(id, current_user)


@router.post(
    "/{id}/resume",
    response_model=SubscriptionResponse,
    summary="Resume subscription",
)
async def resume_subscription(
    id: UUID,
    current_user: User = Depends(get_current_user),
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    """Resumes a paused subscription."""
    return await service.resume_subscription(id, current_user)


@router.post(
    "/{id}/renew",
    response_model=SubscriptionResponse,
    summary="Renew subscription",
)
async def renew_subscription(
    id: UUID,
    current_user: User = Depends(get_current_user),
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    """Advances the next billing date of an active subscription by one billing cycle."""
    return await service.renew_subscription(id, current_user)


@router.post(
    "/{id}/close",
    response_model=SubscriptionResponse,
    summary="Close subscription",
)
async def close_subscription(
    id: UUID,
    current_user: User = Depends(get_current_user),
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    """Closes a subscription."""
    return await service.close_subscription(id, current_user)

