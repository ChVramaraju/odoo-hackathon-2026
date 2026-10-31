import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { InvoiceFilterParams } from '../../types/invoice';

export function useInvoices(params?: InvoiceFilterParams) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => apiClient.getInvoices(params),
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => (id ? apiClient.getInvoice(id) : Promise.reject('No invoice id provided')),
    enabled: !!id,
  });
}

export function useConfirmInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.confirmInvoice(id),
    onSuccess: (updatedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.setQueryData(['invoices', updatedInvoice.id], updatedInvoice);
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.cancelInvoice(id),
    onSuccess: (updatedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.setQueryData(['invoices', updatedInvoice.id], updatedInvoice);
    },
  });
}

