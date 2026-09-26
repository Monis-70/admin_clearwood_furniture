import type { AuditAction, AuditSeverity } from '@shared/enums';
import type { AuditLogDto } from '@shared/types/auth';

import { apiPage, type Page } from '@/lib/api/client';
import { auditRoutes } from '@/lib/api/routes/audit';

export interface AuditQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
  action?: AuditAction;
  severity?: AuditSeverity;
  entity?: string;
  entityId?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export const auditKeys = {
  all: ['audit'] as const,
  list: (query: AuditQuery) => [...auditKeys.all, 'list', query] as const,
};

export const auditApi = {
  list(query: AuditQuery, signal?: AbortSignal): Promise<Page<AuditLogDto>> {
    return apiPage<AuditLogDto>(auditRoutes.list, { query: { ...query }, signal });
  },
};
