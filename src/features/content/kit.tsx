'use client';

import { ArrowDown, ArrowUp, MoreHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

/** Edit / Delete actions for one row, each shown only when the role may use it. */
export function RowActions({
  label,
  onEdit,
  onDelete,
  extra,
}: {
  label: string;
  onEdit?: () => void;
  onDelete?: () => void;
  extra?: ReactNode;
}) {
  if (!onEdit && !onDelete && !extra) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit ? <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem> : null}
        {extra}
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              Delete…
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * An ordered list the admin rearranges with Move up / Move down, then saves in one request.
 * Nothing changes on the storefront until "Save order".
 */
export function ReorderList<T extends { id: string }>({
  items,
  label,
  render,
  onSave,
  canReorder,
  actions,
  empty,
}: {
  items: readonly T[];
  label: string;
  render(item: T): ReactNode;
  onSave(ids: string[]): Promise<void>;
  canReorder: boolean;
  actions?(item: T): ReactNode;
  empty?: ReactNode;
}) {
  const incoming = items.map((i) => i.id).join('|');
  // A local order is kept only while it rearranges the same rows the server sent.
  const [draft, setDraft] = useState<{ base: string; order: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const order = draft && draft.base === incoming ? draft.order : items.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const shown = order.map((id) => byId.get(id)).filter((i): i is T => Boolean(i));
  const dirty = order.join('|') !== incoming;
  const move = (index: number, by: number) => {
    const next = [...order];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved!);
    setDraft({ base: incoming, order: next });
  };

  if (items.length === 0) return <>{empty}</>;
  return (
    <div className="flex flex-col gap-2">
      <FormAlert error={error} />
      <ol className="flex flex-col divide-y rounded-md border bg-card" aria-label={label}>
        {shown.map((item, index) => (
          <li key={item.id} className="flex items-center gap-2 px-3 py-2">
            {canReorder ? (
              <span className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === shown.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown aria-hidden />
                </Button>
              </span>
            ) : null}
            <div className="min-w-0 flex-1">{render(item)}</div>
            {actions?.(item)}
          </li>
        ))}
      </ol>
      {canReorder && dirty ? (
        <div className={cn('flex items-center justify-end gap-2')}>
          <span role="status" className="mr-auto text-sm text-muted-foreground">
            Order changed — not saved yet.
          </span>
          <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
            Reset
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onSave(order);
                notifySuccess('Order saved');
              } catch (e) {
                setError(e);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save order
          </Button>
        </div>
      ) : null}
    </div>
  );
}
