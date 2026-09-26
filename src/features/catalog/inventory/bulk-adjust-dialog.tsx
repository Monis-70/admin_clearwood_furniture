'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { InventoryBulkAdjustInput } from '@shared/schemas/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { humanizeCode } from '@/lib/api/error-messages';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { formatCount, formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';

import { catalogKeys } from '../api';
import { inventoryApi } from '../products/api';

import { MANUAL_REASONS, parseBulkLines } from './model';

interface Row {
  variantId: string;
  sku: string;
  label: string;
  stockQty: number;
}
type Result = Awaited<ReturnType<typeof inventoryApi.bulkAdjust>>['results'][number];

/**
 * Several stock movements in one request. Either for selected low-stock rows (one change for all)
 * or typed "SKU, change" lines. The API applies each line on its own and reports each result.
 */
export function BulkAdjustDialog({ rows, onClose }: { rows: Row[] | null; onClose(): void }) {
  const queryClient = useQueryClient();
  const keyFor = useIdempotencyKey();
  const [delta, setDelta] = useState('');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('PURCHASE');
  const [note, setNote] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);

  const parsed = rows ? null : parseBulkLines(text);
  const n = Number(delta);
  const deltaValid = /^[+-]?\d{1,6}$/.test(delta.trim()) && n !== 0;
  const items: InventoryBulkAdjustInput['items'] = rows
    ? deltaValid
      ? rows.map((row) => ({ variantId: row.variantId, delta: n, note: note.trim() || null }))
      : []
    : (parsed?.errors.length ? [] : (parsed?.lines ?? [])).map((line) => ({
        sku: line.sku,
        delta: line.delta,
        note: note.trim() || null,
      }));

  const run = useMutation({
    mutationFn: () => {
      const body = { items, reason: reason as InventoryBulkAdjustInput['reason'] };
      return inventoryApi.bulkAdjust(body, keyFor(body));
    },
    onSuccess: (data) => {
      setResults(data.results);
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      const ok = data.results.filter((r) => r.ok).length;
      notifySuccess(
        'Stock updated',
        `${ok} of ${formatCount(data.results.length, 'change')} applied.`,
      );
    },
  });
  const skuOf = (variantId: string, index: number) =>
    rows?.find((r) => r.variantId === variantId)?.label ?? parsed?.lines[index]?.sku ?? variantId;

  return (
    <Dialog open onOpenChange={(open) => (open || run.isPending ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {rows ? `Restock ${formatCount(rows.length, 'variant')}` : 'Bulk adjust by SKU'}
          </DialogTitle>
          <DialogDescription>
            Each change is written to the stock ledger on its own; one failing line does not stop
            the others.
          </DialogDescription>
        </DialogHeader>
        {results ? (
          <div className="flex flex-col gap-3">
            <Alert
              tone={results.every((r) => r.ok) ? 'success' : 'warning'}
              title={`${results.filter((r) => r.ok).length} of ${results.length} applied`}
            />
            <ul
              tabIndex={0}
              aria-label="Result for each line"
              className="flex max-h-72 flex-col divide-y overflow-y-auto rounded-md border text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {results.map((result, index) => (
                <li
                  key={`${result.variantId}-${index}`}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="min-w-0 truncate">{skuOf(result.variantId, index)}</span>
                  {result.ok ? (
                    <span className="text-success">Now {formatNumber(result.balanceAfter)}</span>
                  ) : (
                    <span className="text-danger">{humanizeCode(result.code)}</span>
                  )}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (items.length > 0) run.mutate();
            }}
          >
            <FormAlert error={run.error} />
            {rows ? (
              <>
                <ul
                  tabIndex={0}
                  aria-label="Variants to change"
                  className="flex max-h-40 flex-col divide-y overflow-y-auto rounded-md border text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {rows.map((row) => (
                    <li key={row.variantId} className="flex justify-between gap-2 px-3 py-1.5">
                      <span className="min-w-0 truncate">{row.label}</span>
                      <span className="tabular text-muted-foreground">
                        {formatNumber(row.stockQty)}
                        {deltaValid ? ` → ${formatNumber(row.stockQty + n)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bulk-delta">Change for each (e.g. +10 or -2)</Label>
                  <Input
                    id="bulk-delta"
                    inputMode="numeric"
                    value={delta}
                    onChange={(event) => setDelta(event.target.value)}
                    aria-invalid={Boolean(delta) && !deltaValid}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-lines">One line per variant: SKU, change</Label>
                <Textarea
                  id="bulk-lines"
                  rows={8}
                  className="font-mono text-sm"
                  placeholder={'CW-SOFA-01-GRY, +5\nCW-CHAIR-02, -1'}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  aria-describedby="bulk-lines-help"
                />
                <p id="bulk-lines-help" className="text-xs text-muted-foreground">
                  {parsed && parsed.lines.length > 0 && parsed.errors.length === 0
                    ? `${parsed.lines.length} change${parsed.lines.length === 1 ? '' : 's'} ready.`
                    : 'Unknown SKUs stop the whole request, so check them first.'}
                </p>
                {parsed?.errors.length ? (
                  <Alert tone="warning" title="Fix these lines first">
                    <ul className="list-disc pl-5">
                      {parsed.errors.slice(0, 8).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </Alert>
                ) : null}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-reason">Reason</Label>
              <NativeSelect
                id="bulk-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {Object.entries(MANUAL_REASONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-note">Note (optional)</Label>
              <Input
                id="bulk-note"
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={run.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={items.length === 0} loading={run.isPending}>
                Apply {items.length || ''} change{items.length === 1 ? '' : 's'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
