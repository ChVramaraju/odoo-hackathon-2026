import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from './client';

describe('ApiClient & Integration Foundation', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    apiClient.setToken(null);
    apiClient.setMockMode(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    apiClient.setToken(null);
    apiClient.setMockMode(null);
    vi.restoreAllMocks();
  });

  it('manages authorization token and attaches Bearer header', async () => {
    apiClient.setMockMode(false);
    apiClient.setToken('supabase-live-jwt-token-123');

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      }),
    });
    globalThis.fetch = fetchSpy;

    await apiClient.getProducts();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
    expect(calledUrl).toContain('/products');
    expect(calledOptions.headers).toMatchObject({
      Authorization: 'Bearer supabase-live-jwt-token-123',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
  });

  it('parses successful product list response from real backend format', async () => {
    apiClient.setMockMode(false);

    const mockBackendResponse = {
      items: [
        {
          id: 'b8c8d8a0-1234-4567-8901-abcdefabcdef',
          name: 'Live Postgres Product',
          type: 'service',
          sales_price: '199.99',
          cost_price: '50.00',
          currency: 'USD',
          description: 'Loaded directly from FastAPI',
          notes: 'Admin note',
          is_active: true,
          created_at: '2026-10-31T10:00:00Z',
          updated_at: '2026-10-31T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBackendResponse,
    });

    const result = await apiClient.getProducts({ page: 1, page_size: 20 });
    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe('Live Postgres Product');
    expect(result.items[0].sales_price).toBe('199.99');
  });

  it('throws ApiError with UNAUTHORIZED on 401 response without falling back to mock data', async () => {
    apiClient.setMockMode(false);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authentication credentials.',
        },
      }),
    });

    await expect(apiClient.getProducts()).rejects.toThrow(ApiError);
    await expect(apiClient.getProducts()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
      message: 'Missing or invalid authentication credentials.',
    });
  });

  it('throws ApiError with PERMISSION_DENIED on 403 response when role is insufficient', async () => {
    apiClient.setMockMode(false);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to perform this action.',
          details: ['Required role in: [admin], caller role: customer'],
        },
      }),
    });

    await expect(
      apiClient.createProduct({
        name: 'Unauthorized Create',
        sales_price: '10.00',
      })
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
      status: 403,
      message: 'You do not have permission to perform this action.',
    });
  });

  it('throws ApiError with VALIDATION_ERROR on 422 response with details', async () => {
    apiClient.setMockMode(false);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters.',
          details: [{ field: 'sales_price', issue: 'Must be greater than or equal to 0.00' }],
        },
      }),
    });

    await expect(
      apiClient.createProduct({
        name: 'Invalid Price Product',
        sales_price: '-50.00',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  it('CRITICAL: never silently returns mock records when a live request fails with network error', async () => {
    apiClient.setMockMode(false);

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    // Must throw NETWORK_ERROR instead of returning mockProducts
    await expect(apiClient.getProducts()).rejects.toThrow(ApiError);
    await expect(apiClient.getProducts()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 503,
    });
  });

  it('targets the real POST /quotations/{id}/confirm endpoint when in live mode', async () => {
    apiClient.setMockMode(false);

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'quote-123',
        quotation_number: 'QUO-2026-001',
        status: 'confirmed',
        subscription_id: 'SUB-LIVE-456',
        total_amount: '149.00',
        currency: 'USD',
        lines: [],
        customer: { name: 'Acme' },
        plan_name: 'Pro',
        billing_frequency: 'monthly',
        validity_days: 30,
        expiry_date: '2026-11-30',
        created_at: '2026-10-31T10:00:00Z',
      }),
    });
    globalThis.fetch = fetchSpy;

    const result = await apiClient.confirmQuotation('quote-123');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain('/quotations/quote-123/confirm');
    expect(result.status).toBe('confirmed');
    expect(result.subscription_id).toBe('SUB-LIVE-456');
  });

  it('serves in-memory mock data when mock mode is explicitly activated', async () => {
    apiClient.setMockMode(true);

    const products = await apiClient.getProducts();
    expect(products.items.length).toBeGreaterThan(0);
    expect(products.total).toBeGreaterThan(0);

    const plans = await apiClient.getPlans();
    expect(plans.items.length).toBeGreaterThan(0);
  });
});

