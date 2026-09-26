'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { z } from 'zod';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { FormAlert } from '@/components/patterns/form/form-alert';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { endpoints } from '@/lib/api/endpoints';
import { formatDate } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  NumberField,
  SelectField,
  TextField,
  dateTimeInput,
  intInput,
  optionalDateTime,
  requiredInt,
  requiredText,
  textInput,
} from '../catalog/form-kit';
import { productHref } from '../catalog/products/href';
import { RecordDialog } from '../catalog/record-dialog';

import { CHANNEL_LABELS, useCustomerGroupOptions } from './lookups';
import { ProductPicker } from './product-picker';
import { rulesApi, rulesKeys, type PriceListItemRow, type PriceListRow } from './rules-api';

const TierPricesPanel = dynamic(
  () => import('./tier-prices-panel').then((m) => m.TierPricesPanel),
  {
    ssr: false,
  },
);

const CODE = /^[A-Z][A-Z0-9_]*$/;
const listSchema = z
  .object({
    code: z.string().trim().regex(CODE, 'Use UPPER_SNAKE_CASE, e.g. TRADE_2026').min(2).max(32),
    name: requiredText(2, 120, 'Name'),
    customerGroupId: z.string().transform((v) => v || null),
    channel: z.string(),
    priority: requiredInt(0, 10_000, 'Priority'),
    startsAt: optionalDateTime(),
    endsAt: optionalDateTime(),
    isActive: z.boolean(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, {
    path: ['endsAt'],
    message: 'The end must be after the start',
  });
type ListValues = z.input<typeof listSchema>;

const windowText = (row: Pick<PriceListRow, 'startsAt' | 'endsAt'>) =>
  row.startsAt || row.endsAt
    ? `${row.startsAt ? formatDate(row.startsAt) : 'Now'} – ${row.endsAt ? formatDate(row.endsAt) : 'no end'}`
    : 'Always';

export function PriceListsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.pricing.priceLists)) {
    return <PermissionNotice area="price lists" all={['pricing.adjustment.read']} />;
  }
  return <PriceLists />;
}

