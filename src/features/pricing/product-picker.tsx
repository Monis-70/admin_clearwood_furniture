'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { AdminProductSummaryDto } from '@shared/types/catalogAdmin';

import { SearchInput } from '@/components/patterns/data-table/search-input';
import { Button } from '@/components/ui/button';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys, type ProductListQuery } from '../catalog/api';

export interface PickedProduct {
  id: string;
  name: string;
  sku: string;
}

/** Search the catalog by name or SKU and pick one product; the list is the API's, nothing cached here. */
export function ProductPicker({
  label = 'Find a product by name or SKU',
  onPick,
  exclude = [],
  actionLabel = 'Choose',
}: {
  label?: string;
  onPick(product: PickedProduct): void;
  exclude?: readonly string[];
  actionLabel?: string;
}) {
  const [term, setTerm] = useState('');
  const query: ProductListQuery = { page: 1, limit: 8, order: 'asc', sort: 'name', q: term };
  const results = useQuery({
    queryKey: catalogKeys.products(query),
    queryFn: ({ signal }) => catalogApi.products(query, signal),
    enabled: term.length >= 2,
    ...cachePolicy.list,
  });
  const items: AdminProductSummaryDto[] = (results.data?.items ?? []).filter(
    (p) => !exclude.includes(p.id),
  );

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        value={term}
        onSearch={setTerm}
        label={label}
        placeholder={label}
        minLength={2}
      />
      {term.length >= 2 ? (
        <ul className="flex flex-col divide-y rounded-md border" aria-label="Matching products">
          {results.isPending ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
          ) : results.error ? (
            <li className="px-3 py-2 text-sm text-destructive">The search failed. Try again.</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No product matches.</li>
          ) : (
            items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{p.name}</span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`${actionLabel} ${p.name}`}
                  onClick={() => onPick({ id: p.id, name: p.name, sku: p.sku })}
                >
                  {actionLabel}
                </Button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
