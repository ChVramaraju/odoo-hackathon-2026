export type ProductType = 'service' | 'consumable' | 'storable';

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  sales_price: string;
  cost_price: string;
  currency: string;
  description?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  value: string;
  price_adjustment: string;
  sku?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  name: string;
  type?: ProductType;
  sales_price: string;
  cost_price?: string;
  currency?: string;
  description?: string;
  notes?: string;
  is_active?: boolean;
}

export interface ProductUpdate {
  name?: string;
  type?: ProductType;
  sales_price?: string;
  cost_price?: string;
  currency?: string;
  description?: string;
  notes?: string;
  is_active?: boolean;
}

export interface ProductVariantCreate {
  name: string;
  value: string;
  price_adjustment?: string;
  sku?: string;
  is_active?: boolean;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
}

