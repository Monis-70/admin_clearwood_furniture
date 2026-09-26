'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgePercent, MoreHorizontal, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { FilterSelect } from '@/components/patterns/data-table/filter-select';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { endpoints } from '@/lib/api/endpoints';
import { formatDate } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { flattenTree, useAttributeOptions, useCategoryOptions } from '../catalog/lookups';
import { productHref } from '../catalog/products/href';
import { priceAdjustmentsApi, pricingKeys, type PriceAdjustmentRow } from './api';

import { ADJUSTMENT_SCOPES, ADJUSTMENT_STATE, adjustmentState, describeAdjustment } from './model';

const PriceRuleDialog = dynamic(
  () => import('./price-rule-dialog').then((m) => m.PriceRuleDialog),
  { ssr: false },
);

const FILTERS = ['scope', 'productId', 'categoryId'] as const;
type Filter = (typeof FILTERS)[number];
const SCOPE_OPTIONS = Object.entries(ADJUSTMENT_SCOPES).map(([value, label]) => ({ value, label }));

export function PriceRulesScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.priceAdjustments.list))
    return <PermissionNotice area="price rules" all={['pricing.adjustment.read']} />;
  return <PriceRules />;
}

function PriceRules() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<Filter>({
    filters: FILTERS,
    defaultSort: 'priority',
    defaultOrder: 'asc',
  });
  const f = params.filters;
  const [editing, setEditing] = useState<PriceAdjustmentRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<PriceAdjustmentRow | null>(null);
  const categories = useCategoryOptions();
  const attributes = useAttributeOptions();
  const query = {
    page: params.page,
    limit: params.limit,
    ...(f.scope ? { scope: f.scope } : {}),
    ...(f.productId ? { productId: f.productId } : {}),
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
  };
  const rules = useQuery({
    queryKey: pricingKeys.list(query),
    queryFn: ({ signal }) => priceAdjustmentsApi.list(query, signal),
    ...cachePolicy.list,
  });
  const conflicts = useQuery({
    queryKey: pricingKeys.conflicts(),
    queryFn: ({ signal }) => priceAdjustmentsApi.conflicts(signal),
    enabled: canCall(endpoints.priceAdjustments.conflicts),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: pricingKeys.adjustments });
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const valueName = new Map(
    (attributes.data ?? []).flatMap((a) =>
      a.values.map((v) => [v.id, `${a.name}: ${v.label}`] as const),
    ),
  );

  const targetOf = (rule: PriceAdjustmentRow): React.ReactNode => {
    switch (rule.scope) {
      case 'GLOBAL':
        return 'Every product';
      case 'CATEGORY':
        return rule.categoryId ? (categoryName.get(rule.categoryId) ?? 'A category') : 'A category';
      case 'ATTRIBUTE_VALUE':
        return rule.attributeValueId
          ? (valueName.get(rule.attributeValueId) ?? 'An option value')
          : 'An option value';
      case 'PRODUCT':
      case 'VARIANT':
        return rule.productId ? (
          <Link
            className="underline-offset-2 hover:underline"
            href={productHref(rule.productId, rule.scope === 'VARIANT' ? 'variants' : 'pricing')}
          >
            {rule.scope === 'VARIANT' ? 'One variant' : 'One product'}
          </Link>
        ) : (
          ADJUSTMENT_SCOPES[rule.scope]
        );
      default:
        return ADJUSTMENT_SCOPES[rule.scope] ?? rule.scope;
    }
  };
  const targetText = (rule: PriceAdjustmentRow) => {
    const node = targetOf(rule);
    return typeof node === 'string' ? node : undefined;
  };

  const columns: DataTableColumn<PriceAdjustmentRow>[] = [
    {
      id: 'name',
      meta: { label: 'Rule', pinned: true, mobile: 'title' },
      header: 'Rule',
      cell: ({ row }) => (
        <span className="flex max-w-md flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">
            {describeAdjustment(row.original, targetText(row.original))}
          </span>
        </span>
      ),
    },
    {
      id: 'target',
      meta: { label: 'Applies to', mobile: 'detail' },
      header: 'Applies to',
      cell: ({ row }) => targetOf(row.original),
    },
    {
      id: 'state',
      meta: { label: 'State', mobile: 'detail' },
      header: 'State',
      cell: ({ row }) => (
        <StatusBadge status={adjustmentState(row.original)} registry={ADJUSTMENT_STATE} />
      ),
    },
    {
      id: 'priority',
      meta: { label: 'Priority', align: 'right', mobile: 'detail' },
      header: 'Priority',
      cell: ({ row }) => <span className="tabular">{row.original.priority}</span>,
    },
    {
      id: 'window',
      meta: { label: 'Dates', mobile: 'hidden' },
      header: 'Dates',
      cell: ({ row }) =>
        row.original.startsAt || row.original.endsAt
          ? `${row.original.startsAt ? formatDate(row.original.startsAt) : '…'} – ${row.original.endsAt ? formatDate(row.original.endsAt) : '…'}`
          : 'Always',
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        canCall(endpoints.priceAdjustments.update) || canCall(endpoints.priceAdjustments.remove) ? (
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
              {canCall(endpoints.priceAdjustments.update) ? (
                <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
              ) : null}
              {canCall(endpoints.priceAdjustments.remove) ? (
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
        title="Price rules"
        description="Discounts and surcharges the pricing engine applies on top of base prices, in priority order (lowest number first)."
        actions={
          canCall(endpoints.priceAdjustments.create) ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New price rule
            </Button>
          ) : undefined
        }
      />
      {conflicts.data && conflicts.data.length > 0 ? (
        <Alert
          tone="warning"
          title={`${conflicts.data.length} overlapping rule group${conflicts.data.length === 1 ? '' : 's'}`}
          className="mb-4"
        >
          <p>
            These rules share a scope and priority while their dates overlap. Give them different
            priorities to make the order explicit.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {conflicts.data.map((conflict, index) => (
              <li key={index}>
                <AlertTriangle aria-hidden className="mr-1 inline size-3.5" />
                {conflict.names.join(', ')} · {ADJUSTMENT_SCOPES[conflict.scope] ?? conflict.scope}{' '}
                · priority {conflict.priority}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <DataTable
        label="Price rules"
        columns={columns}
        query={rules}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="price-rules"
        filtered={params.activeFilterCount > 0}
        toolbar={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <FilterSelect
              label="Applies to"
              value={f.scope}
              options={SCOPE_OPTIONS}
              onChange={(v) => params.setFilter('scope', v)}
            />
            <FilterSelect
              label="Category"
              value={f.categoryId}
              options={flattenTree(categories.data ?? []).map((c) => ({
                value: c.id,
                label: `${'\u00a0\u00a0'.repeat(c.depth)}${c.name}`,
              }))}
              onChange={(v) => params.setFilter('categoryId', v)}
            />
            {f.productId ? (
              <Badge tone="outline" className="gap-2">
                One product
                <button
                  type="button"
                  className="underline"
                  onClick={() => params.setFilter('productId', null)}
                >
                  Show all
                </button>
              </Badge>
            ) : null}
          </div>
        }
        empty={
          <EmptyState
            icon={BadgePercent}
            title="No price rules"
            description="Base prices apply as they are. Add a rule for a sale, a category surcharge or an option price."
          />
        }
        emptyFiltered={
          <EmptyState
            title="No rule matches"
            action={
              <Button variant="outline" onClick={params.clearAll}>
                Clear filters
              </Button>
            }
          />
        }
      />
      {editing ? (
        <PriceRuleDialog
          rule={editing === 'new' ? null : editing}
          initialProductId={f.productId ?? null}
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
          description="Prices that use it are recalculated without it."
          confirmLabel="Delete rule"
          level="destructive"
          onConfirm={async () => {
            await priceAdjustmentsApi.remove(removing.id);
            refresh();
            notifySuccess('Price rule deleted');
          }}
        />
      ) : null}
    </>
  );
}
