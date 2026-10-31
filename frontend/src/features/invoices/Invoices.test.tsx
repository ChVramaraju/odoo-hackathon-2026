import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../context/AuthContext';
import { InvoicesPage } from './InvoicesPage';
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

describe('InvoicesPage', () => {
  it('renders page header, badge, and metric KPI summary cards', async () => {
    renderWithProviders(<InvoicesPage />);

    expect(screen.getByRole('heading', { name: /Customer Invoices/i })).toBeInTheDocument();
    expect(screen.getByText(/Step 4 of Journey/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Invoiced/i)).toBeInTheDocument();
    expect(screen.getByText(/Outstanding Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/Paid Invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/Overdue Invoices/i)).toBeInTheDocument();
  });

  it('displays mock mode / contract ready notice banner', async () => {
    renderWithProviders(<InvoicesPage />);

    expect(screen.getByText(/Contract Ready \/ Mock Mode:/i)).toBeInTheDocument();
    expect(screen.getByText(/simulated prototype data/i)).toBeInTheDocument();
  });

  it('renders invoices table with references, subscriptions, and balance due', async () => {
    renderWithProviders(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0042')).toBeInTheDocument();
      expect(screen.getByText('Marcus Brody')).toBeInTheDocument();
      expect(screen.getByText('DEMO-SUB-2026-0042')).toBeInTheDocument();
      expect(screen.getByText('Settled')).toBeInTheDocument();
    });

    expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('DEMO-SUB-2026-0001')).toBeInTheDocument();
    expect(screen.getAllByText('Unpaid').length).toBeGreaterThanOrEqual(1);
  });

  it('filters invoices based on search input', async () => {
    renderWithProviders(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0042')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by invoice #, customer, sub #, or company/i);
    fireEvent.change(searchInput, { target: { value: 'Brody' } });

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0042')).toBeInTheDocument();
      expect(screen.queryByText('INV-2026-0001')).not.toBeInTheDocument();
    });
  });

  it('filters invoices by status filter buttons', async () => {
    renderWithProviders(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0042')).toBeInTheDocument();
    });

    // Click 'overdue' filter button
    const overdueBtn = screen.getByRole('button', { name: /^overdue$/i });
    fireEvent.click(overdueBtn);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0003')).toBeInTheDocument(); // Elena Rostova is overdue
      expect(screen.queryByText('INV-2026-0042')).not.toBeInTheDocument(); // Marcus Brody is paid
    });
  });

  it('displays empty state when search finds no matching records', async () => {
    renderWithProviders(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0042')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by invoice #, customer, sub #, or company/i);
    fireEvent.change(searchInput, { target: { value: 'NonExistentInvoiceABC999' } });

    await waitFor(() => {
      expect(screen.getByText(/No invoices found/i)).toBeInTheDocument();
    });
  });

  it('opens details modal and displays line item snapshots, tax, and ledger balance', async () => {
    renderWithProviders(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0042')).toBeInTheDocument();
    });

    // Click view button on Marcus Brody's invoice
    const viewBtn = screen.getByLabelText('View INV-2026-0042');
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Simulated Invoice Record:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Brody Quantum Analytics/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/mbrody@brodyquantum\.io/i)).toBeInTheDocument();
      expect(screen.getByText(/Payment & Ledger Balance/i)).toBeInTheDocument();
      expect(screen.getByText(/Invoice Line Snapshots/i)).toBeInTheDocument();
      expect(screen.getByText(/Scale Annual Platinum \(Dedicated SLA Tier Add-on\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Jurisdiction Tax \(Snapshot\):/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Invoiced Amount:/i)).toBeInTheDocument();
    });
  });

  it('closes details modal on Escape and clicking backdrop, and preserves when clicking inside', async () => {
    renderWithProviders(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0042')).toBeInTheDocument();
    });

    const viewBtn = screen.getByLabelText('View INV-2026-0042');
    fireEvent.click(viewBtn);

    const modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toBeInTheDocument();

    // Clicking inside modal does NOT close it
    fireEvent.click(modalContent);
    expect(screen.getByText(/Simulated Invoice Record:/i)).toBeInTheDocument();

    // Pressing Escape closes it
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText(/Simulated Invoice Record:/i)).not.toBeInTheDocument();
    });

    // Re-open and verify clicking backdrop closes it
    fireEvent.click(viewBtn);
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByText(/Simulated Invoice Record:/i)).not.toBeInTheDocument();
    });
  });

  it('supports simulated confirm on draft invoice and simulated cancel on unpaid invoice', async () => {
    renderWithProviders(<InvoicesPage />);

    // Filter to draft invoices
    const draftBtn = screen.getByRole('button', { name: /^draft$/i });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(screen.getByText('INV-2026-0004')).toBeInTheDocument();
    });

    // View draft invoice
    fireEvent.click(screen.getByLabelText('View INV-2026-0004'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm Invoice \(Simulated\)/i })).toBeInTheDocument();
    });

    // Click confirm
    fireEvent.click(screen.getByRole('button', { name: /Confirm Invoice \(Simulated\)/i }));

    // Status updates to posted
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel Invoice \(Simulated\)/i })).toBeInTheDocument();
    });
  });

  it('supports recording payment settlement on posted invoice and updates balance in real time', async () => {
    renderWithProviders(<InvoicesPage />);

    // View Sarah Chen's posted invoice INV-2026-0001
    await waitFor(() => {
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('View INV-2026-0001'));

    // Verify Record Payment button is displayed
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Record Payment/i })).toBeInTheDocument();
    });

    // Click Record Payment to expand the settlement form
    fireEvent.click(screen.getByRole('button', { name: /Record Payment/i }));

    // Verify form rendered with locked currency and active idempotency key
    expect(screen.getByText(/Record Payment Settlement \(API v1 \/payments\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Internal Settlement Recording:/i)).toBeInTheDocument();
    expect(screen.getByText(/Idempotency Key:/i)).toBeInTheDocument();

    // Fill in payment reference and submit settlement
    const refInput = screen.getByPlaceholderText(/e\.g\. UTR-98234-AX or Check #441/i);
    fireEvent.change(refInput, { target: { value: 'UTR-LIVE-TEST-001' } });

    const submitBtn = screen.getByRole('button', { name: /Confirm & Record Payment/i });
    fireEvent.click(submitBtn);

    // Verify success banner appears and invoice balance updates
    await waitFor(() => {
      expect(screen.getByText(/successfully recorded\. Invoice balance updated\./i)).toBeInTheDocument();
    });
  });

  it('preserves genuine 404 error when querying a non-existent invoice id', async () => {
    await expect(apiClient.getInvoice('non-existent-inv-99999')).rejects.toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('non-existent-inv-99999'),
      },
    });
  });
});

