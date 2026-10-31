/**
 * Brightloop Payment Domain Models & DTOs
 *
 * Implements domain contracts from:
 * - DOMAIN_MODULES.md: Record method, amount, date, note/reference and linked invoice; show paid/outstanding balances.
 * - API_CONTRACTS.md: GET, POST /payments
 * - DATABASE_GUIDE.md: payments table with invoice_id, method, amount, currency, payment_date, note, status.
 */

import { PaginatedResponse } from './api';

export type PaymentMethod =
  | 'card'
  | 'bank_transfer'
  | 'upi'
  | 'net_banking'
  | 'manual'
  | 'cash'
  | 'credit_card'
  | 'ach';

export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';

export interface PaymentCustomer {
  id?: string | null;
  name: string;
  email: string;
  company?: string | null;
}

export interface Payment {
  id: string;
  payment_number: string;
  invoice_id: string;
  invoice_number: string;
  customer_id?: string | null;
  customer: PaymentCustomer;
  amount: string;
  currency: string;
  payment_date: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  payment_status?: PaymentStatus;
  transaction_reference?: string | null;
  reference_note?: string | null;
  notes?: string | null;
  idempotency_key?: string | null;
  recorded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentCreate {
  invoice_id: string;
  amount: string | number;
  currency?: string;
  payment_method?: PaymentMethod;
  transaction_reference?: string | null;
  idempotency_key?: string | null;
  payment_date?: string | null;
  notes?: string | null;
}

export interface PaymentFilterParams {
  customer_id?: string;
  invoice_id?: string;
  status?: PaymentStatus | string;
  search?: string;
  page?: number;
  page_size?: number;
}

export type PaymentListResponse = PaginatedResponse<Payment>;

