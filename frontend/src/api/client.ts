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
import { mockPlans, mockProducts, mockVariants } from './mocks';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private inMemoryProducts: Product[] = [...mockProducts];
  private inMemoryVariants: Record<string, ProductVariant[]> = { ...mockVariants };
  private inMemoryPlans: Plan[] = [...mockPlans];

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
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = { ...this.getHeaders(), ...(options.headers as Record<string, string>) };

    // Explicit mock-mode shortcut (env flag set or offline development)
    if (import.meta.env.VITE_USE_MOCKS === 'true') {
      return this.handleMockFallback<T>(endpoint, options);
    }

    let responseStatus: number | null = null;

    try {
      const response = await fetch(url, { ...options, headers });
      responseStatus = response.status;

      if (!response.ok) {
        // 502 / 503 / 504 mean the Vite dev-proxy cannot reach the backend.
        // Treat these exactly like a network failure and fall through to mocks.
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          return this.handleMockFallback<T>(endpoint, options);
        }

        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = {
            error: {
              code: 'HTTP_ERROR',
              message: `Request failed with status ${response.status}`,
            },
          };
        }
        throw errorData;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      // TypeError = network failure (fetch could not connect at all).
      // Also fall back when the error carries status 502/503/504 set above.
      const isNetworkError =
        err instanceof TypeError ||
        (err as Error)?.name === 'AbortError' ||
        (err as Error)?.message?.toLowerCase().includes('failed to fetch') ||
        responseStatus === 502 ||
        responseStatus === 503 ||
        responseStatus === 504;

      if (isNetworkError) {
        return this.handleMockFallback<T>(endpoint, options);
      }
      throw err;
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

    throw new Error(`Unhandled mock endpoint: ${method} ${endpoint}`);
  }

  // --- High-level Typed Methods ---

  public async getHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>('/health');
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
}

export const apiClient = new ApiClient();

