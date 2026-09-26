'use client';

import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Plus, type LucideIcon } from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';

import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { notifySuccess } from '@/lib/notify';
import { cachePolicy } from '@/lib/query/policies';

import { ReorderList, RowActions } from './kit';

export interface RecordDialogProps<T> {
  row: T | null;
  onClose(): void;
  onSaved(): void;
}

/**
 * A position-ordered CMS list (testimonials, stores…): add, edit, delete with confirmation and
 * reorder with an explicit save. Each action appears only when the role may call its route.
 */
export function OrderedContent<T extends { id: string; position: number }>({
  title,
  description,
  noun,
  icon,
  queryKey,
  load,
  render,
  labelOf,
  Dialog,
  can,
  remove,
  reorder,
  deleteWarning,
  emptyHint,
}: {
  title: string;
  description: string;
  noun: string;
  icon: LucideIcon;
  queryKey: QueryKey;
  load(signal: AbortSignal): Promise<T[]>;
  render(row: T): ReactNode;
  labelOf(row: T): string;
  Dialog: ComponentType<RecordDialogProps<T>>;
  can: { create: boolean; edit: boolean; remove: boolean; reorder: boolean };
  remove(id: string): Promise<void>;
  reorder(ids: string[]): Promise<void>;
  deleteWarning: string;
  /** What the first record is for, shown while the list is empty. */
  emptyHint: string;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [removing, setRemoving] = useState<T | null>(null);
  const rows = useQuery({
    queryKey,
    queryFn: ({ signal }) => load(signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey });

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          can.create ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New {noun}
            </Button>
          ) : null
        }
      />
      {rows.isPending ? (
        <SectionLoader label={`Loading ${title.toLowerCase()}…`} />
      ) : rows.error ? (
        <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />
      ) : (
        <ReorderList
          items={[...rows.data].sort((a, b) => a.position - b.position)}
          label={title}
          canReorder={can.reorder}
          render={render}
          onSave={async (ids) => {
            await reorder(ids);
            refresh();
          }}
          actions={(row) => (
            <RowActions
              label={labelOf(row)}
              onEdit={can.edit ? () => setEditing(row) : undefined}
              onDelete={can.remove ? () => setRemoving(row) : undefined}
            />
          )}
          empty={
            <EmptyState
              icon={icon}
              title={`No ${title.toLowerCase()} yet`}
              description={emptyHint}
              action={
                can.create ? (
                  <Button onClick={() => setEditing('new')}>Add the first {noun}</Button>
                ) : null
              }
            />
          }
        />
      )}
      {editing ? (
        <Dialog
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
          title={`Delete "${labelOf(removing)}"?`}
          description={deleteWarning}
          confirmLabel={`Delete ${noun}`}
          level="destructive"
          onConfirm={async () => {
            await remove(removing.id);
            refresh();
            notifySuccess(`${noun[0]!.toUpperCase()}${noun.slice(1)} deleted`);
          }}
        />
      ) : null}
    </>
  );
}
