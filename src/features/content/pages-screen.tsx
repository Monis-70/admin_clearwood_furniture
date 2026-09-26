'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { endpoints } from '@/lib/api/endpoints';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { contentApi, contentKeys, type CmsPage, type CmsPageRow, type PageListQuery } from './api';
import { RowActions } from './kit';
import { PAGE_STATUS, PAGE_TYPE_LABELS, options } from './model';
import { SitemapCard } from './sitemap-card';

const NewPageDialog = dynamic(() => import('./dialogs/page-dialogs').then((m) => m.NewPageDialog), {
  ssr: false,
});
const DuplicatePageDialog = dynamic(
  () => import('./dialogs/page-dialogs').then((m) => m.DuplicatePageDialog),
  { ssr: false },
);

const e = endpoints.content;
export const editorHref = (id: string) => `/content/pages/edit?id=${encodeURIComponent(id)}`;

export function PagesScreen() {
  const { canCall } = usePermissions();
  if (!canCall(e.pages)) return <PermissionNotice area="pages" all={['cms.page.read']} />;
  return <PagesList />;
}

function PagesList() {
  const { canCall } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState<CmsPageRow | null>(null);
  const [removing, setRemoving] = useState<CmsPageRow | null>(null);
  const params = useListParams<'status' | 'type'>({ filters: ['status', 'type'] });
  const query: PageListQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    q: params.q || undefined,
    status: params.filters.status,
    type: params.filters.type,
  };
  const rows = useQuery({
    queryKey: contentKeys.pages(query),
    queryFn: ({ signal }) => contentApi.pages(query, signal),
    ...cachePolicy.list,
  });
  const opened = (page: CmsPage) => {
    void queryClient.invalidateQueries({ queryKey: [...contentKeys.all, 'pages'] });
    router.push(editorHref(page.id));
  };

  const columns: DataTableColumn<CmsPageRow>[] = [
    {
      id: 'title',
      meta: { label: 'Page', pinned: true, mobile: 'title' },
      header: 'Page',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <Link href={editorHref(row.original.id)} className="font-medium hover:underline">
            {row.original.title}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">/{row.original.slug}</span>
        </span>
      ),
    },
    {
      id: 'type',
      meta: { label: 'Type', mobile: 'detail' },
      header: 'Type',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {PAGE_TYPE_LABELS[row.original.type] ?? row.original.type}
          {row.original.isSystem ? (
            <Badge tone="neutral" title="Required by the storefront; cannot be deleted">
              System
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge status={row.original.status} registry={PAGE_STATUS} />
          {row.original.noIndex ? (
            <Badge tone="outline" title="Search engines are asked not to list this page">
              Hidden from search
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'publishedAt',
      meta: { label: 'Published', mobile: 'detail' },
      header: 'Published',
      cell: ({ row }) =>
        row.original.status === 'SCHEDULED' && row.original.scheduledAt
          ? `Scheduled ${formatDateTime(row.original.scheduledAt)}`
          : formatDate(row.original.publishedAt),
    },
    {
      id: 'updatedAt',
      meta: { label: 'Updated', mobile: 'hidden' },
      header: 'Updated',
      cell: ({ row }) => formatRelative(row.original.updatedAt),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          label={row.original.title}
          onEdit={() => router.push(editorHref(row.original.id))}
          onDelete={
            canCall(e.removePage) && !row.original.isSystem
              ? () => setRemoving(row.original)
              : undefined
          }
          extra={
            canCall(e.duplicatePage) ? (
              <DropdownMenuItem onSelect={() => setDuplicating(row.original)}>
                Duplicate…
              </DropdownMenuItem>
            ) : null
          }
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Pages"
        description="Storefront pages built from blocks: homepage, landing pages, policies and help pages."
        actions={
          canCall(e.createPage) ? (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              New page
            </Button>
          ) : null
        }
      />
      <DataTable
        label="Pages"
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="pages"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={params.q}
              onSearch={params.setSearch}
              label="Search pages"
              minLength={2}
            />
            <FilterSelect
              label="Status"
              value={params.filters.status}
              options={Object.entries(PAGE_STATUS).map(([value, def]) => ({
                value,
                label: def.label,
              }))}
              onChange={(v) => params.setFilter('status', v)}
            />
            <FilterSelect
              label="Type"
              value={params.filters.type}
              options={options(PAGE_TYPE_LABELS)}
              onChange={(v) => params.setFilter('type', v)}
            />
          </div>
        }
        empty={<EmptyState icon={FileText} title="No pages yet" />}
        emptyFiltered={
          <EmptyState
            title="No page matches these filters"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
      {canCall(e.rebuildSitemap) ? (
        <div className="mt-6">
          <SitemapCard />
        </div>
      ) : null}
      {creating ? <NewPageDialog onClose={() => setCreating(false)} onCreated={opened} /> : null}
      {duplicating ? (
        <DuplicatePageDialog
          page={duplicating}
          onClose={() => setDuplicating(null)}
          onCreated={opened}
        />
      ) : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Delete "${removing.title}"?`}
          description={`/${removing.slug} stops working on the storefront${removing.status === 'PUBLISHED' ? ' at once' : ''}. Menu links to it will break.`}
          confirmLabel="Delete page"
          level="destructive"
          onConfirm={async () => {
            await contentApi.removePage(removing.id);
            void queryClient.invalidateQueries({ queryKey: [...contentKeys.all, 'pages'] });
            notifySuccess('Page deleted');
          }}
        />
      ) : null}
    </>
  );
}
