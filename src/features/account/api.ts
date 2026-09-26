import type { SessionDto } from '@shared/types/auth';

import { apiRequest } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

export const accountKeys = {
  sessions: () => ['account', 'sessions'] as const,
};

export const accountApi = {
  async sessions(signal?: AbortSignal): Promise<SessionDto[]> {
    return (await apiRequest<SessionDto[]>(endpoints.auth.sessions, { signal })).data;
  },
  async endSession(id: string): Promise<void> {
    await apiRequest(endpoints.auth.endSession, { params: { id } });
  },
  async signOutEverywhere(): Promise<void> {
    await apiRequest(endpoints.auth.logoutAll);
  },
};
