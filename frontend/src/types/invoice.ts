/**
 * Brightloop Invoice Domain Models & DTOs
 *
 * Implements domain contracts from:
 * - DOMAIN_MODULES.md: Prefilled customer/line/tax/total, duplicate prevention, payment status, balance due.
 * - API_CONTRACTS.md: GET /invoices, GET /invoices/{id}, POST /invoices/{id}/confirm, /cancel.
 * - DATABASE_GUIDE.md: invoices, invoice_lines with immutable pricing and tax snapshots.
 */

import { PaginatedResponse } from './api';

export type InvoiceStatus = 'draft' | 'confirmed' | 'posted' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: string;
  tax_amount: string;
  discount_amount: string;
  line_total: string;
}

export interface InvoiceCustomer {
  id?: string | null;
  name: string;
  email: string;
  company?: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id?: string | null;
  customer: InvoiceCustomer;
  subscription_id?: string | null;
  subscription_number?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  issue_date: string;
  invoice_date?: string;
  due_date: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  amount_paid: string;
  amount_due: string;
  balance?: string;
  lines: InvoiceLineItem[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFilterParams {
  status?: InvoiceStatus;
  search?: string;
  page?: number;
  page_size?: number;
}

export type InvoiceListResponse = PaginatedResponse<Invoice>;

