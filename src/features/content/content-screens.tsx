'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, PanelTop } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { StatusBadge, type StatusRegistry } from '@/components/patterns/status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  contentApi,
  contentKeys,
  type BannerListQuery,
  type BannerRow,
  type CmsPageRow,
  type PageListQuery,
} from './api';

const PAGE_STATUS: StatusRegistry<CmsPageRow['status']> = {
  DRAFT: { label: 'Draft', tone: 'neutral', description: 'Not visible on the storefront.' },
  SCHEDULED: { label: 'Scheduled', tone: 'info', description: 'Publishes at its scheduled time.' },
  PUBLISHED: { label: 'Published', tone: 'success', description: 'Live on the storefront.' },
  ARCHIVED: { label: 'Archived', tone: 'warning', description: 'Taken down; kept for reference.' },
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  LANDING: 'Landing page',
  POLICY: 'Policy',
  HOME: 'Homepage',
  CATEGORY_LANDING: 'Category landing',
  HELP: 'Help',
};

const PLACEMENT_LABELS: Record<string, string> = {
  HOME_HERO: 'Homepage hero',
  HOME_STRIP: 'Homepage strip',
  CATEGORY_TOP: 'Top of category pages',
  PDP_SIDEBAR: 'Product page sidebar',
  CART_PROMO: 'Cart',
  CHECKOUT: 'Checkout',
  ANNOUNCEMENT_BAR: 'Announcement bar',
  POPUP: 'Pop-up',
  FOOTER: 'Footer',
};

export function PagesScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.content.pages)) {
    return <PermissionNotice area="pages" all={['cms.page.read']} />;
  }
  return <PagesList />;
}

function PagesList() {
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

  const columns: DataTableColumn<CmsPageRow>[] = [
    {
      id: 'title',
      meta: { label: 'Page', pinned: true, mobile: 'title' },
      header: 'Page',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.original.title}</span>
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
  ];

  return (
    <>
      <PageHeader
        title="Pages"
        description="Storefront pages: homepage, landing pages, policies and help pages."
      />
      <Alert tone="info" title="Read-only for now" className="mb-4">
        Editing page blocks, scheduling and SEO arrives in the Content phase.
      </Alert>
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
              options={Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
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
    </>
  );
}

export function BannersScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.content.banners)) {
    return <PermissionNotice area="banners" all={['cms.banner.read']} />;
  }
  return <BannersList />;
}

function BannersList() {
  const params = useListParams<'placement' | 'isActive'>({ filters: ['placement', 'isActive'] });
  const query: BannerListQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    placement: params.filters.placement,
    isActive: params.filters.isActive,
  };
  const rows = useQuery({
    queryKey: contentKeys.banners(query),
    queryFn: ({ signal }) => contentApi.banners(query, signal),
    ...cachePolicy.list,
  });

  const columns: DataTableColumn<BannerRow>[] = [
    {
      id: 'name',
      meta: { label: 'Banner', pinned: true, mobile: 'title' },
      header: 'Banner',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          {row.original.headline ? (
            <span className="text-xs text-muted-foreground">{row.original.headline}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'placement',
      meta: { label: 'Where', mobile: 'detail' },
      header: 'Where',
      cell: ({ row }) => PLACEMENT_LABELS[row.original.placement] ?? row.original.placement,
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge tone="success">On</Badge>
        ) : (
          <Badge tone="neutral">Off</Badge>
        ),
    },
    {
      id: 'schedule',
      meta: { label: 'Shown', mobile: 'detail' },
      header: 'Shown',
      cell: ({ row }) =>
        !row.original.startsAt && !row.original.endsAt
          ? 'Always'
          : `${row.original.startsAt ? formatDate(row.original.startsAt) : 'Now'} – ${row.original.endsAt ? formatDate(row.original.endsAt) : 'no end'}`,
    },
    {
      id: 'devices',
      meta: { label: 'Devices', mobile: 'hidden' },
      header: 'Devices',
      cell: ({ row }) =>
        row.original.deviceVisibility === 'ALL'
          ? 'All devices'
          : row.original.deviceVisibility === 'MOBILE'
            ? 'Phones only'
            : row.original.deviceVisibility === 'DESKTOP'
              ? 'Computers only'
              : row.original.deviceVisibility,
    },
  ];

  return (
    <>
      <PageHeader
        title="Banners"
        description="Promotional banners and where they appear on the storefront."
      />
      <Alert tone="info" title="Read-only for now" className="mb-4">
        Creating and scheduling banners arrives in the Content phase.
      </Alert>
      <DataTable
        label="Banners"
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="banners"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <FilterSelect
              label="Where"
              value={params.filters.placement}
              options={Object.entries(PLACEMENT_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={(v) => params.setFilter('placement', v)}
            />
            <FilterSelect
              label="Status"
              value={params.filters.isActive}
              options={[
                { value: 'true', label: 'On' },
                { value: 'false', label: 'Off' },
              ]}
              onChange={(v) => params.setFilter('isActive', v)}
            />
          </div>
        }
        empty={<EmptyState icon={PanelTop} title="No banners yet" />}
        emptyFiltered={
          <EmptyState
            title="No banner matches these filters"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
    </>
  );
}
