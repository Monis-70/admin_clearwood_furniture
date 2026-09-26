'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cachePolicy } from '@/lib/query/policies';

import { formatRupees } from '../catalog/model';
import { productKeys, productsApi } from '../catalog/products/api';
import { productHref } from '../catalog/products/href';
import { ProductTiers } from '../catalog/products/tabs/pricing/tiers-and-explain';

import { percent } from './lookups';
import { ProductPicker, type PickedProduct } from './product-picker';
import { rulesApi, rulesKeys } from './rules-api';

/** Quantity tiers across the catalog, and a product's tiers to edit. */
export function TierPricesPanel() {
  const [picked, setPicked] = useState<PickedProduct | null>(null);
  const product = useQuery({
    queryKey: productKeys.detail(picked?.id ?? ''),
    queryFn: ({ signal }) => productsApi.get(picked!.id, signal),
    enabled: Boolean(picked),
    ...cachePolicy.detail,
  });
  const query = { page: 1, limit: 25 };
  const all = useQuery({
    queryKey: rulesKeys.tiers(query),
    queryFn: ({ signal }) => rulesApi.tiers(query, signal),
    ...cachePolicy.list,
  });

  return (
    <section aria-labelledby="tiers-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="tiers-heading" className="text-lg font-semibold">
          Quantity tiers
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a product to see and change its tiers. They are also on each product&apos;s Pricing
          tab.
        </p>
      </div>
      {picked ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{picked.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{picked.sku}</span>
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
              Choose another product
            </Button>
          </div>
          {product.isPending ? (
            <SectionLoader label="Loading product…" />
          ) : product.error ? (
            <ErrorState error={product.error} onRetry={() => void product.refetch()} compact />
          ) : (
            <ProductTiers product={product.data} />
          )}
        </div>
      ) : (
        <ProductPicker onPick={setPicked} />
      )}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Latest tiers across the catalog</h3>
        {all.isPending ? (
          <SectionLoader label="Loading tiers…" />
        ) : all.error ? (
          <ErrorState error={all.error} onRetry={() => void all.refetch()} compact />
        ) : all.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quantity tiers yet.</p>
        ) : (
          <ul
            className="flex flex-col divide-y rounded-md border text-sm"
            aria-label="Quantity tiers across the catalog"
          >
            {all.data.items.map((tier) => (
              <li key={tier.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span>From {tier.minQty} units:</span>
                <span className="font-medium">
                  {tier.pricePaise !== null
                    ? `${formatRupees(tier.pricePaise)} each`
                    : `${percent(tier.discountBp)} off`}
                </span>
                {tier.isActive ? null : <Badge tone="neutral">Off</Badge>}
                {tier.productId ? (
                  <Link
                    className="ml-auto underline-offset-2 hover:underline"
                    href={productHref(tier.productId, 'pricing')}
                  >
                    Open product
                  </Link>
                ) : (
                  <span className="ml-auto text-muted-foreground">A variant</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {all.data && all.data.meta.total > all.data.items.length ? (
          <p className="text-xs text-muted-foreground">
            Showing {all.data.items.length} of {all.data.meta.total}. Choose a product to see all of
            its tiers.
          </p>
        ) : null}
      </div>
    </section>
  );
}
