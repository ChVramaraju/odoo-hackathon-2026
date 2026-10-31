import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../context/AuthContext';
import { ProductsPage } from './ProductsPage';

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

describe('Products & Variants Page', () => {
  it('renders catalog header and metric cards', async () => {
    render(<ProductsPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Products & Variants')).toBeInTheDocument();
    expect(screen.getByText('Live Catalog')).toBeInTheDocument();
    expect(screen.getByText('Total Catalog Items')).toBeInTheDocument();
    expect(screen.getByText('SaaS Core Services')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Brightloop FinOps Core Platform')).toBeInTheDocument();
    });
  });

  it('renders products table with price and status badges', async () => {
    render(<ProductsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Real-time Revenue Radar Add-on')).toBeInTheDocument();
      expect(screen.getByText('$499.00')).toBeInTheDocument();
    });
  });
});

