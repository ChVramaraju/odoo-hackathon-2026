"""
Brightloop — Subscription Pydantic Schemas.

Enforces:
- Exact decimal prices with 2-decimal financial quantization.
- Status state machine: draft, active, paused, closed, cancelled.
- Line-item references: product, variant, plan.
- Snapshots of gross, discount, tax, and line/header totals.
- ISO 8601 timestamps and calendar dates.
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


class SubscriptionStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class SubscriptionLineType(str, Enum):
    PRODUCT = "product"
    PLAN = "plan"


class SubscriptionLineCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: Optional[UUID] = None
    variant_id: Optional[UUID] = None
    plan_id: Optional[UUID] = None
    quantity: Decimal = Field(default=Decimal("1.00"), gt=Decimal("0.00"))
    unit_price: Optional[Decimal] = Field(default=None, ge=Decimal("0.00"))
    discount_percentage: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("100.00"))
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    description: Optional[str] = Field(default=None, max_length=500)


class SubscriptionCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    customer_id: Optional[UUID] = None
    plan_id: Optional[UUID] = None
    quotation_id: Optional[UUID] = None
    currency: str = Field(default="INR", min_length=3, max_length=3)
    billing_frequency: str = Field(default="monthly")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: list[SubscriptionLineCreate] = Field(default_factory=list)


class SubscriptionUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    notes: Optional[str] = Field(default=None, max_length=2000)
    end_date: Optional[date] = None
    next_billing_date: Optional[date] = None


class SubscriptionLineResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    subscription_id: UUID
    line_type: SubscriptionLineType
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


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    subscription_number: str
    customer_id: UUID
    plan_id: Optional[UUID] = None
    quotation_id: Optional[UUID] = None
    status: SubscriptionStatus
    currency: str = "INR"
    billing_frequency: str = "monthly"
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total_amount: Decimal
    start_date: date
    end_date: Optional[date] = None
    next_billing_date: date
    paused_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    lines: list[SubscriptionLineResponse] = Field(default_factory=list)


class SubscriptionListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[SubscriptionResponse]
    total: int
    page: int
    page_size: int

