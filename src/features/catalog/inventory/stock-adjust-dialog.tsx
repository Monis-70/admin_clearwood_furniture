'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { InventoryAdjustInput } from '@shared/schemas/catalogAdmin';
import type { InventorySnapshotDto } from '@shared/types/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { SectionLoader } from '@/components/patterns/states';
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
import { hasCode } from '@/lib/api/errors';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { cachePolicy } from '@/lib/query/policies';

import { catalogKeys } from '../api';
import { inventoryApi, productKeys } from '../products/api';

import { MANUAL_REASONS } from './model';

type Mode = 'add' | 'remove' | 'set';

/**
 * One stock movement, written through the inventory ledger. The dialog states the exact before and
 * after quantity, sends the balance it was based on (a concurrent change is refused, never
 * overwritten) and a single idempotency key per attempt, so a double click cannot count twice.
 */
export function StockAdjustDialog({
  variantId,
  label,
  productId,
  onClose,
}: {
  variantId: string;
  label: string;
  productId?: string;
  onClose(): void;
}) {
  const queryClient = useQueryClient();
  const snapshot = useQuery({
    queryKey: productKeys.stock(variantId),
    queryFn: ({ signal }) => inventoryApi.snapshot(variantId, signal),
    ...cachePolicy.detail,
    staleTime: 0,
  });
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('PURCHASE');
  const [note, setNote] = useState('');
  const keyFor = useIdempotencyKey();

  const quantity = /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : null;
  const current = snapshot.data?.stockQty ?? null;
  const after =
    current === null || quantity === null
      ? null
      : mode === 'add'
        ? current + quantity
        : mode === 'remove'
          ? current - quantity
          : quantity;

  const adjust = useMutation({
    mutationFn: (base: InventorySnapshotDto) => {
      const body = {
        ...(mode === 'set'
          ? { absolute: quantity! }
          : { delta: mode === 'add' ? quantity! : -quantity! }),
        reason: reason as InventoryAdjustInput['reason'],
        note: note.trim() || null,
        expectedBalance: base.stockQty,
      };
      return inventoryApi.adjust(variantId, body, keyFor(body));
    },
    onSuccess: (result) => {
      queryClient.setQueryData(productKeys.stock(variantId), result.snapshot);
      void queryClient.invalidateQueries({ queryKey: ['inventory', variantId] });
      if (productId)
        void queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      notifySuccess(
        'Stock updated',
        `${label}: ${formatNumber(result.snapshot.stockQty)} in stock.`,
      );
      onClose();
    },
    onError: (error) => {
      if (hasCode(error, 'INVENTORY_CONFLICT')) void snapshot.refetch();
    },
  });

  const valid = quantity !== null && (mode === 'set' || quantity > 0) && after !== null;

  return (
    <Dialog open onOpenChange={(open) => (open || adjust.isPending ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        {snapshot.isPending ? (
          <SectionLoader label="Loading current stock…" />
        ) : snapshot.error ? (
          <FormAlert error={snapshot.error} />
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid && snapshot.data) adjust.mutate(snapshot.data);
            }}
          >
            <FormAlert error={adjust.error} />
            <dl className="grid grid-cols-3 gap-2 rounded-md border bg-muted/40 p-3 text-center text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">In stock</dt>
                <dd className="tabular font-semibold">{formatNumber(snapshot.data.stockQty)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Reserved</dt>
                <dd className="tabular font-semibold">{formatNumber(snapshot.data.reservedQty)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Available</dt>
                <dd className="tabular font-semibold">
                  {formatNumber(snapshot.data.availableQty)}
                </dd>
              </div>
            </dl>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Change</legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['add', 'Add'],
                    ['remove', 'Remove'],
                    ['set', 'Set to'],
                  ] as const
                ).map(([value, text]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name="stock-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(value)}
                      className="accent-primary"
                    />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stock-amount">{mode === 'set' ? 'New quantity' : 'Quantity'}</Label>
              <Input
                id="stock-amount"
                inputMode="numeric"
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-describedby="stock-result"
              />
              <p id="stock-result" role="status" className="text-sm">
                {after === null ? (
                  <span className="text-muted-foreground">Enter a whole number.</span>
                ) : (
                  <>
                    Stock goes from <strong className="tabular">{formatNumber(current)}</strong> to{' '}
                    <strong className="tabular">{formatNumber(after)}</strong>
                    {after < snapshot.data.reservedQty && !snapshot.data.allowBackorder ? (
                      <span className="block text-destructive">
                        That is below the {formatNumber(snapshot.data.reservedQty)} reserved for
                        open orders; the API will refuse it.
                      </span>
                    ) : null}
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stock-reason">Reason</Label>
              <NativeSelect
                id="stock-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {Object.entries(MANUAL_REASONS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stock-note">Note (optional)</Label>
              <Textarea
                id="stock-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Invoice 4417 from the timber yard"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={adjust.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid} loading={adjust.isPending}>
                Save stock change
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
