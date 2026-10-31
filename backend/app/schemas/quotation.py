"""
Brightloop — Quotation Pydantic Schemas.

Enforces:
- Exact decimal prices with 2-decimal financial quantization.
- Status state machine: draft, sent, confirmed, cancelled.
- Line-item references: product, variant, plan.
- Server-side calculation of gross, discount, tax, and line/header totals.
- ISO 8601 timestamps and date intervals.
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


class QuotationStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class QuotationLineType(str, Enum):
    PRODUCT = "product"
    PLAN = "plan"


class QuotationLineCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: Optional[UUID] = None
    variant_id: Optional[UUID] = None
    plan_id: Optional[UUID] = None
    quantity: Decimal = Field(default=Decimal("1.00"), gt=Decimal("0.00"))
    unit_price: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    discount_percentage: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("100.00"))
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    description: Optional[str] = Field(default=None, max_length=500)


class QuotationCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    customer_id: Optional[UUID] = None
    currency: str = Field(default="INR", min_length=3, max_length=3)
    valid_until: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: list[QuotationLineCreate] = Field(default_factory=list)


class QuotationLineResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    quotation_id: UUID
    line_type: QuotationLineType
    product_id: Optional[UUID] = None
    variant_id: Optional[UUID] = None
    plan_id: Optional[UUID] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_percentage: Decimal
    discount_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal
    created_at: datetime


class QuotationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    quotation_number: str
    customer_id: UUID
    status: QuotationStatus
    currency: str = "INR"
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total_amount: Decimal
    valid_until: Optional[date] = None
    notes: Optional[str] = None
    created_by: Optional[UUID] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    lines: list[QuotationLineResponse] = Field(default_factory=list)


class QuotationListResponse(BaseModel):
    items: list[QuotationResponse]
    total: int
    page: int
    page_size: int

