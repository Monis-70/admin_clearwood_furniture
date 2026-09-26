'use client';

import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import dynamic from 'next/dynamic';

import type { EnquiryStatus } from '@shared/enums';
import type { AdminEnquirySummaryDto } from '@shared/types/enquiry';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { SavedFiltersMenu } from '@/components/patterns/data-table/saved-filters-menu';
import { SearchInput } from '@/components/patterns/data-table/search-input';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { formatDateTime, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { enquiriesApi, enquiryKeys, type EnquiryListQuery } from './api';
import { CONTRACT_WORK_FORM, ENQUIRY_STATUS, formLabel } from './model';

const EnquiryDetailSheet = dynamic(
  () => import('./enquiry-detail-sheet').then((m) => m.EnquiryDetailSheet),
  { ssr: false },
);

const STATUS_OPTIONS = (Object.keys(ENQUIRY_STATUS) as EnquiryStatus[]).map((value) => ({
  value,
  label: ENQUIRY_STATUS[value].label,
}));

export function EnquiriesScreen({ formKey }: { formKey?: string }) {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.enquiries.list)) {
    return <PermissionNotice area="enquiries" all={['lead.enquiry.read']} />;
  }
  return <EnquiriesList formKey={formKey} />;
}

function EnquiriesList({ formKey }: { formKey?: string }) {
  const params = useListParams<'status' | 'id'>({ filters: ['status', 'id'] });
  const query: EnquiryListQuery = {
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    order: params.order,
    q: params.q || undefined,
    status: params.filters.status as EnquiryStatus | undefined,
    formKey,
  };
  const rows = useQuery({
    queryKey: enquiryKeys.list(query),
    queryFn: ({ signal }) => enquiriesApi.list(query, signal),
    ...cachePolicy.list,
  });

  const columns: DataTableColumn<AdminEnquirySummaryDto>[] = [
    {
      id: 'name',
      meta: { label: 'From', pinned: true, mobile: 'title' },
      header: 'From',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => params.setFilter('id', row.original.id)}
          className="flex flex-col items-start rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="font-medium hover:underline">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.email ?? row.original.phone ?? ''}
          </span>
        </button>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', sortKey: 'status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} registry={ENQUIRY_STATUS} />,
    },
    {
      id: 'form',
      meta: { label: 'Form', mobile: 'detail' },
      header: 'Form',
      cell: ({ row }) => <span className="capitalize">{formLabel(row.original.formKey)}</span>,
    },
    {
      id: 'city',
      meta: { label: 'City', mobile: 'detail' },
      header: 'City',
      cell: ({ row }) => row.original.city ?? '—',
    },
    {
      id: 'assigned',
      meta: { label: 'Assigned', mobile: 'hidden' },
      header: 'Assigned',
      cell: ({ row }) =>
        row.original.assignedToId ? (
          <Badge tone="neutral">Assigned</Badge>
        ) : (
          <Badge tone="warning">Unassigned</Badge>
        ),
    },
    {
      id: 'createdAt',
      meta: { label: 'Received', sortKey: 'createdAt', mobile: 'detail' },
      header: 'Received',
      cell: ({ row }) => (
        <time dateTime={row.original.createdAt} title={formatDateTime(row.original.createdAt)}>
          {formatRelative(row.original.createdAt)}
        </time>
      ),
    },
  ];

  const contract = formKey === CONTRACT_WORK_FORM;
  return (
    <>
      <PageHeader
        title={contract ? 'Contract work' : 'Enquiries'}
        description={
          contract
            ? 'Requests for contract and interior projects: offices, hotels and full homes.'
            : 'Leads from storefront forms: custom furniture, interiors, bulk and contract work. Nothing here is an order.'
        }
      />
      <DataTable
        label={contract ? 'Contract work enquiries' : 'Enquiries'}
        columns={columns}
        query={rows}
        getRowId={(row) => row.id}
        sort={{ field: params.sort, order: params.order, onChange: params.setSort }}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="enquiries"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={params.q}
              onSearch={params.setSearch}
              label="Search name, email or phone"
              minLength={2}
            />
            <FilterSelect
              label="Status"
              value={params.filters.status}
              options={STATUS_OPTIONS}
              onChange={(v) => params.setFilter('status', v)}
            />
            <div className="sm:ml-auto">
              <SavedFiltersMenu listId={contract ? 'contract-work' : 'enquiries'} />
            </div>
          </div>
        }
        empty={
          <EmptyState
            icon={Inbox}
            title="No enquiries yet"
            description="Enquiries appear here as soon as a customer sends a storefront form."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No enquiry matches these filters"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
      {params.filters.id ? (
        <EnquiryDetailSheet id={params.filters.id} onClose={() => params.setFilter('id', null)} />
      ) : null}
    </>
  );
}
