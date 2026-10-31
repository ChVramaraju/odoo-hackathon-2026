import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from './client';

describe('ApiClient & Integration Foundation', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    apiClient.setToken(null);
    apiClient.setMockMode(null);
    apiClient.resetMockData();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    apiClient.setToken(null);
    apiClient.setMockMode(null);
    apiClient.resetMockData();
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

  describe('Contract Normalization & Backend Reconciliations', () => {
    it('strips preview-mode-* tokens so simulation credentials are never sent to live backends', async () => {
      apiClient.setMockMode(false);
      apiClient.setToken('preview-mode-admin-token');

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 0, page: 1, page_size: 20 }),
      });
      globalThis.fetch = fetchSpy;

      await apiClient.getProducts();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, calledOptions] = fetchSpy.mock.calls[0];
      expect(calledOptions.headers).not.toHaveProperty('Authorization');
    });

    it('normalizes QuotationResponse mapping sent status to quotation and extracts plan_id', () => {
      const backendQuotation = {
        id: 'quo-backend-001',
        quotation_number: 'QUO-2026-999',
        customer_id: 'cust-uuid-1',
        customer_name: 'Alpha Corp',
        customer_email: 'alpha@corp.com',
        status: 'sent',
        currency: 'INR',
        subtotal: 1000.0,
        tax_total: 180.0,
        total_amount: 1180.0,
        valid_until: '2026-11-30T00:00:00Z',
        created_at: '2026-10-31T09:00:00Z',
        updated_at: '2026-10-31T09:00:00Z',
        lines: [
          {
            id: 'line-1',
            line_type: 'plan',
            plan_id: 'plan-pro-uuid',
            quantity: 1,
            unit_price: 1000.0,
            subtotal: 1000.0,
            description: 'Selected Subscription Plan',
          },
        ],
      };

      const normalized = apiClient.normalizeQuotation(backendQuotation);

      expect(normalized.id).toBe('quo-backend-001');
      expect(normalized.status).toBe('quotation'); // 'sent' mapped to frontend 'quotation'
      expect(normalized.plan_id).toBe('plan-pro-uuid');
      expect(normalized.subtotal).toBe('1000.00');
      expect(normalized.tax_amount).toBe('180.00');
      expect(normalized.total_amount).toBe('1180.00');
      expect(normalized.valid_until).toBe('2026-11-30T00:00:00Z');
      expect(normalized.customer.name).toBe('Alpha Corp');
    });

    it('transforms createQuotation payload into FastAPI XOR plan line format', async () => {
      apiClient.setMockMode(false);

      let capturedPayload: any = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: 'quo-new-001',
            quotation_number: 'QUO-2026-002',
            status: 'draft',
            total_amount: 2500.0,
            lines: capturedPayload.lines,
          }),
        };
      });

      await apiClient.createQuotation({
        customer_id: 'cust-uuid-42',
        plan_id: 'plan-enterprise-id',
        lines: [
          {
            product_id: 'prod-addon-id',
            quantity: 2,
            unit_price: '500.00',
            description: 'Add-on module',
          },
        ],
      });

      expect(capturedPayload).toBeTruthy();
      expect(capturedPayload.customer_id).toBe('cust-uuid-42');
      // The plan_id is packed into lines to satisfy FastAPI's XOR requirement:
      expect(capturedPayload.lines).toHaveLength(2);
      expect(capturedPayload.lines[0]).toEqual({
        line_type: 'plan',
        plan_id: 'plan-enterprise-id',
        quantity: 1,
        description: 'Selected Subscription Plan',
      });
      expect(capturedPayload.lines[1]).toMatchObject({
        line_type: 'product',
        product_id: 'prod-addon-id',
        quantity: 2,
      });
    });

    it('normalizes backend Invoice mapping confirmed to posted and balance to amount_due', () => {
      const backendInvoice = {
        id: 'inv-fastapi-01',
        invoice_number: 'INV-2026-001',
        subscription_id: 'sub-live-1',
        status: 'confirmed',
        currency: 'INR',
        subtotal: 5000.0,
        tax_total: 900.0,
        total_amount: 5900.0,
        amount_paid: 0.0,
        balance: '5900.00',
        invoice_date: '2026-10-31T08:00:00Z',
        due_date: '2026-11-15T00:00:00Z',
        customer: {
          id: 'cust-1',
          name: 'Acme Global',
          email: 'finance@acme.com',
        },
      };

      const normalized = apiClient.normalizeInvoice(backendInvoice);

      expect(normalized.id).toBe('inv-fastapi-01');
      expect(normalized.status).toBe('posted'); // 'confirmed' mapped to 'posted'
      expect(normalized.amount_due).toBe('5900.00'); // 'balance' mapped to 'amount_due'
      expect(normalized.issue_date).toBe('2026-10-31T08:00:00Z'); // 'invoice_date' mapped to 'issue_date'
      expect(normalized.total_amount).toBe('5900.00');
    });

    it('normalizes backend SubscriptionResponse preserving lifecycle status and dates', () => {
      const backendSubscription = {
        id: 'sub-backend-001',
        subscription_number: 'SUB-2026-001',
        customer_id: 'cust-uuid-1',
        plan_id: 'plan-uuid-1',
        status: 'active',
        billing_frequency: 'monthly',
        current_period_start: '2026-10-01T00:00:00Z',
        current_period_end: '2026-11-01T00:00:00Z',
        next_billing_date: '2026-11-01T00:00:00Z',
        currency: 'INR',
        amount: 2499.0,
        customer: {
          name: 'TechCorp',
          email: 'ops@techcorp.com',
        },
        plan: {
          name: 'Enterprise Plan',
          code: 'ENT-MONTHLY',
        },
      };

      const normalized = apiClient.normalizeSubscription(backendSubscription);

      expect(normalized.id).toBe('sub-backend-001');
      expect(normalized.status).toBe('active');
      expect(normalized.plan_name).toBe('Enterprise Plan');
      expect(normalized.billing_frequency).toBe('monthly');
      expect(normalized.total_amount).toBe('2499.00');
      expect(normalized.next_billing_date).toBe('2026-11-01T00:00:00Z');
    });

    it('normalizes backend PaymentResponse mapping payment_status to status and formatting amounts', () => {
      const backendPayment = {
        id: 'pay-uuid-777',
        payment_number: 'PAY-202610-00123',
        invoice_id: 'inv-uuid-888',
        customer_id: 'cust-uuid-999',
        amount: 1499.5,
        currency: 'INR',
        payment_method: 'upi',
        payment_status: 'completed',
        payment_date: '2026-10-31T12:00:00Z',
        transaction_reference: 'UPI-REF-992384',
        idempotency_key: 'idem-key-abc-123',
        notes: 'Monthly subscription settlement via UPI',
        created_at: '2026-10-31T12:00:00Z',
        updated_at: '2026-10-31T12:00:00Z',
      };

      const normalized = apiClient.normalizePayment(backendPayment);

      expect(normalized.id).toBe('pay-uuid-777');
      expect(normalized.payment_number).toBe('PAY-202610-00123');
      expect(normalized.status).toBe('completed');
      expect(normalized.amount).toBe('1499.50');
      expect(normalized.currency).toBe('INR');
      expect(normalized.payment_method).toBe('upi');
      expect(normalized.transaction_reference).toBe('UPI-REF-992384');
      expect(normalized.idempotency_key).toBe('idem-key-abc-123');
    });

    it('constructs live POST /payments request with sanitized backend payload without sensitive card details', async () => {
      apiClient.setMockMode(false);
      apiClient.setToken('supabase-live-jwt-token');

      let capturedBody: any = null;
      let capturedHeaders: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body);
        capturedHeaders = options.headers;
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: 'pay-live-01',
            payment_number: 'PAY-202610-99999',
            invoice_id: capturedBody.invoice_id,
            customer_id: 'cust-123',
            amount: capturedBody.amount,
            currency: capturedBody.currency,
            payment_method: capturedBody.payment_method,
            payment_status: 'completed',
            payment_date: '2026-10-31T14:00:00Z',
            transaction_reference: capturedBody.transaction_reference,
            idempotency_key: capturedBody.idempotency_key,
            created_at: '2026-10-31T14:00:00Z',
            updated_at: '2026-10-31T14:00:00Z',
          }),
        };
      });

      const res = await apiClient.createPayment({
        invoice_id: 'inv-uuid-101',
        amount: '250.00',
        currency: 'INR',
        payment_method: 'card',
        transaction_reference: 'TXN-SETTLE-888',
        idempotency_key: 'idem-client-attempt-1',
        notes: 'Card settlement memo',
      });

      expect(capturedHeaders.Authorization).toBe('Bearer supabase-live-jwt-token');
      expect(capturedBody).toEqual({
        invoice_id: 'inv-uuid-101',
        amount: 250,
        currency: 'INR',
        payment_method: 'card',
        transaction_reference: 'TXN-SETTLE-888',
        idempotency_key: 'idem-client-attempt-1',
        notes: 'Card settlement memo',
      });
      // Zero card credentials, CVVs or sensitive tokens sent
      expect(capturedBody).not.toHaveProperty('card_number');
      expect(capturedBody).not.toHaveProperty('cvv');
      expect(capturedBody).not.toHaveProperty('expiry');
      expect(res.payment_number).toBe('PAY-202610-99999');
      expect(res.status).toBe('completed');
    });

    it('handles successful partial payment in mock mode updating invoice balance', async () => {
      apiClient.setMockMode(true);

      const targetInvoice = (await apiClient.getInvoices()).items.find(
        (i) => i.status === 'posted' && parseFloat(i.amount_due) > 50
      );
      expect(targetInvoice).toBeTruthy();
      const initialBalance = parseFloat(targetInvoice!.amount_due);

      const payment = await apiClient.createPayment({
        invoice_id: targetInvoice!.id,
        amount: '50.00',
        currency: targetInvoice!.currency,
        payment_method: 'upi',
        idempotency_key: `idem-partial-${Date.now()}`,
      });

      expect(payment.status).toBe('completed');
      expect(payment.amount).toBe('50.00');

      const updatedInvoice = await apiClient.getInvoice(targetInvoice!.id);
      expect(parseFloat(updatedInvoice.amount_due)).toBeCloseTo(initialBalance - 50.0, 2);
    });

    it('handles full invoice settlement transitioning invoice status to paid and balance to 0.00', async () => {
      apiClient.setMockMode(true);

      const targetInvoice = (await apiClient.getInvoices()).items.find(
        (i) => i.status === 'posted' && parseFloat(i.amount_due) > 0
      );
      expect(targetInvoice).toBeTruthy();
      const fullBalance = targetInvoice!.amount_due;

      const payment = await apiClient.createPayment({
        invoice_id: targetInvoice!.id,
        amount: fullBalance,
        currency: targetInvoice!.currency,
        payment_method: 'bank_transfer',
        idempotency_key: `idem-full-${Date.now()}`,
      });

      expect(payment.status).toBe('completed');

      const updatedInvoice = await apiClient.getInvoice(targetInvoice!.id);
      expect(updatedInvoice.status).toBe('paid');
      expect(parseFloat(updatedInvoice.amount_due)).toBe(0);
    });

    it('rejects overpayment exceeding invoice balance with OVERPAYMENT_NOT_ALLOWED (400)', async () => {
      apiClient.setMockMode(true);

      const targetInvoice = (await apiClient.getInvoices()).items.find(
        (i) => i.status === 'posted' && parseFloat(i.amount_due) > 0
      )!;
      const excessiveAmount = (parseFloat(targetInvoice.amount_due) + 10000).toFixed(2);

      await expect(
        apiClient.createPayment({
          invoice_id: targetInvoice.id,
          amount: excessiveAmount,
          currency: targetInvoice.currency,
          payment_method: 'manual',
        })
      ).rejects.toMatchObject({
        code: 'OVERPAYMENT_NOT_ALLOWED',
        status: 400,
      });
    });

    it('rejects currency mismatch between payment and invoice with CURRENCY_MISMATCH (400)', async () => {
      apiClient.setMockMode(true);

      const targetInvoice = (await apiClient.getInvoices()).items.find(
        (i) => i.status === 'posted' && parseFloat(i.amount_due) > 0
      )!;
      const mismatchCurrency = targetInvoice.currency === 'USD' ? 'EUR' : 'USD';

      await expect(
        apiClient.createPayment({
          invoice_id: targetInvoice.id,
          amount: '10.00',
          currency: mismatchCurrency,
          payment_method: 'manual',
        })
      ).rejects.toMatchObject({
        code: 'CURRENCY_MISMATCH',
        status: 400,
      });
    });

    it('implements idempotent retry returning identical payment on matching idempotency_key', async () => {
      apiClient.setMockMode(true);

      const targetInvoice = (await apiClient.getInvoices()).items.find(
        (i) => i.status === 'posted' && parseFloat(i.amount_due) >= 20
      )!;
      const idempotencyKey = `idem-retry-test-${Date.now()}`;

      // First attempt
      const firstPayment = await apiClient.createPayment({
        invoice_id: targetInvoice.id,
        amount: '10.00',
        currency: targetInvoice.currency,
        payment_method: 'card',
        idempotency_key: idempotencyKey,
      });

      // Second attempt with exact same key and parameters
      const retryPayment = await apiClient.createPayment({
        invoice_id: targetInvoice.id,
        amount: '10.00',
        currency: targetInvoice.currency,
        payment_method: 'card',
        idempotency_key: idempotencyKey,
      });

      expect(retryPayment.id).toBe(firstPayment.id);
      expect(retryPayment.payment_number).toBe(firstPayment.payment_number);
      expect(retryPayment.amount).toBe(firstPayment.amount);
    });

    it('rejects conflicting parameters using existing idempotency_key with CONFLICT (409)', async () => {
      apiClient.setMockMode(true);

      const targetInvoice = (await apiClient.getInvoices()).items.find(
        (i) => i.status === 'posted' && parseFloat(i.amount_due) >= 50
      )!;
      const sharedKey = `idem-conflict-test-${Date.now()}`;

      // First attempt with 10.00
      await apiClient.createPayment({
        invoice_id: targetInvoice.id,
        amount: '10.00',
        currency: targetInvoice.currency,
        payment_method: 'card',
        idempotency_key: sharedKey,
      });

      // Second attempt with DIFFERENT amount (25.00) using the SAME idempotency key
      await expect(
        apiClient.createPayment({
          invoice_id: targetInvoice.id,
          amount: '25.00',
          currency: targetInvoice.currency,
          payment_method: 'card',
          idempotency_key: sharedKey,
        })
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        status: 409,
      });
    });

    it('throws NETWORK_ERROR on live timeout without silently falling back to mock payment', async () => {
      apiClient.setMockMode(false);

      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network request failed'));

      await expect(
        apiClient.createPayment({
          invoice_id: 'inv-live-123',
          amount: '100.00',
          currency: 'INR',
          idempotency_key: 'idem-live-timeout-key',
        })
      ).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        status: 503,
      });
    });

    it('throws ApiError with UNAUTHORIZED on 401 response from payments endpoint', async () => {
      apiClient.setMockMode(false);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication credentials were not provided or have expired.',
          },
        }),
      });

      await expect(
        apiClient.createPayment({
          invoice_id: 'inv-401',
          amount: '50.00',
        })
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        status: 401,
      });
    });

    it('throws ApiError with PERMISSION_DENIED on 403 response when non-owner attempts payment access', async () => {
      apiClient.setMockMode(false);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Customer cannot record payments against another tenant invoice.',
          },
        }),
      });

      await expect(
        apiClient.createPayment({
          invoice_id: 'inv-other-tenant',
          amount: '50.00',
        })
      ).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
        status: 403,
      });
    });
  });
});

