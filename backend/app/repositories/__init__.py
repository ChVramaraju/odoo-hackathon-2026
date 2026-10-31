"""Repositories package."""

from app.repositories.plan_repository import (
    InMemoryPlanRepository,
    PlanRepositoryProtocol,
    SupabasePlanRepository,
    get_plan_repository,
)
from app.repositories.product_repository import (
    InMemoryProductRepository,
    ProductRepositoryProtocol,
    SupabaseProductRepository,
    get_product_repository,
)
from app.repositories.quotation_repository import (
    InMemoryQuotationRepository,
    QuotationRepositoryProtocol,
    SupabaseQuotationRepository,
    get_quotation_repository,
)

__all__ = [
    "ProductRepositoryProtocol",
    "InMemoryProductRepository",
    "SupabaseProductRepository",
    "get_product_repository",
    "PlanRepositoryProtocol",
    "InMemoryPlanRepository",
    "SupabasePlanRepository",
    "get_plan_repository",
    "QuotationRepositoryProtocol",
    "InMemoryQuotationRepository",
    "SupabaseQuotationRepository",
    "get_quotation_repository",
]