function PriceLists() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<'id'>({
    filters: ['id'],
    defaultSort: 'priority',
    defaultOrder: 'desc',
  });
  const groups = useCustomerGroupOptions();
  const [editing, setEditing] = useState<PriceListRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<PriceListRow | null>(null);
  const query = { page: params.page, limit: params.limit };
  const lists = useQuery({
    queryKey: rulesKeys.priceLists(query),
    queryFn: ({ signal }) => rulesApi.priceLists(query, signal),
    ...cachePolicy.list,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: rulesKeys.all });
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const open = params.filters.id ? lists.data?.items.find((l) => l.id === params.filters.id) : null;

  const columns: DataTableColumn<PriceListRow>[] = [
    {
      id: 'name',
      meta: { label: 'Price list', pinned: true, mobile: 'title' },
      header: 'Price list',
      cell: ({ row }) => (
        <button
          type="button"
          className="flex flex-col text-left"
          onClick={() => params.setFilter('id', row.original.id)}
        >
          <span className="font-medium hover:underline">{row.original.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
        </button>
      ),
    },
    {
      id: 'audience',
      meta: { label: 'Who gets it', mobile: 'detail' },
      header: 'Who gets it',
      cell: ({ row }) =>
        `${row.original.customerGroupId ? (groupName.get(row.original.customerGroupId) ?? 'A customer group') : 'Everyone'} · ${CHANNEL_LABELS[row.original.channel] ?? row.original.channel}`,
    },
    {
      id: 'window',
      meta: { label: 'When', mobile: 'detail' },
      header: 'When',
      cell: ({ row }) => windowText(row.original),
    },
    {
      id: 'priority',
      meta: { label: 'Priority', align: 'right', mobile: 'detail' },
      header: 'Priority',
      cell: ({ row }) => <span className="tabular">{row.original.priority}</span>,
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
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.name}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => params.setFilter('id', row.original.id)}>
              Prices
            </DropdownMenuItem>
            {canCall(endpoints.pricing.updatePriceList) ? (
              <DropdownMenuItem onSelect={() => setEditing(row.original)}>Edit</DropdownMenuItem>
            ) : null}
            {canCall(endpoints.pricing.removePriceList) ? (
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
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Price lists & tiers"
        description="Special prices for a customer group or channel, and quantity breaks. The pricing engine chooses which price applies at checkout."
        actions={
          canCall(endpoints.pricing.createPriceList) ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New price list
            </Button>
          ) : undefined
        }
      />
      <DataTable
        label="Price lists"
        columns={columns}
        query={lists}
        getRowId={(row) => row.id}
        onPageChange={params.setPage}
        onLimitChange={params.setLimit}
        preferenceKey="price-lists"
        empty={
          <EmptyState
            icon={ClipboardList}
            title="No price lists"
            description="Create one to give a group or channel its own prices."
          />
        }
      />
      <div className="mt-8">
        <TierPricesPanel />
      </div>
      {editing ? (
        <PriceListDialog
          list={editing === 'new' ? null : editing}
          groups={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
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
          title={`Delete ${removing.name}?`}
          description="Its prices stop applying at checkout immediately."
          confirmLabel="Delete price list"
          level="destructive"
          onConfirm={async () => {
            await rulesApi.removePriceList(removing.id);
            refresh();
            notifySuccess('Price list deleted');
          }}
        />
      ) : null}
      {params.filters.id ? (
        <Sheet open onOpenChange={(o) => (o ? undefined : params.setFilter('id', null))}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
            <SheetHeader className="p-0">
              <SheetTitle>{open?.name ?? 'Price list'}</SheetTitle>
              <SheetDescription>
                {open ? `${open.code} · ${windowText(open)}` : 'Prices in this list'}
              </SheetDescription>
            </SheetHeader>
            <PriceListItems id={params.filters.id} />
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}

function PriceListDialog({
  list,
  groups,
  onClose,
  onSaved,
}: {
  list: PriceListRow | null;
  groups: { value: string; label: string }[];
  onClose(): void;
  onSaved(): void;
}) {
  const keyFor = useIdempotencyKey();
  return (
    <RecordDialog title={list ? `Edit ${list.name}` : 'New price list'} onClose={onClose}>
      <EditorForm
        schema={listSchema}
        defaultValues={{
          code: textInput(list?.code),
          name: textInput(list?.name),
          customerGroupId: list?.customerGroupId ?? '',
          channel: list?.channel ?? 'WEB',
          priority: intInput(list?.priority ?? 100),
          startsAt: dateTimeInput(list?.startsAt),
          endsAt: dateTimeInput(list?.endsAt),
          isActive: list?.isActive ?? true,
        }}
        successMessage={list ? 'Price list saved' : 'Price list created'}
        submitLabel={list ? 'Save changes' : 'Create price list'}
        onSubmit={async (values) => {
          const input = { ...values, channel: values.channel as 'WEB' };
          if (list) await rulesApi.updatePriceList(list.id, { ...input, version: list.version });
          else await rulesApi.createPriceList(input, keyFor(input));
          onSaved();
        }}
      >
        <FieldGrid>
          <TextField<ListValues> name="name" label="Name" required />
          <TextField<ListValues> name="code" label="Code" required />
        </FieldGrid>
        <FieldGrid>
          <SelectField<ListValues>
            name="customerGroupId"
            label="Customer group"
            placeholder="Everyone"
            options={groups}
          />
          <SelectField<ListValues>
            name="channel"
            label="Channel"
            options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </FieldGrid>
        <FieldGrid>
          <TextField<ListValues> name="startsAt" label="Starts" type="datetime-local" />
          <TextField<ListValues> name="endsAt" label="Ends" type="datetime-local" />
        </FieldGrid>
        <NumberField<ListValues>
          name="priority"
          label="Priority"
          required
          description="When two lists price the same product, the higher priority wins."
        />
        <CheckField<ListValues> name="isActive" label="Active" />
      </EditorForm>
    </RecordDialog>
  );
}

interface ItemDraft {
  productId: string;
  label: string;
  minQty: string;
  price: string;
}

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

function PriceListItems({ id }: { id: string }) {
  const items = useQuery({
    queryKey: rulesKeys.priceListItems(id),
    queryFn: ({ signal }) => rulesApi.priceListItems(id, signal),
    ...cachePolicy.detail,
  });
  if (items.isPending) return <SectionLoader label="Loading prices…" />;
  if (items.error) return <ErrorState error={items.error} onRetry={() => void items.refetch()} />;
  return <ItemsEditor id={id} key={JSON.stringify(items.data)} rows={items.data} />;
}

function ItemsEditor({ id, rows }: { id: string; rows: PriceListItemRow[] }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = canCall(endpoints.pricing.setPriceListItems);
  const initial: ItemDraft[] = rows
    .filter((r) => r.productId)
    .map((r) => ({
      productId: r.productId!,
      label: '',
      minQty: String(r.minQty),
      price: String(r.pricePaise / 100),
    }));
  const variantRows = rows.filter((r) => !r.productId).length;
  const [drafts, setDrafts] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const dirty = JSON.stringify(drafts) !== JSON.stringify(initial);
  useUnsavedChangesGuard(dirty);
  const save = useMutation({
    mutationFn: () =>
      rulesApi.setPriceListItems(id, {
        items: [
          ...drafts.map((d) => ({
            productId: d.productId,
            minQty: Number(d.minQty),
            pricePaise: Math.round(Number(d.price) * 100),
          })),
          ...rows
            .filter((r) => !r.productId)
            .map((r) => ({ variantId: r.variantId, minQty: r.minQty, pricePaise: r.pricePaise })),
        ],
      }),
    onSuccess: ({ items }) => {
      void queryClient.invalidateQueries({ queryKey: rulesKeys.all });
      notifySuccess(`${items} price${items === 1 ? '' : 's'} saved`);
    },
  });
  const check = () => {
    if (drafts.length === 0 && variantRows === 0)
      return 'A price list needs at least one price. To remove every price, delete the list.';
    for (const d of drafts) {
      if (!/^\d+$/.test(d.minQty) || Number(d.minQty) < 1 || Number(d.minQty) > 10_000)
        return 'Minimum quantities are whole numbers from 1 to 10,000.';
      if (!MONEY.test(d.price)) return 'Prices are rupees, for example 12499 or 12499.50.';
    }
    return null;
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Each price replaces the product&apos;s own price for this list&apos;s audience, from the
        minimum quantity. Saving replaces the whole list.
      </p>
      {variantRows > 0 ? (
        <p className="text-sm text-muted-foreground">
          {variantRows} variant-specific price{variantRows === 1 ? '' : 's'} (set by import) are
          kept as they are.
        </p>
      ) : null}
      <FormAlert error={save.error} messages={problem ? [problem] : []} />
      {drafts.length === 0 ? (
        <EmptyState title="No product prices" compact />
      ) : (
        <ul className="flex flex-col divide-y rounded-md border" aria-label="Prices in this list">
          {drafts.map((d, index) => (
            <li
              key={`${d.productId}-${index}`}
              className="flex flex-wrap items-end gap-2 px-3 py-2 text-sm"
            >
              <span className="min-w-40 flex-1">
                {d.label ? (
                  <span className="font-medium">{d.label}</span>
                ) : (
                  <Link
                    className="underline-offset-2 hover:underline"
                    href={productHref(d.productId, 'pricing')}
                  >
                    Open product
                  </Link>
                )}
              </span>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`min-${index}`} className="text-xs">
                  From quantity
                </Label>
                <Input
                  id={`min-${index}`}
                  className="w-24"
                  inputMode="numeric"
                  disabled={!canEdit}
                  value={d.minQty}
                  onChange={(e) =>
                    setDrafts((all) =>
                      all.map((x, i) => (i === index ? { ...x, minQty: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`price-${index}`} className="text-xs">
                  Unit price (₹)
                </Label>
                <Input
                  id={`price-${index}`}
                  className="w-32"
                  inputMode="decimal"
                  disabled={!canEdit}
                  value={d.price}
                  onChange={(e) =>
                    setDrafts((all) =>
                      all.map((x, i) => (i === index ? { ...x, price: e.target.value } : x)),
                    )
                  }
                />
              </div>
              {canEdit ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove price ${index + 1}`}
                  onClick={() => setDrafts((all) => all.filter((_, i) => i !== index))}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <>
          <ProductPicker
            actionLabel="Add"
            label="Add a product to this list"
            onPick={(p) =>
              setDrafts((all) => [
                ...all,
                { productId: p.id, label: `${p.name} (${p.sku})`, minQty: '1', price: '' },
              ])
            }
          />
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/95 py-3">
            <span role="status" className="mr-auto text-sm text-muted-foreground">
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <Button variant="ghost" disabled={!dirty} onClick={() => setDrafts(initial)}>
              Discard
            </Button>
            <Button
              disabled={!dirty}
              loading={save.isPending}
              onClick={() => {
                const found = check();
                setProblem(found);
                if (!found) save.mutate();
              }}
            >
              Save prices
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
