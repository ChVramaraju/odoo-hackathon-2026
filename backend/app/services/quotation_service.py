"""
Brightloop — Quotation Domain Service.

Business Logic & Integrity:
- Server-side calculation of all financial values (gross, discount, tax, subtotal, total).
- Price and description snapshots from products, variants, and plans.
- Role-based authorization & data isolation for customers.
- Status state transitions (draft -> confirmed, prevents duplicate confirmation side effects).
- Validation of product/plan existence and active status.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from app.core.errors import AppError
from app.dependencies.auth import User
from app.repositories.plan_repository import PlanRepositoryProtocol
from app.repositories.product_repository import ProductRepositoryProtocol
from app.repositories.quotation_repository import QuotationRepositoryProtocol
from app.schemas.quotation import (
    QuotationCreate,
    QuotationLineResponse,
    QuotationLineType,
    QuotationListResponse,
    QuotationResponse,
    QuotationStatus,
)


class QuotationService:
    def __init__(
        self,
        repo: QuotationRepositoryProtocol,
        product_repo: ProductRepositoryProtocol,
        plan_repo: PlanRepositoryProtocol,
    ) -> None:
        self.repo = repo
        self.product_repo = product_repo
        self.plan_repo = plan_repo

    async def create_quotation(
        self, data: QuotationCreate, current_user: User
    ) -> QuotationResponse:
        # Determine customer ownership
        if current_user.role == "customer":
            customer_id = current_user.id
        else:
            customer_id = data.customer_id or current_user.id

        if not data.lines:
            raise AppError(
                code="VALIDATION_ERROR",
                message="Quotation must contain at least one line item.",
                status_code=422,
            )

        now = datetime.now(timezone.utc)
        quotation_id = uuid4()
        lines: list[QuotationLineResponse] = []

        subtotal = Decimal("0.00")
        discount_total = Decimal("0.00")
        tax_total = Decimal("0.00")
        total_amount = Decimal("0.00")

        for line_input in data.lines:
            # Validate mutual exclusivity of product vs plan
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
                line_type = QuotationLineType.PRODUCT

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
                line_type = QuotationLineType.PLAN

            # Price snapshot: Admin/Staff may supply custom agreed unit_price; customers always snapshot catalog price
            if line_input.unit_price is not None and current_user.role in ("admin", "staff"):
                unit_price = line_input.unit_price.quantize(Decimal("0.01"))
            else:
                unit_price = base_price.quantize(Decimal("0.01"))

            # Description snapshot
            line_desc = line_input.description or desc

            # Calculations with two-decimal quantization
            qty = line_input.quantity.quantize(Decimal("0.01"))
            disc_pct = line_input.discount_percentage.quantize(Decimal("0.01"))
            tax_rate = line_input.tax_rate.quantize(Decimal("0.01"))

            gross = (qty * unit_price).quantize(Decimal("0.01"))
            disc_amt = (gross * (disc_pct / Decimal("100.00"))).quantize(Decimal("0.01"))
            taxable = gross - disc_amt
            tax_amt = (taxable * (tax_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            line_total = taxable + tax_amt

            line_response = QuotationLineResponse(
                id=uuid4(),
                quotation_id=quotation_id,
                line_type=line_type,
                product_id=line_input.product_id,
                variant_id=line_input.variant_id,
                plan_id=line_input.plan_id,
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
            lines.append(line_response)

            subtotal += gross
            discount_total += disc_amt
            tax_total += tax_amt
            total_amount += line_total

        # Concurrency-safe unique quotation number
        quotation_number = f"QT-{now.strftime('%Y%m')}-{uuid4().hex[:6].upper()}"

        quotation = QuotationResponse(
            id=quotation_id,
            quotation_number=quotation_number,
            customer_id=customer_id,
            status=QuotationStatus.DRAFT,
            currency=data.currency,
            subtotal=subtotal.quantize(Decimal("0.01")),
            discount_total=discount_total.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            total_amount=total_amount.quantize(Decimal("0.01")),
            valid_until=data.valid_until,
            notes=data.notes,
            created_by=current_user.id,
            confirmed_at=None,
            created_at=now,
            updated_at=now,
            lines=lines,
        )

        return await self.repo.create(quotation)

    async def get_quotation(self, id: UUID, current_user: User) -> QuotationResponse:
        quotation = await self.repo.get(id)
        if not quotation:
            raise AppError(code="NOT_FOUND", message=f"Quotation {id} not found.", status_code=404)

        # Enforce customer data isolation
        if current_user.role == "customer" and quotation.customer_id != current_user.id:
            raise AppError(code="NOT_FOUND", message=f"Quotation {id} not found.", status_code=404)

        return quotation

    async def list_quotations(
        self,
        customer_id: Optional[UUID],
        status: Optional[str],
        page: int,
        page_size: int,
        current_user: User,
    ) -> QuotationListResponse:
        # Enforce customer scope
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

        return QuotationListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def confirm_quotation(self, id: UUID, current_user: User) -> QuotationResponse:
        quotation = await self.get_quotation(id, current_user)

        # Guard against invalid transitions and duplicate confirmations
        if quotation.status == QuotationStatus.CONFIRMED:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Quotation is already confirmed.",
                status_code=400,
            )

        if quotation.status == QuotationStatus.CANCELLED:
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Cannot confirm a cancelled quotation.",
                status_code=400,
            )

        if quotation.valid_until and quotation.valid_until < date.today():
            raise AppError(
                code="EXPIRED_QUOTATION",
                message="Quotation has expired and cannot be confirmed.",
                status_code=400,
            )

        confirmed_at = datetime.now(timezone.utc)
        # Atomic conditional transition: only updates if current status is DRAFT
        updated = await self.repo.update_status(
            id=id,
            status=QuotationStatus.CONFIRMED,
            confirmed_at=confirmed_at,
            expected_status=QuotationStatus.DRAFT,
        )

        if not updated:
            # Query current state to determine if already confirmed or not found
            current = await self.repo.get(id)
            if current and current.status == QuotationStatus.CONFIRMED:
                raise AppError(
                    code="INVALID_STATUS_TRANSITION",
                    message="Quotation is already confirmed.",
                    status_code=400,
                )
            raise AppError(
                code="INVALID_STATUS_TRANSITION",
                message="Could not confirm quotation; status has changed or is not in draft.",
                status_code=400,
            )

        return updated

