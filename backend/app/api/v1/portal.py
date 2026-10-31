"""
Brightloop — Customer Portal API Endpoints.

Provides role-scoped customer endpoints:
- GET /portal/profile: Return authenticated customer profile.
- PATCH /portal/profile: Update customer profile details.
- GET /portal/dashboard: Consolidated metrics (active subs, outstanding balance, receipts).
- GET /portal/subscriptions: Subscriptions for current customer.
- GET /portal/invoices: Invoices for current customer.
- GET /portal/payments: Payments for current customer.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies.auth import User, get_current_user
from app.dependencies.services import (
    get_invoice_service,
    get_payment_service,
    get_subscription_service,
)
from app.schemas.invoice import InvoiceListResponse
from app.schemas.payment import PaymentListResponse
from app.schemas.portal import (
    CustomerDashboardSummary,
    CustomerProfile,
    CustomerProfileUpdate,
)
from app.schemas.subscription import SubscriptionListResponse
from app.services.invoice_service import InvoiceService
from app.services.payment_service import PaymentService
from app.services.subscription_service import SubscriptionService

router = APIRouter(prefix="/portal", tags=["Customer Portal"])

# In-memory customer profile overrides
_profile_overrides: dict[UUID, dict] = {}


@router.get(
    "/profile",
    response_model=CustomerProfile,
    summary="Get customer portal profile",
)
async def get_portal_profile(
    current_user: User = Depends(get_current_user),
) -> CustomerProfile:
    override = _profile_overrides.get(current_user.id, {})
    name = override.get("name") or current_user.email.split("@")[0].replace(".", " ").title()
    company = override.get("company")
    return CustomerProfile(
        id=current_user.id,
        name=name,
        email=current_user.email,
        company=company,
        role="customer" if current_user.role == "customer" else current_user.role,
    )


@router.patch(
    "/profile",
    response_model=CustomerProfile,
    summary="Update customer portal profile",
)
@router.put(
    "/profile",
    response_model=CustomerProfile,
    summary="Update customer portal profile (PUT alias)",
)
async def update_portal_profile(
    payload: CustomerProfileUpdate,
    current_user: User = Depends(get_current_user),
) -> CustomerProfile:
    override = _profile_overrides.setdefault(current_user.id, {})
    if payload.name is not None:
        override["name"] = payload.name
    if payload.company is not None:
        override["company"] = payload.company

    return await get_portal_profile(current_user)


@router.get(
    "/dashboard",
    response_model=CustomerDashboardSummary,
    summary="Get customer portal dashboard summary",
)
async def get_portal_dashboard(
    current_user: User = Depends(get_current_user),
    sub_service: SubscriptionService = Depends(get_subscription_service),
    inv_service: InvoiceService = Depends(get_invoice_service),
    pay_service: PaymentService = Depends(get_payment_service),
) -> CustomerDashboardSummary:
    profile = await get_portal_profile(current_user)

    subs_res = await sub_service.list_subscriptions(
        customer_id=current_user.id,
        status=None,
        page=1,
        page_size=50,
        current_user=current_user,
    )
    invs_res = await inv_service.list_invoices(
        customer_id=current_user.id,
        status=None,
        subscription_id=None,
        page=1,
        page_size=50,
        current_user=current_user,
    )
    pays_res = await pay_service.list_payments(
        customer_id=current_user.id,
        invoice_id=None,
        status=None,
        page=1,
        page_size=50,
        current_user=current_user,
    )

    active_subs = [s for s in subs_res.items if s.status == "active"]

    outstanding_balance = sum(
        (i.balance for i in invs_res.items if i.status in ("confirmed", "overdue")),
        Decimal("0.00"),
    )
    settled_amount = sum(
        (p.amount for p in pays_res.items if p.payment_status == "completed"),
        Decimal("0.00"),
    )

    next_billing: Optional[datetime] = None
    billing_dates = [s.next_billing_date for s in active_subs if s.next_billing_date]
    if billing_dates:
        next_billing = min(billing_dates)

    return CustomerDashboardSummary(
        customer_id=current_user.id,
        customer_name=profile.name,
        customer_company=profile.company,
        currency="INR",
        active_subscriptions_count=len(active_subs),
        total_outstanding_balance=f"{outstanding_balance:.2f}",
        total_settled_amount=f"{settled_amount:.2f}",
        next_billing_date=next_billing,
        active_subscriptions=active_subs,
        recent_invoices=invs_res.items[:5],
        recent_payments=pays_res.items[:5],
    )


@router.get(
    "/subscriptions",
    response_model=SubscriptionListResponse,
    summary="List customer portal subscriptions",
)
async def get_portal_subscriptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    sub_service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionListResponse:
    return await sub_service.list_subscriptions(
        customer_id=current_user.id,
        status=None,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get(
    "/invoices",
    response_model=InvoiceListResponse,
    summary="List customer portal invoices",
)
async def get_portal_invoices(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    inv_service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceListResponse:
    return await inv_service.list_invoices(
        customer_id=current_user.id,
        status=status,
        subscription_id=None,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )


@router.get(
    "/payments",
    response_model=PaymentListResponse,
    summary="List customer portal payments",
)
async def get_portal_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    pay_service: PaymentService = Depends(get_payment_service),
) -> PaymentListResponse:
    return await pay_service.list_payments(
        customer_id=current_user.id,
        invoice_id=None,
        status=None,
        page=page,
        page_size=page_size,
        current_user=current_user,
    )
