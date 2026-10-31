"""
Brightloop — Payment Domain Service.

Business Logic & Integrity:
- Positive amount validation and two-decimal financial quantization.
- Currency match check against linked invoice.
- Overpayment prevention: payment amount cannot exceed outstanding invoice balance.
- Invoice lifecycle check: rejects payments on cancelled or already paid invoices.
- Partial payment and full settlement: transitions invoice status to PAID when balance reaches 0.
- Safe idempotency key handling: returns existing payment on identical retry, rejects conflicts.
- Customer tenancy isolation: customers can only view and pay their own invoices.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from app.core.errors import AppError
from app.dependencies.auth import User
from app.repositories.invoice_repository import InvoiceRepositoryProtocol
from app.repositories.payment_repository import PaymentRepositoryProtocol
from app.schemas.invoice import InvoiceStatus
from app.schemas.payment import (
    PaymentCreate,
    PaymentListResponse,
    PaymentResponse,
    PaymentStatus,
)


class PaymentService:
    def __init__(
        self,
        repo: PaymentRepositoryProtocol,
        invoice_repo: InvoiceRepositoryProtocol,
    ) -> None:
        self.repo = repo
        self.invoice_repo = invoice_repo

    async def record_payment(
        self, data: PaymentCreate, current_user: User
    ) -> PaymentResponse:
        amount = data.amount.quantize(Decimal("0.01"))
        if amount <= Decimal("0.00"):
            raise AppError(
                code="VALIDATION_ERROR",
                message="Payment amount must be greater than zero.",
                status_code=422,
            )

        # 1. Idempotency check
        if data.idempotency_key:
            existing = await self.repo.get_by_idempotency_key(data.idempotency_key)
            if existing:
                # If identical parameters, return existing payment (idempotent retry)
                if (
                    existing.invoice_id == data.invoice_id
                    and existing.amount == amount
                    and existing.currency.upper() == data.currency.upper()
                ):
                    # Customer isolation check on existing
                    if current_user.role == "customer" and existing.customer_id != current_user.id:
                        raise AppError(code="NOT_FOUND", message=f"Payment not found.", status_code=404)
                    return existing
                # If conflicting parameters with same idempotency key
                raise AppError(
                    code="CONFLICT",
                    message="Idempotency key has already been used with different payment parameters.",
                    status_code=409,
                )

        # 2. Invoice existence and tenant check
        invoice = await self.invoice_repo.get(data.invoice_id)
        if not invoice:
            raise AppError(
                code="NOT_FOUND",
                message=f"Invoice {data.invoice_id} not found.",
                status_code=404,
            )

        if current_user.role == "customer" and invoice.customer_id != current_user.id:
            raise AppError(
                code="NOT_FOUND",
                message=f"Invoice {data.invoice_id} not found.",
                status_code=404,
            )

        # 3. Currency match check
        if data.currency.upper() != invoice.currency.upper():
            raise AppError(
                code="CURRENCY_MISMATCH",
                message=f"Payment currency '{data.currency.upper()}' does not match invoice currency '{invoice.currency.upper()}'.",
                status_code=400,
            )

        # 4. Invoice state checks
        if invoice.status == InvoiceStatus.CANCELLED:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Cannot record payment against a cancelled invoice.",
                status_code=400,
            )

        if invoice.status == InvoiceStatus.PAID or invoice.balance <= Decimal("0.00"):
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Invoice is already paid in full.",
                status_code=400,
            )

        # 5. Overpayment guard
        if amount > invoice.balance:
            raise AppError(
                code="OVERPAYMENT_NOT_ALLOWED",
                message=f"Payment amount ({amount}) exceeds outstanding invoice balance ({invoice.balance}).",
                status_code=400,
            )

        # 6. Atomic invoice balance credit update
        updated_inv = await self.invoice_repo.record_payment_credit(data.invoice_id, amount)
        if not updated_inv:
            raise AppError(
                code="INTERNAL_ERROR",
                message="Failed to apply credit to invoice balance.",
                status_code=500,
            )

        # 7. Record payment
        now = datetime.now(timezone.utc)
        payment_date = data.payment_date or now
        payment_number = f"PAY-{now.strftime('%Y%m')}-{uuid4().hex[:6].upper()}"

        payment = PaymentResponse(
            id=uuid4(),
            payment_number=payment_number,
            invoice_id=invoice.id,
            customer_id=invoice.customer_id,
            amount=amount,
            currency=data.currency.upper(),
            payment_method=data.payment_method,
            payment_status=PaymentStatus.COMPLETED,
            payment_date=payment_date,
            transaction_reference=data.transaction_reference,
            idempotency_key=data.idempotency_key,
            notes=data.notes,
            recorded_by=current_user.id,
            created_at=now,
            updated_at=now,
        )

        return await self.repo.create(payment)

    async def get_payment(self, id: UUID, current_user: User) -> PaymentResponse:
        payment = await self.repo.get(id)
        if not payment:
            raise AppError(code="NOT_FOUND", message=f"Payment {id} not found.", status_code=404)

        if current_user.role == "customer" and payment.customer_id != current_user.id:
            raise AppError(code="NOT_FOUND", message=f"Payment {id} not found.", status_code=404)

        return payment

    async def list_payments(
        self,
        customer_id: Optional[UUID],
        invoice_id: Optional[UUID],
        status: Optional[str],
        page: int,
        page_size: int,
        current_user: User,
    ) -> PaymentListResponse:
        if current_user.role == "customer":
            effective_customer_id = current_user.id
        else:
            effective_customer_id = customer_id

        items, total = await self.repo.list(
            customer_id=effective_customer_id,
            invoice_id=invoice_id,
            status=status,
            page=page,
            page_size=page_size,
        )

        return PaymentListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

