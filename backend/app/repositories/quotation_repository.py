"""
Brightloop — Quotation Repository.

Defines:
- QuotationRepositoryProtocol
- InMemoryQuotationRepository (for offline test suite)
- SupabaseQuotationRepository (for live database persistence)
- get_quotation_repository (FastAPI dependency injection provider)
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, Protocol
from uuid import UUID

from app.core.config import get_settings
from app.schemas.quotation import (
    QuotationLineResponse,
    QuotationLineType,
    QuotationResponse,
    QuotationStatus,
)


class QuotationRepositoryProtocol(Protocol):
    async def create(self, quotation: QuotationResponse) -> QuotationResponse:
        ...

    async def get(self, id: UUID) -> Optional[QuotationResponse]:
        ...

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[QuotationResponse], int]:
        ...

    async def update_status(
        self,
        id: UUID,
        status: QuotationStatus,
        confirmed_at: Optional[datetime] = None,
        expected_status: Optional[QuotationStatus] = None,
    ) -> Optional[QuotationResponse]:
        ...

    async def delete(self, id: UUID) -> bool:
        ...


class InMemoryQuotationRepository:
    """In-memory storage for test isolation."""

    def __init__(self) -> None:
        self._quotations: dict[UUID, QuotationResponse] = {}

    async def create(self, quotation: QuotationResponse) -> QuotationResponse:
        self._quotations[quotation.id] = quotation
        return quotation

    async def get(self, id: UUID) -> Optional[QuotationResponse]:
        return self._quotations.get(id)

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[QuotationResponse], int]:
        items = list(self._quotations.values())
        if customer_id is not None:
            items = [q for q in items if q.customer_id == customer_id]
        if status is not None:
            items = [q for q in items if q.status.value == status]

        total = len(items)
        offset = (page - 1) * page_size
        paged = items[offset : offset + page_size]
        return paged, total

    async def update_status(
        self,
        id: UUID,
        status: QuotationStatus,
        confirmed_at: Optional[datetime] = None,
        expected_status: Optional[QuotationStatus] = None,
    ) -> Optional[QuotationResponse]:
        quotation = self._quotations.get(id)
        if not quotation:
            return None
        if expected_status is not None and quotation.status != expected_status:
            return None

        updated = quotation.model_copy(
            update={
                "status": status,
                "confirmed_at": confirmed_at,
                "updated_at": datetime.now(),
            }
        )
        self._quotations[id] = updated
        return updated

    async def delete(self, id: UUID) -> bool:
        if id in self._quotations:
            del self._quotations[id]
            return True
        return False


class SupabaseQuotationRepository:
    """PostgreSQL storage via Supabase Client."""

    def __init__(self, client) -> None:
        self.client = client

    def _row_to_line(self, row: dict) -> QuotationLineResponse:
        line_type_str = row.get("line_type")
        if not line_type_str:
            line_type = QuotationLineType.PLAN if row.get("plan_id") else QuotationLineType.PRODUCT
        else:
            line_type = QuotationLineType(line_type_str)

        return QuotationLineResponse(
            id=UUID(row["id"]),
            quotation_id=UUID(row["quotation_id"]),
            line_type=line_type,
            product_id=UUID(row["product_id"]) if row.get("product_id") else None,
            variant_id=UUID(row["variant_id"]) if row.get("variant_id") else None,
            plan_id=UUID(row["plan_id"]) if row.get("plan_id") else None,
            description=row["description"],
            quantity=Decimal(str(row["quantity"])).quantize(Decimal("0.01")),
            unit_price=Decimal(str(row["unit_price"])).quantize(Decimal("0.01")),
            discount_percentage=Decimal(str(row.get("discount_percentage", "0.00"))).quantize(Decimal("0.01")),
            discount_amount=Decimal(str(row.get("discount_amount", "0.00"))).quantize(Decimal("0.01")),
            tax_rate=Decimal(str(row.get("tax_rate", "0.00"))).quantize(Decimal("0.01")),
            tax_amount=Decimal(str(row.get("tax_amount", "0.00"))).quantize(Decimal("0.01")),
            line_total=Decimal(str(row["line_total"])).quantize(Decimal("0.01")),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def _row_to_quotation(self, row: dict, lines: list[QuotationLineResponse]) -> QuotationResponse:
        from datetime import date

        raw_valid = row.get("valid_until")
        valid_until = date.fromisoformat(raw_valid) if raw_valid else None
        raw_confirmed = row.get("confirmed_at")
        confirmed_at = datetime.fromisoformat(raw_confirmed) if raw_confirmed else None

        return QuotationResponse(
            id=UUID(row["id"]),
            quotation_number=row["quotation_number"],
            customer_id=UUID(row["customer_id"]),
            status=QuotationStatus(row.get("status", "draft")),
            currency=row.get("currency", "INR"),
            subtotal=Decimal(str(row.get("subtotal", "0.00"))).quantize(Decimal("0.01")),
            discount_total=Decimal(str(row.get("discount_total", "0.00"))).quantize(Decimal("0.01")),
            tax_total=Decimal(str(row.get("tax_total", "0.00"))).quantize(Decimal("0.01")),
            total_amount=Decimal(str(row.get("total_amount", "0.00"))).quantize(Decimal("0.01")),
            valid_until=valid_until,
            notes=row.get("notes"),
            created_by=UUID(row["created_by"]) if row.get("created_by") else None,
            confirmed_at=confirmed_at,
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            lines=lines,
        )

    async def create(self, quotation: QuotationResponse) -> QuotationResponse:
        header_payload = {
            "id": str(quotation.id),
            "quotation_number": quotation.quotation_number,
            "customer_id": str(quotation.customer_id),
            "status": quotation.status.value,
            "currency": quotation.currency,
            "subtotal": str(quotation.subtotal),
            "discount_total": str(quotation.discount_total),
            "tax_total": str(quotation.tax_total),
            "total_amount": str(quotation.total_amount),
            "valid_until": quotation.valid_until.isoformat() if quotation.valid_until else None,
            "notes": quotation.notes,
            "created_by": str(quotation.created_by) if quotation.created_by else None,
            "confirmed_at": quotation.confirmed_at.isoformat() if quotation.confirmed_at else None,
        }

        try:
            self.client.table("quotations").insert(header_payload).execute()
            if quotation.lines:
                lines_payload = [
                    {
                        "id": str(line.id),
                        "quotation_id": str(quotation.id),
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
                    for line in quotation.lines
                ]
                self.client.table("quotation_lines").insert(lines_payload).execute()
        except Exception as exc:
            # Atomicity rollback: prevent orphan quotation header
            try:
                self.client.table("quotations").delete().eq("id", str(quotation.id)).execute()
            except Exception:
                pass
            raise exc

        return quotation

    async def get(self, id: UUID) -> Optional[QuotationResponse]:
        res = self.client.table("quotations").select("*").eq("id", str(id)).execute()
        if not res.data:
            return None

        q_row = res.data[0]
        lines_res = (
            self.client.table("quotation_lines")
            .select("*")
            .eq("quotation_id", str(id))
            .order("created_at")
            .execute()
        )
        lines = [self._row_to_line(r) for r in lines_res.data]
        return self._row_to_quotation(q_row, lines)

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[QuotationResponse], int]:
        query = self.client.table("quotations").select("*", count="exact")
        if customer_id is not None:
            query = query.eq("customer_id", str(customer_id))
        if status is not None:
            query = query.eq("status", status)

        offset = (page - 1) * page_size
        res = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
        total = res.count or len(res.data)

        # Batch load lines for returned quotations
        quotation_ids = [r["id"] for r in res.data]
        lines_by_qid: dict[str, list[QuotationLineResponse]] = {qid: [] for qid in quotation_ids}

        if quotation_ids:
            lines_res = (
                self.client.table("quotation_lines")
                .select("*")
                .in_("quotation_id", quotation_ids)
                .order("created_at")
                .execute()
            )
            for l_row in lines_res.data:
                lines_by_qid[l_row["quotation_id"]].append(self._row_to_line(l_row))

        items = [self._row_to_quotation(r, lines_by_qid[r["id"]]) for r in res.data]
        return items, total

    async def update_status(
        self,
        id: UUID,
        status: QuotationStatus,
        confirmed_at: Optional[datetime] = None,
        expected_status: Optional[QuotationStatus] = None,
    ) -> Optional[QuotationResponse]:
        update_data = {
            "status": status.value,
            "confirmed_at": confirmed_at.isoformat() if confirmed_at else None,
            "updated_at": datetime.now().isoformat(),
        }
        query = self.client.table("quotations").update(update_data).eq("id", str(id))
        if expected_status is not None:
            # Atomic conditional transition: WHERE id = :id AND status = :expected_status
            query = query.eq("status", expected_status.value)
        res = query.execute()
        if not res.data:
            return None
        return await self.get(id)

    async def delete(self, id: UUID) -> bool:
        res = self.client.table("quotations").delete().eq("id", str(id)).execute()
        return bool(res.data)


_default_quotation_repo: Optional[QuotationRepositoryProtocol] = None


def get_quotation_repository() -> QuotationRepositoryProtocol:
    global _default_quotation_repo
    if _default_quotation_repo is None:
        settings = get_settings()
        if settings.supabase_url and (settings.supabase_service_role_key or settings.supabase_anon_key):
            try:
                from supabase import create_client
                key = settings.supabase_service_role_key or settings.supabase_anon_key
                client = create_client(settings.supabase_url, key)
                _default_quotation_repo = SupabaseQuotationRepository(client)
            except Exception as exc:
                # Do NOT silently switch a production/configured backend to in-memory storage
                raise RuntimeError(
                    f"Failed to initialize SupabaseQuotationRepository with configured SUPABASE_URL: {exc}"
                ) from exc
        else:
            _default_quotation_repo = InMemoryQuotationRepository()
    return _default_quotation_repo

