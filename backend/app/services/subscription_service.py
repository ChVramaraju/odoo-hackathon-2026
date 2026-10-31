"""
Brightloop — Subscription Domain Service.

Business Logic & Integrity:
- Server-side calculation of all financial values with two-decimal quantization.
- Price snapshots from products, variants, and plans.
- Idempotent conversion from confirmed quotations (returns existing if already converted).
- Enforces valid lifecycle transitions: active <-> paused -> closed.
- Atomic state transitions to prevent race conditions.
- Role-based authorization & strict data isolation for customers.
- Safe billing period advancement on renewal.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from app.core.errors import AppError
from app.dependencies.auth import User
from app.repositories.plan_repository import PlanRepositoryProtocol
from app.repositories.product_repository import ProductRepositoryProtocol
from app.repositories.quotation_repository import QuotationRepositoryProtocol
from app.repositories.subscription_repository import SubscriptionRepositoryProtocol
from app.schemas.quotation import QuotationLineType, QuotationStatus
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionLineResponse,
    SubscriptionLineType,
    SubscriptionListResponse,
    SubscriptionResponse,
    SubscriptionStatus,
    SubscriptionUpdate,
)


def _add_months(source_date: date, months: int) -> date:
    """Safely advance date by n months, clamping to end-of-month if needed."""
    month_idx = source_date.month - 1 + months
    year = source_date.year + month_idx // 12
    month = month_idx % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _calculate_next_billing_date(start_date: date, frequency: str) -> date:
    freq = (frequency or "monthly").lower()
    if freq == "monthly":
        return _add_months(start_date, 1)
    elif freq == "quarterly":
        return _add_months(start_date, 3)
    elif freq == "yearly":
        return _add_months(start_date, 12)
    elif freq == "weekly":
        import datetime as dt
        return start_date + dt.timedelta(days=7)
    # Default to 1 month
    return _add_months(start_date, 1)


class SubscriptionService:
    def __init__(
        self,
        repo: SubscriptionRepositoryProtocol,
        product_repo: ProductRepositoryProtocol,
        plan_repo: PlanRepositoryProtocol,
        quotation_repo: QuotationRepositoryProtocol,
    ) -> None:
        self.repo = repo
        self.product_repo = product_repo
        self.plan_repo = plan_repo
        self.quotation_repo = quotation_repo

    async def create_subscription(
        self, data: SubscriptionCreate, current_user: User
    ) -> SubscriptionResponse:
        # Determine customer ownership
        if current_user.role == "customer":
            customer_id = current_user.id
        else:
            customer_id = data.customer_id or current_user.id

        now = datetime.now(timezone.utc)
        sub_id = uuid4()
        lines: list[SubscriptionLineResponse] = []

        subtotal = Decimal("0.00")
        discount_total = Decimal("0.00")
        tax_total = Decimal("0.00")
        total_amount = Decimal("0.00")
        primary_plan_id: Optional[UUID] = data.plan_id

        # If explicit lines are provided, process each line
        if data.lines:
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
                    line_type = SubscriptionLineType.PRODUCT

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
                    line_type = SubscriptionLineType.PLAN
                    if primary_plan_id is None:
                        primary_plan_id = plan.id

                # Pricing snapshot
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

                line_resp = SubscriptionLineResponse(
                    id=uuid4(),
                    subscription_id=sub_id,
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

        elif data.plan_id:
            # Standalone plan reference without explicit lines creates an implicit plan line
            plan = await self.plan_repo.get_plan(data.plan_id)
            if not plan or not plan.is_active:
                raise AppError(
                    code="PLAN_NOT_FOUND",
                    message=f"Plan {data.plan_id} is inactive or does not exist.",
                    status_code=404,
                )
            unit_price = plan.price.quantize(Decimal("0.01"))
            line_resp = SubscriptionLineResponse(
                id=uuid4(),
                subscription_id=sub_id,
                line_type=SubscriptionLineType.PLAN,
                product_id=None,
                variant_id=None,
                plan_id=plan.id,
                line_number=1,
                description=f"Plan: {plan.name}",
                quantity=Decimal("1.00"),
                unit_price=unit_price,
                discount_percentage=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                tax_rate=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                line_total=unit_price,
                created_at=now,
            )
            lines.append(line_resp)
            subtotal = unit_price
            total_amount = unit_price
        else:
            raise AppError(
                code="VALIDATION_ERROR",
                message="Subscription must specify either a plan or at least one line item.",
                status_code=422,
            )

        start_date = data.start_date or date.today()
        billing_freq = data.billing_frequency or "monthly"
        next_billing = _calculate_next_billing_date(start_date, billing_freq)
        subscription_number = f"SUB-{now.strftime('%Y%m')}-{uuid4().hex[:6].upper()}"

        subscription = SubscriptionResponse(
            id=sub_id,
            subscription_number=subscription_number,
            customer_id=customer_id,
            plan_id=primary_plan_id,
            quotation_id=data.quotation_id,
            status=SubscriptionStatus.ACTIVE,
            currency=data.currency,
            billing_frequency=billing_freq,
            subtotal=subtotal.quantize(Decimal("0.01")),
            discount_total=discount_total.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            total_amount=total_amount.quantize(Decimal("0.01")),
            start_date=start_date,
            end_date=data.end_date,
            next_billing_date=next_billing,
            paused_at=None,
            closed_at=None,
            notes=data.notes,
            created_by=current_user.id,
            created_at=now,
            updated_at=now,
            lines=lines,
        )

        return await self.repo.create(subscription)

    async def create_from_quotation(
        self, quotation_id: UUID, current_user: User
    ) -> SubscriptionResponse:
        # Check idempotency first: if a subscription already exists for this quotation, return it
        existing = await self.repo.get_by_quotation_id(quotation_id)
        if existing:
            # Enforce customer data isolation on read of existing subscription
            if current_user.role == "customer" and existing.customer_id != current_user.id:
                raise AppError(code="NOT_FOUND", message=f"Subscription for quotation {quotation_id} not found.", status_code=404)
            return existing

        quotation = await self.quotation_repo.get(quotation_id)
        if not quotation:
            raise AppError(code="NOT_FOUND", message=f"Quotation {quotation_id} not found.", status_code=404)

        # Enforce customer ownership check
        if current_user.role == "customer" and quotation.customer_id != current_user.id:
            raise AppError(code="NOT_FOUND", message=f"Quotation {quotation_id} not found.", status_code=404)

        # Verify quotation is confirmed
        if quotation.status != QuotationStatus.CONFIRMED:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message=f"Quotation must be confirmed before converting to a subscription. Current status: '{quotation.status.value}'.",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        sub_id = uuid4()
        lines: list[SubscriptionLineResponse] = []
        primary_plan_id: Optional[UUID] = None

        for idx, qline in enumerate(quotation.lines):
            line_type = (
                SubscriptionLineType.PLAN
                if qline.line_type == QuotationLineType.PLAN
                else SubscriptionLineType.PRODUCT
            )
            if line_type == SubscriptionLineType.PLAN and primary_plan_id is None:
                primary_plan_id = qline.plan_id

            sub_line = SubscriptionLineResponse(
                id=uuid4(),
                subscription_id=sub_id,
                line_type=line_type,
                product_id=qline.product_id,
                variant_id=qline.variant_id,
                plan_id=qline.plan_id,
                line_number=idx + 1,
                description=qline.description,
                quantity=qline.quantity,
                unit_price=qline.unit_price,
                discount_percentage=qline.discount_percentage,
                discount_amount=qline.discount_amount,
                tax_rate=qline.tax_rate,
                tax_amount=qline.tax_amount,
                line_total=qline.line_total,
                created_at=now,
            )
            lines.append(sub_line)

        start_date = date.today()
        billing_freq = "monthly"
        next_billing = _calculate_next_billing_date(start_date, billing_freq)
        subscription_number = f"SUB-{now.strftime('%Y%m')}-{uuid4().hex[:6].upper()}"

        subscription = SubscriptionResponse(
            id=sub_id,
            subscription_number=subscription_number,
            customer_id=quotation.customer_id,
            plan_id=primary_plan_id,
            quotation_id=quotation.id,
            status=SubscriptionStatus.ACTIVE,
            currency=quotation.currency,
            billing_frequency=billing_freq,
            subtotal=quotation.subtotal,
            discount_total=quotation.discount_total,
            tax_total=quotation.tax_total,
            total_amount=quotation.total_amount,
            start_date=start_date,
            end_date=None,
            next_billing_date=next_billing,
            paused_at=None,
            closed_at=None,
            notes=f"Converted from quotation {quotation.quotation_number}",
            created_by=current_user.id,
            created_at=now,
            updated_at=now,
            lines=lines,
        )

        return await self.repo.create(subscription)

    async def get_subscription(self, id: UUID, current_user: User) -> SubscriptionResponse:
        sub = await self.repo.get(id)
        if not sub:
            raise AppError(code="NOT_FOUND", message=f"Subscription {id} not found.", status_code=404)

        if current_user.role == "customer" and sub.customer_id != current_user.id:
            raise AppError(code="NOT_FOUND", message=f"Subscription {id} not found.", status_code=404)

        return sub

    async def list_subscriptions(
        self,
        customer_id: Optional[UUID],
        status: Optional[str],
        page: int,
        page_size: int,
        current_user: User,
    ) -> SubscriptionListResponse:
        if current_user.role == "customer":
            effective_customer_id = current_user.id
        else:
            effective_customer_id = customer_id

        items, total = await self.repo.list(
            customer_id=effective_customer_id,
            status=status,
            page=page,
            page_size=page_size,
        )

        return SubscriptionListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def update_subscription(
        self, id: UUID, data: SubscriptionUpdate, current_user: User
    ) -> SubscriptionResponse:
        # Check existence and customer ownership
        await self.get_subscription(id, current_user)

        updated = await self.repo.update(
            id=id,
            notes=data.notes,
            end_date=data.end_date,
            next_billing_date=data.next_billing_date,
        )
        if not updated:
            raise AppError(code="NOT_FOUND", message=f"Subscription {id} not found.", status_code=404)
        return updated

    async def pause_subscription(self, id: UUID, current_user: User) -> SubscriptionResponse:
        sub = await self.get_subscription(id, current_user)

        if sub.status == SubscriptionStatus.PAUSED:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Subscription is already paused.",
                status_code=400,
            )

        if sub.status != SubscriptionStatus.ACTIVE:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message=f"Cannot pause subscription with status '{sub.status.value}'. Only active subscriptions can be paused.",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        updated = await self.repo.update_status(
            id=id,
            status=SubscriptionStatus.PAUSED,
            timestamp_field="paused_at",
            timestamp_value=now,
            expected_status=SubscriptionStatus.ACTIVE,
        )

        if not updated:
            curr = await self.repo.get(id)
            if curr and curr.status == SubscriptionStatus.PAUSED:
                raise AppError(
                    code="INVALID_STATUS_TRANSITION",
                    message="Subscription is already paused.",
                    status_code=400,
                )
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Could not pause subscription; status has changed or is not active.",
                status_code=400,
            )

        return updated

    async def resume_subscription(self, id: UUID, current_user: User) -> SubscriptionResponse:
        sub = await self.get_subscription(id, current_user)

        if sub.status == SubscriptionStatus.ACTIVE:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Subscription is already active.",
                status_code=400,
            )

        if sub.status != SubscriptionStatus.PAUSED:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message=f"Cannot resume subscription with status '{sub.status.value}'. Only paused subscriptions can be resumed.",
                status_code=400,
            )

        updated = await self.repo.update_status(
            id=id,
            status=SubscriptionStatus.ACTIVE,
            expected_status=SubscriptionStatus.PAUSED,
        )

        if not updated:
            curr = await self.repo.get(id)
            if curr and curr.status == SubscriptionStatus.ACTIVE:
                raise AppError(
                    code="INVALID_STATUS_TRANSITION",
                    message="Subscription is already active.",
                    status_code=400,
                )
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Could not resume subscription; status has changed or is not paused.",
                status_code=400,
            )

        return updated

    async def close_subscription(self, id: UUID, current_user: User) -> SubscriptionResponse:
        sub = await self.get_subscription(id, current_user)

        if sub.status == SubscriptionStatus.CLOSED:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Subscription is already closed.",
                status_code=400,
            )

        if sub.status not in (SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED, SubscriptionStatus.DRAFT):
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message=f"Cannot close subscription with status '{sub.status.value}'.",
                status_code=400,
            )

        now = datetime.now(timezone.utc)
        updated = await self.repo.update_status(
            id=id,
            status=SubscriptionStatus.CLOSED,
            timestamp_field="closed_at",
            timestamp_value=now,
        )

        if not updated:
            raise AppError(code="NOT_FOUND", message=f"Subscription {id} not found.", status_code=404)

        return updated

    async def renew_subscription(self, id: UUID, current_user: User) -> SubscriptionResponse:
        sub = await self.get_subscription(id, current_user)

        if sub.status != SubscriptionStatus.ACTIVE:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message=f"Only active subscriptions can be renewed. Current status: '{sub.status.value}'.",
                status_code=400,
            )

        new_next_billing = _calculate_next_billing_date(sub.next_billing_date, sub.billing_frequency)
        updated = await self.repo.update(id=id, next_billing_date=new_next_billing)

        if not updated:
            raise AppError(code="NOT_FOUND", message=f"Subscription {id} not found.", status_code=404)

        return updated

