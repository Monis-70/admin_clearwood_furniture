'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { BulkActionType, Permission } from '@shared/enums';
import type { AdminProductSummaryDto, BulkActionResultDto } from '@shared/types/catalogAdmin';

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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from '../api';
import { flattenTree, useBrandOptions, useCategoryOptions, useTaxClassOptions } from '../lookups';

import { productsApi, type BulkInput } from './api';

type Target = 'category' | 'collection' | 'brand' | 'taxClass';

interface BulkOption {
  action: BulkActionType;
  label: string;
  /** Checked again by the API for every product; this only hides what the role cannot do. */
  permission: Permission;
  target?: Target;
  destructive?: boolean;
  explain: string;
}

const OPTIONS: readonly BulkOption[] = [
  {
    action: 'PUBLISH',
    label: 'Publish',
    permission: 'catalog.product.publish',
    explain: 'Products that pass their publishing checklist go live; the others are reported.',
  },
  {
    action: 'UNPUBLISH',
    label: 'Unpublish',
    permission: 'catalog.product.publish',
    explain: 'Hidden from customers immediately.',
  },
  {
    action: 'DEACTIVATE',
    label: 'Set back to draft',
    permission: 'catalog.product.update',
    explain: 'Status becomes Draft; customers cannot see them.',
  },
  {
    action: 'ADD_CATEGORY',
    label: 'Also list in a category',
    permission: 'catalog.product.update',
    target: 'category',
    explain: 'Adds the category; the primary category stays.',
  },
  {
    action: 'MOVE_CATEGORY',
    label: 'Change primary category',
    permission: 'catalog.product.update',
    target: 'category',
    explain: 'Replaces the primary category.',
  },
  {
    action: 'REMOVE_CATEGORY',
    label: 'Remove from a category',
    permission: 'catalog.product.update',
    target: 'category',
    explain: 'Removes an extra category listing.',
  },
  {
    action: 'ASSIGN_COLLECTION',
    label: 'Add to a collection',
    permission: 'catalog.collection.update',
    target: 'collection',
    explain: 'Manual collections only.',
  },
  {
    action: 'SET_BRAND',
    label: 'Set brand',
    permission: 'catalog.product.update',
    target: 'brand',
    explain: 'Replaces the brand.',
  },
  {
    action: 'SET_TAX_CLASS',
    label: 'Set tax class',
    permission: 'pricing.tax.update',
    target: 'taxClass',
    explain: 'Changes the GST rate applied at checkout.',
  },
  {
    action: 'RESTORE',
    label: 'Restore from trash',
    permission: 'catalog.product.update',
    explain: 'Deleted products come back as they were.',
  },
  {
    action: 'DELETE',
    label: 'Move to trash',
    permission: 'catalog.product.delete',
    destructive: true,
    explain: 'Removed from the storefront and lists; can be restored.',
  },
];

