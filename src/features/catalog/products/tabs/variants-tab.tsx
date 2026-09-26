'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Star, Wand2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import type { AdminProductDetailDto, AdminVariantDto } from '@shared/types/catalogAdmin';

import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { StatusBadge } from '@/components/patterns/status-badge';
import { EmptyState } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { variantsRoutes } from '@/lib/api/routes/variants';
import { formatNumber } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { catalogKeys } from '../../api';
import { useAttributeOptions } from '../../lookups';
import { STOCK_STATUS, formatRupees } from '../../model';
import type { AttributeRow } from '../../taxonomy/api';
import { productKeys, variantsApi } from '../api';

const VariantDialog = dynamic(() => import('./variant-dialog').then((m) => m.VariantDialog), {
  ssr: false,
});
const MatrixGenerator = dynamic(() => import('./matrix-generator').then((m) => m.MatrixGenerator), {
  ssr: false,
});

/** The option attributes this product's variants use, in attribute order. */
export function optionAttributes(
  variants: readonly AdminVariantDto[],
  attributes: readonly AttributeRow[],
): AttributeRow[] {
  const used = new Set(
    variants.flatMap((variant) => variant.attributeValues.map((v) => v.attributeId)),
  );
  return attributes
    .filter((attribute) => used.has(attribute.id))
    .sort((a, b) => a.position - b.position);
}

export function valueLabel(
  attributes: readonly AttributeRow[],
  attributeId: string,
  valueId: string,
) {
  return (
    attributes.find((a) => a.id === attributeId)?.values.find((v) => v.id === valueId)?.label ?? '—'
  );
}

