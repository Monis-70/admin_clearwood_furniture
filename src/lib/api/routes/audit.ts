import { endpoint, requires } from '../endpoint';

export const auditRoutes = {
  list: endpoint('GET', '/admin/audit-logs', { access: requires('system.audit.read') }),
} as const;
