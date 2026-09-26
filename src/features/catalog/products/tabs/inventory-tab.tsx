'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';

import type { AdminProductDetailDto, AdminVariantDto } from '@shared/types/catalogAdmin';

import { StatusBadge } from '@/components/patterns/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { inventoryRoutes } from '@/lib/api/routes/inventory';
import { formatNumber } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { STOCK_STATUS } from '../../model';
import { productHref } from '../model';

const StockAdjustDialog = dynamic(
  () => import('../../inventory/stock-adjust-dialog').then((m) => m.StockAdjustDialog),
  { ssr: false },
);

export const variantLabel = (variant: Pick<AdminVariantDto, 'name' | 'sku'>) =>
  variant.name ? `${variant.name} · ${variant.sku}` : variant.sku;

export function InventoryTab({ product }: { product: AdminProductDetailDto }) {
  const { canCall } = usePermissions();
  const [adjusting, setAdjusting] = useState<AdminVariantDto | null>(null);
  const canAdjust = canCall(inventoryRoutes.adjust) && !product.deletedAt;
  const variants = product.variants;

  return (
    <section aria-labelledby="stock-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="stock-heading" className="text-base font-semibold">
          Stock by variant
        </h2>
        <p className="text-sm text-muted-foreground">
          Stock is held per variant. Every change is recorded in the stock history with its reason.
        </p>
      </div>
      {product.isMadeToOrder ? (
        <Alert tone="info" title="Made to order">
          Each piece is built after the order is placed, so stock counts do not limit sales.
        </Alert>
      ) : null}
      {variants.length === 0 ? (
        <Alert tone="warning" title="No variants yet">
          Stock is tracked per variant.{' '}
          <Link href={productHref(product.id, 'variants')} className="font-medium underline">
            Add a variant
          </Link>{' '}
          first.
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Stock for each variant of {product.name}</caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Variant
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Status
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  In stock
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Reserved
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Available
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Low-stock level
                </th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map((variant) => (
                <tr
                  key={variant.id}
                  className={variant.isActive ? undefined : 'text-muted-foreground'}
                >
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {variant.name ?? 'Default'}
                    <span className="block font-mono text-xs font-normal text-muted-foreground">
                      {variant.sku}
                      {variant.isActive ? '' : ' · inactive'}
                    </span>
                  </th>
                  <td className="px-3 py-2">
                    <StatusBadge status={variant.stockStatus} registry={STOCK_STATUS} />
                  </td>
                  <td className="tabular px-3 py-2 text-right">{formatNumber(variant.stockQty)}</td>
                  <td className="tabular px-3 py-2 text-right">
                    {formatNumber(variant.reservedQty)}
                  </td>
                  <td className="tabular px-3 py-2 text-right font-medium">
                    {formatNumber(variant.availableQty)}
                  </td>
                  <td className="tabular px-3 py-2 text-right">
                    {formatNumber(variant.lowStockThreshold)}
                    {variant.allowBackorder ? (
                      <span className="block text-xs text-muted-foreground">back-orders on</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      {canCall(inventoryRoutes.history) ? (
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/catalog/inventory?variantId=${encodeURIComponent(variant.id)}`}
                          >
                            History<span className="sr-only"> for {variantLabel(variant)}</span>
                          </Link>
                        </Button>
                      ) : null}
                      {canAdjust ? (
                        <Button size="sm" variant="outline" onClick={() => setAdjusting(variant)}>
                          Adjust<span className="sr-only"> stock for {variantLabel(variant)}</span>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adjusting ? (
        <StockAdjustDialog
          variantId={adjusting.id}
          label={`${product.name} — ${variantLabel(adjusting)}`}
          productId={product.id}
          onClose={() => setAdjusting(null)}
        />
      ) : null}
    </section>
  );
}
