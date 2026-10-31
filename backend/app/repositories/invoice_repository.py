"""
Brightloop — Invoice Repository.

Defines:
- InvoiceRepositoryProtocol
- InMemoryInvoiceRepository (for test isolation and offline execution)
- SupabaseInvoiceRepository (for PostgreSQL live persistence)
- get_invoice_repository (FastAPI dependency injection provider)
"""

from __future__ import annotations

import os
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, Protocol
from uuid import UUID

from app.core.config import get_settings
from app.schemas.invoice import (
    InvoiceLineResponse,
    InvoiceLineType,
    InvoiceResponse,
    InvoiceStatus,
)


class InvoiceRepositoryProtocol(Protocol):
    async def create(self, invoice: InvoiceResponse) -> InvoiceResponse:
        ...

    async def get(self, id: UUID) -> Optional[InvoiceResponse]:
        ...

    async def get_by_billing_period(
        self, subscription_id: UUID, period_start: date, period_end: date
    ) -> Optional[InvoiceResponse]:
        ...

    async def get_by_quotation_id(self, quotation_id: UUID) -> Optional[InvoiceResponse]:
        ...

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        subscription_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[InvoiceResponse], int]:
        ...

    async def update_status(
        self,
        id: UUID,
        status: InvoiceStatus,
        expected_status: Optional[InvoiceStatus] = None,
        timestamp_field: Optional[str] = None,
        timestamp_value: Optional[datetime] = None,
    ) -> Optional[InvoiceResponse]:
        ...

    async def record_payment_credit(
        self, id: UUID, amount: Decimal
    ) -> Optional[InvoiceResponse]:
        ...

    async def delete(self, id: UUID) -> bool:
        ...


class InMemoryInvoiceRepository:
    """In-memory invoice storage for isolated testing."""

    def __init__(self) -> None:
        self._invoices: dict[UUID, InvoiceResponse] = {}

    async def create(self, invoice: InvoiceResponse) -> InvoiceResponse:
        self._invoices[invoice.id] = invoice
        return invoice

    async def get(self, id: UUID) -> Optional[InvoiceResponse]:
        return self._invoices.get(id)

    async def get_by_billing_period(
        self, subscription_id: UUID, period_start: date, period_end: date
    ) -> Optional[InvoiceResponse]:
        for inv in self._invoices.values():
            if (
                inv.subscription_id == subscription_id
                and inv.billing_period_start == period_start
                and inv.billing_period_end == period_end
                and inv.status != InvoiceStatus.CANCELLED
            ):
                return inv
        return None

    async def get_by_quotation_id(self, quotation_id: UUID) -> Optional[InvoiceResponse]:
        for inv in self._invoices.values():
            if inv.quotation_id == quotation_id and inv.status != InvoiceStatus.CANCELLED:
                return inv
        return None

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        subscription_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[InvoiceResponse], int]:
        items = list(self._invoices.values())
        if customer_id is not None:
            items = [inv for inv in items if inv.customer_id == customer_id]
        if status is not None:
            items = [inv for inv in items if inv.status.value == status]
        if subscription_id is not None:
            items = [inv for inv in items if inv.subscription_id == subscription_id]

        total = len(items)
        offset = (page - 1) * page_size
        paged = items[offset : offset + page_size]
        return paged, total

    async def update_status(
        self,
        id: UUID,
        status: InvoiceStatus,
        expected_status: Optional[InvoiceStatus] = None,
        timestamp_field: Optional[str] = None,
        timestamp_value: Optional[datetime] = None,
    ) -> Optional[InvoiceResponse]:
        inv = self._invoices.get(id)
        if not inv:
            return None
        if expected_status is not None and inv.status != expected_status:
            return None

        update_dict: dict = {
            "status": status,
            "updated_at": datetime.now(timezone.utc),
        }
        if timestamp_field:
            update_dict[timestamp_field] = timestamp_value

        updated = inv.model_copy(update=update_dict)
        self._invoices[id] = updated
        return updated

    async def record_payment_credit(
        self, id: UUID, amount: Decimal
    ) -> Optional[InvoiceResponse]:
        inv = self._invoices.get(id)
        if not inv:
            return None

        new_paid = (inv.amount_paid + amount).quantize(Decimal("0.01"))
        new_balance = (inv.total_amount - new_paid).quantize(Decimal("0.01"))
        new_status = InvoiceStatus.PAID if new_balance <= Decimal("0.00") else inv.status

        update_dict: dict = {
            "amount_paid": new_paid,
            "balance": new_balance,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc),
        }
        if new_status == InvoiceStatus.PAID:
            update_dict["paid_at"] = datetime.now(timezone.utc)

        updated = inv.model_copy(update=update_dict)
        self._invoices[id] = updated
        return updated

    async def delete(self, id: UUID) -> bool:
        if id in self._invoices:
            del self._invoices[id]
            return True
        return False


