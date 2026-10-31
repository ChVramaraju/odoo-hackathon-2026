"""
Brightloop — Service Dependencies.

Provides dependency injection providers for domain services.
"""

from fastapi import Depends

from app.repositories.invoice_repository import InvoiceRepositoryProtocol, get_invoice_repository
from app.repositories.plan_repository import PlanRepositoryProtocol, get_plan_repository
from app.repositories.product_repository import ProductRepositoryProtocol, get_product_repository
from app.repositories.quotation_repository import QuotationRepositoryProtocol, get_quotation_repository
from app.repositories.subscription_repository import SubscriptionRepositoryProtocol, get_subscription_repository
from app.services.invoice_service import InvoiceService
from app.services.plan_service import PlanService
from app.services.product_service import ProductService
from app.services.quotation_service import QuotationService
from app.services.subscription_service import SubscriptionService


def get_product_service(
    repo: ProductRepositoryProtocol = Depends(get_product_repository),
) -> ProductService:
    return ProductService(repo)


def get_plan_service(
    repo: PlanRepositoryProtocol = Depends(get_plan_repository),
) -> PlanService:
    return PlanService(repo)


def get_quotation_service(
    repo: QuotationRepositoryProtocol = Depends(get_quotation_repository),
    product_repo: ProductRepositoryProtocol = Depends(get_product_repository),
    plan_repo: PlanRepositoryProtocol = Depends(get_plan_repository),
) -> QuotationService:
    return QuotationService(repo=repo, product_repo=product_repo, plan_repo=plan_repo)


def get_subscription_service(
    repo: SubscriptionRepositoryProtocol = Depends(get_subscription_repository),
    product_repo: ProductRepositoryProtocol = Depends(get_product_repository),
    plan_repo: PlanRepositoryProtocol = Depends(get_plan_repository),
    quotation_repo: QuotationRepositoryProtocol = Depends(get_quotation_repository),
) -> SubscriptionService:
    return SubscriptionService(
        repo=repo,
        product_repo=product_repo,
        plan_repo=plan_repo,
        quotation_repo=quotation_repo,
    )


def get_invoice_service(
    repo: InvoiceRepositoryProtocol = Depends(get_invoice_repository),
    product_repo: ProductRepositoryProtocol = Depends(get_product_repository),
    plan_repo: PlanRepositoryProtocol = Depends(get_plan_repository),
    subscription_repo: SubscriptionRepositoryProtocol = Depends(get_subscription_repository),
) -> InvoiceService:
    return InvoiceService(
        repo=repo,
        product_repo=product_repo,
        plan_repo=plan_repo,
        subscription_repo=subscription_repo,
    )
