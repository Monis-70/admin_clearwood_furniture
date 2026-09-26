import { endpoint, requires } from '../endpoint';

export const rolesRoutes = {
  list: endpoint('GET', '/admin/roles', { access: requires('system.role.read') }),
  get: endpoint('GET', '/admin/roles/{id}', { access: requires('system.role.read') }),
  create: endpoint('POST', '/admin/roles', { access: requires('system.role.create') }),
  update: endpoint('PATCH', '/admin/roles/{id}', { access: requires('system.role.update') }),
  remove: endpoint('DELETE', '/admin/roles/{id}', { access: requires('system.role.delete') }),
  permissions: endpoint('GET', '/admin/permissions', { access: requires('system.role.read') }),
} as const;
