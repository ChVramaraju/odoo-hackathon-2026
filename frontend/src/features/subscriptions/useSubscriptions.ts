import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { SubscriptionFilterParams } from '../../types/subscription';

export function useSubscriptions(params?: SubscriptionFilterParams) {
  return useQuery({
    queryKey: ['subscriptions', params],
    queryFn: () => apiClient.getSubscriptions(params),
  });
}

export function useSubscription(id: string | null) {
  return useQuery({
    queryKey: ['subscriptions', id],
    queryFn: () => (id ? apiClient.getSubscription(id) : Promise.reject('No id provided')),
    enabled: !!id,
  });
}

export function usePauseSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.pauseSubscription(id),
    onSuccess: (updatedSub) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.setQueryData(['subscriptions', updatedSub.id], updatedSub);
    },
  });
}

export function useResumeSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.resumeSubscription(id),
    onSuccess: (updatedSub) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.setQueryData(['subscriptions', updatedSub.id], updatedSub);
    },
  });
}

export function useRenewSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.renewSubscription(id),
    onSuccess: (updatedSub) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.setQueryData(['subscriptions', updatedSub.id], updatedSub);
    },
  });
}

export function useCloseSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.closeSubscription(id),
    onSuccess: (updatedSub) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.setQueryData(['subscriptions', updatedSub.id], updatedSub);
    },
  });
}

