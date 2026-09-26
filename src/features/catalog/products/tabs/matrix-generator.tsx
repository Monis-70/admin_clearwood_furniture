'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { VariantMatrixInput } from '@shared/schemas/catalogAdmin';
import type { AdminProductDetailDto, VariantMatrixPreviewDto } from '@shared/types/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';

import type { AttributeRow } from '../../taxonomy/api';
import { variantsApi } from '../api';

/**
 * Every combination of the chosen option values. The API previews which combinations already
 * exist and which are new, and generates only the new ones; duplicates are never created.
 */
export function MatrixGenerator({
  product,
  attributes,
  options,
  onClose,
  onGenerated,
}: {
  product: AdminProductDetailDto;
  attributes: readonly AttributeRow[];
  options: readonly AttributeRow[];
  onClose(): void;
  onGenerated(): void;
}) {
  const candidates = attributes.filter(
    (a) => a.isVariantDefining && a.isActive && a.values.length > 0,
  );
  const inUse = new Map<string, Set<string>>();
  for (const variant of product.variants) {
    for (const value of variant.attributeValues) {
      inUse.set(
        value.attributeId,
        (inUse.get(value.attributeId) ?? new Set()).add(value.attributeValueId),
      );
    }
  }
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(options.map((a) => [a.id, [...(inUse.get(a.id) ?? [])]])),
  );
  const [skuPattern, setSkuPattern] = useState('{PRODUCT_SKU}-{INDEX}');
  const [preview, setPreview] = useState<VariantMatrixPreviewDto | null>(null);
  const keyFor = useIdempotencyKey();

  const chosen = candidates.filter((a) => (selected[a.id]?.length ?? 0) > 0);
  const input: VariantMatrixInput = {
    attributeIds: chosen.map((a) => a.id),
    selectedValueIdsByAttribute: Object.fromEntries(chosen.map((a) => [a.id, selected[a.id]!])),
    skuPattern,
    pricingMode: 'INHERIT',
  };
  const expected = chosen.reduce((total, a) => total * (selected[a.id]?.length ?? 0), 1);

  const runPreview = useMutation({
    mutationFn: () => variantsApi.preview(product.id, input),
    onSuccess: setPreview,
  });
  const generate = useMutation({
    mutationFn: () => variantsApi.generate(product.id, input, keyFor(input)),
    onSuccess: (result) => {
      notifySuccess(
        result.created === 0
          ? 'Nothing to add'
          : `${result.created} variant${result.created === 1 ? '' : 's'} created`,
        result.created === 0 ? 'Every combination already exists.' : undefined,
      );
      onGenerated();
      onClose();
    },
  });

  const toggle = (attributeId: string, valueId: string, on: boolean) => {
    setPreview(null);
    setSelected((current) => {
      const list = current[attributeId] ?? [];
      return {
        ...current,
        [attributeId]: on ? [...list, valueId] : list.filter((v) => v !== valueId),
      };
    });
  };

  return (
    <Dialog open onOpenChange={(open) => (open || generate.isPending ? undefined : onClose())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Generate combinations</DialogTitle>
          <DialogDescription>
            Pick the option values to sell. Combinations that already exist are kept as they are.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormAlert error={runPreview.error ?? generate.error} />
          {candidates.length === 0 ? (
            <Alert tone="warning" title="No option attributes">
              Mark an attribute as &ldquo;defines variants&rdquo; and give it values first.
            </Alert>
          ) : (
            candidates.map((attribute) => (
              <fieldset key={attribute.id} className="flex flex-col gap-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">
                  {attribute.name}
                  {(selected[attribute.id]?.length ?? 0) > 0 ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {selected[attribute.id]!.length} chosen
                    </span>
                  ) : null}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {attribute.values
                    .filter((value) => value.isActive)
                    .map((value) => {
                      const on = selected[attribute.id]?.includes(value.id) ?? false;
                      return (
                        <label
                          key={value.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={on}
                            onChange={(event) =>
                              toggle(attribute.id, value.id, event.target.checked)
                            }
                          />
                          {value.colorHex ? (
                            <span
                              aria-hidden
                              className="size-3.5 rounded-full border"
                              style={{ backgroundColor: value.colorHex }}
                            />
                          ) : null}
                          {value.label}
                        </label>
                      );
                    })}
                </div>
              </fieldset>
            ))
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sku-pattern">SKU pattern</Label>
            <Input
              id="sku-pattern"
              value={skuPattern}
              onChange={(event) => {
                setPreview(null);
                setSkuPattern(event.target.value);
              }}
              aria-describedby="sku-pattern-help"
            />
            <p id="sku-pattern-help" className="text-xs text-muted-foreground">
              Placeholders such as {'{PRODUCT_SKU}'} and {'{INDEX}'} are filled in by the server.
            </p>
          </div>
          <p role="status" className="text-sm">
            {chosen.length === 0
              ? 'Choose at least one value.'
              : `${formatNumber(expected)} combination${expected === 1 ? '' : 's'} from ${chosen.map((a) => a.name).join(' × ')}.`}
          </p>

          {preview ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                <strong>{preview.newCount}</strong> new, <strong>{preview.existingCount}</strong>{' '}
                already exist.
              </p>
              {preview.orphanedVariantIds.length > 0 ? (
                <Alert tone="warning" title="Some variants fall outside this selection">
                  {preview.orphanedVariantIds.length} existing variant
                  {preview.orphanedVariantIds.length === 1 ? '' : 's'} use values you did not
                  choose. They are not deleted; deactivate them afterwards if they should no longer
                  be sold.
                </Alert>
              ) : null}
              <div
                tabIndex={0}
                role="region"
                aria-label="Combination preview"
                className="max-h-72 overflow-auto rounded-md border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <table className="w-full text-sm">
                  <caption className="sr-only">Combinations the generator would create</caption>
                  <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      {chosen.map((attribute) => (
                        <th key={attribute.id} scope="col" className="px-3 py-2 font-medium">
                          {attribute.name}
                        </th>
                      ))}
                      <th scope="col" className="px-3 py-2 font-medium">
                        SKU
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.combinations.map((combination) => (
                      <tr key={combination.key}>
                        {chosen.map((attribute) => (
                          <td key={attribute.id} className="px-3 py-1.5">
                            {combination.values.find((v) => v.attributeId === attribute.id)
                              ?.label ?? '—'}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 font-mono text-xs">{combination.sku}</td>
                        <td className="px-3 py-1.5">
                          {combination.exists ? (
                            <Badge tone="neutral">Exists</Badge>
                          ) : (
                            <Badge tone="success">New</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={generate.isPending}>
            Cancel
          </Button>
          {preview ? (
            <Button
              type="button"
              disabled={preview.newCount === 0}
              loading={generate.isPending}
              onClick={() => generate.mutate()}
            >
              Create {preview.newCount} variant{preview.newCount === 1 ? '' : 's'}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={chosen.length === 0 || !skuPattern.trim()}
              loading={runPreview.isPending}
              onClick={() => runPreview.mutate()}
            >
              Preview combinations
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
