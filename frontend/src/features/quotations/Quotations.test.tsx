import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../context/AuthContext';
import { QuotationsPage } from './QuotationsPage';
import { apiClient } from '../../api/client';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          {ui}
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('QuotationsPage', () => {
  it('renders page header and new quotation action button', async () => {
    renderWithProviders(<QuotationsPage />);

    expect(screen.getByRole('heading', { name: /Customer Quotations/i })).toBeInTheDocument();
    expect(screen.getByText(/Assemble multi-line quotes with catalog products/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Quotation/i })).toBeInTheDocument();
  });

  it('displays summary metrics cards and fallback notice', async () => {
    renderWithProviders(<QuotationsPage />);

    // Check KPI titles with updated non-misleading labels
    expect(screen.getByText(/Total Quotations/i)).toBeInTheDocument();
    expect(screen.getByText(/Open Quotations/i)).toBeInTheDocument();
    expect(screen.getByText(/Promoted \/ Confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Drafts & Expired/i)).toBeInTheDocument();

    // Check mock mode notification
    expect(screen.getByText(/Contract Ready \/ Mock Mode:/i)).toBeInTheDocument();
    expect(screen.getByText(/simulated prototype data/i)).toBeInTheDocument();
  });

  it('renders table with quotations from mock data with USD currency', async () => {
    renderWithProviders(<QuotationsPage />);

    // Should render quotes QT-2026-001, QT-2026-002, etc.
    await waitFor(() => {
      expect(screen.getByText('QT-2026-001')).toBeInTheDocument();
      expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
      expect(screen.getByText('Acme Cloud Corp')).toBeInTheDocument();
    });

    expect(screen.getByText('QT-2026-002')).toBeInTheDocument();
    expect(screen.getByText('Marcus Brody')).toBeInTheDocument();

    // Verify USD column header
    expect(screen.getByText(/Projected Total \(USD\)/i)).toBeInTheDocument();
  });

  it('filters quotations based on search input', async () => {
    renderWithProviders(<QuotationsPage />);

    await waitFor(() => {
      expect(screen.getByText('QT-2026-001')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by quote #, client, or plan/i);
    fireEvent.change(searchInput, { target: { value: 'Marcus' } });

    await waitFor(() => {
      expect(screen.queryByText('Sarah Chen')).not.toBeInTheDocument();
      expect(screen.getByText('Marcus Brody')).toBeInTheDocument();
    });
  });

  it('filters quotations based on status filter buttons', async () => {
    renderWithProviders(<QuotationsPage />);

    await waitFor(() => {
      expect(screen.getByText('QT-2026-001')).toBeInTheDocument();
    });

    // Click 'confirmed' filter button
    const confirmedBtn = screen.getByRole('button', { name: /^confirmed$/i });
    fireEvent.click(confirmedBtn);

    await waitFor(() => {
      expect(screen.getByText('QT-2026-002')).toBeInTheDocument(); // Marcus Brody is confirmed
      expect(screen.queryByText('QT-2026-001')).not.toBeInTheDocument(); // Sarah Chen is active quotation
    });
  });

  it('opens and closes the Create Quotation modal with simulation indicator', async () => {
    renderWithProviders(<QuotationsPage />);

    const newBtn = screen.getByRole('button', { name: /New Quotation/i });
    fireEvent.click(newBtn);

    expect(screen.getByRole('heading', { name: /Create Customer Quotation/i })).toBeInTheDocument();
    expect(screen.getByText(/1\. Unregistered Contact Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulated Client-Side Action/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Create Customer Quotation/i })).not.toBeInTheDocument();
    });
  });

  it('validates form and prevents invalid quotation submission', async () => {
    renderWithProviders(<QuotationsPage />);

    const newBtn = screen.getByRole('button', { name: /New Quotation/i });
    fireEvent.click(newBtn);

    // Click submit immediately without filling required inputs
    const submitBtn = screen.getByRole('button', { name: /Create Quotation \(Simulated\)/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Customer name must be at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/Please select a base subscription plan/i)).toBeInTheDocument();
    });
  });

  it('displays illustrative 10% demo tax calculation and USD label in create modal', async () => {
    renderWithProviders(<QuotationsPage />);

    const newBtn = screen.getByRole('button', { name: /New Quotation/i });
    fireEvent.click(newBtn);

    expect(screen.getByText(/Illustrative Client Estimate:/i)).toBeInTheDocument();
    expect(screen.getByText(/Est\. Tax \(10% Illustrative Demo Rate\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Projected Amount \(Illustrative Estimate\):/i)).toBeInTheDocument();
  });

  it('opens detail modal and displays unregistered lead label and simulated confirm button for open quotes', async () => {
    renderWithProviders(<QuotationsPage />);

    await waitFor(() => {
      expect(screen.getByText('QT-2026-001')).toBeInTheDocument();
    });

    // QT-2026-001 is in 'quotation' status
    fireEvent.click(screen.getByLabelText('View QT-2026-001'));

    await waitFor(() => {
      expect(screen.getByText(/Customer Contact \(Unregistered Lead\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Estimated Tax \(10% Demo Rate\):/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Projected Amount:/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirm to Subscription \(Simulated\)/i })).toBeInTheDocument();
    });
  });

  it('strictly restricts confirmation button from appearing on draft or expired quotations', async () => {
    renderWithProviders(<QuotationsPage />);

    // Click 'draft' filter button
    const draftBtn = screen.getByRole('button', { name: /^draft$/i });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(screen.getByText('QT-2026-003')).toBeInTheDocument();
    });

    // Click draft quote view button
    fireEvent.click(screen.getByLabelText('View QT-2026-003'));

    await waitFor(() => {
      expect(screen.getByText(/Customer Contact \(Unregistered Lead\)/i)).toBeInTheDocument();
      // Confirm to Subscription MUST NOT be visible for draft quotes
      expect(screen.queryByRole('button', { name: /Confirm to Subscription/i })).not.toBeInTheDocument();
    });
  });

  it('displays simulated promotion reference with DEMO-SUB- prefix on confirmed quotations', async () => {
    renderWithProviders(<QuotationsPage />);

    // Click 'confirmed' filter button
    const confirmedBtn = screen.getByRole('button', { name: /^confirmed$/i });
    fireEvent.click(confirmedBtn);

    await waitFor(() => {
      expect(screen.getByText('QT-2026-002')).toBeInTheDocument();
    });

    // Click confirmed quote view button
    fireEvent.click(screen.getByLabelText('View QT-2026-002'));

    await waitFor(() => {
      expect(screen.getByText(/Simulated Promotion Reference:/i)).toBeInTheDocument();
      expect(screen.getByText('DEMO-SUB-2026-0042')).toBeInTheDocument();
      expect(screen.getAllByText(/Simulated Promotion/i).length).toBeGreaterThanOrEqual(2);
      // Already confirmed quote cannot be confirmed again
      expect(screen.queryByRole('button', { name: /Confirm to Subscription/i })).not.toBeInTheDocument();
    });
  });

  it('populates recurring plan dropdown with available plans and formatted intervals', async () => {
    renderWithProviders(<QuotationsPage />);

    const newBtn = screen.getByRole('button', { name: /New Quotation/i });
    fireEvent.click(newBtn);

    // Verify the recurring plan select is populated with formatted plan options
    await waitFor(() => {
      expect(screen.getByText(/Growth Monthly FinOps \(BL-GROWTH-M\) — \$299\.00 USD \/ monthly/i)).toBeInTheDocument();
      expect(screen.getByText(/Scale Annual Platinum \(BL-SCALE-Y\) — \$2990\.00 USD \/ yearly/i)).toBeInTheDocument();
      expect(screen.getByText(/Usage Starter Weekly \(BL-START-W\) — \$79\.00 USD \/ weekly/i)).toBeInTheDocument();
    });

    // Selecting a plan updates the estimated subtotal and total
    const selectElement = screen.getByText(/-- Choose a recurring plan --/i).closest('select')!;
    fireEvent.change(selectElement, { target: { value: 'plan-001' } });
    expect(selectElement.value).toBe('plan-001');

    await waitFor(() => {
      expect(screen.getByText('$299.00 USD')).toBeInTheDocument();
      expect(screen.getByText('$328.90 USD')).toBeInTheDocument();
    });
  });

  it('closes the modal when clicking outside on backdrop or pressing Escape, and does NOT close when clicking inside', async () => {
    renderWithProviders(<QuotationsPage />);

    const newBtn = screen.getByRole('button', { name: /New Quotation/i });
    fireEvent.click(newBtn);

    const modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toBeInTheDocument();

    // Clicking inside the modal content must NOT close it
    fireEvent.click(modalContent);
    expect(screen.getByRole('heading', { name: /Create Customer Quotation/i })).toBeInTheDocument();

    // Pressing Escape key closes the modal
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Create Customer Quotation/i })).not.toBeInTheDocument();
    });

    // Re-open and verify clicking backdrop closes the modal
    fireEvent.click(newBtn);
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Create Customer Quotation/i })).not.toBeInTheDocument();
    });
  });

  it('handles currency switching from USD to INR with missing FX rate gracefully', async () => {
    delete window.__EXCHANGE_RATES__;
    renderWithProviders(<QuotationsPage />);

    const newBtn = screen.getByRole('button', { name: /New Quotation/i });
    fireEvent.click(newBtn);

    // Select plan-001 ($299.00 USD)
    const planSelect = screen.getByText(/-- Choose a recurring plan --/i).closest('select')!;
    fireEvent.change(planSelect, { target: { value: 'plan-001' } });

    await waitFor(() => {
      expect(screen.getByText('$299.00 USD')).toBeInTheDocument();
    });

    // Switch currency from USD to INR
    const currencySelect = screen.getByLabelText(/Quotation Currency/i);
    fireEvent.change(currencySelect, { target: { value: 'INR' } });

    // When no FX rate is configured:
    // 1. Should display Conversion Unavailable notice
    await waitFor(() => {
      expect(screen.getByText(/Conversion Unavailable:/i)).toBeInTheDocument();
      expect(screen.getByText(/No exchange rate source is configured for INR/i)).toBeInTheDocument();
    });

    // 2. Must NOT merely replace $ with ₹ keeping 299.00 (i.e. NO false ₹299.00)
    expect(screen.queryByText('₹299.00 INR')).not.toBeInTheDocument();
    expect(screen.queryByText('₹299.00')).not.toBeInTheDocument();

    // 3. Totals display unavailable notice across subtotal, tax, and total
    expect(screen.getAllByText(/Unavailable \(No INR FX rate\)/i).length).toBe(3);

    // Switch back from INR to USD
    fireEvent.change(currencySelect, { target: { value: 'USD' } });

    // Should restore standard USD calculations immediately
    await waitFor(() => {
      expect(screen.queryByText(/Conversion Unavailable:/i)).not.toBeInTheDocument();
      expect(screen.getByText('$299.00 USD')).toBeInTheDocument();
      expect(screen.getByText('$328.90 USD')).toBeInTheDocument();
    });
  });

  it('recalculates every monetary amount when switching USD to INR and back to USD when an FX rate is configured', async () => {
    window.__EXCHANGE_RATES__ = {
      USD_INR: 85.0,
      INR_USD: 1 / 85.0,
    };

    try {
      renderWithProviders(<QuotationsPage />);

      const newBtn = screen.getByRole('button', { name: /New Quotation/i });
      fireEvent.click(newBtn);

      // Select plan-001 ($299.00 USD)
      const planSelect = screen.getByText(/-- Choose a recurring plan --/i).closest('select')!;
      fireEvent.change(planSelect, { target: { value: 'plan-001' } });

      await waitFor(() => {
        expect(screen.getByText('$299.00 USD')).toBeInTheDocument();
      });

      // Switch to INR
      const currencySelect = screen.getByLabelText(/Quotation Currency/i);
      fireEvent.change(currencySelect, { target: { value: 'INR' } });

      // $299 * 85 = 25415.00 INR
      // 10% tax = 2541.50 INR
      // Total = 27956.50 INR
      await waitFor(() => {
        expect(screen.getByText('₹25415.00 INR')).toBeInTheDocument();
        expect(screen.getByText('₹2541.50 INR')).toBeInTheDocument();
        expect(screen.getByText('₹27956.50 INR')).toBeInTheDocument();
      });

      // Switch back to USD
      fireEvent.change(currencySelect, { target: { value: 'USD' } });

      await waitFor(() => {
        expect(screen.getByText('$299.00 USD')).toBeInTheDocument();
        expect(screen.getByText('$328.90 USD')).toBeInTheDocument();
      });
    } finally {
      delete window.__EXCHANGE_RATES__;
    }
  });

  it('preserves genuine 404 error when querying a non-existent quotation id', async () => {
    await expect(apiClient.getQuotation('non-existent-uuid-12345')).rejects.toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('non-existent-uuid-12345'),
      },
    });
  });
});
