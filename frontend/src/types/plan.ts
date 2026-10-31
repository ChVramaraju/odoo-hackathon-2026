export type BillingFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type EndOfTermBehavior = 'renew' | 'close' | 'cancel' | 'pause';
export type PlanStatus = 'draft' | 'active' | 'closed' | 'archived';

export interface Plan {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  price: string;
  currency: string;
  billing_frequency: BillingFrequency;
  billing_interval: number;
  minimum_quantity: number;
  start_date?: string | null;
  end_date?: string | null;
  end_of_term_behavior: EndOfTermBehavior;
  status: PlanStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanCreate {
  name: string;
  code?: string;
  description?: string;
  price: string;
  currency?: string;
  billing_frequency?: BillingFrequency;
  billing_interval?: number;
  minimum_quantity?: number;
  start_date?: string;
  end_date?: string;
  end_of_term_behavior?: EndOfTermBehavior;
  status?: PlanStatus;
  is_active?: boolean;
}

export interface PlanUpdate {
  name?: string;
  code?: string;
  description?: string;
  price?: string;
  currency?: string;
  billing_frequency?: BillingFrequency;
  billing_interval?: number;
  minimum_quantity?: number;
  start_date?: string;
  end_date?: string;
  end_of_term_behavior?: EndOfTermBehavior;
  status?: PlanStatus;
  is_active?: boolean;
}

export interface PlanListResponse {
  items: Plan[];
  total: number;
  page: number;
  page_size: number;
}

