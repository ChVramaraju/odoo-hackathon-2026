"""
Brightloop — API v1 Router.

Aggregates all v1 domain routers.
"""

from fastapi import APIRouter

from app.api.v1 import (
    health,
    invoices,
    payments,
    plans,
    products,
    quotations,
    subscriptions,
)

router = APIRouter()

router.include_router(health.router)
router.include_router(products.router)
router.include_router(plans.router)
router.include_router(quotations.router)
router.include_router(subscriptions.router)
router.include_router(invoices.router)
router.include_router(payments.router)
