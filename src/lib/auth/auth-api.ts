import type { AdminLoginInput, ChangePasswordInput } from '@shared/schemas/auth';
import type { AdminLoginResponse, AdminMeDto } from '@shared/types/auth';

import { apiRequest, withoutTokens } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

/** Session endpoints. Used only by the session provider; screens go through `useSession()`. */
export const authApi = {
  async login(input: AdminLoginInput): Promise<AdminMeDto> {
    const result = await apiRequest<AdminLoginResponse>(endpoints.auth.login, { body: input });
    return withoutTokens(result.data);
  },

  async me(signal?: AbortSignal): Promise<AdminMeDto> {
    return (await apiRequest<AdminMeDto>(endpoints.auth.me, { signal })).data;
  },

  async logout(): Promise<void> {
    await apiRequest<{ loggedOut: boolean }>(endpoints.auth.logout);
  },

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await apiRequest<{ changed: boolean }>(endpoints.auth.changePassword, { body: input });
  },
};
