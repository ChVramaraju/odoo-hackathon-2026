"""
Brightloop — Subscription Plan Pydantic Schemas.

Enforces:
- Exact decimal prices.
- Frequency restrictions: daily, weekly, monthly, yearly.
- End-of-term behavior: renew, cancel, pause.
- Status: active, closed.
- ISO 8601 timestamps and date intervals.
- Database contract alias alignment (available_from, available_until).
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated, Optional
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

PositiveDecimal = Annotated[Decimal, Field(ge=Decimal("0.00"), decimal_places=2)]


class BillingFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class EndOfTermBehavior(str, Enum):
    RENEW = "renew"
    CLOSE = "close"
    CANCEL = "cancel"
    PAUSE = "pause"


class PlanStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    ARCHIVED = "archived"


class PlanBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=255, description="Plan name (e.g., Professional Monthly)")
    code: Optional[str] = Field(default=None, max_length=50, description="Unique plan code or identifier")
    description: Optional[str] = Field(default=None, max_length=1000, description="Plan overview and terms")
    price: PositiveDecimal = Field(..., description="Recurring price per interval")
    currency: str = Field(default="INR", min_length=3, max_length=3, description="ISO 4217 currency code")
    billing_frequency: BillingFrequency = Field(default=BillingFrequency.MONTHLY, description="Billing frequency")
    billing_interval: int = Field(default=1, ge=1, le=365, description="Frequency multiplier (e.g. 1 month, 3 months)")
    minimum_quantity: int = Field(default=1, ge=1, description="Minimum subscription seat/item quantity")
    start_date: Annotated[
        Optional[date],
        Field(
            default=None,
            validation_alias=AliasChoices("start_date", "available_from"),
            description="Availability start date",
        ),
    ] = None
    end_date: Annotated[
        Optional[date],
        Field(
            default=None,
            validation_alias=AliasChoices("end_date", "available_until"),
            description="Availability expiry date",
        ),
    ] = None
    end_of_term_behavior: EndOfTermBehavior = Field(default=EndOfTermBehavior.RENEW, description="Action at term end")
    status: PlanStatus = Field(default=PlanStatus.ACTIVE, description="Lifecycle status")
    is_active: bool = Field(default=True, description="Whether the plan is active for subscription")


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    code: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default=None, max_length=1000)
    price: Optional[PositiveDecimal] = None
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    billing_frequency: Optional[BillingFrequency] = None
    billing_interval: Optional[int] = Field(default=None, ge=1, le=365)
    minimum_quantity: Optional[int] = Field(default=None, ge=1)
    start_date: Annotated[
        Optional[date],
        Field(
            default=None,
            validation_alias=AliasChoices("start_date", "available_from"),
        ),
    ] = None
    end_date: Annotated[
        Optional[date],
        Field(
            default=None,
            validation_alias=AliasChoices("end_date", "available_until"),
        ),
    ] = None
    end_of_term_behavior: Optional[EndOfTermBehavior] = None
    status: Optional[PlanStatus] = None
    is_active: Optional[bool] = None


class PlanResponse(PlanBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class PlanListResponse(BaseModel):
    items: list[PlanResponse]
    total: int
    page: int
    page_size: int
