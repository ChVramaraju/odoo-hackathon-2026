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

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, computed_field

# Positive or zero decimal constraint
PositiveDecimal = Annotated[Decimal, Field(ge=Decimal("0.00"), decimal_places=2)]
MoneyDecimal = Annotated[Decimal, Field(decimal_places=2)]


class ProductBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=255, description="Product title")
    type: Annotated[
        str,
        Field(
            default="service",
            max_length=50,
            validation_alias=AliasChoices("type", "product_type"),
            description="Product type (service, consumable, storable)",
        ),
    ] = "service"
    sales_price: PositiveDecimal = Field(..., description="Base sales price")
    cost_price: PositiveDecimal = Field(default=Decimal("0.00"), description="Internal cost price")
    currency: str = Field(default="INR", min_length=3, max_length=3, description="ISO 4217 currency code")
    description: Optional[str] = Field(default=None, max_length=1000, description="Customer-facing description")
    notes: Annotated[
        Optional[str],
        Field(
            default=None,
            max_length=1000,
            validation_alias=AliasChoices("notes", "internal_notes"),
            description="Internal admin/staff notes",
        ),
    ] = None
    is_active: bool = Field(default=True, description="Whether the product is active for sales")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    type: Annotated[
        Optional[str],
        Field(
            default=None,
            max_length=50,
            validation_alias=AliasChoices("type", "product_type"),
        ),
    ] = None
    sales_price: Optional[PositiveDecimal] = None
    cost_price: Optional[PositiveDecimal] = None
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    description: Optional[str] = Field(default=None, max_length=1000)
    notes: Annotated[
        Optional[str],
        Field(
            default=None,
            max_length=1000,
            validation_alias=AliasChoices("notes", "internal_notes"),
        ),
    ] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def product_type(self) -> str:
        return self.type

    @computed_field
    @property
    def internal_notes(self) -> Optional[str]:
        return self.notes


class ProductVariantBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Annotated[
        str,
        Field(
            min_length=1,
            max_length=100,
            validation_alias=AliasChoices("name", "attribute_name", "variant_name"),
            description="Attribute name, e.g. Tier or Seat",
        ),
    ]
    value: Annotated[
        str,
        Field(
            min_length=1,
            max_length=100,
            validation_alias=AliasChoices("value", "attribute_value", "variant_value"),
            description="Attribute value, e.g. Pro or 5-Users",
        ),
    ]
    price_adjustment: MoneyDecimal = Field(
        default=Decimal("0.00"),
        description="Additive cost adjustment to product base price",
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

    @computed_field
    @property
    def variant_name(self) -> str:
        return self.name

    @computed_field
    @property
    def variant_value(self) -> str:
        return self.value

    @computed_field
    @property
    def attribute_name(self) -> str:
        return self.name

    @computed_field
    @property
    def attribute_value(self) -> str:
        return self.value


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int
