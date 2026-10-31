"""
Brightloop — Subscription Plan Business Service.

Encapsulates business rules:
- Validates availability date windows (end_date >= start_date).
- Normalizes currency codes.
- Enforces status transition validations.
- Applies consistent error handling via AppError.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import status

from app.core.errors import AppError
from app.repositories.plan_repository import PlanRepositoryProtocol
from app.schemas.plan import (
    BillingFrequency,
    PlanCreate,
    PlanListResponse,
    PlanResponse,
    PlanStatus,
    PlanUpdate,
)


class PlanService:
    def __init__(self, repo: PlanRepositoryProtocol) -> None:
        self.repo = repo

    async def create_plan(self, data: PlanCreate) -> PlanResponse:
        data.currency = data.currency.upper()

        if data.start_date and data.end_date and data.end_date < data.start_date:
            raise AppError(
                code="INVALID_DATE_RANGE",
                message="Plan end_date cannot be earlier than start_date.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=[{"start_date": str(data.start_date), "end_date": str(data.end_date)}],
            )

        return await self.repo.create_plan(data)

    async def get_plan(self, plan_id: UUID) -> PlanResponse:
        plan = await self.repo.get_plan(plan_id)
        if not plan:
            raise AppError(
                code="PLAN_NOT_FOUND",
                message=f"Plan with id '{plan_id}' was not found.",
                status_code=status.HTTP_404_NOT_FOUND,
                details=[{"plan_id": str(plan_id)}],
            )
        return plan

    async def list_plans(
        self,
        status_filter: Optional[PlanStatus] = None,
        billing_frequency: Optional[BillingFrequency] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PlanListResponse:
        if page < 1:
            page = 1
        if page_size < 1 or page_size > 100:
            page_size = 20

        items, total = await self.repo.list_plans(
            status=status_filter,
            billing_frequency=billing_frequency,
            page=page,
            page_size=page_size,
        )
        return PlanListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def update_plan(self, plan_id: UUID, data: PlanUpdate) -> PlanResponse:
        existing = await self.get_plan(plan_id)

        if data.currency:
            data.currency = data.currency.upper()

        effective_start = data.start_date if data.start_date is not None else existing.start_date
        effective_end = data.end_date if data.end_date is not None else existing.end_date

        if effective_start and effective_end and effective_end < effective_start:
            raise AppError(
                code="INVALID_DATE_RANGE",
                message="Plan end_date cannot be earlier than start_date.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        updated = await self.repo.update_plan(plan_id, data)
        if not updated:
            raise AppError(
                code="PLAN_NOT_FOUND",
                message=f"Plan with id '{plan_id}' was not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return updated

