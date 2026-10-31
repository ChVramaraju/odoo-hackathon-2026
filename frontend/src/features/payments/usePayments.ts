import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { PaymentCreate, PaymentFilterParams } from '../../types/payment';

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

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PaymentCreate) => apiClient.createPayment(payload),
    onSuccess: (newPayment) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['portal-summary'] });
      queryClient.invalidateQueries({ queryKey: ['portal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['portal-payments'] });
      if (newPayment.invoice_id) {
        queryClient.invalidateQueries({ queryKey: ['invoices', newPayment.invoice_id] });
      }
    },
  });
}

