'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { contentRoutes } from '@/lib/api/routes/content';
import { formatDateTime } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { contentApi, contentKeys, type AnnouncementRow } from './api';
import { RowActions } from './kit';
import { DEVICE_LABELS, windowLabel } from './model';

const AnnouncementDialog = dynamic(
  () => import('./dialogs/announcement-dialog').then((m) => m.AnnouncementDialog),
  { ssr: false },
);

export function AnnouncementsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(contentRoutes.announcements))
    return <PermissionNotice area="announcements" all={['cms.banner.read']} />;
  return <Announcements />;
}

function Announcements() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<AnnouncementRow | null>(null);
  const rows = useQuery({
    queryKey: contentKeys.announcements(),
    queryFn: ({ signal }) => contentApi.announcements(signal),
    ...cachePolicy.list,
  });
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: contentKeys.announcements() });
  const canEdit = canCall(contentRoutes.updateAnnouncement);
  const canDelete = canCall(contentRoutes.removeAnnouncement);

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Short messages in the bar above the storefront header, e.g. delivery notices or a sale."
        actions={
          canCall(contentRoutes.createAnnouncement) ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New announcement
            </Button>
          ) : null
        }
      />
      {rows.isPending ? (
        <SectionLoader label="Loading announcements…" />
      ) : rows.error ? (
        <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />
      ) : rows.data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description="The bar is hidden while there are none."
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-md border bg-card" aria-label="Announcements">
          {[...rows.data]
            .sort((a, b) => a.position - b.position)
            .map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="mt-1 size-4 shrink-0 rounded border"
                  style={{ background: row.backgroundHex ?? undefined }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium">{row.message}</span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Badge tone={row.isActive ? 'success' : 'neutral'}>
                      {row.isActive ? 'On' : 'Off'}
                    </Badge>
                    <span>{windowLabel(row.startsAt, row.endsAt, formatDateTime)}</span>
                    <span>{DEVICE_LABELS[row.deviceVisibility] ?? row.deviceVisibility}</span>
                    {row.linkUrl ? (
                      <span className="font-mono">
                        {row.linkLabel ? `${row.linkLabel} → ` : ''}
                        {row.linkUrl}
                      </span>
                    ) : null}
                    <span>Order {row.position}</span>
                  </span>
                </div>
                <RowActions
                  label={row.message}
                  onEdit={canEdit ? () => setEditing(row) : undefined}
                  onDelete={canDelete ? () => setRemoving(row) : undefined}
                />
              </li>
            ))}
        </ul>
      )}
      {editing ? (
        <AnnouncementDialog
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title="Delete this announcement?"
          description={`"${removing.message}" disappears from the storefront at once.`}
          confirmLabel="Delete announcement"
          level="destructive"
          onConfirm={async () => {
            await contentApi.removeAnnouncement(removing.id);
            refresh();
            notifySuccess('Announcement deleted');
          }}
        />
      ) : null}
    </>
  );
}
