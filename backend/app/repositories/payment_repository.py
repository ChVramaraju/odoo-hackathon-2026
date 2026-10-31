"""
Brightloop — Payment Repository.

Defines:
- PaymentRepositoryProtocol
- InMemoryPaymentRepository (for isolated testing)
- SupabasePaymentRepository (for PostgreSQL live persistence)
- get_payment_repository (FastAPI dependency injection provider)
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Protocol
from uuid import UUID

from app.core.config import get_settings
from app.core.errors import AppError
from app.schemas.payment import PaymentMethod, PaymentResponse, PaymentStatus


class PaymentRepositoryProtocol(Protocol):
    async def create(self, payment: PaymentResponse) -> PaymentResponse:
        ...

    async def get(self, id: UUID) -> Optional[PaymentResponse]:
        ...

    async def get_by_idempotency_key(self, key: str) -> Optional[PaymentResponse]:
        ...

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        invoice_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PaymentResponse], int]:
        ...

    async def delete(self, id: UUID) -> bool:
        ...


class InMemoryPaymentRepository:
    """In-memory payment storage for isolated unit tests."""

    def __init__(self) -> None:
        self._payments: dict[UUID, PaymentResponse] = {}

    async def create(self, payment: PaymentResponse) -> PaymentResponse:
        self._payments[payment.id] = payment
        return payment

    async def get(self, id: UUID) -> Optional[PaymentResponse]:
        return self._payments.get(id)

    async def get_by_idempotency_key(self, key: str) -> Optional[PaymentResponse]:
        for p in self._payments.values():
            if p.idempotency_key == key:
                return p
        return None

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        invoice_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PaymentResponse], int]:
        items = list(self._payments.values())
        if customer_id is not None:
            items = [p for p in items if p.customer_id == customer_id]
        if invoice_id is not None:
            items = [p for p in items if p.invoice_id == invoice_id]
        if status is not None:
            items = [p for p in items if p.payment_status.value == status]

        total = len(items)
        offset = (page - 1) * page_size
        paged = items[offset : offset + page_size]
        return paged, total

    async def delete(self, id: UUID) -> bool:
        if id in self._payments:
            del self._payments[id]
            return True
        return False


class SupabasePaymentRepository:
    """PostgreSQL storage via Supabase Client."""

    is_atomic_settlement_managed: bool = True

    def __init__(self, client) -> None:
        self.client = client

    def _row_to_payment(self, row: dict) -> PaymentResponse:
        raw_pdate = row.get("payment_date")
        payment_date = datetime.fromisoformat(raw_pdate) if isinstance(raw_pdate, str) else (raw_pdate or datetime.now(timezone.utc))
        raw_created = row.get("created_at")
        created_at = datetime.fromisoformat(raw_created) if isinstance(raw_created, str) else (raw_created or datetime.now(timezone.utc))
        raw_updated = row.get("updated_at")
        updated_at = datetime.fromisoformat(raw_updated) if isinstance(raw_updated, str) else (raw_updated or datetime.now(timezone.utc))

        status_str = row.get("payment_status") or row.get("status", "completed")
        recorded_by = UUID(str(row["recorded_by"])) if row.get("recorded_by") else (
            UUID(str(row["created_by"])) if row.get("created_by") else None
        )

        raw_method = row.get("payment_method", "manual")
        try:
            payment_method = PaymentMethod(raw_method)
        except ValueError:
            payment_method = PaymentMethod.MANUAL

        return PaymentResponse(
            id=UUID(str(row["id"])),
            payment_number=str(row["payment_number"]),
            invoice_id=UUID(str(row["invoice_id"])),
            customer_id=UUID(str(row["customer_id"])),
            amount=Decimal(str(row["amount"])).quantize(Decimal("0.01")),
            currency=str(row.get("currency", "INR")),
            payment_method=payment_method,
            payment_status=PaymentStatus(status_str),
            payment_date=payment_date,
            transaction_reference=row.get("transaction_reference"),
            idempotency_key=row.get("idempotency_key"),
            notes=row.get("notes"),
            recorded_by=recorded_by,
            created_at=created_at,
            updated_at=updated_at,
        )

    async def create(self, payment: PaymentResponse) -> PaymentResponse:
        method_str = payment.payment_method.value
        # Map sub-types if needed by database check constraint:
        # CHECK (payment_method IN ('card', 'bank_transfer', 'upi', 'net_banking', 'manual', 'cash'))
        if method_str in ("credit_card", "debit_card"):
            method_str = "card"

        payload = {
            "id": str(payment.id),
            "payment_number": payment.payment_number,
            "invoice_id": str(payment.invoice_id),
            "customer_id": str(payment.customer_id),
            "amount": str(payment.amount),
            "currency": payment.currency,
            "payment_method": method_str,
            "payment_status": payment.payment_status.value,
            "payment_date": payment.payment_date.isoformat(),
            "transaction_reference": payment.transaction_reference,
            "idempotency_key": payment.idempotency_key,
            "notes": payment.notes,
            "recorded_by": str(payment.recorded_by) if payment.recorded_by else None,
        }

        try:
            # 1. Attempt PostgreSQL atomic RPC: record_payment_atomic(p_payment JSONB)
            # This executes in a single PostgreSQL ACID transaction:
            # locks the parent invoice FOR UPDATE, validates non-overpayment,
            # enforces idempotency, inserts the payment record, and automatically triggers
            # invoice balance and status reconciliation via trg_payments_apply_to_invoice.
            res = self.client.rpc("record_payment_atomic", {"p_payment": payload}).execute()
            if res.data:
                return self._row_to_payment(res.data)
            return payment
        except Exception as exc:
            err_msg = str(exc)
            # Map PostgreSQL constraint & business rule violations to AppError
            if "exceeds outstanding invoice balance" in err_msg or "Total completed payments" in err_msg:
                raise AppError(
                    code="OVERPAYMENT_NOT_ALLOWED",
                    message="Payment amount exceeds outstanding invoice balance.",
                    status_code=400,
                ) from exc
            if "Idempotency key has already been used with different payment parameters" in err_msg:
                raise AppError(
                    code="CONFLICT",
                    message="Idempotency key has already been used with different payment parameters.",
                    status_code=409,
                ) from exc
            if "Cannot record payment against a cancelled invoice" in err_msg:
                raise AppError(
                    code="INVALID_STATUS_TRANSITION",
                    message="Cannot record payment against a cancelled invoice.",
                    status_code=400,
                ) from exc
            if "Invoice is already paid in full" in err_msg:
                raise AppError(
                    code="INVALID_STATUS_TRANSITION",
                    message="Invoice is already paid in full.",
                    status_code=400,
                ) from exc
            if "Payment currency" in err_msg and "does not match" in err_msg:
                raise AppError(
                    code="CURRENCY_MISMATCH",
                    message="Payment currency does not match invoice currency.",
                    status_code=400,
                ) from exc
            if "not found" in err_msg.lower() and "invoice" in err_msg.lower():
                raise AppError(
                    code="NOT_FOUND",
                    message=f"Invoice not found.",
                    status_code=404,
                ) from exc

            # Fallback to direct payments table insert if RPC is not present
            if "PGRST202" in err_msg or "Could not find the function" in err_msg:
                try:
                    # Provide status/payment_status & created_by/recorded_by compatibility
                    table_payload = dict(payload)
                    table_payload["status"] = payment.payment_status.value
                    table_payload["created_by"] = table_payload["recorded_by"]
                    insert_res = self.client.table("payments").insert(table_payload).execute()
                    if insert_res.data:
                        return self._row_to_payment(insert_res.data[0])
                    return payment
                except Exception as insert_exc:
                    ins_msg = str(insert_exc)
                    if "exceeds invoice total amount" in ins_msg or "check_violation" in ins_msg:
                        raise AppError(
                            code="OVERPAYMENT_NOT_ALLOWED",
                            message="Payment amount exceeds outstanding invoice balance.",
                            status_code=400,
                        ) from insert_exc
                    raise insert_exc from exc

            raise exc

    async def get(self, id: UUID) -> Optional[PaymentResponse]:
        res = self.client.table("payments").select("*").eq("id", str(id)).execute()
        if not res.data:
            return None
        return self._row_to_payment(res.data[0])

    async def get_by_idempotency_key(self, key: str) -> Optional[PaymentResponse]:
        res = self.client.table("payments").select("*").eq("idempotency_key", key).limit(1).execute()
        if not res.data:
            return None
        return self._row_to_payment(res.data[0])

    async def list(
        self,
        customer_id: Optional[UUID] = None,
        invoice_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PaymentResponse], int]:
        query = self.client.table("payments").select("*", count="exact")
        if customer_id is not None:
            query = query.eq("customer_id", str(customer_id))
        if invoice_id is not None:
            query = query.eq("invoice_id", str(invoice_id))
        if status is not None:
            query = query.eq("payment_status", status)

        offset = (page - 1) * page_size
        res = query.order("payment_date", desc=True).range(offset, offset + page_size - 1).execute()
        items = [self._row_to_payment(r) for r in res.data]
        total = res.count if res.count is not None else len(items)
        return items, total

    async def delete(self, id: UUID) -> bool:
        res = self.client.table("payments").delete().eq("id", str(id)).execute()
        return bool(res.data)


def get_payment_repository() -> PaymentRepositoryProtocol:
    """Dependency injection provider for PaymentRepository."""
    settings = get_settings()

    # Fail fast if production is configured but credentials are missing
    if os.getenv("APP_ENV") == "production" or os.getenv("REQUIRE_PERSISTENT_STORAGE") == "true":
        if not (settings.supabase_url and (settings.supabase_service_role_key or settings.supabase_anon_key)):
            raise RuntimeError(
                "Production environment requires Supabase credentials, refusing silent fallback to InMemoryPaymentRepository."
            )

    if settings.supabase_url and (settings.supabase_service_role_key or settings.supabase_anon_key):
        from supabase import create_client

        key = settings.supabase_service_role_key or settings.supabase_anon_key
        try:
            client = create_client(settings.supabase_url, key)
            return SupabasePaymentRepository(client)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to initialise SupabasePaymentRepository: {exc}. "
                "Refusing silent fallback to InMemoryPaymentRepository."
            ) from exc

    return InMemoryPaymentRepository()

