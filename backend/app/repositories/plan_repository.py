"""
Brightloop — Subscription Plan Repository.

Handles persistence for the plans table in Supabase PostgreSQL.
Provides an in-memory fallback for local testing when Supabase credentials are absent.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Protocol
from uuid import UUID, uuid4

from app.core.config import get_settings
from app.schemas.plan import (
    BillingFrequency,
    EndOfTermBehavior,
    PlanCreate,
    PlanResponse,
    PlanStatus,
    PlanUpdate,
)


class PlanRepositoryProtocol(Protocol):
    async def create_plan(self, data: PlanCreate) -> PlanResponse: ...
    async def get_plan(self, plan_id: UUID) -> Optional[PlanResponse]: ...
    async def list_plans(
        self,
        status: Optional[PlanStatus] = None,
        billing_frequency: Optional[BillingFrequency] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PlanResponse], int]: ...
    async def update_plan(self, plan_id: UUID, data: PlanUpdate) -> Optional[PlanResponse]: ...


class InMemoryPlanRepository:
    """Fast, reliable in-memory implementation for unit testing and offline development."""

    def __init__(self) -> None:
        self._plans: dict[UUID, PlanResponse] = {}

    async def create_plan(self, data: PlanCreate) -> PlanResponse:
        now = datetime.now(timezone.utc)
        plan = PlanResponse(
            id=uuid4(),
            name=data.name,
            code=data.code,
            description=data.description,
            price=data.price,
            currency=data.currency,
            billing_frequency=data.billing_frequency,
            billing_interval=data.billing_interval,
            minimum_quantity=data.minimum_quantity,
            start_date=data.start_date,
            end_date=data.end_date,
            end_of_term_behavior=data.end_of_term_behavior,
            status=data.status,
            is_active=data.is_active,
            created_at=now,
            updated_at=now,
        )
        self._plans[plan.id] = plan
        return plan

    async def get_plan(self, plan_id: UUID) -> Optional[PlanResponse]:
        return self._plans.get(plan_id)

    async def list_plans(
        self,
        status: Optional[PlanStatus] = None,
        billing_frequency: Optional[BillingFrequency] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PlanResponse], int]:
        items = list(self._plans.values())
        if status:
            items = [p for p in items if p.status == status]
        if billing_frequency:
            items = [p for p in items if p.billing_frequency == billing_frequency]

        items.sort(key=lambda p: p.created_at, reverse=True)
        total = len(items)

        start = (page - 1) * page_size
        end = start + page_size
        return items[start:end], total

    async def update_plan(self, plan_id: UUID, data: PlanUpdate) -> Optional[PlanResponse]:
        existing = self._plans.get(plan_id)
        if not existing:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return existing

        now = datetime.now(timezone.utc)
        updated_data = existing.model_dump()
        updated_data.update(update_dict)
        updated_data["updated_at"] = now

        updated_plan = PlanResponse(**updated_data)
        self._plans[plan_id] = updated_plan
        return updated_plan


class SupabasePlanRepository:
    """Supabase PostgreSQL client implementation aligned with 001_catalog.sql."""

    def __init__(self, supabase_client) -> None:
        self.client = supabase_client

    async def create_plan(self, data: PlanCreate) -> PlanResponse:
        # Map end_of_term_behavior: if API caller sends "cancel", persist as "close" to satisfy DB constraint
        eot = data.end_of_term_behavior.value
        if eot == "cancel":
            eot = "close"

        payload = {
            "name": data.name,
            "code": data.code,
            "description": data.description,
            "price": str(data.price),
            "currency": data.currency,
            "billing_interval": data.billing_frequency.value,
            "interval_count": data.billing_interval,
            "minimum_quantity": data.minimum_quantity,
            "start_date": data.start_date.isoformat() if data.start_date else None,
            "end_date": data.end_date.isoformat() if data.end_date else None,
            "end_of_term_behavior": eot,
            "status": data.status.value,
            "is_active": data.is_active,
        }
        res = self.client.table("plans").insert(payload).execute()
        return self._row_to_plan(res.data[0])

    async def get_plan(self, plan_id: UUID) -> Optional[PlanResponse]:
        res = self.client.table("plans").select("*").eq("id", str(plan_id)).execute()
        if not res.data:
            return None
        return self._row_to_plan(res.data[0])

    async def list_plans(
        self,
        status: Optional[PlanStatus] = None,
        billing_frequency: Optional[BillingFrequency] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PlanResponse], int]:
        query = self.client.table("plans").select("*", count="exact")
        if status:
            query = query.eq("status", status.value)
        if billing_frequency:
            query = query.eq("billing_interval", billing_frequency.value)

        start = (page - 1) * page_size
        end = start + page_size - 1
        res = query.order("created_at", desc=True).range(start, end).execute()
        total = res.count or len(res.data)
        return [self._row_to_plan(row) for row in res.data], total

    async def update_plan(self, plan_id: UUID, data: PlanUpdate) -> Optional[PlanResponse]:
        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return await self.get_plan(plan_id)

        db_payload = {}
        for k, v in update_dict.items():
            if k == "price" and v is not None:
                db_payload["price"] = str(v)
            elif k == "billing_frequency" and v is not None:
                db_payload["billing_interval"] = v.value
            elif k == "billing_interval" and v is not None:
                db_payload["interval_count"] = v
            elif k == "start_date":
                db_payload["start_date"] = v.isoformat() if v else None
            elif k == "end_date":
                db_payload["end_date"] = v.isoformat() if v else None
            elif k == "end_of_term_behavior" and v is not None:
                eot = v.value
                if eot == "cancel":
                    eot = "close"
                db_payload["end_of_term_behavior"] = eot
            elif k == "status" and v is not None:
                db_payload["status"] = v.value
            elif k == "is_active" and v is not None:
                db_payload["is_active"] = v
            else:
                db_payload[k] = v

        res = self.client.table("plans").update(db_payload).eq("id", str(plan_id)).execute()
        if not res.data:
            return None
        return self._row_to_plan(res.data[0])

    def _row_to_plan(self, row: dict) -> PlanResponse:
        from datetime import date
        raw_start = row.get("start_date") or row.get("available_from")
        raw_end = row.get("end_date") or row.get("available_until")
        start_date = date.fromisoformat(raw_start) if raw_start else None
        end_date = date.fromisoformat(raw_end) if raw_end else None

        # Resolve billing recurrence:
        # In SQL schema: billing_interval is string frequency ('monthly'), interval_count is integer multiplier
        # In API schema: billing_frequency is frequency enum, billing_interval is integer multiplier
        raw_interval = row.get("billing_interval")
        if isinstance(raw_interval, str) and raw_interval in ("daily", "weekly", "monthly", "yearly"):
            freq = BillingFrequency(raw_interval)
        else:
            freq = BillingFrequency(row.get("billing_frequency", "monthly"))

        raw_count = row.get("interval_count")
        if raw_count is not None:
            multiplier = int(raw_count)
        elif isinstance(raw_interval, int):
            multiplier = raw_interval
        else:
            multiplier = 1

        raw_eot = row.get("end_of_term_behavior", "renew")
        eot = EndOfTermBehavior(raw_eot)

        return PlanResponse(
            id=UUID(row["id"]),
            name=row["name"],
            code=row.get("code"),
            description=row.get("description"),
            price=Decimal(str(row["price"])),
            currency=row.get("currency", "USD"),
            billing_frequency=freq,
            billing_interval=multiplier,
            minimum_quantity=row.get("minimum_quantity", 1),
            start_date=start_date,
            end_date=end_date,
            end_of_term_behavior=eot,
            status=PlanStatus(row.get("status", "active")),
            is_active=row.get("is_active", True),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )


_default_plan_repo: Optional[PlanRepositoryProtocol] = None


def get_plan_repository() -> PlanRepositoryProtocol:
    global _default_plan_repo
    if _default_plan_repo is None:
        settings = get_settings()
        if settings.supabase_url and (settings.supabase_service_role_key or settings.supabase_anon_key):
            try:
                from supabase import create_client
                key = settings.supabase_service_role_key or settings.supabase_anon_key
                client = create_client(settings.supabase_url, key)
                _default_plan_repo = SupabasePlanRepository(client)
            except Exception:
                _default_plan_repo = InMemoryPlanRepository()
        else:
            _default_plan_repo = InMemoryPlanRepository()
    return _default_plan_repo
