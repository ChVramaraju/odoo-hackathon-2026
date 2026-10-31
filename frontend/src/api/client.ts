import { SystemHealth } from '../types/api';
import {
  Product,
  ProductCreate,
  ProductListResponse,
  ProductUpdate,
  ProductVariant,
  ProductVariantCreate,
} from '../types/product';
import { Plan, PlanCreate, PlanListResponse, PlanUpdate } from '../types/plan';
import {
  Quotation,
  QuotationCreate,
  QuotationListResponse,
  QuotationStatus,
} from '../types/quotation';
import {
  Subscription,
  SubscriptionFilterParams,
  SubscriptionListResponse,
} from '../types/subscription';
import {
  Invoice,
  InvoiceFilterParams,
  InvoiceListResponse,
} from '../types/invoice';
import {
  Payment,
  PaymentCreate,
  PaymentFilterParams,
  PaymentListResponse,
  PaymentStatus,
} from '../types/payment';
import {
  CustomerProfile,
  CustomerProfileUpdate,
  CustomerDashboardSummary,
} from '../types/portal';
import { mockInvoices, mockPayments, mockPlans, mockProducts, mockQuotations, mockSubscriptions, mockVariants } from './mocks';

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: Array<string | { field: string; issue: string }>;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: Array<string | { field: string; issue: string }>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private mockModeOverride: boolean | null = null;
  private liveConnected: boolean = false;
  private inMemoryProducts: Product[] = [...mockProducts];
  private inMemoryVariants: Record<string, ProductVariant[]> = { ...mockVariants };
  private inMemoryPlans: Plan[] = [...mockPlans];
  private inMemoryQuotations: Quotation[] = [...mockQuotations];
  private inMemorySubscriptions: Subscription[] = [...mockSubscriptions];
  private inMemoryInvoices: Invoice[] = [...mockInvoices];
  private inMemoryPayments: Payment[] = [...mockPayments];
  private activeCustomerId: string = 'cust-001';
  private customerProfiles: Record<string, CustomerProfile> = {
    'cust-001': {
      id: 'cust-001',
      name: 'Sarah Chen',
      email: 'schen@acmecloud.com',
      company: 'Acme Cloud Corp',
      role: 'customer',
      created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    'cust-002': {
      id: 'cust-002',
      name: 'Marcus Brody',
      email: 'mbrody@brodyquantum.io',
      company: 'Brody Quantum Analytics',
      role: 'customer',
      created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
    'cust-003': {
      id: 'cust-003',
      name: 'Elena Rostova',
      email: 'elena@rostovarobotics.de',
      company: 'Rostova Robotics GmbH',
      role: 'customer',
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
  };

  public getCurrentCallerRole(): 'admin' | 'staff' | 'customer' {
    if (this.token && (this.token.includes('customer') || this.token.includes('cust-'))) {
      return 'customer';
    }
    if (this.token && this.token.includes('staff')) {
      return 'staff';
    }
    return 'admin';
  }

  public getCurrentCustomerId(): string | null {
    if (this.getCurrentCallerRole() === 'customer') {
      if (this.token && this.token.includes('cust-002')) return 'cust-002';
      if (this.token && this.token.includes('cust-003')) return 'cust-003';
      return this.activeCustomerId;
    }
    return null;
  }

  public setActiveCustomerId(customerId: string) {
    if (this.customerProfiles[customerId]) {
      this.activeCustomerId = customerId;
    }
  }

  public setMockMode(enabled: boolean | null) {
    this.mockModeOverride = enabled;
  }

  public isMockMode(): boolean {
    if (this.mockModeOverride !== null) return this.mockModeOverride;
    if (import.meta.env.VITE_USE_MOCKS === 'true') return true;
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      return true;
    }
    return false;
  }

  public isLiveConnected(): boolean {
    return this.liveConnected;
  }

  public resetMockData() {
    this.inMemoryProducts = [...mockProducts];
    this.inMemoryPlans = [...mockPlans];
    this.inMemoryQuotations = [...mockQuotations];
    this.inMemorySubscriptions = [...mockSubscriptions];
    this.inMemoryInvoices = mockInvoices.map((inv) => ({ ...inv }));
    this.inMemoryPayments = mockPayments.map((p) => ({ ...p }));
  }

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  }

  public setToken(token: string | null) {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    // Preview mode tokens are simulated client markers and must NEVER be transmitted as real Bearer tokens to live backends
    if (this.token && !this.token.startsWith('preview-mode-')) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = { ...this.getHeaders(), ...(options.headers as Record<string, string>) };

    // Explicit mock-mode shortcut (env flag set or offline development)
    if (this.isMockMode()) {
      return this.handleMockFallback<T>(endpoint, options);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const signal = options.signal || controller.signal;

    try {
      const response = await fetch(url, { ...options, headers, signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: { error?: { code?: string; message?: string; details?: any[] } } = {};
        try {
          errorData = await response.json();
        } catch {
          // Response body was not JSON
        }

        const code = errorData?.error?.code || (response.status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR');
        const message = errorData?.error?.message || `Request to ${endpoint} failed with HTTP status ${response.status}`;
        const details = errorData?.error?.details;

        throw new ApiError(code, message, response.status, details);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) {
        throw err;
      }
      const isAbort = (err as Error)?.name === 'AbortError';
      const message = isAbort
        ? `Request to ${endpoint} timed out after 15 seconds.`
        : (err as Error)?.message || `Network error: failed to connect to backend service at ${this.baseUrl}.`;
      throw new ApiError('NETWORK_ERROR', message, 503);
    }
  }

  private handleMockFallback<T>(endpoint: string, options: RequestInit): T {
    const method = options.method || 'GET';
    const cleanUrl = endpoint.split('?')[0];

    // Health check
    if (cleanUrl === '/health') {
      return { status: 'mock-healthy', version: '0.1.0-frontend-mock' } as T;
    }

    // Products endpoints
    if (cleanUrl === '/products') {
      if (method === 'GET') {
        return {
          items: this.inMemoryProducts,
          total: this.inMemoryProducts.length,
          page: 1,
          page_size: 20,
        } as T;
      }
      if (method === 'POST') {
        const payload = JSON.parse(options.body as string) as ProductCreate;
        const newProduct: Product = {
          id: `prod-${Date.now().toString(36)}`,
          name: payload.name,
          type: payload.type || 'service',
          sales_price: payload.sales_price,
          cost_price: payload.cost_price || '0.00',
          currency: payload.currency || 'USD',
          description: payload.description || null,
          notes: payload.notes || null,
          is_active: payload.is_active !== undefined ? payload.is_active : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.inMemoryProducts.unshift(newProduct);
        return newProduct as T;
      }
    }

    if (cleanUrl.startsWith('/products/') && cleanUrl.endsWith('/variants')) {
      const parts = cleanUrl.split('/');
      const productId = parts[2];
      if (method === 'GET') {
        return (this.inMemoryVariants[productId] || []) as T;
      }
      if (method === 'POST') {
        const payload = JSON.parse(options.body as string) as ProductVariantCreate;
        const newVariant: ProductVariant = {
          id: `var-${Date.now().toString(36)}`,
          product_id: productId,
          name: payload.name,
          value: payload.value,
          price_adjustment: payload.price_adjustment || '0.00',
          sku: payload.sku || null,
          is_active: payload.is_active !== undefined ? payload.is_active : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (!this.inMemoryVariants[productId]) {
          this.inMemoryVariants[productId] = [];
        }
        this.inMemoryVariants[productId].push(newVariant);
        return newVariant as T;
      }
    }

    if (cleanUrl.startsWith('/products/')) {
      const productId = cleanUrl.replace('/products/', '');
      const found = this.inMemoryProducts.find((p) => p.id === productId);
      if (found) return found as T;
    }

    // Plans endpoints
    if (cleanUrl === '/plans') {
      if (method === 'GET') {
        return {
          items: this.inMemoryPlans,
          total: this.inMemoryPlans.length,
          page: 1,
          page_size: 20,
        } as T;
      }
      if (method === 'POST') {
        const payload = JSON.parse(options.body as string) as PlanCreate;
        const newPlan: Plan = {
          id: `plan-${Date.now().toString(36)}`,
          name: payload.name,
          code: payload.code || `PL-${Date.now().toString().slice(-4)}`,
          description: payload.description || null,
          price: payload.price,
          currency: payload.currency || 'USD',
          billing_frequency: payload.billing_frequency || 'monthly',
          billing_interval: payload.billing_interval || 1,
          minimum_quantity: payload.minimum_quantity || 1,
          start_date: payload.start_date || null,
          end_date: payload.end_date || null,
          end_of_term_behavior: payload.end_of_term_behavior || 'renew',
          status: payload.status || 'active',
          is_active: payload.is_active !== undefined ? payload.is_active : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.inMemoryPlans.unshift(newPlan);
        return newPlan as T;
      }
    }

    if (cleanUrl.startsWith('/plans/')) {
      const planId = cleanUrl.replace('/plans/', '');
      const found = this.inMemoryPlans.find((p) => p.id === planId);
      if (found) return found as T;
    }

    // Quotations endpoints (API_CONTRACTS.md: GET /quotations, POST /quotations, POST /quotations/{id}/confirm)
    if (cleanUrl === '/quotations') {
      if (method === 'GET') {
        return {
          items: this.inMemoryQuotations,
          total: this.inMemoryQuotations.length,
          page: 1,
          page_size: 20,
        } as T;
      }
      if (method === 'POST') {
        const payload = JSON.parse(options.body as string) as QuotationCreate;
        const matchedPlan = this.inMemoryPlans.find((p) => p.id === payload.plan_id) || this.inMemoryPlans[0];
        
        let subtotalNum = 0;
        const lines = (payload.lines || []).map((l, idx) => {
          const product = this.inMemoryProducts.find((p) => p.id === l.product_id);
          const price = parseFloat(String(l.unit_price || product?.sales_price || '0.00'));
          const lineTotal = Math.round(price * l.quantity * 100) / 100;
          subtotalNum += lineTotal;
          return {
            id: `qline-${Date.now().toString(36)}-${idx}`,
            product_id: l.product_id,
            product_name: product?.name || 'Selected Product',
            product_type: product?.type || 'service',
            variant_id: l.variant_id || null,
            quantity: l.quantity,
            unit_price: price.toFixed(2),
            subtotal: lineTotal.toFixed(2),
          };
        });

        // 10% illustrative tax calculation rounded to cents to prevent float drift
        const taxNum = Math.round(subtotalNum * 10) / 100;
        const totalNum = Math.round((subtotalNum + taxNum) * 100) / 100;
        const quoteNum = `QT-2026-${String(this.inMemoryQuotations.length + 1).padStart(3, '0')}`;
        const now = new Date();
        const expiry = new Date(now.getTime() + (payload.validity_days || 30) * 86400000);

        const newQuotation: Quotation = {
          id: `quote-${Date.now().toString(36)}`,
          quotation_number: quoteNum,
          customer_id: payload.customer_id || null,
          customer: {
            id: payload.customer_id || null,
            name: payload.customer_name || 'Unregistered Contact',
            email: payload.customer_email || 'lead@example.com',
            company: payload.customer_company || null,
            is_registered: false,
          },
          plan_id: matchedPlan.id,
          plan_name: matchedPlan.name,
          plan_code: matchedPlan.code || 'BL-PLAN',
          billing_frequency: matchedPlan.billing_frequency,
          validity_days: payload.validity_days || 30,
          status: 'quotation' as QuotationStatus,
          currency: payload.currency || 'USD',
          lines,
          subtotal: subtotalNum.toFixed(2),
          tax_amount: taxNum.toFixed(2),
          discount_amount: '0.00',
          total_amount: totalNum.toFixed(2),
          notes: payload.notes || null,
          created_at: now.toISOString(),
          expiry_date: expiry.toISOString(),
          updated_at: now.toISOString(),
        };

        this.inMemoryQuotations.unshift(newQuotation);
        return newQuotation as T;
      }
    }

    if (cleanUrl.startsWith('/quotations/') && cleanUrl.endsWith('/confirm')) {
      const parts = cleanUrl.split('/');
      const quoteId = parts[2];
      const found = this.inMemoryQuotations.find((q) => q.id === quoteId);
      if (!found) {
        throw {
          error: {
            code: 'NOT_FOUND',
            message: `Quotation with id '${quoteId}' was not found.`,
          },
        };
      }
      if (found.status !== 'quotation') {
        throw {
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: `Cannot confirm quotation in '${found.status}' status. Only quotations in 'quotation' status can be confirmed to subscription.`,
          },
        };
      }
      found.status = 'confirmed';
      found.subscription_id = `DEMO-SUB-${Date.now().toString(36).toUpperCase()}`;
      found.updated_at = new Date().toISOString();
      return found as T;
    }

    if (cleanUrl.startsWith('/quotations/')) {
      const quoteId = cleanUrl.replace('/quotations/', '');
      const found = this.inMemoryQuotations.find((q) => q.id === quoteId);
      if (found) return found as T;
      throw {
        error: {
          code: 'NOT_FOUND',
          message: `Quotation with id '${quoteId}' was not found.`,
        },
      };
    }

    // Subscriptions endpoints (API_CONTRACTS.md)
    if (cleanUrl === '/subscriptions' || cleanUrl === '/portal/subscriptions') {
      if (method === 'GET') {
        let items = [...this.inMemorySubscriptions];
        const callerRole = this.getCurrentCallerRole();
        const custId = this.getCurrentCustomerId();

        // Enforce backend customer ownership boundary
        if (callerRole === 'customer' && custId) {
          const profile = this.customerProfiles[custId];
          items = items.filter(
            (s) => s.customer_id === custId || (profile && s.customer.email === profile.email)
          );
        }

        const searchParams = new URLSearchParams(endpoint.includes('?') ? endpoint.split('?')[1] : '');
        const status = searchParams.get('status');
        const search = searchParams.get('search')?.toLowerCase();

        if (status && status !== 'all') {
          items = items.filter((s) => s.status === status);
        }
        if (search) {
          items = items.filter(
            (s) =>
              s.subscription_number.toLowerCase().includes(search) ||
              s.customer.name.toLowerCase().includes(search) ||
              (s.customer.company && s.customer.company.toLowerCase().includes(search)) ||
              s.plan_name.toLowerCase().includes(search)
          );
        }
        return {
          items,
          total: items.length,
          page: 1,
          page_size: 20,
        } as T;
      }
    }

    if (cleanUrl.startsWith('/subscriptions/') && cleanUrl.endsWith('/pause')) {
      const subId = cleanUrl.split('/')[2];
      const found = this.inMemorySubscriptions.find((s) => s.id === subId);
      if (!found) {
        throw {
          error: {
            code: 'NOT_FOUND',
            message: `Subscription with id '${subId}' was not found.`,
          },
        };
      }
      if (found.status !== 'active') {
        throw {
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: `Cannot pause subscription in '${found.status}' status. Only active subscriptions can be paused.`,
          },
        };
      }
      found.status = 'paused';
      found.updated_at = new Date().toISOString();
      return found as T;
    }

    if (cleanUrl.startsWith('/subscriptions/') && cleanUrl.endsWith('/resume')) {
      const subId = cleanUrl.split('/')[2];
      const found = this.inMemorySubscriptions.find((s) => s.id === subId);
      if (!found) {
        throw {
          error: {
            code: 'NOT_FOUND',
            message: `Subscription with id '${subId}' was not found.`,
          },
        };
      }
      if (found.status !== 'paused') {
        throw {
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: `Cannot resume subscription in '${found.status}' status. Only paused subscriptions can be resumed.`,
          },
        };
      }
      found.status = 'active';
      found.updated_at = new Date().toISOString();
      return found as T;
    }

    if (cleanUrl.startsWith('/subscriptions/') && cleanUrl.endsWith('/renew')) {
      const subId = cleanUrl.split('/')[2];
      const found = this.inMemorySubscriptions.find((s) => s.id === subId);
      if (!found) {
        throw {
          error: {
            code: 'NOT_FOUND',
            message: `Subscription with id '${subId}' was not found.`,
          },
        };
      }
      found.status = 'active';
      found.updated_at = new Date().toISOString();
      return found as T;
    }

    if (cleanUrl.startsWith('/subscriptions/') && cleanUrl.endsWith('/close')) {
      const subId = cleanUrl.split('/')[2];
      const found = this.inMemorySubscriptions.find((s) => s.id === subId);
      if (!found) {
        throw {
          error: {
            code: 'NOT_FOUND',
            message: `Subscription with id '${subId}' was not found.`,
          },
        };
      }
      found.status = 'closed';
      found.end_date = new Date().toISOString();
      found.updated_at = new Date().toISOString();
      return found as T;
    }

    if (cleanUrl.startsWith('/subscriptions/')) {
      const subId = cleanUrl.replace('/subscriptions/', '');
      const found = this.inMemorySubscriptions.find((s) => s.id === subId);
      if (found) {
        // Enforce customer ownership check at API boundary
        const callerRole = this.getCurrentCallerRole();
        const custId = this.getCurrentCustomerId();
        if (callerRole === 'customer' && custId) {
          const profile = this.customerProfiles[custId];
          if (found.customer_id !== custId && (!profile || found.customer.email !== profile.email)) {
            throw {
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to access this subscription record.',
              },
            };
          }
        }
        return found as T;
      }
      throw {
        error: {
          code: 'NOT_FOUND',
          message: `Subscription with id '${subId}' was not found.`,
        },
      };
    }

    // Invoices endpoints (API_CONTRACTS.md)
    if (cleanUrl === '/invoices' || cleanUrl === '/portal/invoices') {
      if (method === 'GET') {
        let items = [...this.inMemoryInvoices];
        const callerRole = this.getCurrentCallerRole();
        const custId = this.getCurrentCustomerId();

        // Enforce backend customer ownership boundary
        if (callerRole === 'customer' && custId) {
          const profile = this.customerProfiles[custId];
          items = items.filter(
            (inv) => inv.customer_id === custId || (profile && inv.customer.email === profile.email)
          );
        }

        const searchParams = new URLSearchParams(endpoint.includes('?') ? endpoint.split('?')[1] : '');
        const status = searchParams.get('status');
        const search = searchParams.get('search')?.toLowerCase();

        if (status && status !== 'all') {
          items = items.filter((inv) => inv.status === status);
        }
        if (search) {
          items = items.filter(
            (inv) =>
              inv.invoice_number.toLowerCase().includes(search) ||
              inv.customer.name.toLowerCase().includes(search) ||
              (inv.customer.company && inv.customer.company.toLowerCase().includes(search)) ||
              (inv.subscription_number && inv.subscription_number.toLowerCase().includes(search))
          );
        }
        return {
          items,
          total: items.length,
          page: 1,
          page_size: 20,
        } as T;
      }
    }

    if (cleanUrl.startsWith('/invoices/') && cleanUrl.endsWith('/confirm')) {
      const invId = cleanUrl.split('/')[2];
      const found = this.inMemoryInvoices.find((i) => i.id === invId);
      if (!found) {
        throw {
          error: {
            code: 'NOT_FOUND',
            message: `Invoice with id '${invId}' was not found.`,
          },
        };
      }
      if (found.status !== 'draft') {
        throw {
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: `Cannot confirm invoice in '${found.status}' status. Only draft invoices can be confirmed.`,
          },
        };
      }
      found.status = 'posted';
      found.updated_at = new Date().toISOString();
      return found as T;
    }

    if (cleanUrl.startsWith('/invoices/') && cleanUrl.endsWith('/cancel')) {
      const invId = cleanUrl.split('/')[2];
      const found = this.inMemoryInvoices.find((i) => i.id === invId);
      if (!found) {
        throw {
          error: {
            code: 'NOT_FOUND',
            message: `Invoice with id '${invId}' was not found.`,
          },
        };
      }
      if (found.status === 'paid') {
        throw {
          error: {
            code: 'INVALID_STATE_TRANSITION',
            message: `Cannot cancel a fully paid invoice.`,
          },
        };
      }
      found.status = 'cancelled';
      found.updated_at = new Date().toISOString();
      return found as T;
    }

    if (cleanUrl.startsWith('/invoices/')) {
      const invId = cleanUrl.replace('/invoices/', '');
      const found = this.inMemoryInvoices.find((i) => i.id === invId);
      if (found) {
        // Enforce customer ownership check at API boundary
        const callerRole = this.getCurrentCallerRole();
        const custId = this.getCurrentCustomerId();
        if (callerRole === 'customer' && custId) {
          const profile = this.customerProfiles[custId];
          if (found.customer_id !== custId && (!profile || found.customer.email !== profile.email)) {
            throw {
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to access this invoice record.',
              },
            };
          }
        }
        return found as T;
      }
      throw {
        error: {
          code: 'NOT_FOUND',
          message: `Invoice with id '${invId}' was not found.`,
        },
      };
    }

    // Payments endpoints (API_CONTRACTS.md, DOMAIN_MODULES.md)
    if (cleanUrl === '/payments' || cleanUrl === '/portal/payments') {
      if (method === 'GET') {
        let items = [...this.inMemoryPayments];
        const callerRole = this.getCurrentCallerRole();
        const custId = this.getCurrentCustomerId();

        // Enforce backend customer ownership boundary
        if (callerRole === 'customer' && custId) {
          const profile = this.customerProfiles[custId];
          items = items.filter(
            (p) => p.customer_id === custId || (profile && p.customer.email === profile.email)
          );
        }

        const searchParams = new URLSearchParams(endpoint.includes('?') ? endpoint.split('?')[1] : '');
        const status = searchParams.get('status');
        const search = searchParams.get('search')?.toLowerCase();

        if (status && status !== 'all') {
          items = items.filter((p) => p.status === status);
        }
        if (search) {
          items = items.filter(
            (p) =>
              p.payment_number.toLowerCase().includes(search) ||
              p.invoice_number.toLowerCase().includes(search) ||
              p.customer.name.toLowerCase().includes(search) ||
              (p.customer.company && p.customer.company.toLowerCase().includes(search)) ||
              (p.reference_note && p.reference_note.toLowerCase().includes(search))
          );
        }
        return {
          items,
          total: items.length,
          page: 1,
          page_size: 20,
        } as T;
      }

      if (method === 'POST') {
        const payload = JSON.parse(options.body as string) as PaymentCreate;
        const amountNum = typeof payload.amount === 'number' ? payload.amount : parseFloat(String(payload.amount || '0'));
        if (isNaN(amountNum) || amountNum <= 0) {
          throw new ApiError('VALIDATION_ERROR', 'Payment amount must be greater than zero.', 422);
        }

        // 1. Idempotency check: if key already used, check whether request is identical
        if (payload.idempotency_key) {
          const existing = this.inMemoryPayments.find((p) => p.idempotency_key === payload.idempotency_key);
          if (existing) {
            const existingAmount = parseFloat(existing.amount);
            const reqAmount = parseFloat(amountNum.toFixed(2));
            const existingCurrency = (existing.currency || 'INR').toUpperCase();
            const reqCurrency = (payload.currency || 'INR').toUpperCase();
            if (
              existing.invoice_id === payload.invoice_id &&
              Math.abs(existingAmount - reqAmount) < 0.001 &&
              existingCurrency === reqCurrency
            ) {
              return existing as T;
            }
            throw new ApiError(
              'CONFLICT',
              'Idempotency key has already been used with different payment parameters.',
              409
            );
          }
        }

        // 2. Invoice existence & tenancy check
        const invoice = this.inMemoryInvoices.find((inv) => inv.id === payload.invoice_id);
        if (!invoice) {
          throw new ApiError('NOT_FOUND', `Invoice '${payload.invoice_id}' not found.`, 404);
        }

        const callerRole = this.getCurrentCallerRole();
        const custId = this.getCurrentCustomerId();
        if (callerRole === 'customer' && custId && invoice.customer_id && invoice.customer_id !== custId) {
          throw new ApiError('NOT_FOUND', `Invoice '${payload.invoice_id}' not found.`, 404);
        }

        // 3. Currency match check
        const paymentCurrency = (payload.currency || 'INR').toUpperCase();
        const invoiceCurrency = (invoice.currency || 'INR').toUpperCase();
        if (paymentCurrency !== invoiceCurrency) {
          throw new ApiError(
            'CURRENCY_MISMATCH',
            `Payment currency '${paymentCurrency}' does not match invoice currency '${invoiceCurrency}'.`,
            400
          );
        }

        // 4. Invoice status & balance checks
        if (invoice.status === 'cancelled') {
          throw new ApiError('INVALID_STATUS_TRANSITION', 'Cannot record payment against a cancelled invoice.', 400);
        }

        const currentBalance = parseFloat(invoice.amount_due || '0');
        if (invoice.status === 'paid' || currentBalance <= 0) {
          throw new ApiError('INVALID_STATUS_TRANSITION', 'Invoice is already paid in full.', 400);
        }

        // 5. Overpayment guard
        if (amountNum > currentBalance + 0.001) {
          throw new ApiError(
            'OVERPAYMENT_NOT_ALLOWED',
            `Payment amount (${amountNum.toFixed(2)}) exceeds outstanding invoice balance (${currentBalance.toFixed(2)}).`,
            400
          );
        }

        // 6. Update invoice balance and status
        const newBalance = Math.max(0, currentBalance - amountNum);
        invoice.amount_due = newBalance.toFixed(2);
        if (newBalance === 0) {
          invoice.status = 'paid';
        }

        // 7. Record payment
        const rawMethod = payload.payment_method || 'manual';
        const normalizedMethod =
          rawMethod === 'credit_card' ? 'card' : rawMethod === 'ach' ? 'bank_transfer' : rawMethod;

        const newPay: Payment = {
          id: `pay-${Date.now().toString(36)}`,
          payment_number: `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          customer_id: invoice.customer_id || custId || null,
          customer: {
            id: invoice.customer_id || null,
            name: invoice.customer.name,
            email: invoice.customer.email,
            company: invoice.customer.company || null,
          },
          amount: amountNum.toFixed(2),
          currency: paymentCurrency,
          payment_date: payload.payment_date || new Date().toISOString(),
          payment_method: normalizedMethod,
          status: 'completed',
          payment_status: 'completed',
          transaction_reference: payload.transaction_reference || null,
          reference_note: payload.notes || payload.transaction_reference || null,
          notes: payload.notes || null,
          idempotency_key: payload.idempotency_key || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        this.inMemoryPayments.unshift(newPay);
        return newPay as T;
      }
    }

    if (cleanUrl.startsWith('/payments/')) {
      const payId = cleanUrl.replace('/payments/', '');
      const found = this.inMemoryPayments.find((p) => p.id === payId);
      if (found) {
        // Enforce customer ownership check at API boundary
        const callerRole = this.getCurrentCallerRole();
        const custId = this.getCurrentCustomerId();
        if (callerRole === 'customer' && custId) {
          const profile = this.customerProfiles[custId];
          if (found.customer_id !== custId && (!profile || found.customer.email !== profile.email)) {
            throw {
              error: {
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to access this payment record.',
              },
            };
          }
        }
        return found as T;
      }
      throw {
        error: {
          code: 'NOT_FOUND',
          message: `Payment with id '${payId}' was not found.`,
        },
      };
    }

    // Customer Portal: Profile endpoints (API_CONTRACTS.md, DOMAIN_MODULES.md)
    if (cleanUrl === '/auth/me' || cleanUrl === '/portal/me' || cleanUrl === '/portal/profile') {
      const custId = this.getCurrentCustomerId() || 'cust-001';
      const profile = this.customerProfiles[custId] || {
        id: custId,
        name: 'Sarah Chen',
        email: 'schen@acmecloud.com',
        company: 'Acme Cloud Corp',
        role: 'customer' as const,
      };

      if (method === 'GET') {
        return profile as T;
      }

      if (method === 'PATCH' || method === 'PUT') {
        const body = JSON.parse(options.body as string) as CustomerProfileUpdate;
        if (body.name !== undefined) profile.name = body.name;
        if (body.company !== undefined) profile.company = body.company;
        profile.updated_at = new Date().toISOString();
        return profile as T;
      }
    }

    // Customer Portal: Dashboard summary (API_CONTRACTS.md, DOMAIN_MODULES.md)
    if (cleanUrl === '/portal/dashboard') {
      const custId = this.getCurrentCustomerId() || 'cust-001';
      const profile = this.customerProfiles[custId] || {
        id: custId,
        name: 'Sarah Chen',
        email: 'schen@acmecloud.com',
        company: 'Acme Cloud Corp',
        role: 'customer' as const,
      };

      const custSubs = this.inMemorySubscriptions.filter(
        (s) => s.customer_id === custId || s.customer.email === profile.email
      );
      const activeSubs = custSubs.filter((s) => s.status === 'active');
      const custInvs = this.inMemoryInvoices.filter(
        (i) => i.customer_id === custId || i.customer.email === profile.email
      );
      const custPays = this.inMemoryPayments.filter(
        (p) => p.customer_id === custId || p.customer.email === profile.email
      );

      const totalOutstanding = custInvs.reduce(
        (sum, inv) => sum + parseFloat(inv.amount_due || '0'),
        0
      );
      const totalSettled = custPays
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

      const nextBillingDate =
        activeSubs.find((s) => s.next_billing_date)?.next_billing_date || null;

      const summary: CustomerDashboardSummary = {
        customer_id: custId,
        customer_name: profile.name,
        customer_company: profile.company,
        currency: 'USD',
        active_subscriptions_count: activeSubs.length,
        total_outstanding_balance: totalOutstanding.toFixed(2),
        total_settled_amount: totalSettled.toFixed(2),
        next_billing_date: nextBillingDate,
        active_subscriptions: activeSubs,
        recent_invoices: custInvs,
        recent_payments: custPays,
      };

      return summary as T;
    }

    throw new Error(`Unhandled mock endpoint: ${method} ${endpoint}`);
  }

  // --- High-level Typed Methods ---

  public async getHealth(): Promise<SystemHealth> {
    try {
      const res = await this.request<SystemHealth>('/health');
      if (res.status === 'ok') {
        this.liveConnected = true;
      }
      return res;
    } catch (err) {
      this.liveConnected = false;
      throw err;
    }
  }

  public async getProducts(params?: { active_only?: boolean; page?: number; page_size?: number }): Promise<ProductListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.active_only !== undefined) searchParams.append('active_only', String(params.active_only));
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return this.request<ProductListResponse>(`/products${qs ? `?${qs}` : ''}`);
  }

  public async getProduct(id: string): Promise<Product> {
    return this.request<Product>(`/products/${id}`);
  }

  public async createProduct(payload: ProductCreate): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateProduct(id: string, payload: ProductUpdate): Promise<Product> {
    return this.request<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  public async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return this.request<ProductVariant[]>(`/products/${productId}/variants`);
  }

  public async createProductVariant(productId: string, payload: ProductVariantCreate): Promise<ProductVariant> {
    return this.request<ProductVariant>(`/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getPlans(params?: { status?: string; billing_frequency?: string; page?: number; page_size?: number }): Promise<PlanListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.billing_frequency) searchParams.append('billing_frequency', params.billing_frequency);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return this.request<PlanListResponse>(`/plans${qs ? `?${qs}` : ''}`);
  }

  public async getPlan(id: string): Promise<Plan> {
    return this.request<Plan>(`/plans/${id}`);
  }

  public async createPlan(payload: PlanCreate): Promise<Plan> {
    return this.request<Plan>('/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updatePlan(id: string, payload: PlanUpdate): Promise<Plan> {
    return this.request<Plan>(`/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // --- Quotations Normalization & Methods (API_CONTRACTS.md & FastAPI Schemas) ---

  public normalizeQuotation(raw: any): Quotation {
    if (!raw) return raw;
    const rawStatus = raw.status;
    const normalizedStatus = rawStatus === 'sent' ? 'quotation' : rawStatus;
    const planLine = Array.isArray(raw.lines)
      ? raw.lines.find((l: any) => l.line_type === 'plan' || l.plan_id)
      : undefined;

    return {
      id: raw.id,
      quotation_number: raw.quotation_number || `QT-${raw.id?.slice(0, 8)}`,
      customer_id: raw.customer_id || null,
      customer: raw.customer || {
        id: raw.customer_id || null,
        name: raw.customer_name || 'Customer ' + (raw.customer_id ? String(raw.customer_id).slice(0, 8) : 'General'),
        email: raw.customer_email || 'client@brightloop.io',
        company: raw.customer_company || null,
        is_registered: true,
      },
      plan_id: raw.plan_id || planLine?.plan_id || '',
      plan_name: raw.plan_name || planLine?.description || 'Subscription Plan',
      plan_code: raw.plan_code || null,
      billing_frequency: raw.billing_frequency || 'monthly',
      validity_days: raw.validity_days || 30,
      status: normalizedStatus,
      currency: raw.currency || 'INR',
      subtotal: typeof raw.subtotal === 'number' ? raw.subtotal.toFixed(2) : String(raw.subtotal || '0.00'),
      tax_amount: typeof raw.tax_total === 'number' ? raw.tax_total.toFixed(2) : String(raw.tax_amount || raw.tax_total || '0.00'),
      discount_amount: typeof raw.discount_total === 'number' ? raw.discount_total.toFixed(2) : String(raw.discount_amount || raw.discount_total || '0.00'),
      total_amount:
        typeof raw.total_amount === 'number'
          ? raw.total_amount.toFixed(2)
          : typeof raw.amount === 'number'
            ? raw.amount.toFixed(2)
            : String(raw.total_amount || raw.amount || '0.00'),
      valid_until: raw.valid_until || null,
      notes: raw.notes || null,
      subscription_id: raw.subscription_id || null,
      created_at: raw.created_at || new Date().toISOString(),
      expiry_date: raw.valid_until || raw.expiry_date || new Date().toISOString(),
      updated_at: raw.updated_at || new Date().toISOString(),
      lines: Array.isArray(raw.lines)
        ? raw.lines.map((l: any) => ({
            id: l.id || `line-${Math.random().toString(36).slice(2, 7)}`,
            line_type: l.line_type || (l.plan_id ? 'plan' : 'product'),
            product_id: l.product_id || null,
            product_name: l.product_name || l.description || 'Item',
            product_type: l.product_type || 'service',
            variant_id: l.variant_id || null,
            variant_name: l.variant_name || null,
            plan_id: l.plan_id || null,
            description: l.description || '',
            quantity: typeof l.quantity === 'number' ? l.quantity : Number(l.quantity || 1),
            unit_price: typeof l.unit_price === 'number' ? l.unit_price.toFixed(2) : String(l.unit_price || '0.00'),
            line_total: typeof l.line_total === 'number' ? l.line_total.toFixed(2) : String(l.line_total || '0.00'),
            subtotal: typeof l.line_total === 'number' ? l.line_total.toFixed(2) : String(l.line_total || '0.00'),
          }))
        : [],
    };
  }

  public normalizeSubscription(raw: any): Subscription {
    if (!raw) return raw;
    return {
      id: raw.id,
      subscription_number: raw.subscription_number || `SUB-${raw.id?.slice(0, 8)}`,
      customer_id: raw.customer_id || null,
      customer: raw.customer || {
        id: raw.customer_id || null,
        name: raw.customer_name || 'Customer ' + (raw.customer_id ? String(raw.customer_id).slice(0, 8) : 'Client'),
        email: raw.customer_email || 'client@brightloop.io',
        company: raw.customer_company || null,
      },
      plan_id: raw.plan_id || '',
      plan_name: raw.plan?.name || raw.plan_name || 'Active Subscription Plan',
      plan_code: raw.plan?.code || raw.plan_code || null,
      billing_frequency: raw.billing_frequency || 'monthly',
      billing_interval: raw.billing_interval || 1,
      start_date: raw.start_date || new Date().toISOString(),
      end_date: raw.end_date || null,
      next_billing_date: raw.next_billing_date || new Date().toISOString(),
      payment_terms: raw.payment_terms || null,
      end_of_term_behavior: raw.end_of_term_behavior || 'renew',
      status: raw.status || 'active',
      currency: raw.currency || 'INR',
      subtotal: typeof raw.subtotal === 'number' ? raw.subtotal.toFixed(2) : String(raw.subtotal || '0.00'),
      tax_amount: typeof raw.tax_total === 'number' ? raw.tax_total.toFixed(2) : String(raw.tax_amount || raw.tax_total || '0.00'),
      total_amount:
        typeof raw.total_amount === 'number'
          ? raw.total_amount.toFixed(2)
          : typeof raw.amount === 'number'
            ? raw.amount.toFixed(2)
            : String(raw.total_amount || raw.amount || '0.00'),
      quotation_id: raw.quotation_id || null,
      notes: raw.notes || null,
      created_at: raw.created_at || new Date().toISOString(),
      updated_at: raw.updated_at || new Date().toISOString(),
      lines: Array.isArray(raw.lines)
        ? raw.lines.map((l: any) => ({
            id: l.id || `subline-${Math.random().toString(36).slice(2, 7)}`,
            product_id: l.product_id || '',
            product_name: l.product_name || l.description || 'Service',
            product_type: l.product_type || 'service',
            variant_id: l.variant_id || null,
            variant_name: l.variant_name || null,
            quantity: typeof l.quantity === 'number' ? l.quantity : Number(l.quantity || 1),
            unit_price: typeof l.unit_price === 'number' ? l.unit_price.toFixed(2) : String(l.unit_price || '0.00'),
            tax_rate: l.tax_rate !== undefined ? String(l.tax_rate) : undefined,
            line_total: typeof l.line_total === 'number' ? l.line_total.toFixed(2) : String(l.line_total || '0.00'),
          }))
        : [],
    };
  }

  public normalizeInvoice(raw: any): Invoice {
    if (!raw) return raw;
    const rawStatus = raw.status;
    const normalizedStatus = rawStatus === 'confirmed' ? 'posted' : rawStatus;

    return {
      id: raw.id,
      invoice_number: raw.invoice_number || `INV-${raw.id?.slice(0, 8)}`,
      customer_id: raw.customer_id || null,
      customer: raw.customer || {
        id: raw.customer_id || null,
        name: raw.customer_name || 'Customer ' + (raw.customer_id ? String(raw.customer_id).slice(0, 8) : 'Client'),
        email: raw.customer_email || 'client@brightloop.io',
        company: raw.customer_company || null,
      },
      subscription_id: raw.subscription_id || null,
      subscription_number: raw.subscription_number || null,
      billing_period_start: raw.billing_period_start || null,
      billing_period_end: raw.billing_period_end || null,
      issue_date: raw.invoice_date || raw.issue_date || raw.created_at || new Date().toISOString(),
      invoice_date: raw.invoice_date || raw.issue_date || raw.created_at || new Date().toISOString(),
      due_date: raw.due_date || new Date().toISOString(),
      status: normalizedStatus,
      currency: raw.currency || 'INR',
      subtotal: typeof raw.subtotal === 'number' ? raw.subtotal.toFixed(2) : String(raw.subtotal || '0.00'),
      tax_amount: typeof raw.tax_total === 'number' ? raw.tax_total.toFixed(2) : String(raw.tax_amount || raw.tax_total || '0.00'),
      discount_amount: typeof raw.discount_total === 'number' ? raw.discount_total.toFixed(2) : String(raw.discount_amount || raw.discount_total || '0.00'),
      total_amount:
        typeof raw.total_amount === 'number'
          ? raw.total_amount.toFixed(2)
          : typeof raw.amount === 'number'
            ? raw.amount.toFixed(2)
            : String(raw.total_amount || raw.amount || '0.00'),
      amount_paid: typeof raw.amount_paid === 'number' ? raw.amount_paid.toFixed(2) : String(raw.amount_paid || '0.00'),
      amount_due: typeof raw.balance === 'number' ? raw.balance.toFixed(2) : String(raw.balance ?? raw.amount_due ?? '0.00'),
      balance: typeof raw.balance === 'number' ? raw.balance.toFixed(2) : String(raw.balance ?? raw.amount_due ?? '0.00'),
      lines: Array.isArray(raw.lines)
        ? raw.lines.map((l: any) => ({
            id: l.id || `invline-${Math.random().toString(36).slice(2, 7)}`,
            description: l.description || 'Line Item',
            quantity: typeof l.quantity === 'number' ? l.quantity : Number(l.quantity || 1),
            unit_price: typeof l.unit_price === 'number' ? l.unit_price.toFixed(2) : String(l.unit_price || '0.00'),
            tax_amount: typeof l.tax_amount === 'number' ? l.tax_amount.toFixed(2) : String(l.tax_amount || '0.00'),
            discount_amount: typeof l.discount_amount === 'number' ? l.discount_amount.toFixed(2) : String(l.discount_amount || '0.00'),
            line_total: typeof l.line_total === 'number' ? l.line_total.toFixed(2) : String(l.line_total || '0.00'),
          }))
        : [],
      notes: raw.notes || null,
      created_at: raw.created_at || new Date().toISOString(),
      updated_at: raw.updated_at || new Date().toISOString(),
    };
  }

  public async getQuotations(params?: { status?: string; search?: string; page?: number; page_size?: number }): Promise<QuotationListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) {
      const backendStatus = params.status === 'quotation' ? 'sent' : params.status;
      searchParams.append('status', backendStatus);
    }
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    const res = await this.request<QuotationListResponse>(`/quotations${qs ? `?${qs}` : ''}`);
    if (res && Array.isArray(res.items)) {
      return {
        ...res,
        items: res.items.map((item: any) => this.normalizeQuotation(item)),
      };
    }
    return res;
  }

  public async getQuotation(id: string): Promise<Quotation> {
    const raw = await this.request<any>(`/quotations/${id}`);
    return this.normalizeQuotation(raw);
  }

  public async createQuotation(payload: QuotationCreate): Promise<Quotation> {
    if (this.isMockMode()) {
      return this.handleMockFallback<Quotation>('/quotations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    // Build exact FastAPI QuotationCreate schema: lines contain plan and products
    const backendLines: any[] = [];
    if (payload.plan_id) {
      backendLines.push({
        line_type: 'plan',
        plan_id: payload.plan_id,
        quantity: 1,
        description: 'Selected Subscription Plan',
      });
    }

    if (Array.isArray(payload.lines)) {
      for (const line of payload.lines) {
        if (line.product_id) {
          backendLines.push({
            line_type: 'product',
            product_id: line.product_id,
            variant_id: line.variant_id || undefined,
            quantity: typeof line.quantity === 'number' ? line.quantity : 1,
            unit_price: line.unit_price ? Number(line.unit_price) : undefined,
            discount_percentage: line.discount_percentage || 0,
            tax_rate: line.tax_rate || 0,
            description: line.description || undefined,
          });
        } else if (line.plan_id && line.plan_id !== payload.plan_id) {
          backendLines.push({
            line_type: 'plan',
            plan_id: line.plan_id,
            quantity: line.quantity || 1,
            unit_price: line.unit_price ? Number(line.unit_price) : undefined,
            description: line.description || undefined,
          });
        }
      }
    }

    const backendPayload = {
      customer_id: payload.customer_id || undefined,
      currency: payload.currency || 'INR',
      valid_until: payload.valid_until || (payload.validity_days ? new Date(Date.now() + payload.validity_days * 86400000).toISOString().split('T')[0] : undefined),
      notes: payload.notes || undefined,
      lines: backendLines,
    };

    const raw = await this.request<any>('/quotations', {
      method: 'POST',
      body: JSON.stringify(backendPayload),
    });

    return this.normalizeQuotation(raw);
  }

  public async confirmQuotation(id: string): Promise<Quotation> {
    const raw = await this.request<any>(`/quotations/${id}/confirm`, {
      method: 'POST',
    });
    return this.normalizeQuotation(raw);
  }

  // --- Subscriptions Methods (API_CONTRACTS.md) ---

  public async getSubscriptions(params?: SubscriptionFilterParams): Promise<SubscriptionListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    const res = await this.request<SubscriptionListResponse>(`/subscriptions${qs ? `?${qs}` : ''}`);
    if (res && Array.isArray(res.items)) {
      return {
        ...res,
        items: res.items.map((item: any) => this.normalizeSubscription(item)),
      };
    }
    return res;
  }

  public async getSubscription(id: string): Promise<Subscription> {
    const raw = await this.request<any>(`/subscriptions/${id}`);
    return this.normalizeSubscription(raw);
  }

  public async pauseSubscription(id: string): Promise<Subscription> {
    const raw = await this.request<any>(`/subscriptions/${id}/pause`, {
      method: 'POST',
    });
    return this.normalizeSubscription(raw);
  }

  public async resumeSubscription(id: string): Promise<Subscription> {
    const raw = await this.request<any>(`/subscriptions/${id}/resume`, {
      method: 'POST',
    });
    return this.normalizeSubscription(raw);
  }

  public async renewSubscription(id: string): Promise<Subscription> {
    const raw = await this.request<any>(`/subscriptions/${id}/renew`, {
      method: 'POST',
    });
    return this.normalizeSubscription(raw);
  }

  public async closeSubscription(id: string): Promise<Subscription> {
    const raw = await this.request<any>(`/subscriptions/${id}/close`, {
      method: 'POST',
    });
    return this.normalizeSubscription(raw);
  }

  // --- Invoices Methods (API_CONTRACTS.md) ---

  public async getInvoices(params?: InvoiceFilterParams): Promise<InvoiceListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) {
      const backendStatus = params.status === 'posted' ? 'confirmed' : params.status;
      searchParams.append('status', backendStatus);
    }
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    const res = await this.request<InvoiceListResponse>(`/invoices${qs ? `?${qs}` : ''}`);
    if (res && Array.isArray(res.items)) {
      return {
        ...res,
        items: res.items.map((item: any) => this.normalizeInvoice(item)),
      };
    }
    return res;
  }

  public async getInvoice(id: string): Promise<Invoice> {
    const raw = await this.request<any>(`/invoices/${id}`);
    return this.normalizeInvoice(raw);
  }

  public async confirmInvoice(id: string): Promise<Invoice> {
    const raw = await this.request<any>(`/invoices/${id}/confirm`, {
      method: 'POST',
    });
    return this.normalizeInvoice(raw);
  }

  public async cancelInvoice(id: string): Promise<Invoice> {
    const raw = await this.request<any>(`/invoices/${id}/cancel`, {
      method: 'POST',
    });
    return this.normalizeInvoice(raw);
  }

  // --- Payments Methods (API_CONTRACTS.md, DOMAIN_MODULES.md) ---

  public normalizePayment(raw: any): Payment {
    if (!raw) return raw;
    const rawStatus = raw.payment_status || raw.status || 'completed';
    const rawMethod = raw.payment_method || 'manual';
    const normalizedMethod = rawMethod;

    return {
      id: raw.id,
      payment_number: raw.payment_number || `PAY-${raw.id?.slice(0, 8)}`,
      invoice_id: raw.invoice_id || '',
      invoice_number:
        raw.invoice_number ||
        raw.invoice?.invoice_number ||
        (raw.invoice_id ? `INV-${String(raw.invoice_id).slice(0, 8)}` : 'INV-UNKNOWN'),
      customer_id: raw.customer_id || null,
      customer: raw.customer || {
        id: raw.customer_id || null,
        name: raw.customer_name || 'Customer ' + (raw.customer_id ? String(raw.customer_id).slice(0, 8) : 'Client'),
        email: raw.customer_email || 'client@brightloop.io',
        company: raw.customer_company || null,
      },
      amount:
        typeof raw.amount === 'number'
          ? raw.amount.toFixed(2)
          : String(raw.amount || '0.00'),
      currency: raw.currency || 'INR',
      payment_date: raw.payment_date || raw.created_at || new Date().toISOString(),
      payment_method: normalizedMethod,
      status: rawStatus as PaymentStatus,
      payment_status: rawStatus as PaymentStatus,
      transaction_reference: raw.transaction_reference || null,
      reference_note: raw.reference_note || raw.notes || raw.transaction_reference || null,
      notes: raw.notes || null,
      idempotency_key: raw.idempotency_key || null,
      recorded_by: raw.recorded_by || null,
      created_at: raw.created_at || new Date().toISOString(),
      updated_at: raw.updated_at || new Date().toISOString(),
    };
  }

  public async getPayments(params?: PaymentFilterParams): Promise<PaymentListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.customer_id) searchParams.append('customer_id', params.customer_id);
    if (params?.invoice_id) searchParams.append('invoice_id', params.invoice_id);
    if (params?.status && params.status !== 'all') searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    const res = await this.request<PaymentListResponse>(`/payments${qs ? `?${qs}` : ''}`);
    if (res && Array.isArray(res.items)) {
      return {
        ...res,
        items: res.items.map((item: any) => this.normalizePayment(item)),
      };
    }
    return res;
  }

  public async getPayment(id: string): Promise<Payment> {
    const raw = await this.request<any>(`/payments/${id}`);
    return this.normalizePayment(raw);
  }

  public async createPayment(payload: PaymentCreate): Promise<Payment> {
    if (this.isMockMode()) {
      return this.handleMockFallback<Payment>('/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    const amountNum = typeof payload.amount === 'number' ? payload.amount : parseFloat(String(payload.amount));
    const backendPayload = {
      invoice_id: payload.invoice_id,
      amount: Number(amountNum.toFixed(2)),
      currency: (payload.currency || 'INR').toUpperCase(),
      payment_method:
        payload.payment_method === 'credit_card'
          ? 'card'
          : payload.payment_method === 'ach'
            ? 'bank_transfer'
            : payload.payment_method || 'manual',
      transaction_reference: payload.transaction_reference || undefined,
      idempotency_key: payload.idempotency_key || undefined,
      payment_date: payload.payment_date || undefined,
      notes: payload.notes || undefined,
    };

    const raw = await this.request<any>('/payments', {
      method: 'POST',
      body: JSON.stringify(backendPayload),
    });

    return this.normalizePayment(raw);
  }

  // --- Customer Portal Methods (API_CONTRACTS.md, DOMAIN_MODULES.md) ---

  public async getPortalProfile(): Promise<CustomerProfile> {
    return this.request<CustomerProfile>('/portal/profile');
  }

  public async updatePortalProfile(data: CustomerProfileUpdate): Promise<CustomerProfile> {
    return this.request<CustomerProfile>('/portal/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  public async getPortalDashboard(): Promise<CustomerDashboardSummary> {
    return this.request<CustomerDashboardSummary>('/portal/dashboard');
  }

  public async getPortalSubscriptions(): Promise<SubscriptionListResponse> {
    return this.request<SubscriptionListResponse>('/portal/subscriptions');
  }

  public async getPortalInvoices(): Promise<InvoiceListResponse> {
    return this.request<InvoiceListResponse>('/portal/invoices');
  }

  public async getPortalPayments(): Promise<PaymentListResponse> {
    const res = await this.request<PaymentListResponse>(this.isMockMode() ? '/portal/payments' : '/payments');
    if (res && Array.isArray(res.items)) {
      return {
        ...res,
        items: res.items.map((item: any) => this.normalizePayment(item)),
      };
    }
    return res;
  }
}

export const apiClient = new ApiClient();

