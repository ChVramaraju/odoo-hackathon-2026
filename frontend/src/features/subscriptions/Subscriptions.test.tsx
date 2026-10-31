import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../context/AuthContext';
import { SubscriptionsPage } from './SubscriptionsPage';
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

describe('SubscriptionsPage', () => {
  it('renders page header and metric KPI summary cards', async () => {
    renderWithProviders(<SubscriptionsPage />);

    expect(screen.getByRole('heading', { name: /Customer Subscriptions/i })).toBeInTheDocument();
    expect(screen.getByText(/Step 3 of Journey/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Subscriptions/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Contracts/i)).toBeInTheDocument();
    expect(screen.getByText(/Paused Contracts/i)).toBeInTheDocument();
    expect(screen.getByText(/Closed \/ Completed/i)).toBeInTheDocument();
  });

  it('displays mock mode / contract ready notice banner', async () => {
    renderWithProviders(<SubscriptionsPage />);

    expect(screen.getByText(/Contract Ready \/ Mock Mode:/i)).toBeInTheDocument();
    expect(screen.getByText(/simulated prototype data/i)).toBeInTheDocument();
  });

  it('renders subscriptions table with mock data', async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('DEMO-SUB-2026-0042')).toBeInTheDocument();
      expect(screen.getByText('Marcus Brody')).toBeInTheDocument();
      expect(screen.getByText('Brody Quantum Analytics')).toBeInTheDocument();
      expect(screen.getByText('Scale Annual Platinum')).toBeInTheDocument();
    });

    expect(screen.getByText('DEMO-SUB-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Acme Cloud Corp')).toBeInTheDocument();
  });

  it('filters subscriptions based on search input', async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('DEMO-SUB-2026-0042')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by sub #, customer, plan, or company/i);
    fireEvent.change(searchInput, { target: { value: 'Brody' } });

    await waitFor(() => {
      expect(screen.getByText('DEMO-SUB-2026-0042')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Chen')).not.toBeInTheDocument();
    });
  });

  it('filters subscriptions by status buttons', async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('DEMO-SUB-2026-0042')).toBeInTheDocument();
    });

    // Click 'paused' status filter
    const pausedBtn = screen.getByRole('button', { name: /^paused$/i });
    fireEvent.click(pausedBtn);

    await waitFor(() => {
      expect(screen.getByText('DEMO-SUB-2026-0003')).toBeInTheDocument(); // Elena Rostova is paused
      expect(screen.queryByText('DEMO-SUB-2026-0042')).not.toBeInTheDocument(); // Marcus Brody is active
    });
  });

  it('displays empty state when search finds no matching records', async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('DEMO-SUB-2026-0042')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by sub #, customer, plan, or company/i);
    fireEvent.change(searchInput, { target: { value: 'NonExistentCustomerNameXYZ' } });

    await waitFor(() => {
      expect(screen.getByText(/No subscriptions found/i)).toBeInTheDocument();
    });
  });

  it('opens details modal and displays full contract metadata and line items', async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('DEMO-SUB-2026-0042')).toBeInTheDocument();
    });

    // Click view button on Marcus Brody's subscription
    const viewBtn = screen.getByLabelText('View DEMO-SUB-2026-0042');
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Simulated Subscription Contract:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Brody Quantum Analytics/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/mbrody@brodyquantum\.io/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Scale Annual Platinum/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Contract Line Items/i)).toBeInTheDocument();
      expect(screen.getByText(/Real-time Revenue Radar Add-on/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Recurring \(yearly\):/i)).toBeInTheDocument();
    });
  });

  it('closes details modal on Escape and clicking backdrop, and preserves when clicking inside', async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('DEMO-SUB-2026-0042')).toBeInTheDocument();
    });

    const viewBtn = screen.getByLabelText('View DEMO-SUB-2026-0042');
    fireEvent.click(viewBtn);

    const modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toBeInTheDocument();

    // Clicking inside modal does NOT close it
    fireEvent.click(modalContent);
    expect(screen.getByText(/Simulated Subscription Contract:/i)).toBeInTheDocument();

    // Pressing Escape closes it
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText(/Simulated Subscription Contract:/i)).not.toBeInTheDocument();
    });

    // Re-open and verify clicking backdrop closes it
    fireEvent.click(viewBtn);
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByText(/Simulated Subscription Contract:/i)).not.toBeInTheDocument();
    });
  });

  it('supports simulated pause and close actions on active subscriptions', async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('DEMO-SUB-2026-0001')).toBeInTheDocument();
    });

    // Open Sarah Chen's active subscription
    fireEvent.click(screen.getByLabelText('View DEMO-SUB-2026-0001'));

    // Verify Pause and Close action buttons are present for admin
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pause Contract \(Simulated\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Close Contract \(Simulated\)/i })).toBeInTheDocument();
    });

    // Click Pause
    const pauseBtn = screen.getByRole('button', { name: /Pause Contract \(Simulated\)/i });
    fireEvent.click(pauseBtn);

    // After pause, button updates and status becomes Paused
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Resume Contract \(Simulated\)/i })).toBeInTheDocument();
    });
  });

  it('preserves genuine 404 error when querying a non-existent subscription id', async () => {
    await expect(apiClient.getSubscription('non-existent-sub-99999')).rejects.toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('non-existent-sub-99999'),
      },
    });
  });
});
