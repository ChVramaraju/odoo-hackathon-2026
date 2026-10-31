"""
Brightloop — Invoice Domain Service.

Business Logic & Integrity:
- Server-authoritative calculation of all financial values with two-decimal quantization.
- Financial snapshots: unit price, tax, and discount snapshots from products, variants, and plans.
- Idempotent recurring billing: prevents duplicate invoices per subscription billing period.
- Strict customer data isolation: customers access only their own invoices.
- State transitions: draft -> confirmed -> paid / cancelled.
- Direct linking to customers, subscriptions, and quotations.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from app.core.errors import AppError
from app.dependencies.auth import User
from app.repositories.invoice_repository import InvoiceRepositoryProtocol
from app.repositories.plan_repository import PlanRepositoryProtocol
from app.repositories.product_repository import ProductRepositoryProtocol
from app.repositories.subscription_repository import SubscriptionRepositoryProtocol
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceFromSubscriptionCreate,
    InvoiceLineResponse,
    InvoiceLineType,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceStatus,
)
from app.schemas.subscription import SubscriptionLineType


class InvoiceService:
    def __init__(
        self,
        repo: InvoiceRepositoryProtocol,
        product_repo: ProductRepositoryProtocol,
        plan_repo: PlanRepositoryProtocol,
        subscription_repo: SubscriptionRepositoryProtocol,
    ) -> None:
        self.repo = repo
        self.product_repo = product_repo
        self.plan_repo = plan_repo
        self.subscription_repo = subscription_repo

    async def create_invoice(
        self, data: InvoiceCreate, current_user: User
    ) -> InvoiceResponse:
        # Determine customer ownership
        if current_user.role == "customer":
            customer_id = current_user.id
        else:
            customer_id = data.customer_id or current_user.id

        if not data.lines:
            raise AppError(
                code="VALIDATION_ERROR",
                message="Invoice must contain at least one line item.",
                status_code=422,
            )

        now = datetime.now(timezone.utc)
        inv_id = uuid4()
        lines: list[InvoiceLineResponse] = []

        subtotal = Decimal("0.00")
        discount_total = Decimal("0.00")
        tax_total = Decimal("0.00")
        total_amount = Decimal("0.00")

        for idx, line_input in enumerate(data.lines):
            has_prod = bool(line_input.product_id)
            has_plan = bool(line_input.plan_id)

            if not (has_prod ^ has_plan):
                raise AppError(
                    code="VALIDATION_ERROR",
                    message="Each line must reference either a product or a plan, but not both or neither.",
                    status_code=422,
                )

            if has_prod:
                assert line_input.product_id is not None
                product = await self.product_repo.get_product(line_input.product_id)
                if not product or not product.is_active:
                    raise AppError(
                        code="PRODUCT_NOT_FOUND",
                        message=f"Product {line_input.product_id} is inactive or does not exist.",
                        status_code=404,
                    )

                base_price = product.sales_price
                desc = product.name
                line_type = InvoiceLineType.PRODUCT

                if line_input.variant_id:
                    variant = await self.product_repo.get_variant(line_input.variant_id)
                    if not variant or variant.product_id != product.id or not variant.is_active:
                        raise AppError(
                            code="VARIANT_NOT_FOUND",
                            message=f"Variant {line_input.variant_id} is invalid or inactive.",
                            status_code=404,
                        )
                    base_price += variant.price_adjustment
                    desc = f"{product.name} ({variant.name}: {variant.value})"

            else:
                assert line_input.plan_id is not None
                plan = await self.plan_repo.get_plan(line_input.plan_id)
                if not plan or not plan.is_active:
                    raise AppError(
                        code="PLAN_NOT_FOUND",
                        message=f"Plan {line_input.plan_id} is inactive or does not exist.",
                        status_code=404,
                    )

                base_price = plan.price
                desc = f"Plan: {plan.name}"
                line_type = InvoiceLineType.PLAN

            # Price snapshot
            if line_input.unit_price is not None and current_user.role in ("admin", "staff"):
                unit_price = line_input.unit_price.quantize(Decimal("0.01"))
            else:
                unit_price = base_price.quantize(Decimal("0.01"))

            line_desc = line_input.description or desc
            qty = line_input.quantity.quantize(Decimal("0.01"))
            disc_pct = line_input.discount_percentage.quantize(Decimal("0.01"))
            tax_rate = line_input.tax_rate.quantize(Decimal("0.01"))

            gross = (qty * unit_price).quantize(Decimal("0.01"))
            disc_amt = (gross * (disc_pct / Decimal("100.00"))).quantize(Decimal("0.01"))
            taxable = gross - disc_amt
            tax_amt = (taxable * (tax_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            line_total = taxable + tax_amt

            line_resp = InvoiceLineResponse(
                id=uuid4(),
                invoice_id=inv_id,
                line_type=line_type,
                product_id=line_input.product_id,
                variant_id=line_input.variant_id,
                plan_id=line_input.plan_id,
                line_number=idx + 1,
                description=line_desc,
                quantity=qty,
                unit_price=unit_price,
                discount_percentage=disc_pct,
                discount_amount=disc_amt,
                tax_rate=tax_rate,
                tax_amount=tax_amt,
                line_total=line_total,
                created_at=now,
            )
            lines.append(line_resp)
            subtotal += gross
            discount_total += disc_amt
            tax_total += tax_amt
            total_amount += line_total

        inv_date = data.invoice_date or date.today()
        due_date = data.due_date or (inv_date + timedelta(days=15))
        invoice_number = f"INV-{now.strftime('%Y%m')}-{uuid4().hex[:6].upper()}"

        subtotal = subtotal.quantize(Decimal("0.01"))
        discount_total = discount_total.quantize(Decimal("0.01"))
        tax_total = tax_total.quantize(Decimal("0.01"))
        total_amount = total_amount.quantize(Decimal("0.01"))

        invoice = InvoiceResponse(
            id=inv_id,
            invoice_number=invoice_number,
            customer_id=customer_id,
            subscription_id=data.subscription_id,
            quotation_id=data.quotation_id,
            status=InvoiceStatus.DRAFT,
            currency=data.currency,
            subtotal=subtotal,
            discount_total=discount_total,
            tax_total=tax_total,
            total_amount=total_amount,
            amount_paid=Decimal("0.00"),
            balance=total_amount,
            invoice_date=inv_date,
            due_date=due_date,
            billing_period_start=data.billing_period_start,
            billing_period_end=data.billing_period_end,
            confirmed_at=None,
            paid_at=None,
            cancelled_at=None,
            notes=data.notes,
            created_by=current_user.id,
            created_at=now,
            updated_at=now,
            lines=lines,
        )

        return await self.repo.create(invoice)

    async def create_from_subscription(
        self,
        subscription_id: UUID,
        data: InvoiceFromSubscriptionCreate,
        current_user: User,
    ) -> InvoiceResponse:
        sub = await self.subscription_repo.get(subscription_id)
        if not sub:
            raise AppError(code="NOT_FOUND", message=f"Subscription {subscription_id} not found.", status_code=404)

        if current_user.role == "customer" and sub.customer_id != current_user.id:
            raise AppError(code="NOT_FOUND", message=f"Subscription {subscription_id} not found.", status_code=404)

        period_start = data.billing_period_start or sub.start_date
        period_end = data.billing_period_end or sub.next_billing_date

        # Idempotency check: exactly one invoice per subscription billing period
        existing = await self.repo.get_by_billing_period(subscription_id, period_start, period_end)
        if existing:
            return existing

        now = datetime.now(timezone.utc)
        inv_id = uuid4()
        lines: list[InvoiceLineResponse] = []

        for idx, sline in enumerate(sub.lines):
            line_type = (
                InvoiceLineType.PLAN
                if sline.line_type == SubscriptionLineType.PLAN
                else InvoiceLineType.PRODUCT
            )
            inv_line = InvoiceLineResponse(
                id=uuid4(),
                invoice_id=inv_id,
                line_type=line_type,
                product_id=sline.product_id,
                variant_id=sline.variant_id,
                plan_id=sline.plan_id,
                line_number=idx + 1,
                description=sline.description,
                quantity=sline.quantity,
                unit_price=sline.unit_price,
                discount_percentage=sline.discount_percentage,
                discount_amount=sline.discount_amount,
                tax_rate=sline.tax_rate,
                tax_amount=sline.tax_amount,
                line_total=sline.line_total,
                created_at=now,
            )
            lines.append(inv_line)

        inv_date = date.today()
        due_date = data.due_date or (inv_date + timedelta(days=15))
        invoice_number = f"INV-{now.strftime('%Y%m')}-{uuid4().hex[:6].upper()}"

        invoice = InvoiceResponse(
            id=inv_id,
            invoice_number=invoice_number,
            customer_id=sub.customer_id,
            subscription_id=sub.id,
            quotation_id=sub.quotation_id,
            status=InvoiceStatus.DRAFT,
            currency=sub.currency,
            subtotal=sub.subtotal,
            discount_total=sub.discount_total,
            tax_total=sub.tax_total,
            total_amount=sub.total_amount,
            amount_paid=Decimal("0.00"),
            balance=sub.total_amount,
            invoice_date=inv_date,
            due_date=due_date,
            billing_period_start=period_start,
            billing_period_end=period_end,
            confirmed_at=None,
            paid_at=None,
            cancelled_at=None,
            notes=data.notes or f"Generated for subscription {sub.subscription_number}",
            created_by=current_user.id,
            created_at=now,
            updated_at=now,
            lines=lines,
        )

        return await self.repo.create(invoice)

    async def get_invoice(self, id: UUID, current_user: User) -> InvoiceResponse:
        inv = await self.repo.get(id)
        if not inv:
            raise AppError(code="NOT_FOUND", message=f"Invoice {id} not found.", status_code=404)

        if current_user.role == "customer" and inv.customer_id != current_user.id:
            raise AppError(code="NOT_FOUND", message=f"Invoice {id} not found.", status_code=404)

        return inv

    async def list_invoices(
        self,
        customer_id: Optional[UUID],
        status: Optional[str],
        subscription_id: Optional[UUID],
        page: int,
        page_size: int,
        current_user: User,
    ) -> InvoiceListResponse:
        if current_user.role == "customer":
            effective_customer_id = current_user.id
        else:
            effective_customer_id = customer_id

        items, total = await self.repo.list(
            customer_id=effective_customer_id,
            status=status,
            subscription_id=subscription_id,
            page=page,
            page_size=page_size,
        )

        return InvoiceListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def confirm_invoice(self, id: UUID, current_user: User) -> InvoiceResponse:
        inv = await self.get_invoice(id, current_user)

        if inv.status in (InvoiceStatus.CONFIRMED, InvoiceStatus.PAID):
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Invoice is already confirmed or paid.",
                status_code=400,
            )

        if inv.status == InvoiceStatus.CANCELLED:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Cannot confirm a cancelled invoice.",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        updated = await self.repo.update_status(
            id=id,
            status=InvoiceStatus.CONFIRMED,
            expected_status=InvoiceStatus.DRAFT,
            timestamp_field="confirmed_at",
            timestamp_value=now,
        )

        if not updated:
            curr = await self.repo.get(id)
            if curr and curr.status in (InvoiceStatus.CONFIRMED, InvoiceStatus.PAID):
                raise AppError(
                    code="INVALID_STATUS_TRANSITION",
                    message="Invoice is already confirmed.",
                    status_code=400,
                )
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Could not confirm invoice; status has changed or is not draft.",
                status_code=400,
            )

        return updated

    async def cancel_invoice(self, id: UUID, current_user: User) -> InvoiceResponse:
        inv = await self.get_invoice(id, current_user)

        if inv.status == InvoiceStatus.PAID:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Cannot cancel an invoice with recorded payments.",
                status_code=400,
            )

        if inv.status == InvoiceStatus.CANCELLED:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Invoice is already cancelled.",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        updated = await self.repo.update_status(
            id=id,
            status=InvoiceStatus.CANCELLED,
            timestamp_field="cancelled_at",
            timestamp_value=now,
        )

        if not updated:
            raise AppError(code="NOT_FOUND", message=f"Invoice {id} not found.", status_code=404)

        return updated

