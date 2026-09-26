'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Percent, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { pricingRoutes } from '@/lib/api/routes/pricing';
import { taxClassesRoutes } from '@/lib/api/routes/taxClasses';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { taxClassesApi, taxonomyKeys, type TaxClassRow } from '../catalog/taxonomy/api';

const TaxClassDialog = dynamic(() => import('./tax-class-dialog').then((m) => m.TaxClassDialog), {
  ssr: false,
});
const PricingSettingsPanel = dynamic(
  () => import('./pricing-settings-panel').then((m) => m.PricingSettingsPanel),
  { ssr: false },
);

/** Basis points shown as a percentage: 1800 → "18%". Display only; tax is computed by the API. */
const formatRate = (bp: number) =>
  `${(bp / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;

export function TaxScreen() {
  const { canCall } = usePermissions();
  if (!canCall(taxClassesRoutes.list))
    return <PermissionNotice area="tax classes" all={['pricing.tax.read']} />;
  return <TaxList />;
}

function TaxList() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<TaxClassRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<TaxClassRow | null>(null);
  const classes = useQuery({
    queryKey: [...taxonomyKeys.taxClasses, 'table'],
    queryFn: async ({ signal }) => {
      const items = await taxClassesApi.all(signal);
      return {
        items,
        meta: {
          page: 1,
          limit: items.length,
          total: items.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    },
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: taxonomyKeys.taxClasses });
  const canEdit = canCall(taxClassesRoutes.update);

  const columns: DataTableColumn<TaxClassRow>[] = [
    {
      id: 'name',
      meta: { label: 'Tax class', pinned: true, mobile: 'title' },
      header: 'Tax class',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
        </span>
      ),
    },
    {
      id: 'rate',
      meta: { label: 'GST rate', align: 'right', mobile: 'detail' },
      header: 'GST rate',
      cell: ({ row }) => (
        <span className="tabular font-medium">{formatRate(row.original.rateBp)}</span>
      ),
    },
    {
      id: 'hsn',
      meta: { label: 'HSN code', mobile: 'detail' },
      header: 'HSN code',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.hsnCode ?? '—'}</span>,
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {row.original.isDefault ? <Badge tone="brand">Default</Badge> : null}
          <Badge tone={row.original.isActive ? 'success' : 'neutral'}>
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </span>
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        canEdit || canCall(taxClassesRoutes.remove) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.original.name}`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit ? (
                <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
              ) : null}
              {canCall(taxClassesRoutes.remove) && !row.original.isDefault ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setRemoving(row.original)}
                  >
                    Delete…
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Tax & GST"
        description="GST classes assigned to products. Rates here drive the tax the API calculates on every order."
        actions={
          canCall(taxClassesRoutes.create) ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New tax class
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label="Tax classes"
        columns={columns}
        query={classes}
        getRowId={(row) => row.id}
        onPageChange={() => undefined}
        onLimitChange={() => undefined}
        preferenceKey="tax-classes"
        empty={
          <EmptyState
            icon={Percent}
            title="No tax classes"
            description="Create a GST class, then assign it to products on their Pricing tab."
          />
        }
      />
      {canCall(pricingRoutes.settings) ? (
        <section aria-labelledby="pricing-settings" className="mt-8 flex flex-col gap-3">
          <h2 id="pricing-settings" className="text-lg font-semibold">
            Pricing &amp; GST settings
          </h2>
          <PricingSettingsPanel />
        </section>
      ) : null}
      {editing ? (
        <TaxClassDialog
          taxClass={editing === 'new' ? null : editing}
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
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={`Delete ${removing.name}?`}
          description="Only possible when no product uses it."
          confirmLabel="Delete tax class"
          level="destructive"
          onConfirm={async () => {
            await taxClassesApi.remove(removing.id);
            refresh();
            notifySuccess('Tax class deleted');
          }}
        />
      ) : null}
    </>
  );
}
