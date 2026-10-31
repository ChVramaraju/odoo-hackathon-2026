import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ProductsPage } from './features/products/ProductsPage';
import { PlansPage } from './features/plans/PlansPage';
import { QuotationsPage } from './features/quotations/QuotationsPage';
import { SubscriptionsPage } from './features/subscriptions/SubscriptionsPage';
import { InvoicesPage } from './features/invoices/InvoicesPage';
import { PaymentsPage } from './features/payments/PaymentsPage';
import { CustomerPortalPage } from './features/portal/CustomerPortalPage';
import { User } from './types/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export interface AppProps {
  initialUser?: User | null;
}

export const App: React.FC<AppProps> = ({ initialUser }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialUser={initialUser}>
        <BrowserRouter>
          <Routes>
            {/* Public authentication route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Authenticated protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="plans" element={<PlansPage />} />
                <Route path="quotations" element={<QuotationsPage />} />
                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="portal" element={<CustomerPortalPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
