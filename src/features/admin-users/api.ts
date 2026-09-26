import type { AdminUserStatus } from '@shared/enums';
import type {
  AdminPasswordSetInput,
  AdminUserCreateInput,
  AdminUserUpdateInput,
  AssignRolesInput,
} from '@shared/schemas/auth';
import type { AdminUserDto } from '@shared/types/auth';

import { apiPage, apiRequest, type Page } from '@/lib/api/client';
import { usersRoutes } from '@/lib/api/routes/users';

export interface AdminUserListQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  search?: string;
  status?: AdminUserStatus;
}

export const adminUserKeys = {
  all: ['admin-users'] as const,
  lists: () => [...adminUserKeys.all, 'list'] as const,
  list: (query: AdminUserListQuery) => [...adminUserKeys.lists(), query] as const,
};

export const adminUsersApi = {
  list(query: AdminUserListQuery, signal?: AbortSignal): Promise<Page<AdminUserDto>> {
    return apiPage<AdminUserDto>(usersRoutes.list, { query: { ...query }, signal });
  },
  async create(input: AdminUserCreateInput): Promise<AdminUserDto> {
    return (await apiRequest<AdminUserDto>(usersRoutes.create, { body: input })).data;
  },
  async update(id: string, input: AdminUserUpdateInput): Promise<AdminUserDto> {
    const { data } = await apiRequest(usersRoutes.update, { params: { id }, body: input });
    return data as AdminUserDto;
  },
  async remove(id: string): Promise<void> {
    await apiRequest(usersRoutes.remove, { params: { id } });
  },
  async setRoles(id: string, input: AssignRolesInput): Promise<AdminUserDto> {
    const { data } = await apiRequest(usersRoutes.setRoles, { params: { id }, body: input });
    return data as AdminUserDto;
  },
  async setPassword(id: string, input: AdminPasswordSetInput): Promise<void> {
    await apiRequest(usersRoutes.setPassword, { params: { id }, body: input });
  },
};
