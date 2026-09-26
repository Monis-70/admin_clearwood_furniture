import type { RoleCreateInput, RoleUpdateInput } from '@shared/schemas/auth';
import type { PermissionDto, RoleDto } from '@shared/types/auth';

import { apiRequest } from '@/lib/api/client';
import { rolesRoutes } from '@/lib/api/routes/roles';

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
    return (await apiRequest<RoleDto[]>(rolesRoutes.list, { signal })).data;
  },
  async get(id: string, signal?: AbortSignal): Promise<RoleDto> {
    const { data } = await apiRequest(rolesRoutes.get, { params: { id }, signal });
    return data as RoleDto;
  },
  async create(input: RoleCreateInput): Promise<RoleDto> {
    return (await apiRequest<RoleDto>(rolesRoutes.create, { body: input })).data;
  },
  async update(id: string, input: RoleUpdateInput): Promise<RoleDto> {
    const { data } = await apiRequest(rolesRoutes.update, { params: { id }, body: input });
    return data as RoleDto;
  },
  async remove(id: string): Promise<void> {
    await apiRequest(rolesRoutes.remove, { params: { id } });
  },
  async permissions(signal?: AbortSignal): Promise<PermissionRegistry> {
    return (await apiRequest<PermissionRegistry>(rolesRoutes.permissions, { signal })).data;
  },
};
