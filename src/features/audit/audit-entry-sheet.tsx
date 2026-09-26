'use client';

import type { AuditLogDto } from '@shared/types/auth';

import { KeyValueList } from '@/components/patterns/key-value-list';
import { StatusBadge } from '@/components/patterns/status-badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDateTime } from '@/lib/format/datetime';

import { AUDIT_ACTION_LABELS, AUDIT_SEVERITY, entityLabel } from './model';

function Structured({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="max-h-80 overflow-auto rounded-md bg-muted/60 p-3 font-mono text-xs break-all whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** One audit entry in full: who, what, from where, and the recorded before/after values. */
export function AuditEntrySheet({ entry, onClose }: { entry: AuditLogDto; onClose(): void }) {
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>
            {AUDIT_ACTION_LABELS[entry.action] ?? entry.action} · {entityLabel(entry.entity)}
          </SheetTitle>
          <SheetDescription>{formatDateTime(entry.createdAt)}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          <KeyValueList
            items={[
              {
                label: 'Severity',
                value: <StatusBadge status={entry.severity} registry={AUDIT_SEVERITY} />,
              },
              { label: 'By', value: entry.actorName ?? entry.actorType },
              { label: 'Email', value: entry.actorEmail ?? '—' },
              {
                label: 'Record id',
                value: <span className="font-mono text-xs">{entry.entityId ?? '—'}</span>,
              },
              { label: 'IP address', value: entry.ip ?? '—' },
              { label: 'Device', value: entry.userAgent ?? '—' },
              {
                label: 'Request',
                value: <span className="font-mono text-xs">{entry.requestId ?? '—'}</span>,
              },
            ]}
          />
          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">Changes</h3>
            <Structured value={entry.changes} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">Details</h3>
            <Structured value={entry.meta} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
