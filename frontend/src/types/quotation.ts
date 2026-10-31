/**
 * Brightloop Quotation Domain Models & DTOs
 *
 * Implements the domain contracts from:
 * - DOMAIN_MODULES.md: Templates, correct plan/product lines, validity days.
 * - API_CONTRACTS.md: GET /quotations, POST /quotations, POST /quotations/{id}/confirm.
 * - Backend FastAPI schemas: quotation.py (draft, sent, confirmed, cancelled).
 */

import { PaginatedResponse } from './api';
import { BillingFrequency } from './plan';

export type QuotationStatus = 'draft' | 'sent' | 'quotation' | 'confirmed' | 'expired' | 'cancelled';
export type QuotationLineType = 'product' | 'plan';

export interface QuotationLineItem {
  id: string;
  line_type?: QuotationLineType;
  product_id?: string | null;
  product_name?: string;
  product_type?: 'service' | 'consumable' | 'storable';
  variant_id?: string | null;
  variant_name?: string | null;
  plan_id?: string | null;
  description?: string;
  quantity: number;
  unit_price: string;
  price_adjustment?: string;
  discount_percentage?: number;
  discount_amount?: string;
  tax_rate?: number;
  tax_amount?: string;
  line_total?: string;
  subtotal?: string;
}

export interface QuotationCustomer {
  id?: string | null;
  name: string;
  email: string;
  company?: string | null;
  is_registered?: boolean;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id?: string | null;
  customer: QuotationCustomer;
  plan_id: string;
  plan_name: string;
  plan_code?: string | null;
  billing_frequency: BillingFrequency;
  validity_days: number;
  status: QuotationStatus;
  lines: QuotationLineItem[];
  currency: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  valid_until?: string | null;
  notes?: string | null;
  subscription_id?: string | null;
  created_at: string;
  expiry_date: string;
  updated_at: string;
}

export interface QuotationCreateLine {
  line_type?: QuotationLineType;
  product_id?: string | null;
  variant_id?: string | null;
  plan_id?: string | null;
  quantity: number;
  unit_price?: string | number;
  discount_percentage?: number;
  tax_rate?: number;
  description?: string;
}

export interface QuotationCreate {
  customer_id?: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_company?: string;
  plan_id?: string;
  validity_days?: number;
  valid_until?: string | null;
  lines: QuotationCreateLine[];
  currency?: string;
  notes?: string;
}

export type QuotationListResponse = PaginatedResponse<Quotation>;
