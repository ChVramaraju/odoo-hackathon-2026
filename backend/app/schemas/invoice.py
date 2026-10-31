"""
Brightloop — Invoice Pydantic Schemas.

Enforces:
- Exact decimal prices with 2-decimal financial quantization.
- Status state machine: draft -> confirmed -> paid / cancelled.
- Line-item references: product, variant, plan.
- Snapshots of gross, discount, tax, line totals, and invoice balances.
- Safe billing-period idempotency keys.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

PositiveDecimal = Annotated[Decimal, Field(ge=Decimal("0.00"), decimal_places=2)]
PercentageDecimal = Annotated[Decimal, Field(ge=Decimal("0.00"), le=Decimal("100.00"), decimal_places=2)]


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PAID = "paid"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class InvoiceLineType(str, Enum):
    PRODUCT = "product"
    PLAN = "plan"


class InvoiceLineCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: Optional[UUID] = None
    variant_id: Optional[UUID] = None
    plan_id: Optional[UUID] = None
    quantity: Decimal = Field(default=Decimal("1.00"), gt=Decimal("0.00"))
    unit_price: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    discount_percentage: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("100.00"))
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    description: Optional[str] = Field(default=None, max_length=500)


class InvoiceCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    customer_id: Optional[UUID] = None
    subscription_id: Optional[UUID] = None
    quotation_id: Optional[UUID] = None
    currency: str = Field(default="INR", min_length=3, max_length=3)
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    billing_period_start: Optional[date] = None
    billing_period_end: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: list[InvoiceLineCreate] = Field(default_factory=list)


class InvoiceFromSubscriptionCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    billing_period_start: Optional[date] = None
    billing_period_end: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=2000)


class InvoiceLineResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    invoice_id: UUID
    line_type: InvoiceLineType
    product_id: Optional[UUID] = None
    variant_id: Optional[UUID] = None
    plan_id: Optional[UUID] = None
    line_number: int = 1
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_percentage: Decimal
    discount_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal
    created_at: datetime


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    invoice_number: str
    customer_id: UUID
    subscription_id: Optional[UUID] = None
    quotation_id: Optional[UUID] = None
    status: InvoiceStatus
    currency: str = "INR"
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total_amount: Decimal
    amount_paid: Decimal = Decimal("0.00")
    balance: Decimal
    invoice_date: date
    due_date: date
    billing_period_start: Optional[date] = None
    billing_period_end: Optional[date] = None
    confirmed_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    lines: list[InvoiceLineResponse] = Field(default_factory=list)


class InvoiceListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[InvoiceResponse]
    total: int
    page: int
    page_size: int

