import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { CustomerPortalPage } from './CustomerPortalPage';
import { Sidebar } from '../../components/layout/Sidebar';
import { apiClient } from '../../api/client';

function renderWithProviders(ui: React.ReactElement, initialRoute: string = '/portal') {
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
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/portal" element={ui} />
            <Route path="/" element={<div data-testid="overview-page">Overview</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('CustomerPortalPage', () => {
  beforeEach(() => {
    // Reset to customer token
    apiClient.setToken('mock-customer-token-cust-001');
    apiClient.setActiveCustomerId('cust-001');
  });

  it('renders portal header, security badge, and dashboard KPI summary cards', async () => {
    renderWithProviders(<CustomerPortalPage />);

    expect(screen.getByRole('heading', { name: /Customer Self-Service Portal/i })).toBeInTheDocument();
    expect(screen.getByText(/Customer Scoped Area:/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Active Subscriptions/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Outstanding Invoices/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Settled YTD/i)).toBeInTheDocument();
      expect(screen.getByText(/Next Billing Date/i)).toBeInTheDocument();
    });
  });

  it('renders active subscriptions, recent invoices, and recent payments on dashboard', async () => {
    renderWithProviders(<CustomerPortalPage />);

    await waitFor(() => {
      // Sarah Chen's active subscription
      expect(screen.getByText('DEMO-SUB-2026-0001')).toBeInTheDocument();
      expect(screen.getByText(/Growth Monthly FinOps/i)).toBeInTheDocument();
      // Sarah Chen's invoice
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
      // Sarah Chen's payment
      expect(screen.getByText('PAY-2026-0001')).toBeInTheDocument();
    });
  });

  it('navigates to My Subscriptions tab and opens subscription details modal', async () => {
    renderWithProviders(<CustomerPortalPage />, '/portal?tab=subscriptions');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /My Subscription Agreements/i })).toBeInTheDocument();
      expect(screen.getByText('DEMO-SUB-2026-0001')).toBeInTheDocument();
    });

    // View subscription details
    const viewBtn = screen.getByLabelText('View DEMO-SUB-2026-0001');
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Simulated Subscription Contract:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Customer Information/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to My Invoices tab and opens invoice details modal', async () => {
    renderWithProviders(<CustomerPortalPage />, '/portal?tab=invoices');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /My Billing Statements & Invoices/i })).toBeInTheDocument();
      expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    });

    const viewBtn = screen.getByLabelText('View INV-2026-0001');
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Simulated Invoice Record:/i)).toBeInTheDocument();
      expect(screen.getByText(/Payment & Ledger Balance/i)).toBeInTheDocument();
      expect(screen.getByText(/Jurisdiction Tax \(Snapshot\):/i)).toBeInTheDocument();
    });
  });

  it('navigates to Payment History tab and opens payment receipt modal', async () => {
    renderWithProviders(<CustomerPortalPage />, '/portal?tab=payments');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Payment & Transaction History/i })).toBeInTheDocument();
      expect(screen.getByText('PAY-2026-0001')).toBeInTheDocument();
    });

    const receiptBtn = screen.getByLabelText('View PAY-2026-0001');
    fireEvent.click(receiptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Payment Record • Ledger Snapshot/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Settled Amount/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Credit Card/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('navigates to Account & Profile tab and updates contact details', async () => {
    renderWithProviders(<CustomerPortalPage />, '/portal?tab=profile');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Customer Account Profile/i })).toBeInTheDocument();
      expect(screen.getByText(/Supported Backend Profile Fields/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('Your full name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Sarah Chen-Updated' } });

    const saveBtn = screen.getByRole('button', { name: /Save Profile Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Profile updated successfully/i)).toBeInTheDocument();
    });
  });
});

