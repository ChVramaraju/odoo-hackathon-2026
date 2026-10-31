/**
 * Brightloop Customer Portal Domain Models & Contracts
 *
 * Implements domain contracts from:
 * - DOMAIN_MODULES.md: Customer self-service portal, scoped to authenticated user, zero cross-customer leakage.
 * - API_CONTRACTS.md: Role-scoped list & read operations, customer ownership checks.
 * - DATABASE_GUIDE.md: profiles table and customer ownership RLS policies.
 */

import { Subscription } from './subscription';
import { Invoice } from './invoice';
import { Payment } from './payment';

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  role: 'customer';
  created_at?: string;
  updated_at?: string;
}

export interface CustomerProfileUpdate {
  name?: string;
  company?: string;
}

export interface CustomerDashboardSummary {
  customer_id: string;
  customer_name: string;
  customer_company?: string | null;
  currency: string;
  active_subscriptions_count: number;
  total_outstanding_balance: string;
  total_settled_amount: string;
  next_billing_date: string | null;
  active_subscriptions: Subscription[];
  recent_invoices: Invoice[];
  recent_payments: Payment[];
}

