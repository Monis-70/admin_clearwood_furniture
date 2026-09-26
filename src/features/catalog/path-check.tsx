'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ResolveResultDto } from '@shared/types/storefront';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { SectionLoader } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api/client';
import { catalogRoutes } from '@/lib/api/routes/catalog';

const TYPE_LABEL: Record<string, string> = {
  PRODUCT: 'product',
  CATEGORY: 'category',
  COLLECTION: 'collection',
  PAGE: 'page',
};

function outcome(result: ResolveResultDto): string {
  if (result.type === 'REDIRECT')
    return `Forwards (${result.statusCode ?? 301}) to ${result.redirectTo ?? '?'}${result.entity ? `: ${result.entity.name}` : ''}.`;
  if (result.type === 'NOT_FOUND') return 'Customers get "page not found" (404).';
  return `Opens the ${TYPE_LABEL[result.type] ?? result.type.toLowerCase()} ${result.entity?.name ?? ''} directly.`;
}

/** "Check an old address": asks the storefront resolver what a customer reaching a path gets. */
export function PathCheck({ id }: { id: string }) {
  const [draft, setDraft] = useState('');
  const [run, setRun] = useState<{ path: string; attempt: number } | null>(null);
  const result = useQuery({
    queryKey: ['storefront-path-check', run],
    queryFn: async ({ signal }) =>
      (await apiRequest(catalogRoutes.resolvePath, { query: { path: run?.path }, signal }))
        .data as ResolveResultDto,
    enabled: run !== null,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = draft.trim();
          if (value) setRun((prev) => ({ path: value, attempt: (prev?.attempt ?? 0) + 1 }));
        }}
      >
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor={`${id}-path`}>Check an address</Label>
          <Input
            id={`${id}-path`}
            value={draft}
            maxLength={300}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="/products/old-name"
          />
        </div>
        <Button type="submit" variant="outline" disabled={!draft.trim()}>
          Check
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Shows what a customer opening this address gets. Following an old address counts as one
        visit.
      </p>
      {run === null ? null : result.isPending ? (
        <SectionLoader label="Checking…" />
      ) : result.error ? (
        <FormAlert error={result.error} />
      ) : (
        <p className="text-sm" aria-live="polite">
          <span className="font-mono break-all">{result.data.path}</span>: {outcome(result.data)}
        </p>
      )}
    </div>
  );
}
