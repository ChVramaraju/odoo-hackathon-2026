"""
Brightloop — Subscription Repository.

Defines:
- SubscriptionRepositoryProtocol
- InMemorySubscriptionRepository (for test isolation and offline execution)
- SupabaseSubscriptionRepository (for PostgreSQL live persistence)
- get_subscription_repository (FastAPI dependency injection provider)
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Protocol
from uuid import UUID

from app.core.config import get_settings
from app.schemas.subscription import (
    SubscriptionLineResponse,
    SubscriptionLineType,
    SubscriptionResponse,
    SubscriptionStatus,
)


class SubscriptionRepositoryProtocol(Protocol):
    async def create(self, subscription: SubscriptionResponse) -> SubscriptionResponse:
        ...

    async def get(self, id: UUID) -> Optional[SubscriptionResponse]:
        ...

    async def get_by_quotation_id(self, quotation_id: UUID) -> Optional[SubscriptionResponse]:
        ...

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SubscriptionResponse], int]:
        ...

    async def update(
        self,
        id: UUID,
        notes: Optional[str] = None,
        end_date: Optional[date] = None,
        next_billing_date: Optional[date] = None,
    ) -> Optional[SubscriptionResponse]:
        ...

    async def update_status(
        self,
        id: UUID,
        status: SubscriptionStatus,
        timestamp_field: Optional[str] = None,
        timestamp_value: Optional[datetime] = None,
        expected_status: Optional[SubscriptionStatus] = None,
    ) -> Optional[SubscriptionResponse]:
        ...

    async def delete(self, id: UUID) -> bool:
        ...


class InMemorySubscriptionRepository:
    """In-memory subscription storage for isolated testing."""

    def __init__(self) -> None:
        self._subscriptions: dict[UUID, SubscriptionResponse] = {}

    async def create(self, subscription: SubscriptionResponse) -> SubscriptionResponse:
        self._subscriptions[subscription.id] = subscription
        return subscription

    async def get(self, id: UUID) -> Optional[SubscriptionResponse]:
        return self._subscriptions.get(id)

    async def get_by_quotation_id(self, quotation_id: UUID) -> Optional[SubscriptionResponse]:
        for sub in self._subscriptions.values():
            if sub.quotation_id == quotation_id:
                return sub
        return None

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SubscriptionResponse], int]:
        items = list(self._subscriptions.values())
        if customer_id is not None:
            items = [s for s in items if s.customer_id == customer_id]
        if status is not None:
            items = [s for s in items if s.status.value == status]

        total = len(items)
        offset = (page - 1) * page_size
        paged = items[offset : offset + page_size]
        return paged, total

    async def update(
        self,
        id: UUID,
        notes: Optional[str] = None,
        end_date: Optional[date] = None,
        next_billing_date: Optional[date] = None,
    ) -> Optional[SubscriptionResponse]:
        sub = self._subscriptions.get(id)
        if not sub:
            return None

        update_dict: dict = {"updated_at": datetime.now()}
        if notes is not None:
            update_dict["notes"] = notes
        if end_date is not None:
            update_dict["end_date"] = end_date
        if next_billing_date is not None:
            update_dict["next_billing_date"] = next_billing_date

        updated = sub.model_copy(update=update_dict)
        self._subscriptions[id] = updated
        return updated

    async def update_status(
        self,
        id: UUID,
        status: SubscriptionStatus,
        timestamp_field: Optional[str] = None,
        timestamp_value: Optional[datetime] = None,
        expected_status: Optional[SubscriptionStatus] = None,
    ) -> Optional[SubscriptionResponse]:
        sub = self._subscriptions.get(id)
        if not sub:
            return None
        if expected_status is not None and sub.status != expected_status:
            return None

        update_dict: dict = {
            "status": status,
            "updated_at": datetime.now(),
        }
        if timestamp_field:
            update_dict[timestamp_field] = timestamp_value

        updated = sub.model_copy(update=update_dict)
        self._subscriptions[id] = updated
        return updated

    async def delete(self, id: UUID) -> bool:
        if id in self._subscriptions:
            del self._subscriptions[id]
            return True
        return False


class SupabaseSubscriptionRepository:
    """PostgreSQL storage via Supabase Client."""

    def __init__(self, client) -> None:
        self.client = client

    def _row_to_line(self, row: dict) -> SubscriptionLineResponse:
        line_type_str = row.get("line_type")
        if not line_type_str:
            line_type = SubscriptionLineType.PLAN if row.get("plan_id") else SubscriptionLineType.PRODUCT
        else:
            line_type = SubscriptionLineType(line_type_str)

        return SubscriptionLineResponse(
            id=UUID(str(row["id"])),
            subscription_id=UUID(str(row["subscription_id"])),
            line_type=line_type,
            product_id=UUID(str(row["product_id"])) if row.get("product_id") else None,
            variant_id=UUID(str(row["variant_id"])) if row.get("variant_id") else None,
            plan_id=UUID(str(row["plan_id"])) if row.get("plan_id") else None,
            line_number=row.get("line_number", 1),
            description=row["description"],
            quantity=Decimal(str(row["quantity"])).quantize(Decimal("0.01")),
            unit_price=Decimal(str(row["unit_price"])).quantize(Decimal("0.01")),
            discount_percentage=Decimal(str(row.get("discount_percentage", "0.00"))).quantize(Decimal("0.01")),
            discount_amount=Decimal(str(row.get("discount_amount", "0.00"))).quantize(Decimal("0.01")),
            tax_rate=Decimal(str(row.get("tax_rate", "0.00"))).quantize(Decimal("0.01")),
            tax_amount=Decimal(str(row.get("tax_amount", "0.00"))).quantize(Decimal("0.01")),
            line_total=Decimal(str(row["line_total"])).quantize(Decimal("0.01")),
            created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row["created_at"], str) else row["created_at"],
        )

    def _row_to_subscription(self, row: dict, lines: list[SubscriptionLineResponse]) -> SubscriptionResponse:
        raw_start = row.get("start_date")
        start_date = date.fromisoformat(raw_start) if isinstance(raw_start, str) else raw_start
        raw_end = row.get("end_date")
        end_date = date.fromisoformat(raw_end) if isinstance(raw_end, str) else raw_end
        raw_next = row.get("next_billing_date")
        next_billing_date = date.fromisoformat(raw_next) if isinstance(raw_next, str) else raw_next
        raw_paused = row.get("paused_at")
        paused_at = datetime.fromisoformat(raw_paused) if isinstance(raw_paused, str) else raw_paused
        raw_closed = row.get("closed_at")
        closed_at = datetime.fromisoformat(raw_closed) if isinstance(raw_closed, str) else raw_closed
        raw_created = row.get("created_at")
        created_at = datetime.fromisoformat(raw_created) if isinstance(raw_created, str) else (raw_created or datetime.now())
        raw_updated = row.get("updated_at")
        updated_at = datetime.fromisoformat(raw_updated) if isinstance(raw_updated, str) else (raw_updated or datetime.now())

        return SubscriptionResponse(
            id=UUID(str(row["id"])),
            subscription_number=str(row["subscription_number"]),
            customer_id=UUID(str(row["customer_id"])),
            plan_id=UUID(str(row["plan_id"])) if row.get("plan_id") else None,
            quotation_id=UUID(str(row["quotation_id"])) if row.get("quotation_id") else None,
            status=SubscriptionStatus(row.get("status", "active")),
            currency=str(row.get("currency", "INR")),
            billing_frequency=str(row.get("billing_frequency", "monthly")),
            subtotal=Decimal(str(row.get("subtotal", "0.00"))).quantize(Decimal("0.01")),
            discount_total=Decimal(str(row.get("discount_total", "0.00"))).quantize(Decimal("0.01")),
            tax_total=Decimal(str(row.get("tax_total", "0.00"))).quantize(Decimal("0.01")),
            total_amount=Decimal(str(row.get("total_amount", "0.00"))).quantize(Decimal("0.01")),
            start_date=start_date,
            end_date=end_date,
            next_billing_date=next_billing_date,
            paused_at=paused_at,
            closed_at=closed_at,
            notes=row.get("notes"),
            created_by=UUID(str(row["created_by"])) if row.get("created_by") else None,
            created_at=created_at,
            updated_at=updated_at,
            lines=lines,
        )

    async def create(self, subscription: SubscriptionResponse) -> SubscriptionResponse:
        header_payload = {
            "id": str(subscription.id),
            "subscription_number": subscription.subscription_number,
            "customer_id": str(subscription.customer_id),
            "plan_id": str(subscription.plan_id) if subscription.plan_id else None,
            "quotation_id": str(subscription.quotation_id) if subscription.quotation_id else None,
            "status": subscription.status.value,
            "currency": subscription.currency,
            "billing_frequency": subscription.billing_frequency,
            "subtotal": str(subscription.subtotal),
            "discount_total": str(subscription.discount_total),
            "tax_total": str(subscription.tax_total),
            "total_amount": str(subscription.total_amount),
            "start_date": subscription.start_date.isoformat(),
            "end_date": subscription.end_date.isoformat() if subscription.end_date else None,
            "next_billing_date": subscription.next_billing_date.isoformat(),
            "notes": subscription.notes,
            "created_by": str(subscription.created_by) if subscription.created_by else None,
        }

        self.client.table("subscriptions").insert(header_payload).execute()
        if subscription.lines:
            lines_payload = [
                {
                    "id": str(line.id),
                    "subscription_id": str(subscription.id),
                    "line_type": line.line_type.value,
                    "line_number": line.line_number,
                    "product_id": str(line.product_id) if line.product_id else None,
                    "variant_id": str(line.variant_id) if line.variant_id else None,
                    "plan_id": str(line.plan_id) if line.plan_id else None,
                    "description": line.description,
                    "quantity": str(line.quantity),
                    "unit_price": str(line.unit_price),
                    "discount_percentage": str(line.discount_percentage),
                    "discount_amount": str(line.discount_amount),
                    "tax_rate": str(line.tax_rate),
                    "tax_amount": str(line.tax_amount),
                    "line_total": str(line.line_total),
                }
                for line in subscription.lines
            ]
            self.client.table("subscription_lines").insert(lines_payload).execute()

        return subscription

    async def get(self, id: UUID) -> Optional[SubscriptionResponse]:
        res = self.client.table("subscriptions").select("*").eq("id", str(id)).execute()
        if not res.data:
            return None

        sub_row = res.data[0]
        lines_res = (
            self.client.table("subscription_lines")
            .select("*")
            .eq("subscription_id", str(id))
            .order("line_number")
            .execute()
        )
        lines = [self._row_to_line(r) for r in lines_res.data]
        return self._row_to_subscription(sub_row, lines)

    async def get_by_quotation_id(self, quotation_id: UUID) -> Optional[SubscriptionResponse]:
        res = self.client.table("subscriptions").select("*").eq("quotation_id", str(quotation_id)).limit(1).execute()
        if not res.data:
            return None
        return await self.get(UUID(res.data[0]["id"]))

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SubscriptionResponse], int]:
        query = self.client.table("subscriptions").select("*", count="exact")
        if customer_id is not None:
            query = query.eq("customer_id", str(customer_id))
        if status is not None:
            query = query.eq("status", status)

        offset = (page - 1) * page_size
        res = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
        total = res.count or len(res.data)

        subscription_ids = [r["id"] for r in res.data]
        lines_by_sid: dict[str, list[SubscriptionLineResponse]] = {sid: [] for sid in subscription_ids}

        if subscription_ids:
            lines_res = (
                self.client.table("subscription_lines")
                .select("*")
                .in_("subscription_id", subscription_ids)
                .order("line_number")
                .execute()
            )
            for l_row in lines_res.data:
                lines_by_sid[l_row["subscription_id"]].append(self._row_to_line(l_row))

        items = [self._row_to_subscription(r, lines_by_sid[r["id"]]) for r in res.data]
        return items, total

    async def update(
        self,
        id: UUID,
        notes: Optional[str] = None,
        end_date: Optional[date] = None,
        next_billing_date: Optional[date] = None,
    ) -> Optional[SubscriptionResponse]:
        update_data: dict = {"updated_at": datetime.now().isoformat()}
        if notes is not None:
            update_data["notes"] = notes
        if end_date is not None:
            update_data["end_date"] = end_date.isoformat()
        if next_billing_date is not None:
            update_data["next_billing_date"] = next_billing_date.isoformat()

        res = self.client.table("subscriptions").update(update_data).eq("id", str(id)).execute()
        if not res.data:
            return None
        return await self.get(id)

    async def update_status(
        self,
        id: UUID,
        status: SubscriptionStatus,
        timestamp_field: Optional[str] = None,
        timestamp_value: Optional[datetime] = None,
        expected_status: Optional[SubscriptionStatus] = None,
    ) -> Optional[SubscriptionResponse]:
        update_data = {
            "status": status.value,
            "updated_at": datetime.now().isoformat(),
        }
        if timestamp_field and timestamp_value:
            update_data[timestamp_field] = timestamp_value.isoformat()

        query = self.client.table("subscriptions").update(update_data).eq("id", str(id))
        if expected_status is not None:
            query = query.eq("status", expected_status.value)
        res = query.execute()
        if not res.data:
            return None
        return await self.get(id)

    async def delete(self, id: UUID) -> bool:
        res = self.client.table("subscriptions").delete().eq("id", str(id)).execute()
        return bool(res.data)


_default_subscription_repo: Optional[SubscriptionRepositoryProtocol] = None


def get_subscription_repository() -> SubscriptionRepositoryProtocol:
    global _default_subscription_repo
    if _default_subscription_repo is None:
        settings = get_settings()
        if settings.supabase_url and (settings.supabase_service_role_key or settings.supabase_anon_key):
            try:
                from supabase import create_client
                key = settings.supabase_service_role_key or settings.supabase_anon_key
                client = create_client(settings.supabase_url, key)
                _default_subscription_repo = SupabaseSubscriptionRepository(client)
            except Exception as exc:
                raise RuntimeError(
                    f"Failed to initialize SupabaseSubscriptionRepository with configured SUPABASE_URL: {exc}"
                ) from exc
        else:
            _default_subscription_repo = InMemorySubscriptionRepository()
    return _default_subscription_repo

