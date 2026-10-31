/**
 * Brightloop Subscription Domain Models & DTOs
 *
 * Implements the domain contracts from:
 * - DOMAIN_MODULES.md: Unique reference, customer, plan, dates, payment terms, lines, quantities, prices, taxes, totals, and visible lifecycle.
 * - API_CONTRACTS.md: GET /subscriptions, GET /subscriptions/{id}, POST /subscriptions/{id}/pause, resume, renew, close.
 * - Lifecycle: Draft -> Quotation -> Confirmed -> Active -> Closed (with Pause/Resume transitions).
 */

import { PaginatedResponse } from './api';
import { BillingFrequency } from './plan';

export type SubscriptionStatus = 'draft' | 'active' | 'paused' | 'closed' | 'cancelled' | 'expired';

export interface SubscriptionLineItem {
  id: string;
  product_id: string;
  product_name: string;
  product_type: 'service' | 'consumable' | 'storable';
  variant_id?: string | null;
  variant_name?: string | null;
  quantity: number;
  unit_price: string;
  tax_rate?: string;
  line_total: string;
}

export interface SubscriptionCustomer {
  id?: string | null;
  name: string;
  email: string;
  company?: string | null;
}

export interface Subscription {
  id: string;
  subscription_number: string;
  customer_id?: string | null;
  customer: SubscriptionCustomer;
  plan_id: string;
  plan_name: string;
  plan_code?: string | null;
  billing_frequency: BillingFrequency;
  billing_interval: number;
  start_date: string;
  end_date?: string | null;
  next_billing_date: string;
  payment_terms?: string | null;
  end_of_term_behavior: 'renew' | 'close' | 'cancel' | 'pause';
  status: SubscriptionStatus;
  currency: string;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  lines: SubscriptionLineItem[];
  quotation_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionFilterParams {
  status?: SubscriptionStatus;
  search?: string;
  page?: number;
  page_size?: number;
}

export type SubscriptionListResponse = PaginatedResponse<Subscription>;

