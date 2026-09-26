import type { SessionDto } from '@shared/types/auth';

import { apiRequest } from '@/lib/api/client';
import { authRoutes } from '@/lib/api/routes/auth';

export const accountKeys = {
  sessions: () => ['account', 'sessions'] as const,
};

export const accountApi = {
  async sessions(signal?: AbortSignal): Promise<SessionDto[]> {
    return (await apiRequest<SessionDto[]>(authRoutes.sessions, { signal })).data;
  },
  async endSession(id: string): Promise<void> {
    await apiRequest(authRoutes.endSession, { params: { id } });
  },
  async signOutEverywhere(): Promise<void> {
    await apiRequest(authRoutes.logoutAll);
  },
};
