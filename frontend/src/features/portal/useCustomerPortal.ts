import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { CustomerProfileUpdate } from '../../types/portal';

export function usePortalProfile() {
  return useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: () => apiClient.getPortalProfile(),
  });
}

export function useUpdatePortalProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerProfileUpdate) => apiClient.updatePortalProfile(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['portal', 'profile'], updated);
      queryClient.invalidateQueries({ queryKey: ['portal', 'dashboard'] });
    },
  });
}

export function usePortalDashboard() {
  return useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: () => apiClient.getPortalDashboard(),
  });
}

export function usePortalSubscriptions() {
  return useQuery({
    queryKey: ['portal', 'subscriptions'],
    queryFn: () => apiClient.getPortalSubscriptions(),
  });
}

export function usePortalInvoices() {
  return useQuery({
    queryKey: ['portal', 'invoices'],
    queryFn: () => apiClient.getPortalInvoices(),
  });
}

export function usePortalPayments() {
  return useQuery({
    queryKey: ['portal', 'payments'],
    queryFn: () => apiClient.getPortalPayments(),
  });
}

