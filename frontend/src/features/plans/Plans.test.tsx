import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../context/AuthContext';
import { PlansPage } from './PlansPage';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('Subscription Plans Page', () => {
  it('renders plans header and metrics', async () => {
    render(<PlansPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Subscription Plans')).toBeInTheDocument();
    expect(screen.getByText('Pricing Engine')).toBeInTheDocument();
    expect(screen.getByText('Configured Tiers')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Growth Monthly FinOps')).toBeInTheDocument();
    });
  });

  it('renders plan price and billing frequency', async () => {
    render(<PlansPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Scale Annual Platinum')).toBeInTheDocument();
      expect(screen.getByText('$2990.00')).toBeInTheDocument();
    });
  });
});

