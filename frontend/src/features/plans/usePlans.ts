import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { PlanCreate, PlanUpdate } from '../../types/plan';

export const usePlans = (params?: { status?: string; billing_frequency?: string; page?: number; page_size?: number }) => {
  return useQuery({
    queryKey: ['plans', params],
    queryFn: () => apiClient.getPlans(params),
  });
};

export const usePlan = (id: string) => {
  return useQuery({
    queryKey: ['plan', id],
    queryFn: () => apiClient.getPlan(id),
    enabled: !!id,
  });
};

export const useCreatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlanCreate) => apiClient.createPlan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};

export const useUpdatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlanUpdate }) => apiClient.updatePlan(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};