/** Bulk actions on the selected products, through `POST /catalog/bulk` (per-product results). */
export function BulkActions({
  selected,
  onDone,
}: {
  selected: AdminProductSummaryDto[];
  onDone(): void;
}) {
  const { allows } = usePermissions();
  const available = OPTIONS.filter((option) => allows({ all: [option.permission] }));
  const [action, setAction] = useState<BulkActionType | ''>('');
  const [confirming, setConfirming] = useState(false);
  if (available.length === 0) return null;
  const option = available.find((o) => o.action === action);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="bulk-action" className="sr-only">
        Action for the selected products
      </Label>
      <NativeSelect
        id="bulk-action"
        size="sm"
        value={action}
        onChange={(event) => setAction(event.target.value as BulkActionType)}
      >
        <option value="">Choose an action…</option>
        {available.map((o) => (
          <option key={o.action} value={o.action}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <Button size="sm" disabled={!option} onClick={() => setConfirming(true)}>
        Apply to {selected.length}
      </Button>
      {confirming && option ? (
        <BulkDialog
          option={option}
          selected={selected}
          onClose={(done) => {
            setConfirming(false);
            if (done) {
              setAction('');
              onDone();
            }
          }}
        />
      ) : null}
    </div>
  );
}

function BulkDialog({
  option,
  selected,
  onClose,
}: {
  option: BulkOption;
  selected: AdminProductSummaryDto[];
  onClose(done: boolean): void;
}) {
  const queryClient = useQueryClient();
  const keyFor = useIdempotencyKey();
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<BulkActionResultDto | null>(null);
  const categories = useCategoryOptions(option.target === 'category');
  const brands = useBrandOptions(option.target === 'brand');
  const taxClasses = useTaxClassOptions(option.target === 'taxClass');
  const collections = useQuery({
    queryKey: catalogKeys.collections({ page: 1, limit: 100, order: 'asc' }),
    queryFn: ({ signal }) => catalogApi.collections({ page: 1, limit: 100, order: 'asc' }, signal),
    enabled: option.target === 'collection',
    ...cachePolicy.reference,
  });

  const choices: { value: string; label: string }[] =
    option.target === 'category'
      ? flattenTree(categories.data ?? []).map((c) => ({
          value: c.id,
          label: `${'\u00a0\u00a0'.repeat(c.depth)}${c.name}`,
        }))
      : option.target === 'collection'
        ? (collections.data?.items ?? [])
            .filter((c) => c.type === 'MANUAL')
            .map((c) => ({ value: c.id, label: c.name }))
        : option.target === 'brand'
          ? (brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))
          : option.target === 'taxClass'
            ? (taxClasses.data ?? []).map((t) => ({ value: t.id, label: t.name }))
            : [];

  const run = useMutation({
    mutationFn: () => {
      const body: BulkInput = {
        action: option.action,
        ids: selected.map((p) => p.id),
        ...(option.target === 'category' ? { categoryId: target } : {}),
        ...(option.target === 'collection' ? { collectionId: target } : {}),
        ...(option.target === 'brand' ? { brandId: target } : {}),
        ...(option.target === 'taxClass' ? { taxClassId: target } : {}),
      };
      return productsApi.bulk(body, keyFor(body));
    },
    onSuccess: (outcome) => {
      setResult(outcome);
      void queryClient.invalidateQueries({ queryKey: ['product'] });
    },
  });

  // The list refreshes once the summary is closed: refreshing now would drop the changed rows,
  // empty the selection and unmount this dialog before its per-product results are read.
  const close = (done: boolean) => {
    if (result) void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    onClose(done);
  };

  const names = new Map(selected.map((p) => [p.id, p.name]));

  return (
    <Dialog
      open
      onOpenChange={(open) => (open || run.isPending ? undefined : close(Boolean(result)))}
    >
      <DialogContent className="sm:max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {result.failed === 0 ? 'Done' : `${result.succeeded} of ${result.requested} done`}
              </DialogTitle>
              <DialogDescription>
                {option.label}: {result.succeeded} succeeded, {result.failed} failed.
              </DialogDescription>
            </DialogHeader>
            {result.failed > 0 ? (
              <ul
                tabIndex={0}
                className="max-h-64 overflow-y-auto rounded-md border text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="Products that were not changed"
              >
                {result.results
                  .filter((item) => !item.ok)
                  .map((item) => (
                    <li key={item.id} className="border-b px-3 py-2 last:border-0">
                      <span className="font-medium">{names.get(item.id) ?? item.id}</span>
                      <span className="block text-muted-foreground">
                        {item.message ?? item.code}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : null}
            <DialogFooter>
              <Button onClick={() => close(true)}>Close</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {option.label}: {selected.length} product{selected.length === 1 ? '' : 's'}
              </DialogTitle>
              <DialogDescription>{option.explain}</DialogDescription>
            </DialogHeader>
            <FormAlert error={run.error} />
            {option.target ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-target">
                  {option.target === 'taxClass'
                    ? 'Tax class'
                    : option.target[0]!.toUpperCase() + option.target.slice(1)}
                </Label>
                <NativeSelect
                  id="bulk-target"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">Choose…</option>
                  {choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
            <div
              tabIndex={0}
              role="region"
              aria-label="Selected products"
              className="max-h-40 overflow-y-auto rounded-md border bg-muted/40 p-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Affects exactly these products:
              </p>
              <ul className="list-disc pl-5">
                {selected.map((product) => (
                  <li key={product.id}>{product.name}</li>
                ))}
              </ul>
            </div>
            {option.destructive ? (
              <Alert tone="warning" title="They leave the storefront now">
                Live products stop selling immediately.
              </Alert>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => onClose(false)} disabled={run.isPending}>
                Cancel
              </Button>
              <Button
                variant={option.destructive ? 'destructive' : 'default'}
                disabled={Boolean(option.target) && !target}
                loading={run.isPending}
                onClick={() => run.mutate()}
              >
                {option.label} {selected.length}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
