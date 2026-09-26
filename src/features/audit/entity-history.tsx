'use client';

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import Link from 'next/link';

import { StatusBadge } from '@/components/patterns/status-badge';
import { EmptyState, ErrorState, PermissionNotice } from '@/components/patterns/states';
import { Skeleton } from '@/components/ui/surface';
import { endpoints } from '@/lib/api/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { auditApi, auditKeys, type AuditQuery } from './api';
import { AUDIT_ACTION_LABELS, AUDIT_SEVERITY } from './model';

/** The last changes to one record, from the audit trail (the only history the API keeps). */
export function EntityHistory({ entity, entityId }: { entity: string; entityId: string }) {
  const { canCall } = usePermissions();
  const allowed = canCall(endpoints.audit.list);
  const query: AuditQuery = { page: 1, limit: 10, order: 'desc', entity, entityId };
  const history = useQuery({
    queryKey: auditKeys.list(query),
    queryFn: ({ signal }) => auditApi.list(query, signal),
    enabled: allowed,
    ...cachePolicy.list,
  });

  if (!allowed) {
    return (
      <PermissionNotice area="the history of this record" all={['system.audit.read']} compact />
    );
  }
  if (history.isPending) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading history">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (history.error) {
    return <ErrorState error={history.error} onRetry={() => void history.refetch()} compact />;
  }
  if (history.data.items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No recorded activity yet"
        description="Changes made from now on appear here."
        compact
      />
    );
  }

  const params = new URLSearchParams({ entity, entityId });
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col divide-y rounded-md border">
        {history.data.items.map((row) => (
          <li key={row.id} className="flex flex-col gap-1 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{AUDIT_ACTION_LABELS[row.action] ?? row.action}</span>
              <StatusBadge status={row.severity} registry={AUDIT_SEVERITY} />
            </div>
            <div className="text-xs text-muted-foreground">
              {row.actorName ?? (row.actorType === 'SYSTEM' ? 'System' : 'Unknown')}
              {' · '}
              <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)}>
                {formatRelative(row.createdAt)}
              </time>
            </div>
          </li>
        ))}
      </ol>
      {history.data.meta.total > history.data.items.length ? (
        <Link
          href={`/system/audit-log?${params.toString()}`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          See all {history.data.meta.total} entries in the audit log
        </Link>
      ) : null}
    </div>
  );
}
