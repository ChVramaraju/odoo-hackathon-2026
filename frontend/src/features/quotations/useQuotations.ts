import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { QuotationCreate } from '../../types/quotation';

export const useQuotations = (params?: { status?: string; search?: string; page?: number; page_size?: number }) => {
  return useQuery({
    queryKey: ['quotations', params],
    queryFn: () => apiClient.getQuotations(params),
  });
};

export const useQuotation = (id: string) => {
  return useQuery({
    queryKey: ['quotation', id],
    queryFn: () => apiClient.getQuotation(id),
    enabled: !!id,
  });
};

export const useCreateQuotation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: QuotationCreate) => apiClient.createQuotation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
};

export const useConfirmQuotation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.confirmQuotation(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', updated.id] });
    },
  });
};

