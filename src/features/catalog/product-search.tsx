'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import type { AdminProductSummaryDto } from '@shared/types/catalogAdmin';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from './api';

/** Search products by name or SKU and pick one; the list comes from the product search API. */
export function ProductSearch({
  label = 'Find a product',
  onPick,
  exclude,
  actionLabel = 'Choose',
}: {
  label?: string;
  onPick(product: AdminProductSummaryDto): void;
  exclude?: ReadonlySet<string>;
  actionLabel?: string;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const query = { page: 1, limit: 8, q: term, sort: 'name', order: 'asc' as const };
  const results = useQuery({
    queryKey: catalogKeys.products(query),
    queryFn: ({ signal }) => catalogApi.products(query, signal),
    enabled: term.length >= 2,
    ...cachePolicy.list,
  });
  const items = (results.data?.items ?? []).filter((p) => !exclude?.has(p.id));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="search"
        value={text}
        placeholder="Name or SKU (2+ characters)"
        autoComplete="off"
        onChange={(event) => setText(event.target.value)}
      />
      {term.length >= 2 ? (
        <div role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {results.isFetching
            ? 'Searching…'
            : `${items.length} result${items.length === 1 ? '' : 's'}`}
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="flex max-h-60 flex-col divide-y overflow-y-auto rounded-md border">
          {items.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => onPick(product)}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{product.name}</span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Plus aria-hidden className="size-3.5" />
                  {actionLabel}
                  <span className="sr-only"> {product.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