describe('Role-Based UI & Navigation Visibility', () => {
  it('displays customer portal links and hides admin tools when role is customer', async () => {
    const TestRoleApp = () => {
      const { switchRole } = useAuth();
      return (
        <div>
          <button onClick={() => switchRole('customer')}>Set Customer Role</button>
          <button onClick={() => switchRole('admin')}>Set Admin Role</button>
          <Sidebar />
        </div>
      );
    };

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <TestRoleApp />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Initial default role is admin
    expect(screen.getByText('Products & Variants')).toBeInTheDocument();
    expect(screen.getByText('Subscription Plans')).toBeInTheDocument();

    // Switch to customer
    fireEvent.click(screen.getByText('Set Customer Role'));

    await waitFor(() => {
      // Admin tools must be hidden
      expect(screen.queryByText('Products & Variants')).not.toBeInTheDocument();
      expect(screen.queryByText('Subscription Plans')).not.toBeInTheDocument();
      expect(screen.queryByText('Quotations')).not.toBeInTheDocument();

      // Customer portal navigation must be visible
      expect(screen.getByText('Customer Dashboard')).toBeInTheDocument();
      expect(screen.getByText('My Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('My Invoices')).toBeInTheDocument();
      expect(screen.getByText('Payment History')).toBeInTheDocument();
      expect(screen.getByText('Account & Profile')).toBeInTheDocument();
    });
  });
});

describe('Customer Data Ownership & Scoping API Boundary', () => {
  beforeEach(() => {
    // Authenticate as Sarah Chen (cust-001)
    apiClient.setToken('mock-customer-token-cust-001');
    apiClient.setActiveCustomerId('cust-001');
  });

  it('scopes subscriptions list to authenticated customer only', async () => {
    const res = await apiClient.getSubscriptions();
    expect(res.items.length).toBeGreaterThan(0);
    // All returned subscriptions must belong to Sarah Chen
    res.items.forEach((sub) => {
      expect(sub.customer_id === 'cust-001' || sub.customer.email === 'schen@acmecloud.com').toBe(true);
      expect(sub.customer.name).not.toBe('Marcus Brody');
    });
  });

  it('rejects access when customer attempts to fetch another customer subscription by ID', async () => {
    // sub-001 belongs to Marcus Brody (cust-002)
    await expect(apiClient.getSubscription('sub-001')).rejects.toEqual({
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to access this subscription record.',
      },
    });
  });

  it('scopes invoices list to authenticated customer only', async () => {
    const res = await apiClient.getInvoices();
    expect(res.items.length).toBeGreaterThan(0);
    res.items.forEach((inv) => {
      expect(inv.customer_id === 'cust-001' || inv.customer.email === 'schen@acmecloud.com').toBe(true);
      expect(inv.customer.name).not.toBe('Marcus Brody');
    });
  });

  it('rejects access when customer attempts to fetch another customer invoice by ID', async () => {
    // inv-001 belongs to Marcus Brody (cust-002)
    await expect(apiClient.getInvoice('inv-001')).rejects.toEqual({
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to access this invoice record.',
      },
    });
  });

  it('scopes payments list to authenticated customer only', async () => {
    const res = await apiClient.getPayments();
    expect(res.items.length).toBeGreaterThan(0);
    res.items.forEach((p) => {
      expect(p.customer_id === 'cust-001' || p.customer.email === 'schen@acmecloud.com').toBe(true);
      expect(p.customer.name).not.toBe('Marcus Brody');
    });
  });

  it('rejects access when customer attempts to fetch another customer payment by ID', async () => {
    // pay-001 belongs to Marcus Brody (cust-002)
    await expect(apiClient.getPayment('pay-001')).rejects.toEqual({
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to access this payment record.',
      },
    });
  });

  it('allows customer to view and update permitted profile fields via portal contract', async () => {
    const profile = await apiClient.getPortalProfile();
    expect(profile.id).toBe('cust-001');
    expect(profile.role).toBe('customer');

    const updated = await apiClient.updatePortalProfile({
      name: 'Sarah Chen-Verified',
      company: 'Acme Cloud Corp Global',
    });
    expect(updated.name).toBe('Sarah Chen-Verified');
    expect(updated.company).toBe('Acme Cloud Corp Global');
  });
});
