'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { pricingRoutes } from '@/lib/api/routes/pricing';
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

import { CHANNEL_LABELS } from './lookups';
import { ProductPicker } from './product-picker';
import { rulesApi, rulesKeys, type PriceListItemRow, type PriceListRow } from './rules-api';

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

export function PriceListDialog({
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

export function PriceListItems({ id }: { id: string }) {
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
  const canEdit = canCall(pricingRoutes.setPriceListItems);
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
        <EmptyState
          title="No product prices"
          description="This list changes nothing until you add a product below. Base prices apply meanwhile."
          compact
        />
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
