"""
Brightloop — Customer Portal Pydantic Schemas.

Models for customer self-service portal, profile management,
and consolidated dashboard summary.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.invoice import InvoiceResponse
from app.schemas.payment import PaymentResponse
from app.schemas.subscription import SubscriptionResponse


class CustomerProfile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    name: str
    email: str
    company: Optional[str] = None
    role: str = "customer"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CustomerProfileUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(default=None, max_length=150)
    company: Optional[str] = Field(default=None, max_length=150)


class CustomerDashboardSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    customer_id: UUID
    customer_name: str
    customer_company: Optional[str] = None
    currency: str = "INR"
    active_subscriptions_count: int = 0
    total_outstanding_balance: str = "0.00"
    total_settled_amount: str = "0.00"
    next_billing_date: Optional[datetime] = None
    active_subscriptions: list[SubscriptionResponse] = Field(default_factory=list)
    recent_invoices: list[InvoiceResponse] = Field(default_factory=list)
    recent_payments: list[PaymentResponse] = Field(default_factory=list)
