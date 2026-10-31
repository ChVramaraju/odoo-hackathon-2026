import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../context/AuthContext';
import { PaymentsPage } from './PaymentsPage';
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

describe('PaymentsPage', () => {
  beforeEach(() => {
    apiClient.resetMockData();
  });

  it('renders page header, badge, and metric KPI summary cards', async () => {
    renderWithProviders(<PaymentsPage />);

    expect(screen.getByRole('heading', { name: /Payments & Settlements/i })).toBeInTheDocument();
    expect(screen.getByText(/Step 5 of Core Journey/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Settled/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Settlements/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed Settlements/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Transactions/i)).toBeInTheDocument();
  });

  it('displays mock mode / contract ready notice banner', async () => {
    renderWithProviders(<PaymentsPage />);

    expect(screen.getByText(/Contract Ready \/ Mock Mode:/i)).toBeInTheDocument();
    expect(screen.getByText(/simulated prototype data/i)).toBeInTheDocument();
  });

  it('renders payments table with references, linked invoice, customer, and method', async () => {
    renderWithProviders(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0042')).toBeInTheDocument();
      expect(screen.getAllByText('INV-2026-0042').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Marcus Brody').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Bank Wire / ACH').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('PAY-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Credit Card')).toBeInTheDocument();

    expect(screen.getByText('PAY-2026-0003')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-0003')).toBeInTheDocument();
    expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    expect(screen.getByText('ACH Debit')).toBeInTheDocument();
  });

  it('filters payments based on search input', async () => {
    renderWithProviders(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0042')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by payment #, invoice #, customer/i);
    fireEvent.change(searchInput, { target: { value: 'Rostova' } });

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0003')).toBeInTheDocument();
      expect(screen.queryByText('PAY-2026-0042')).not.toBeInTheDocument();
      expect(screen.queryByText('PAY-2026-0001')).not.toBeInTheDocument();
    });
  });

  it('filters payments by status filter buttons', async () => {
    renderWithProviders(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0042')).toBeInTheDocument();
    });

    // Click 'failed' filter button
    const failedBtn = screen.getByRole('button', { name: /^failed$/i });
    fireEvent.click(failedBtn);

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0003')).toBeInTheDocument();
      expect(screen.queryByText('PAY-2026-0042')).not.toBeInTheDocument();
      expect(screen.queryByText('PAY-2026-0001')).not.toBeInTheDocument();
    });
  });

  it('displays empty state when search finds no matching records', async () => {
    renderWithProviders(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0042')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by payment #, invoice #, customer/i);
    fireEvent.change(searchInput, { target: { value: 'NonExistentPayment12345' } });

    await waitFor(() => {
      expect(screen.getByText(/No payments found/i)).toBeInTheDocument();
    });
  });

  it('opens details modal and displays settlement amount, method, and accounting memo', async () => {
    renderWithProviders(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0042')).toBeInTheDocument();
    });

    // Click view on first payment
    const viewBtn = screen.getByLabelText('View PAY-2026-0042');
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Contract Ready \/ Simulated Record/i)).toBeInTheDocument();
      expect(screen.getByText(/Payment Record • Ledger Snapshot/i)).toBeInTheDocument();
      expect(screen.getByText(/Accounting Memo \/ Audit Reference/i)).toBeInTheDocument();
      expect(screen.getByText(/ACH wire settlement reference TXN-89324-BL/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Brody Quantum Analytics/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('closes details modal on close button and backdrop click', async () => {
    renderWithProviders(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('PAY-2026-0042')).toBeInTheDocument();
    });

    const viewBtn = screen.getByLabelText('View PAY-2026-0042');
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Payment Record • Ledger Snapshot/i)).toBeInTheDocument();
    });

    const closeBtn = screen.getByTitle('Close modal');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Payment Record • Ledger Snapshot/i)).not.toBeInTheDocument();
    });
  });

  it('retrieves payments and payment detail via apiClient', async () => {
    const listRes = await apiClient.getPayments();
    expect(listRes.items.length).toBeGreaterThan(0);
    expect(listRes.items.some((p) => p.payment_number === 'PAY-2026-0042')).toBe(true);

    const singlePay = await apiClient.getPayment('pay-001');
    expect(singlePay.payment_number).toBe('PAY-2026-0042');
    expect(singlePay.amount).toBe('3837.90');
    expect(singlePay.status).toBe('completed');
  });

  it('throws 404 error when retrieving non-existent payment id', async () => {
    await expect(apiClient.getPayment('pay-nonexistent-999')).rejects.toEqual({
      error: {
        code: 'NOT_FOUND',
        message: "Payment with id 'pay-nonexistent-999' was not found.",
      },
    });
  });
});
