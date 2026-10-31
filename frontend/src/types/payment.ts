/**
 * Brightloop Payment Domain Models & DTOs
 *
 * Implements domain contracts from:
 * - DOMAIN_MODULES.md: Record method, amount, date, note/reference and linked invoice; show paid/outstanding balances.
 * - API_CONTRACTS.md: GET, POST /payments
 * - DATABASE_GUIDE.md: payments table with invoice_id, method, amount, currency, payment_date, note, status.
 */

import { PaginatedResponse } from './api';

export type PaymentMethod = 'bank_transfer' | 'credit_card' | 'ach' | 'manual';

export type PaymentStatus = 'completed' | 'pending' | 'failed';

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
  reference_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentFilterParams {
  status?: PaymentStatus;
  search?: string;
  page?: number;
  page_size?: number;
}

export type PaymentListResponse = PaginatedResponse<Payment>;

