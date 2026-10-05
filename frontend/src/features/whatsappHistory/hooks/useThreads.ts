import { useQuery } from '@tanstack/react-query';
import { env } from '@/config/env';
import { apiFetch } from '@/hooks/api/api-fetch';
import { useAuthStore } from '@/stores/auth-store';
import type { Thread } from '../types';

export function useThreads() {
  const { user } = useAuthStore();
  const userScopeKey = user?.uid || user?.phone || user?.email || 'anonymous';

  return useQuery({
    queryKey: ['whatsapp-threads', userScopeKey],
    queryFn: async () => {
      const data = await apiFetch<Thread[]>(`${env.apiBaseUrl()}/whatsapp/threads`);
      if (!data) return [];
      return data;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}
