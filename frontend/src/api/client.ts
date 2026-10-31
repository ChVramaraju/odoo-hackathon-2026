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
  PaymentFilterParams,
  PaymentListResponse,
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
          const price = parseFloat(l.unit_price || product?.sales_price || '0.00');
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

  // --- Quotations Methods (API_CONTRACTS.md) ---

  public async getQuotations(params?: { status?: string; search?: string; page?: number; page_size?: number }): Promise<QuotationListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return this.request<QuotationListResponse>(`/quotations${qs ? `?${qs}` : ''}`);
  }

  public async getQuotation(id: string): Promise<Quotation> {
    return this.request<Quotation>(`/quotations/${id}`);
  }

  public async createQuotation(payload: QuotationCreate): Promise<Quotation> {
    return this.request<Quotation>('/quotations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async confirmQuotation(id: string): Promise<Quotation> {
    return this.request<Quotation>(`/quotations/${id}/confirm`, {
      method: 'POST',
    });
  }

  // --- Subscriptions Methods (API_CONTRACTS.md) ---

  public async getSubscriptions(params?: SubscriptionFilterParams): Promise<SubscriptionListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return this.request<SubscriptionListResponse>(`/subscriptions${qs ? `?${qs}` : ''}`);
  }

  public async getSubscription(id: string): Promise<Subscription> {
    return this.request<Subscription>(`/subscriptions/${id}`);
  }

  public async pauseSubscription(id: string): Promise<Subscription> {
    return this.request<Subscription>(`/subscriptions/${id}/pause`, {
      method: 'POST',
    });
  }

  public async resumeSubscription(id: string): Promise<Subscription> {
    return this.request<Subscription>(`/subscriptions/${id}/resume`, {
      method: 'POST',
    });
  }

  public async renewSubscription(id: string): Promise<Subscription> {
    return this.request<Subscription>(`/subscriptions/${id}/renew`, {
      method: 'POST',
    });
  }

  public async closeSubscription(id: string): Promise<Subscription> {
    return this.request<Subscription>(`/subscriptions/${id}/close`, {
      method: 'POST',
    });
  }

  // --- Invoices Methods (API_CONTRACTS.md) ---

  public async getInvoices(params?: InvoiceFilterParams): Promise<InvoiceListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return this.request<InvoiceListResponse>(`/invoices${qs ? `?${qs}` : ''}`);
  }

  public async getInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}`);
  }

  public async confirmInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/confirm`, {
      method: 'POST',
    });
  }

  public async cancelInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/cancel`, {
      method: 'POST',
    });
  }

  // --- Payments Methods (API_CONTRACTS.md, DOMAIN_MODULES.md) ---

  public async getPayments(params?: PaymentFilterParams): Promise<PaymentListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return this.request<PaymentListResponse>(`/payments${qs ? `?${qs}` : ''}`);
  }

  public async getPayment(id: string): Promise<Payment> {
    return this.request<Payment>(`/payments/${id}`);
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
    return this.request<PaymentListResponse>('/portal/payments');
  }
}

export const apiClient = new ApiClient();

