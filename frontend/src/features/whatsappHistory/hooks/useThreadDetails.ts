import { useQuery } from '@tanstack/react-query';
import { env } from '@/config/env';
import { apiFetch } from '@/hooks/api/api-fetch';
import { useAuthStore } from '@/stores/auth-store';
import type { Message } from '../types';

export function useThreadDetails(threadId: string | undefined, date: string) {
  const { user } = useAuthStore();
  const userScopeKey = user?.uid || user?.phone || user?.email || 'anonymous';

  return useQuery({
    queryKey: ['whatsapp-thread-details', userScopeKey, threadId, date],
    queryFn: async () => {
      if (!threadId) return [];

      const url = date
        ? `${env.apiBaseUrl()}/whatsapp/threads/${encodeURIComponent(threadId)}/${date}`
        : `${env.apiBaseUrl()}/whatsapp/threads/${encodeURIComponent(threadId)}`;

      const data = await apiFetch<Message[]>(url);
      return data || [];
    },
    enabled: !!threadId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}