export function VariantsTab({ product }: { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const { canCall } = usePermissions();
  const attributes = useAttributeOptions();
  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; variant: AdminVariantDto } | null
  >(null);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<AdminVariantDto | null>(null);
  const editable = !product.deletedAt;
  const can = {
    create: editable && canCall(variantsRoutes.create),
    update: editable && canCall(variantsRoutes.update),
    remove: editable && canCall(variantsRoutes.remove),
    generate:
      editable && canCall(variantsRoutes.matrixPreview) && canCall(variantsRoutes.matrixGenerate),
  };
  const variants = [...product.variants].sort((a, b) => a.position - b.position);
  const options = optionAttributes(variants, attributes.data ?? []);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: productKeys.detail(product.id) });
    void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
  };

  const setDefault = useMutation({
    mutationFn: (variant: AdminVariantDto) => variantsApi.setDefault(product.id, variant.id),
    onSuccess: (_, variant) => {
      refresh();
      notifySuccess('Default variant changed', `${variant.name ?? variant.sku} is shown first.`);
    },
    onError: (error) => notifyError(error, 'Could not change the default'),
  });

  const move = useMutation({
    mutationFn: async ({ index, by }: { index: number; by: -1 | 1 }) => {
      const next = [...variants];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item!);
      await variantsApi.reorder(
        product.id,
        next.map((variant, position) => ({ id: variant.id, position })),
      );
    },
    onSuccess: refresh,
    onError: (error) => notifyError(error, 'Could not reorder'),
  });

  return (
    <section aria-labelledby="variants-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="variants-heading" className="text-base font-semibold">
            Variants
          </h2>
          <p className="text-sm text-muted-foreground">
            Each sellable combination of options (for example Colour × Material) with its own SKU,
            price and stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can.generate ? (
            <Button variant="outline" size="sm" onClick={() => setGenerating(true)}>
              <Wand2 aria-hidden />
              Generate combinations
            </Button>
          ) : null}
          {can.create ? (
            <Button size="sm" onClick={() => setDialog({ mode: 'create' })}>
              <Plus aria-hidden />
              Add variant
            </Button>
          ) : null}
        </div>
      </div>

      {variants.length === 0 ? (
        <EmptyState
          title="No variants yet"
          description="A product needs at least one active variant before it can be published. Add one, or generate every combination of its options."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Variants of {product.name}: options, SKU, price and stock
            </caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                {options.map((attribute) => (
                  <th key={attribute.id} scope="col" className="px-3 py-2 font-medium">
                    {attribute.name}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-medium">
                  SKU
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Price
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Stock
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Status
                </th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map((variant, index) => {
                const title = variant.name ?? variant.sku;
                return (
                  <tr
                    key={variant.id}
                    className={variant.isActive ? undefined : 'text-muted-foreground'}
                  >
                    {options.map((attribute) => {
                      const value = variant.attributeValues.find(
                        (v) => v.attributeId === attribute.id,
                      );
                      return (
                        <td key={attribute.id} className="px-3 py-2">
                          {value ? valueLabel(options, attribute.id, value.attributeValueId) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      <span className="font-mono">{variant.sku}</span>
                      {variant.isDefault ? (
                        <Badge tone="info" className="ml-2">
                          Default
                        </Badge>
                      ) : null}
                      {options.length === 0 && variant.name ? (
                        <span className="block text-xs text-muted-foreground">{variant.name}</span>
                      ) : null}
                    </td>
                    <td className="tabular px-3 py-2 text-right">
                      {variant.pricePaise === null ? (
                        <span className="text-muted-foreground">Base price</span>
                      ) : (
                        formatRupees(variant.pricePaise)
                      )}
                    </td>
                    <td className="tabular px-3 py-2 text-right">
                      {formatNumber(variant.stockQty)}
                    </td>
                    <td className="px-3 py-2">
                      {variant.isActive ? (
                        <StatusBadge status={variant.stockStatus} registry={STOCK_STATUS} />
                      ) : (
                        <Badge tone="neutral">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {can.update || can.remove ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${title}`}
                            >
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {can.update ? (
                              <>
                                <DropdownMenuItem
                                  onSelect={() => setDialog({ mode: 'edit', variant })}
                                >
                                  Edit variant
                                </DropdownMenuItem>
                                {!variant.isDefault && variant.isActive ? (
                                  <DropdownMenuItem onSelect={() => setDefault.mutate(variant)}>
                                    <Star aria-hidden />
                                    Make default
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  disabled={index === 0}
                                  onSelect={() => move.mutate({ index, by: -1 })}
                                >
                                  <ArrowUp aria-hidden />
                                  Move up
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={index === variants.length - 1}
                                  onSelect={() => move.mutate({ index, by: 1 })}
                                >
                                  <ArrowDown aria-hidden />
                                  Move down
                                </DropdownMenuItem>
                              </>
                            ) : null}
                            {can.remove ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => setDeleting(variant)}
                                >
                                  Delete variant
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {variants.length > 0 && !variants.some((variant) => variant.isActive) ? (
        <Alert tone="warning" title="No active variant">
          Activate at least one variant, or the product cannot be published.
        </Alert>
      ) : null}

      {dialog ? (
        <VariantDialog
          product={product}
          variant={dialog.mode === 'edit' ? dialog.variant : null}
          attributes={attributes.data ?? []}
          options={options}
          onClose={() => setDialog(null)}
          onSaved={refresh}
        />
      ) : null}
      {generating ? (
        <MatrixGenerator
          product={product}
          attributes={attributes.data ?? []}
          options={options}
          onClose={() => setGenerating(false)}
          onGenerated={refresh}
        />
      ) : null}
      {deleting ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setDeleting(null))}
          title={`Delete variant ${deleting.sku}?`}
          description="The variant and its stock history are removed from this product. Orders that already contain it keep their copy."
          impact={
            deleting.stockQty > 0 ? (
              <p className="text-sm">
                It still has {formatNumber(deleting.stockQty)} units in stock.
              </p>
            ) : undefined
          }
          confirmLabel="Delete variant"
          level="irreversible"
          confirmText={deleting.sku}
          onConfirm={async () => {
            await variantsApi.remove(product.id, deleting.id);
            refresh();
            notifySuccess('Variant deleted');
          }}
        />
      ) : null}
    </section>
  );
}
