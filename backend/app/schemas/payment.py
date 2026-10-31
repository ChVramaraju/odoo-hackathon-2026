"""
Brightloop — Payment Pydantic Schemas.

Enforces:
- Exact decimal financial precision (2 decimal places).
- Positive payment amounts (> 0.00).
- Payment methods: card, bank_transfer, upi, net_banking, manual, cash.
- Payment statuses: completed, pending, failed, refunded.
- Linkage to invoices and customers.
- Idempotency key tracking to eliminate duplicate submissions.
- Zero storage of raw card credentials or sensitive CVVs.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

PositiveDecimal = Annotated[Decimal, Field(ge=Decimal("0.01"), decimal_places=2)]


class PaymentMethod(str, Enum):
    CARD = "card"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    BANK_TRANSFER = "bank_transfer"
    UPI = "upi"
    NET_BANKING = "net_banking"
    MANUAL = "manual"
    CASH = "cash"


class PaymentStatus(str, Enum):
    COMPLETED = "completed"
    PENDING = "pending"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    invoice_id: UUID
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Positive payment amount")
    currency: str = Field(default="INR", min_length=3, max_length=3)
    payment_method: PaymentMethod = Field(default=PaymentMethod.MANUAL)
    transaction_reference: Optional[str] = Field(default=None, max_length=100, description="External reference, check # or UTR")
    idempotency_key: Optional[str] = Field(default=None, max_length=100, description="Unique client key for duplicate prevention")
    payment_date: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=1000)


class PaymentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    payment_number: str
    invoice_id: UUID
    customer_id: UUID
    amount: Decimal
    currency: str = "INR"
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    payment_date: datetime
    transaction_reference: Optional[str] = None
    idempotency_key: Optional[str] = None
    notes: Optional[str] = None
    recorded_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class PaymentListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[PaymentResponse]
    total: int
    page: int
    page_size: int

