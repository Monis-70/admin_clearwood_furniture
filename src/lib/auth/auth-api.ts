import type { AdminLoginInput, ChangePasswordInput } from '@shared/schemas/auth';
import type { AdminLoginResponse, AdminMeDto } from '@shared/types/auth';

import { apiRequest, withoutTokens } from '@/lib/api/client';
import { authRoutes } from '@/lib/api/routes/auth';

/** Session endpoints. Used only by the session provider; screens go through `useSession()`. */
export const authApi = {
  async login(input: AdminLoginInput): Promise<AdminMeDto> {
    const result = await apiRequest<AdminLoginResponse>(authRoutes.login, { body: input });
    return withoutTokens(result.data);
  },

  async me(signal?: AbortSignal): Promise<AdminMeDto> {
    return (await apiRequest<AdminMeDto>(authRoutes.me, { signal })).data;
  },

  async logout(): Promise<void> {
    await apiRequest<{ loggedOut: boolean }>(authRoutes.logout);
  },

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await apiRequest<{ changed: boolean }>(authRoutes.changePassword, { body: input });
  },
};
