import type { RoleCreateInput, RoleUpdateInput } from '@shared/schemas/auth';
import type { PermissionDto, RoleDto } from '@shared/types/auth';

import { apiRequest } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

/** `GET /permissions` groups the registry by area: `{ catalog: PermissionDto[], cms: … }`. */
export type PermissionRegistry = Record<string, PermissionDto[]>;

export const roleKeys = {
  all: ['roles'] as const,
  list: () => [...roleKeys.all, 'list'] as const,
  detail: (id: string) => [...roleKeys.all, 'detail', id] as const,
  permissions: () => ['permissions'] as const,
};

export const rolesApi = {
  async list(signal?: AbortSignal): Promise<RoleDto[]> {
    return (await apiRequest<RoleDto[]>(endpoints.roles.list, { signal })).data;
  },
  async get(id: string, signal?: AbortSignal): Promise<RoleDto> {
    const { data } = await apiRequest(endpoints.roles.get, { params: { id }, signal });
    return data as RoleDto;
  },
  async create(input: RoleCreateInput): Promise<RoleDto> {
    return (await apiRequest<RoleDto>(endpoints.roles.create, { body: input })).data;
  },
  async update(id: string, input: RoleUpdateInput): Promise<RoleDto> {
    const { data } = await apiRequest(endpoints.roles.update, { params: { id }, body: input });
    return data as RoleDto;
  },
  async remove(id: string): Promise<void> {
    await apiRequest(endpoints.roles.remove, { params: { id } });
  },
  async permissions(signal?: AbortSignal): Promise<PermissionRegistry> {
    return (await apiRequest<PermissionRegistry>(endpoints.roles.permissions, { signal })).data;
  },
};
