'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ListTree, MoreHorizontal, Plus, RefreshCw, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/surface';
import { searchRoutes } from '@/lib/api/routes/search';
import { formatDate, formatDateTime, formatNumber, formatRelative } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { searchApi, searchKeys, type SynonymRow } from './api';

const SynonymDialog = dynamic(() => import('./synonym-dialog').then((m) => m.SynonymDialog), {
  ssr: false,
});

const pct = (bp: number) => `${(bp / 100).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;

function Guard({ area, children }: { area: string; children: React.ReactNode }) {
  const { canCall } = usePermissions();
  if (!canCall(searchRoutes.analytics))
    return <PermissionNotice area={area} all={['catalog.product.update']} />;
  return <>{children}</>;
}

/* --------------------------------------------------------------- insights */

export function SearchInsightsScreen() {
  return (
    <Guard area="search insights">
      <Insights />
    </Guard>
  );
}

function Insights() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [adding, setAdding] = useState<string | null>(null);
  const report = useQuery({
    queryKey: searchKeys.analytics(days),
    queryFn: ({ signal }) => searchApi.analytics(days, signal),
    ...cachePolicy.diagnostic,
  });
  return (
    <>
      <PageHeader
        title="Search insights"
        description="What customers search for on the storefront, and which searches find nothing."
        actions={
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="insight-days" className="text-xs">
                Period
              </Label>
              <NativeSelect
                id="insight-days"
                size="sm"
                value={String(days)}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </NativeSelect>
            </div>
          </div>
        }
      />
      {report.isPending ? (
        <SectionLoader label="Loading search insights…" />
      ) : report.error ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Searches', formatNumber(report.data.totals.searches)],
              ['Clicks on results', formatNumber(report.data.totals.clicks)],
              ['Searches with no result', formatNumber(report.data.totals.zeroResults)],
              ['Click-through', pct(report.data.totals.clickThroughBp)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-card p-4">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="tabular text-2xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top searches</CardTitle>
                <CardDescription>
                  With the average number of results and click-through.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.data.topQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No searches in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <caption className="sr-only">Top searches</caption>
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 font-medium">Search</th>
                        <th className="py-1 text-right font-medium">Times</th>
                        <th className="py-1 text-right font-medium">Results</th>
                        <th className="py-1 text-right font-medium">Click-through</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.topQueries.map((q) => (
                        <tr key={q.query} className="border-t">
                          <td className="py-1.5">{q.query}</td>
                          <td className="tabular py-1.5 text-right">{formatNumber(q.count)}</td>
                          <td className="tabular py-1.5 text-right">
                            {formatNumber(Math.round(q.avgResults))}
                          </td>
                          <td className="tabular py-1.5 text-right">{pct(q.clickThroughBp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Searches that found nothing</CardTitle>
                <CardDescription>
                  A synonym often fixes these: e.g. &quot;couch&quot; should find sofas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.data.zeroResultQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Every search found something.</p>
                ) : (
                  <ul
                    className="flex flex-col divide-y text-sm"
                    aria-label="Searches that found nothing"
                  >
                    {report.data.zeroResultQueries.map((q) => (
                      <li key={q.query} className="flex flex-wrap items-center gap-2 py-1.5">
                        <span className="font-medium">{q.query}</span>
                        <span className="text-muted-foreground">
                          {formatNumber(q.count)}× · last {formatRelative(q.lastSeenAt)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto"
                          aria-label={`Add synonym for ${q.query}`}
                          onClick={() => setAdding(q.query)}
                        >
                          Add synonym
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Day by day</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <caption className="sr-only">Searches per day</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 font-medium">Day</th>
                    <th className="py-1 text-right font-medium">Searches</th>
                    <th className="py-1 text-right font-medium">No result</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.trend.map((d) => (
                    <tr key={d.date} className="border-t">
                      <td className="py-1">{formatDate(d.date)}</td>
                      <td className="tabular py-1 text-right">{formatNumber(d.searches)}</td>
                      <td className="tabular py-1 text-right">{formatNumber(d.zeroResults)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
      {adding ? (
        <SynonymDialog
          synonym={null}
          term={adding}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            void queryClient.invalidateQueries({ queryKey: searchKeys.all });
          }}
        />
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- synonyms */

export function SynonymsScreen() {
  return (
    <Guard area="synonyms">
      <Synonyms />
    </Guard>
  );
}

function Synonyms() {
  const queryClient = useQueryClient();
  const params = useListParams<never>({ filters: [], defaultSort: 'term', defaultOrder: 'asc' });
  const [editing, setEditing] = useState<SynonymRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<SynonymRow | null>(null);
  const query = { page: params.page, limit: params.limit };
  const synonyms = useQuery({
    queryKey: searchKeys.synonyms(query),
    queryFn: ({ signal }) => searchApi.synonyms(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: searchKeys.all });
  const columns: DataTableColumn<SynonymRow>[] = [
    {
      id: 'term',
      meta: { label: 'Search for', pinned: true, mobile: 'title' },
      header: 'Search for',
      cell: ({ row }) => <span className="font-medium">{row.original.term}</span>,
    },
    {
      id: 'synonyms',
      meta: { label: 'Also finds', mobile: 'detail' },
      header: 'Also finds',
      cell: ({ row }) => row.original.synonyms.join(', '),
    },
    {
      id: 'direction',
      meta: { label: 'Direction', mobile: 'detail' },
      header: 'Direction',
      cell: ({ row }) => (row.original.isTwoWay ? 'Both ways' : 'One way'),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <Badge tone={row.original.isActive ? 'success' : 'neutral'}>
          {row.original.isActive ? 'Active' : 'Off'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.term}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setRemoving(row.original)}
            >
              Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Synonyms"
        description="Words that should find the same products. Changes apply to new searches at once."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            New synonyms
          </Button>
        }
      />
      <DataTable
        label="Synonyms"
        columns={columns}
        query={synonyms}
        getRowId={(row) => row.term}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="synonyms"
        empty={
          <EmptyState
            icon={ListTree}
            title="No synonyms yet"
            description="Add one, e.g. couch → sofa."
          />
        }
      />
      {editing ? (
        <SynonymDialog
          synonym={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Delete the synonyms for "${removing.term}"?`}
          description="Searches for these words stop finding each other's products."
          confirmLabel="Delete synonyms"
          level="destructive"
          onConfirm={async () => {
            await searchApi.removeSynonym(removing.term);
            refresh();
            notifySuccess('Synonyms deleted');
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------ index upkeep */

const ENTITY_LABELS: Record<string, string> = {
  PRODUCT: 'Products',
  CATEGORY: 'Categories',
  COLLECTION: 'Collections',
  BRAND: 'Brands',
  PAGE: 'Pages',
  HELP_ARTICLE: 'Help articles',
};

const JOB_TONE: Record<string, 'success' | 'danger' | 'info' | 'neutral'> = {
  COMPLETED: 'success',
  FAILED: 'danger',
  RUNNING: 'info',
};

export function SearchIndexScreen() {
  return (
    <Guard area="search index maintenance">
      <SearchIndex />
    </Guard>
  );
}

function SearchIndex() {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState('');
  const [full, setFull] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const jobs = useQuery({
    queryKey: searchKeys.jobs(),
    queryFn: ({ signal }) => searchApi.jobs(signal),
    ...cachePolicy.probe,
  });
  const popularity = useMutation({
    mutationFn: () => searchApi.recomputePopularity(),
    onSuccess: ({ updated }) =>
      notifySuccess(`Popularity recomputed for ${formatNumber(updated)} products`),
  });

  return (
    <>
      <PageHeader
        title="Index maintenance"
        description="Rebuild the storefront search index after large imports, and refresh popularity scores used to rank results."
        actions={
          <Button variant="outline" onClick={() => void jobs.refetch()} loading={jobs.isFetching}>
            {jobs.isFetching ? null : <RefreshCw aria-hidden />}
            Refresh
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rebuild the index</CardTitle>
            <CardDescription>
              Products are re-indexed automatically when they change; a rebuild is only needed after
              bulk changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reindex-entity">What to rebuild</Label>
              <NativeSelect
                id="reindex-entity"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
              >
                <option value="">Everything</option>
                {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={full}
                onChange={(e) => setFull(e.target.checked)}
              />
              <span>
                Clear first (full rebuild)
                <span className="block text-xs text-muted-foreground">
                  Search may miss items until the rebuild finishes.
                </span>
              </span>
            </label>
            <Button className="w-fit" onClick={() => setConfirming(true)}>
              <Search aria-hidden />
              Rebuild
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Popularity</CardTitle>
            <CardDescription>
              Recomputes every product&apos;s popularity from views, carts and orders.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <FormAlert error={popularity.error} />
            <Button
              className="w-fit"
              variant="outline"
              loading={popularity.isPending}
              onClick={() => popularity.mutate()}
            >
              <Activity aria-hidden />
              Recompute popularity
            </Button>
          </CardContent>
        </Card>
      </div>
      <section aria-labelledby="jobs-heading" className="mt-6 flex flex-col gap-3">
        <h2 id="jobs-heading" className="text-base font-semibold">
          Recent rebuilds
        </h2>
        {jobs.isPending ? (
          <SectionLoader label="Loading rebuilds…" />
        ) : jobs.error ? (
          <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} compact />
        ) : jobs.data.length === 0 ? (
          <EmptyState title="No rebuilds yet" compact />
        ) : (
          <ul
            className="flex flex-col divide-y rounded-md border text-sm"
            aria-label="Recent rebuilds"
          >
            {jobs.data.map((job) => (
              <li key={job.id} className="flex flex-col gap-1 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={JOB_TONE[job.status] ?? 'neutral'}>{job.status.toLowerCase()}</Badge>
                  <span className="font-medium">
                    {job.entityType
                      ? (ENTITY_LABELS[job.entityType] ?? job.entityType)
                      : 'Everything'}
                  </span>
                  {job.isFull ? <Badge tone="info">Full</Badge> : null}
                  <span className="tabular">
                    {formatNumber(job.processed)} of {formatNumber(job.total)}
                    {job.failed ? `, ${formatNumber(job.failed)} failed` : ''}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {job.startedAt ? formatDateTime(job.startedAt) : ''}
                  </span>
                  {job.status === 'RUNNING' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const latest = await searchApi.job(job.id);
                        queryClient.setQueryData(searchKeys.jobs(), (all: typeof jobs.data) =>
                          all?.map((j) => (j.id === latest.id ? latest : j)),
                        );
                      }}
                    >
                      Check progress
                    </Button>
                  ) : null}
                </div>
                {job.errors.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      {job.errors.length} errors
                    </summary>
                    <ul className="list-disc pl-5 text-xs">
                      {job.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirming ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setConfirming(false))}
          title={`Rebuild ${entityType ? ENTITY_LABELS[entityType] : 'the whole search index'}?`}
          description={
            full
              ? 'The index is cleared first: storefront search may miss items until it finishes. It can take several minutes.'
              : 'Every item is indexed again. It can take several minutes; the page waits for it.'
          }
          confirmLabel="Rebuild now"
          level={full ? 'destructive' : 'standard'}
          onConfirm={async () => {
            const job = await searchApi.reindex({ entityType: entityType || undefined, full });
            void queryClient.invalidateQueries({ queryKey: searchKeys.jobs() });
            notifySuccess(
              `Rebuild ${job.status.toLowerCase()}: ${formatNumber(job.processed)} items`,
            );
          }}
        />
      ) : null}
    </>
  );
}
