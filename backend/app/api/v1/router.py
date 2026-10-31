"""
Brightloop — API v1 Router.

Aggregates all v1 domain routers.
"""

from fastapi import APIRouter

from app.api.v1 import health, plans, products

router = APIRouter()

router.include_router(health.router)
router.include_router(products.router)
router.include_router(plans.router)
