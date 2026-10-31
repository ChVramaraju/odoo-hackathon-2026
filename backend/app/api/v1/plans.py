"""
Brightloop — Subscription Plans API Endpoints.

Implements:
- GET   /api/v1/plans              (Public / Authenticated)
- POST  /api/v1/plans              (Admin only)
- GET   /api/v1/plans/{plan_id}    (Public / Authenticated)
- PATCH /api/v1/plans/{plan_id}    (Admin only)
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies.auth import User, require_role
from app.dependencies.services import get_plan_service
from app.schemas.plan import (
    BillingFrequency,
    PlanCreate,
    PlanListResponse,
    PlanResponse,
    PlanStatus,
    PlanUpdate,
)
from app.services.plan_service import PlanService

router = APIRouter(prefix="/plans", tags=["Plans"])


@router.get(
    "",
    response_model=PlanListResponse,
    summary="List subscription plans",
)
async def list_plans(
    status_filter: Optional[PlanStatus] = Query(default=None, alias="status", description="Filter by status (active/closed)"),
    billing_frequency: Optional[BillingFrequency] = Query(default=None, description="Filter by frequency"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    service: PlanService = Depends(get_plan_service),
) -> PlanListResponse:
    """List subscription pricing plans with optional status and frequency filters."""
    return await service.list_plans(
        status_filter=status_filter,
        billing_frequency=billing_frequency,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create subscription plan",
)
async def create_plan(
    payload: PlanCreate,
    service: PlanService = Depends(get_plan_service),
    current_user: User = Depends(require_role(["admin"])),
) -> PlanResponse:
    """Define a new recurring subscription plan. Restricted to Admin."""
    return await service.create_plan(payload)


@router.get(
    "/{plan_id}",
    response_model=PlanResponse,
    summary="Get plan by ID",
)
async def get_plan(
    plan_id: UUID,
    service: PlanService = Depends(get_plan_service),
) -> PlanResponse:
    """Retrieve detailed plan record by ID."""
    return await service.get_plan(plan_id)


@router.patch(
    "/{plan_id}",
    response_model=PlanResponse,
    summary="Update plan",
)
async def update_plan(
    plan_id: UUID,
    payload: PlanUpdate,
    service: PlanService = Depends(get_plan_service),
    current_user: User = Depends(require_role(["admin"])),
) -> PlanResponse:
    """Update terms or configuration of an existing plan. Restricted to Admin."""
    return await service.update_plan(plan_id, payload)

