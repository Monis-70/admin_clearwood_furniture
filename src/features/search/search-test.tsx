'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';

import type { SearchResponseDto } from '@shared/types/storefront';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { SectionLoader } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/surface';
import { apiRequest } from '@/lib/api/client';
import { searchRoutes } from '@/lib/api/routes/search';
import { formatNumber } from '@/lib/format/datetime';

/** Runs one real storefront search, so the effect of synonyms can be checked at once. */
export function SearchTest() {
  const [draft, setDraft] = useState('');
  // Each click is one try (a new key), and the key stays outside searchKeys.all so saving a
  // synonym does not re-run it: every run is logged as a customer search.
  const [run, setRun] = useState<{ term: string; attempt: number } | null>(null);
  const result = useQuery({
    queryKey: ['storefront-search-test', run],
    queryFn: async ({ signal }) =>
      (
        await apiRequest(searchRoutes.storefrontSearch, {
          query: { q: run?.term, limit: 5 },
          signal,
        })
      ).data as SearchResponseDto,
    enabled: run !== null,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const count = (groups: { total: number }[]) => groups.reduce((sum, g) => sum + g.total, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Try a search</CardTitle>
        <CardDescription>
          Runs the storefront search as a customer would. Each try is recorded as a customer search
          in Search insights.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (value) setRun((prev) => ({ term: value, attempt: (prev?.attempt ?? 0) + 1 }));
          }}
        >
          <div className="flex min-w-48 flex-1 flex-col gap-1">
            <Label htmlFor="search-test-term">Search words</Label>
            <Input
              id="search-test-term"
              value={draft}
              maxLength={100}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="e.g. couch"
            />
          </div>
          <Button type="submit" variant="outline" disabled={!draft.trim()}>
            <Search aria-hidden />
            Search
          </Button>
        </form>
        {run === null ? null : result.isPending ? (
          <SectionLoader label="Searching…" />
        ) : result.error ? (
          <FormAlert error={result.error} />
        ) : (
          <div className="flex flex-col gap-3 text-sm" aria-live="polite">
            <p>
              <span className="text-muted-foreground">Searched for: </span>
              {result.data.expandedTerms.length > 0
                ? result.data.expandedTerms.join(', ')
                : result.data.normalizedQuery}
            </p>
            <p>
              {formatNumber(result.data.products.totalCount)} products ·{' '}
              {formatNumber(count(result.data.categories))} categories ·{' '}
              {formatNumber(count(result.data.collections))} collections ·{' '}
              {formatNumber(count(result.data.brands))} brands
            </p>
            {result.data.products.items.length > 0 ? (
              <ol className="list-decimal pl-5" aria-label="First products found">
                {result.data.products.items.map((item) => (
                  <li key={item.id}>{item.name}</li>
                ))}
              </ol>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
