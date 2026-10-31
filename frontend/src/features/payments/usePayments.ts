import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { PaymentFilterParams } from '../../types/payment';

export function usePayments(params?: PaymentFilterParams) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => apiClient.getPayments(params),
  });
}

export function usePayment(id: string | null) {
  return useQuery({
    queryKey: ['payments', id],
    queryFn: () => (id ? apiClient.getPayment(id) : Promise.reject('No payment id provided')),
    enabled: !!id,
  });
}

