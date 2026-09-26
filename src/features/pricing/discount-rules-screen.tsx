'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, MoreHorizontal, Plus, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
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
import { formatDate, formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { describeAction } from './discount-model';
import { parseActions, rulesApi, rulesKeys, type DiscountRuleRow } from './rules-api';

const DiscountRuleDialog = dynamic(
  () => import('./discount-rule-dialogs').then((m) => m.DiscountRuleDialog),
  { ssr: false },
);
const TestRulesDialog = dynamic(
  () => import('./discount-rule-dialogs').then((m) => m.TestRulesDialog),
  { ssr: false },
);

export function DiscountRulesScreen() {
  const { canCall } = usePermissions();
  if (!canCall(pricingRoutes.discountRules)) {
    return <PermissionNotice area="automatic discounts" all={['pricing.adjustment.read']} />;
  }
  return <DiscountRules />;
}

function DiscountRules() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<never>({
    filters: [],
    defaultSort: 'priority',
    defaultOrder: 'asc',
  });
  const [editing, setEditing] = useState<DiscountRuleRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<DiscountRuleRow | null>(null);
  const [testing, setTesting] = useState(false);
  const query = { page: params.page, limit: params.limit };
  const rules = useQuery({
    queryKey: rulesKeys.discountRules(query),
    queryFn: ({ signal }) => rulesApi.discountRules(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: rulesKeys.all });

  const columns: DataTableColumn<DiscountRuleRow>[] = [
    {
      id: 'name',
      meta: { label: 'Rule', pinned: true, mobile: 'title' },
      header: 'Rule',
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
        </span>
      ),
    },
    {
      id: 'gives',
      meta: { label: 'Gives', mobile: 'detail' },
      header: 'Gives',
      cell: ({ row }) => parseActions(row.original).map(describeAction).join(' + '),
    },
    {
      id: 'scope',
      meta: { label: 'Applies to', mobile: 'detail' },
      header: 'Applies to',
      cell: ({ row }) => (row.original.scope === 'CART' ? 'The cart' : 'Each matching line'),
    },
    {
      id: 'window',
      meta: { label: 'When', mobile: 'detail' },
      header: 'When',
      cell: ({ row }) =>
        row.original.startsAt || row.original.endsAt
          ? `${row.original.startsAt ? formatDate(row.original.startsAt) : 'Now'} – ${row.original.endsAt ? formatDate(row.original.endsAt) : 'no end'}`
          : 'Always',
    },
    {
      id: 'usage',
      meta: { label: 'Used', align: 'right', mobile: 'detail' },
      header: 'Used',
      cell: ({ row }) => (
        <span className="tabular">
          {formatNumber(row.original.usedCount)}
          {row.original.usageLimit ? ` / ${formatNumber(row.original.usageLimit)}` : ''}
        </span>
      ),
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          <Badge tone={row.original.isActive ? 'success' : 'neutral'}>
            {row.original.isActive ? 'Active' : 'Off'}
          </Badge>
          {row.original.stopFurtherRules ? <Badge tone="info">Stops later rules</Badge> : null}
        </span>
      ),
    },
    {
      id: 'actions',
      meta: { label: 'Actions', align: 'right', mobile: 'detail' },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        canCall(pricingRoutes.updateDiscountRule) || canCall(pricingRoutes.removeDiscountRule) ? (
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
              {canCall(pricingRoutes.updateDiscountRule) ? (
                <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
              ) : null}
              {canCall(pricingRoutes.removeDiscountRule) ? (
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
        title="Automatic discounts"
        description="Discounts checkout applies without a code when a cart meets the conditions. Rules run in priority order (lowest first)."
        actions={
          <>
            {canCall(pricingRoutes.evaluateDiscountRules) ? (
              <Button variant="outline" onClick={() => setTesting(true)}>
                <FlaskConical aria-hidden />
                Test rules
              </Button>
            ) : null}
            {canCall(pricingRoutes.createDiscountRule) ? (
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden />
                New rule
              </Button>
            ) : null}
          </>
        }
      />
      <DataTable
        label="Automatic discounts"
        columns={columns}
        query={rules}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="discount-rules"
        empty={
          <EmptyState
            icon={Sparkles}
            title="No automatic discounts"
            description="Create a rule such as 5% off carts above ₹50,000."
          />
        }
      />
      {editing ? (
        <DiscountRuleDialog
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {testing ? <TestRulesDialog onClose={() => setTesting(false)} /> : null}
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemoving(null))}
          title={`Delete ${removing.name}?`}
          description="Checkout stops applying it immediately. Orders already placed keep their discount."
          confirmLabel="Delete rule"
          level="destructive"
          onConfirm={async () => {
            await rulesApi.removeDiscountRule(removing.id);
            refresh();
            notifySuccess('Rule deleted');
          }}
        />
      ) : null}
    </>
  );
}
