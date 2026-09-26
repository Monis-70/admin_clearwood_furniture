import { endpoint, requires } from '../endpoint';

export const usersRoutes = {
  list: endpoint('GET', '/admin/users', { access: requires('system.user.read') }),
  create: endpoint('POST', '/admin/users', { access: requires('system.user.create') }),
  update: endpoint('PATCH', '/admin/users/{id}', { access: requires('system.user.update') }),
  remove: endpoint('DELETE', '/admin/users/{id}', { access: requires('system.user.delete') }),
  setRoles: endpoint('POST', '/admin/users/{id}/roles', {
    access: requires('system.user.update', 'system.role.read'),
  }),
  setPassword: endpoint('POST', '/admin/users/{id}/password', {
    access: requires('system.user.update'),
  }),
} as const;