class SupabaseInvoiceRepository:
    """PostgreSQL storage via Supabase Client."""

    def __init__(self, client) -> None:
        self.client = client
        self._fallback = InMemoryInvoiceRepository()

    def _is_missing_table(self, exc: Exception) -> bool:
        err = str(exc)
        return (
            ("PGRST205" in err or "Could not find the table" in err)
            and os.getenv("APP_ENV") != "production"
            and os.getenv("REQUIRE_PERSISTENT_STORAGE") != "true"
        )

    def _row_to_line(self, row: dict) -> InvoiceLineResponse:
        line_type_str = row.get("line_type")
        if not line_type_str:
            line_type = InvoiceLineType.PLAN if row.get("plan_id") else InvoiceLineType.PRODUCT
        else:
            line_type = InvoiceLineType(line_type_str)

        return InvoiceLineResponse(
            id=UUID(str(row["id"])),
            invoice_id=UUID(str(row["invoice_id"])),
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

    def _row_to_invoice(self, row: dict, lines: list[InvoiceLineResponse]) -> InvoiceResponse:
        raw_inv_date = row.get("invoice_date")
        invoice_date = date.fromisoformat(raw_inv_date) if isinstance(raw_inv_date, str) else raw_inv_date
        raw_due_date = row.get("due_date")
        due_date = date.fromisoformat(raw_due_date) if isinstance(raw_due_date, str) else raw_due_date
        raw_p_start = row.get("billing_period_start")
        period_start = date.fromisoformat(raw_p_start) if isinstance(raw_p_start, str) else raw_p_start
        raw_p_end = row.get("billing_period_end")
        period_end = date.fromisoformat(raw_p_end) if isinstance(raw_p_end, str) else raw_p_end

        raw_conf = row.get("confirmed_at")
        confirmed_at = datetime.fromisoformat(raw_conf) if isinstance(raw_conf, str) else raw_conf
        raw_paid = row.get("paid_at")
        paid_at = datetime.fromisoformat(raw_paid) if isinstance(raw_paid, str) else raw_paid
        raw_canc = row.get("cancelled_at")
        cancelled_at = datetime.fromisoformat(raw_canc) if isinstance(raw_canc, str) else raw_canc

        raw_created = row.get("created_at")
        created_at = datetime.fromisoformat(raw_created) if isinstance(raw_created, str) else (raw_created or datetime.now(timezone.utc))
        raw_updated = row.get("updated_at")
        updated_at = datetime.fromisoformat(raw_updated) if isinstance(raw_updated, str) else (raw_updated or datetime.now(timezone.utc))

        total_amount = Decimal(str(row.get("total_amount", "0.00"))).quantize(Decimal("0.01"))
        amount_paid = Decimal(str(row.get("amount_paid", "0.00"))).quantize(Decimal("0.01"))
        balance = Decimal(str(row.get("balance", str(total_amount - amount_paid)))).quantize(Decimal("0.01"))

        return InvoiceResponse(
            id=UUID(str(row["id"])),
            invoice_number=str(row["invoice_number"]),
            customer_id=UUID(str(row["customer_id"])),
            subscription_id=UUID(str(row["subscription_id"])) if row.get("subscription_id") else None,
            quotation_id=UUID(str(row["quotation_id"])) if row.get("quotation_id") else None,
            status=InvoiceStatus(row.get("status", "draft")),
            currency=str(row.get("currency", "INR")),
            subtotal=Decimal(str(row.get("subtotal", "0.00"))).quantize(Decimal("0.01")),
            discount_total=Decimal(str(row.get("discount_total", "0.00"))).quantize(Decimal("0.01")),
            tax_total=Decimal(str(row.get("tax_total", "0.00"))).quantize(Decimal("0.01")),
            total_amount=total_amount,
            amount_paid=amount_paid,
            balance=balance,
            invoice_date=invoice_date,
            due_date=due_date,
            billing_period_start=period_start,
            billing_period_end=period_end,
            confirmed_at=confirmed_at,
            paid_at=paid_at,
            cancelled_at=cancelled_at,
            notes=row.get("notes"),
            created_by=UUID(str(row["created_by"])) if row.get("created_by") else None,
            created_at=created_at,
            updated_at=updated_at,
            lines=lines,
        )

    async def create(self, invoice: InvoiceResponse) -> InvoiceResponse:
        try:
            return await self._create_impl(invoice)
        except Exception as exc:
            if self._is_missing_table(exc):
                return await self._fallback.create(invoice)
            raise

    async def _create_impl(self, invoice: InvoiceResponse) -> InvoiceResponse:
        header_payload = {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "customer_id": str(invoice.customer_id),
            "subscription_id": str(invoice.subscription_id) if invoice.subscription_id else None,
            "quotation_id": str(invoice.quotation_id) if invoice.quotation_id else None,
            "status": invoice.status.value,
            "currency": invoice.currency,
            "subtotal": str(invoice.subtotal),
            "discount_total": str(invoice.discount_total),
            "tax_total": str(invoice.tax_total),
            "total_amount": str(invoice.total_amount),
            "amount_paid": str(invoice.amount_paid),
            "balance": str(invoice.balance),
            "invoice_date": invoice.invoice_date.isoformat(),
            "due_date": invoice.due_date.isoformat(),
            "billing_period_start": invoice.billing_period_start.isoformat() if invoice.billing_period_start else None,
            "billing_period_end": invoice.billing_period_end.isoformat() if invoice.billing_period_end else None,
            "notes": invoice.notes,
            "created_by": str(invoice.created_by) if invoice.created_by else None,
        }

        self.client.table("invoices").insert(header_payload).execute()
        if invoice.lines:
            lines_payload = [
                {
                    "id": str(line.id),
                    "invoice_id": str(invoice.id),
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
                for line in invoice.lines
            ]
            self.client.table("invoice_lines").insert(lines_payload).execute()

        return invoice

    async def get(self, id: UUID) -> Optional[InvoiceResponse]:
        try:
            return await self._get_impl(id)
        except Exception as exc:
            if self._is_missing_table(exc):
                return await self._fallback.get(id)
            raise

    async def _get_impl(self, id: UUID) -> Optional[InvoiceResponse]:
        res = self.client.table("invoices").select("*").eq("id", str(id)).execute()
        if not res.data:
            return None

        inv_row = res.data[0]
        lines_res = (
            self.client.table("invoice_lines")
            .select("*")
            .eq("invoice_id", str(id))
            .order("line_number")
            .execute()
        )
        lines = [self._row_to_line(r) for r in lines_res.data]
        return self._row_to_invoice(inv_row, lines)

    async def get_by_billing_period(
        self, subscription_id: UUID, period_start: date, period_end: date
    ) -> Optional[InvoiceResponse]:
        try:
            return await self._get_by_billing_period_impl(subscription_id, period_start, period_end)
        except Exception as exc:
            if self._is_missing_table(exc):
                return await self._fallback.get_by_billing_period(subscription_id, period_start, period_end)
            raise

    async def _get_by_billing_period_impl(
        self, subscription_id: UUID, period_start: date, period_end: date
    ) -> Optional[InvoiceResponse]:
        res = (
            self.client.table("invoices")
            .select("*")
            .eq("subscription_id", str(subscription_id))
            .eq("billing_period_start", period_start.isoformat())
            .eq("billing_period_end", period_end.isoformat())
            .neq("status", "cancelled")
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        inv_row = res.data[0]
        return await self.get(UUID(str(inv_row["id"])))

    async def get_by_quotation_id(self, quotation_id: UUID) -> Optional[InvoiceResponse]:
        try:
            return await self._get_by_quotation_id_impl(quotation_id)
        except Exception as exc:
            if self._is_missing_table(exc):
                return await self._fallback.get_by_quotation_id(quotation_id)
            raise

    async def _get_by_quotation_id_impl(self, quotation_id: UUID) -> Optional[InvoiceResponse]:
        res = (
            self.client.table("invoices")
            .select("*")
            .eq("quotation_id", str(quotation_id))
            .neq("status", "cancelled")
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        inv_row = res.data[0]
        return await self.get(UUID(str(inv_row["id"])))

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        subscription_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[InvoiceResponse], int]:
        try:
            return await self._list_impl(customer_id, status, subscription_id, page, page_size)
        except Exception as exc:
            if self._is_missing_table(exc):
                return await self._fallback.list(customer_id, status, subscription_id, page, page_size)
            raise

    async def _list_impl(
        self,
        customer_id: Optional[UUID] = None,
        status: Optional[str] = None,
        subscription_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[InvoiceResponse], int]:
        query = self.client.table("invoices").select("*", count="exact")
        if customer_id is not None:
            query = query.eq("customer_id", str(customer_id))
        if status is not None:
            query = query.eq("status", status)
        if subscription_id is not None:
            query = query.eq("subscription_id", str(subscription_id))

        offset = (page - 1) * page_size
        res = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

        items: list[InvoiceResponse] = []
        for row in res.data:
            lines_res = (
                self.client.table("invoice_lines")
                .select("*")
                .eq("invoice_id", row["id"])
                .order("line_number")
                .execute()
            )
            lines = [self._row_to_line(r) for r in lines_res.data]
            items.append(self._row_to_invoice(row, lines))

        total = res.count if res.count is not None else len(items)
        return items, total

    async def update_status(
        self,
        id: UUID,
        status: InvoiceStatus,
        expected_status: Optional[InvoiceStatus] = None,
        timestamp_field: Optional[str] = None,
        timestamp_value: Optional[datetime] = None,
    ) -> Optional[InvoiceResponse]:
        try:
            return await self._update_status_impl(id, status, expected_status, timestamp_field, timestamp_value)
        except Exception as exc:
            if self._is_missing_table(exc):
                return await self._fallback.update_status(id, status, expected_status, timestamp_field, timestamp_value)
            raise

    async def _update_status_impl(
        self,
        id: UUID,
        status: InvoiceStatus,
        expected_status: Optional[InvoiceStatus] = None,
        timestamp_field: Optional[str] = None,
        timestamp_value: Optional[datetime] = None,
    ) -> Optional[InvoiceResponse]:
        update_dict: dict = {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if timestamp_field and timestamp_value:
            update_dict[timestamp_field] = timestamp_value.isoformat()

        query = self.client.table("invoices").update(update_dict).eq("id", str(id))
        if expected_status is not None:
            query = query.eq("status", expected_status.value)

        res = query.execute()
        if not res.data:
            return None
        return await self.get(id)

    async def record_payment_credit(
        self, id: UUID, amount: Decimal
    ) -> Optional[InvoiceResponse]:
        try:
            return await self._record_payment_credit_impl(id, amount)
        except Exception as exc:
            if self._is_missing_table(exc):
                return await self._fallback.record_payment_credit(id, amount)
            raise

    async def _record_payment_credit_impl(
        self, id: UUID, amount: Decimal
    ) -> Optional[InvoiceResponse]:
        curr = await self.get(id)
        if not curr:
            return None

        new_paid = (curr.amount_paid + amount).quantize(Decimal("0.01"))
        new_balance = (curr.total_amount - new_paid).quantize(Decimal("0.01"))
        new_status = InvoiceStatus.PAID.value if new_balance <= Decimal("0.00") else curr.status.value

        update_dict: dict = {
            "amount_paid": str(new_paid),
            "balance": str(new_balance),
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if new_status == InvoiceStatus.PAID.value:
            update_dict["paid_at"] = datetime.now(timezone.utc).isoformat()

        res = self.client.table("invoices").update(update_dict).eq("id", str(id)).execute()
        if not res.data:
            return None
        return await self.get(id)

    async def delete(self, id: UUID) -> bool:
        try:
            return await self._delete_impl(id)
        except Exception as exc:
            if self._is_missing_table(exc):
                return await self._fallback.delete(id)
            raise

    async def _delete_impl(self, id: UUID) -> bool:
        res = self.client.table("invoices").delete().eq("id", str(id)).execute()
        return bool(res.data)


def get_invoice_repository() -> InvoiceRepositoryProtocol:
    """Dependency injection provider for InvoiceRepository."""
    settings = get_settings()

    # Fail fast if production is configured but credentials are missing
    if os.getenv("APP_ENV") == "production" or os.getenv("REQUIRE_PERSISTENT_STORAGE") == "true":
        if not (settings.supabase_url and (settings.supabase_service_role_key or settings.supabase_anon_key)):
            raise RuntimeError(
                "Production environment requires Supabase credentials, refusing silent fallback to InMemoryInvoiceRepository."
            )

    if settings.supabase_url and (settings.supabase_service_role_key or settings.supabase_anon_key):
        from supabase import create_client

        key = settings.supabase_service_role_key or settings.supabase_anon_key
        try:
            client = create_client(settings.supabase_url, key)
            return SupabaseInvoiceRepository(client)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to initialise SupabaseInvoiceRepository: {exc}. "
                "Refusing silent fallback to InMemoryInvoiceRepository."
            ) from exc

    return InMemoryInvoiceRepository()

