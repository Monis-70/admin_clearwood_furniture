'use client';

import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import dynamic from 'next/dynamic';

import type { AuditAction, AuditSeverity } from '@shared/enums';
import type { AuditLogDto } from '@shared/types/auth';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SavedFiltersMenu } from '@/components/patterns/data-table/saved-filters-menu';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { endpoints } from '@/lib/api/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { auditApi, auditKeys, type AuditQuery } from './api';
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, AUDIT_SEVERITY, entityLabel } from './model';

const FILTERS = [
  'action',
  'severity',
  'entity',
  'entityId',
  'actorId',
  'from',
  'to',
  'id',
] as const;
type Filter = (typeof FILTERS)[number];

// The label maps are typed Record<AuditAction|AuditSeverity, …>, so they list every value.
const ACTION_OPTIONS = (Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map((value) => ({
  value,
  label: AUDIT_ACTION_LABELS[value],
}));
const SEVERITY_OPTIONS = (Object.keys(AUDIT_SEVERITY) as AuditSeverity[]).map((value) => ({
  value,
  label: AUDIT_SEVERITY[value].label,
}));
const ENTITY_OPTIONS = Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Day boundaries in the admin's own time zone, sent as instants. */
function dayStart(value: string | undefined): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}
function dayEnd(value: string | undefined): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

const AuditEntrySheet = dynamic(
  () => import('./audit-entry-sheet').then((m) => m.AuditEntrySheet),
  { ssr: false },
);

export function AuditLogScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.audit.list)) {
    return <PermissionNotice area="the audit log" all={['system.audit.read']} />;
  }
  return <AuditLogList />;
}

function AuditLogList() {
  const params = useListParams<Filter>({ filters: FILTERS, defaultSort: 'createdAt' });
  const f = params.filters;
  const query: AuditQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    action: f.action as AuditAction | undefined,
    severity: f.severity as AuditSeverity | undefined,
    entity: f.entity,
    entityId: f.entityId,
    actorId: f.actorId,
    from: dayStart(f.from),
    to: dayEnd(f.to),
  };
  const rows = useQuery({
    queryKey: auditKeys.list(query),
    queryFn: ({ signal }) => auditApi.list(query, signal),
    ...cachePolicy.list,
  });
  const selected = f.id ? (rows.data?.items.find((row) => row.id === f.id) ?? null) : null;

  const columns: DataTableColumn<AuditLogDto>[] = [
    {
      id: 'createdAt',
      meta: { label: 'When', sortKey: 'createdAt', pinned: true, mobile: 'detail' },
      header: 'When',
      cell: ({ row }) => (
        <time dateTime={row.original.createdAt} title={formatDateTime(row.original.createdAt)}>
          {formatRelative(row.original.createdAt)}
        </time>
      ),
    },
    {
      id: 'action',
      meta: { label: 'What happened', sortKey: 'action', mobile: 'title' },
      header: 'What happened',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => params.setFilter('id', row.original.id)}
          className="rounded-sm text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {AUDIT_ACTION_LABELS[row.original.action] ?? row.original.action}
          <span className="font-normal text-muted-foreground">
            {' '}
            · {entityLabel(row.original.entity)}
          </span>
        </button>
      ),
    },
    {
      id: 'actor',
      meta: { label: 'Who', mobile: 'detail' },
      header: 'Who',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span>
            {row.original.actorName ?? (row.original.actorType === 'SYSTEM' ? 'System' : '—')}
          </span>
          {row.original.actorEmail ? (
            <span className="text-xs text-muted-foreground">{row.original.actorEmail}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'severity',
      meta: { label: 'Severity', sortKey: 'severity', mobile: 'detail' },
      header: 'Severity',
      cell: ({ row }) => <StatusBadge status={row.original.severity} registry={AUDIT_SEVERITY} />,
    },
    {
      id: 'ip',
      meta: { label: 'IP address', mobile: 'hidden' },
      header: 'IP address',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.ip ?? '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who did what, and when: sign-ins, changes to records, roles and settings, and refused actions. Entries cannot be edited or deleted."
      />
      <DataTable
        label="Audit log"
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="audit-log"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <FilterSelect
              label="Action"
              value={f.action}
              options={ACTION_OPTIONS}
              onChange={(value) => params.setFilter('action', value)}
            />
            <FilterSelect
              label="Severity"
              value={f.severity}
              options={SEVERITY_OPTIONS}
              onChange={(value) => params.setFilter('severity', value)}
            />
            <FilterSelect
              label="Record"
              value={f.entity}
              options={ENTITY_OPTIONS}
              onChange={(value) => params.setFilter('entity', value)}
            />
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="audit-from" className="text-xs">
                  From
                </Label>
                <Input
                  id="audit-from"
                  type="date"
                  value={f.from ?? ''}
                  onChange={(event) => params.setFilter('from', event.target.value || null)}
                  className="w-40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="audit-to" className="text-xs">
                  To
                </Label>
                <Input
                  id="audit-to"
                  type="date"
                  value={f.to ?? ''}
                  onChange={(event) => params.setFilter('to', event.target.value || null)}
                  className="w-40"
                />
              </div>
            </div>
            {f.entityId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => params.setFilter('entityId', null)}
              >
                One record only · show all
              </Button>
            ) : null}
            <div className="sm:ml-auto">
              <SavedFiltersMenu listId="audit-log" />
            </div>
          </div>
        }
        empty={<EmptyState icon={ScrollText} title="No activity recorded yet" />}
        emptyFiltered={
          <EmptyState
            title="Nothing matches these filters"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />

      {selected ? (
        <AuditEntrySheet entry={selected} onClose={() => params.setFilter('id', null)} />
      ) : null}
    </>
  );
}
