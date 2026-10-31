"""
Brightloop — Product & Variant Pydantic Schemas.

Enforces:
- Exact decimal representations for money (sales_price, cost_price, price_adjustment).
- ISO 8601 timestamps.
- Validation for non-negative prices and positive quantities.
- Database contract alias alignment (product_type, variant_name, variant_value).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Optional
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

# Positive or zero decimal constraint
PositiveDecimal = Annotated[Decimal, Field(ge=Decimal("0.00"), decimal_places=2)]


class ProductBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=255, description="Product title")
    type: str = Field(
        default="service",
        max_length=50,
        validation_alias=AliasChoices("type", "product_type"),
        description="Product type (service, digital, physical)",
    )
    sales_price: PositiveDecimal = Field(..., description="Base sales price")
    cost_price: PositiveDecimal = Field(default=Decimal("0.00"), description="Internal cost price")
    currency: str = Field(default="USD", min_length=3, max_length=3, description="ISO 4217 currency code")
    notes: Optional[str] = Field(default=None, max_length=1000, description="Optional description or notes")
    is_active: bool = Field(default=True, description="Whether the product is active for sales")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    type: Optional[str] = Field(
        default=None,
        max_length=50,
        validation_alias=AliasChoices("type", "product_type"),
    )
    sales_price: Optional[PositiveDecimal] = None
    cost_price: Optional[PositiveDecimal] = None
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    notes: Optional[str] = Field(default=None, max_length=1000)
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class ProductVariantBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices("name", "attribute_name", "variant_name"),
        description="Attribute name, e.g. Tier or Seat",
    )
    value: str = Field(
        ...,
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices("value", "attribute_value", "variant_value"),
        description="Attribute value, e.g. Pro or 5-Users",
    )
    price_adjustment: PositiveDecimal = Field(
        default=Decimal("0.00"),
        description="Additional cost added to product base price",
    )
    sku: Optional[str] = Field(default=None, max_length=100, description="Optional stock keeping unit or code")
    is_active: bool = Field(default=True, description="Whether the variant is available")


class ProductVariantCreate(ProductVariantBase):
    pass


class ProductVariantResponse(ProductVariantBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    product_id: UUID
    created_at: datetime
    updated_at: datetime


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int
