'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { endpoints } from '@/lib/api/endpoints';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  MoneyField,
  NumberField,
  SelectField,
  TextField,
  intInput,
  optionalRupees,
  paiseInput,
  requiredInt,
} from '../../../form-kit';
import { formatRupees } from '../../../model';
import { RecordDialog } from '../../../record-dialog';
import { BreakdownView, TraceView } from '@/features/pricing/breakdown-view';
import {
  bpInput,
  optionalPercentBp,
  percent,
  useCustomerGroupOptions,
} from '@/features/pricing/lookups';
import { rulesApi, rulesKeys, type TierPriceRow } from '@/features/pricing/rules-api';

/* ------------------------------------------------------------------ tiers */

const tierSchema = z
  .object({
    minQty: requiredInt(1, 10_000, 'Minimum quantity'),
    kind: z.enum(['price', 'discount']),
    pricePaise: optionalRupees('Price'),
    discountBp: optionalPercentBp('Discount'),
    customerGroupId: z.string().transform((v) => v || null),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'price' && v.pricePaise === null) {
      ctx.addIssue({ code: 'custom', path: ['pricePaise'], message: 'Enter the unit price' });
    }
    if (v.kind === 'discount' && v.discountBp === null) {
      ctx.addIssue({ code: 'custom', path: ['discountBp'], message: 'Enter the discount' });
    }
  });
type TierValues = z.input<typeof tierSchema>;

interface Target {
  productId?: string;
  variantId?: string;
}

/** Quantity breaks for this product or one of its variants, stored and applied by the API. */
export function ProductTiers({ product }: { product: AdminProductDetailDto }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const groups = useCustomerGroupOptions();
  const [scope, setScope] = useState('');
  const target: Target = scope ? { variantId: scope } : { productId: product.id };
  const query = { page: 1, limit: 50, ...target };
  const tiers = useQuery({
    queryKey: rulesKeys.tiers(query),
    queryFn: ({ signal }) => rulesApi.tiers(query, signal),
    ...cachePolicy.list,
  });
  const [editing, setEditing] = useState<TierPriceRow | 'new' | null>(null);
  const [removing, setRemoving] = useState<TierPriceRow | null>(null);
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const refresh = () => void queryClient.invalidateQueries({ queryKey: rulesKeys.all });
  const editable = !product.deletedAt;

  return (
    <section
      aria-labelledby="product-tiers"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="product-tiers" className="text-base font-semibold">
            Quantity tiers
          </h2>
          <p className="text-sm text-muted-foreground">
            A lower unit price, or a discount, from a minimum quantity. The pricing engine picks the
            tier that applies at checkout.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {product.variants.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tier-scope">Tiers for</Label>
              <NativeSelect
                id="tier-scope"
                size="sm"
                value={scope}
                onChange={(event) => setScope(event.target.value)}
              >
                <option value="">The whole product</option>
                {product.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    Variant {variant.sku}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {editable && canCall(endpoints.pricing.createTierPrice) ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              Add tier
            </Button>
          ) : null}
        </div>
      </div>
      {tiers.isPending ? (
        <SectionLoader label="Loading tiers…" />
      ) : tiers.error ? (
        <ErrorState error={tiers.error} onRetry={() => void tiers.refetch()} compact />
      ) : tiers.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No quantity tiers.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border" aria-label="Quantity tiers">
          {tiers.data.items.map((tier) => (
            <li key={tier.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="font-medium">From {tier.minQty} units</span>
              <span>
                {tier.pricePaise !== null
                  ? `${formatRupees(tier.pricePaise)} each`
                  : `${percent(tier.discountBp)} off`}
              </span>
              <span className="text-muted-foreground">
                {tier.customerGroupId
                  ? `for ${groupName.get(tier.customerGroupId) ?? 'one customer group'}`
                  : 'for everyone'}
              </span>
              {tier.isActive ? null : <Badge tone="neutral">Off</Badge>}
              {editable &&
              (canCall(endpoints.pricing.updateTierPrice) ||
                canCall(endpoints.pricing.removeTierPrice)) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto"
                      aria-label={`Actions for the tier from ${tier.minQty} units`}
                    >
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canCall(endpoints.pricing.updateTierPrice) ? (
                      <DropdownMenuItem onSelect={() => setEditing(tier)}>Edit</DropdownMenuItem>
                    ) : null}
                    {canCall(endpoints.pricing.removeTierPrice) ? (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setRemoving(tier)}
                      >
                        Delete…
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <TierDialog
          tier={editing === 'new' ? null : editing}
          target={target}
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
          onOpenChange={(open) => (open ? undefined : setRemoving(null))}
          title={`Delete the tier from ${removing.minQty} units?`}
          description="Checkout stops using it immediately."
          confirmLabel="Delete tier"
          level="destructive"
          onConfirm={async () => {
            await rulesApi.removeTier(removing.id);
            refresh();
            notifySuccess('Tier deleted');
          }}
        />
      ) : null}
    </section>
  );
}

export function TierDialog({
  tier,
  target,
  groups,
  onClose,
  onSaved,
}: {
  tier: TierPriceRow | null;
  target: Target;
  groups: { value: string; label: string }[];
  onClose(): void;
  onSaved(): void;
}) {
  return (
    <RecordDialog title={tier ? 'Edit quantity tier' : 'New quantity tier'} onClose={onClose}>
      <EditorForm
        schema={tierSchema}
        defaultValues={{
          minQty: intInput(tier?.minQty ?? 2),
          kind: tier && tier.pricePaise === null ? 'discount' : 'price',
          pricePaise: paiseInput(tier?.pricePaise),
          discountBp: bpInput(tier?.discountBp),
          customerGroupId: tier?.customerGroupId ?? '',
          isActive: tier?.isActive ?? true,
        }}
        successMessage={tier ? 'Tier saved' : 'Tier added'}
        submitLabel={tier ? 'Save changes' : 'Add tier'}
        onSubmit={async ({ kind, pricePaise, discountBp, ...rest }) => {
          const value =
            kind === 'price' ? { pricePaise, discountBp: null } : { pricePaise: null, discountBp };
          if (tier) await rulesApi.updateTier(tier.id, { ...rest, ...value });
          else await rulesApi.createTier({ ...target, ...rest, ...value });
          onSaved();
        }}
      >
        <FieldGrid>
          <NumberField<TierValues> name="minQty" label="From quantity" required />
          <SelectField<TierValues>
            name="kind"
            label="Tier gives"
            options={[
              { value: 'price', label: 'A unit price' },
              { value: 'discount', label: 'A percentage off' },
            ]}
          />
        </FieldGrid>
        <FieldGrid>
          <MoneyField<TierValues> name="pricePaise" label="Unit price" />
          <TextField<TierValues>
            name="discountBp"
            label="Discount"
            prefix="%"
            inputMode="decimal"
          />
        </FieldGrid>
        <SelectField<TierValues>
          name="customerGroupId"
          label="Customer group"
          placeholder="Everyone"
          options={groups}
        />
        <CheckField<TierValues> name="isActive" label="Active" />
      </EditorForm>
    </RecordDialog>
  );
}

/* ---------------------------------------------------------------- explain */

/**
 * "Why is it this price?": the engine prices the product for a quantity and group (the same call
 * as checkout), and the API lists every rule that could touch it. Nothing is computed here.
 */
export function ExplainPrice({ product }: { product: AdminProductDetailDto }) {
  const { canCall } = usePermissions();
  const groups = useCustomerGroupOptions();
  const [qty, setQty] = useState('1');
  const [groupId, setGroupId] = useState('');
  const [open, setOpen] = useState(false);
  const explanation = useQuery({
    queryKey: rulesKeys.explain(product.id),
    queryFn: ({ signal }) => rulesApi.explain(product.id, signal),
    enabled: open && canCall(endpoints.pricing.explain),
    ...cachePolicy.diagnostic,
  });
  const quantity = Number(qty);
  const valid = Number.isInteger(quantity) && quantity >= 1 && quantity <= 999;
  const simulation = useMutation({
    mutationFn: () =>
      rulesApi.simulate({
        items: [{ productId: product.id, qty: quantity }],
        channel: 'WEB',
        includeTrace: true,
        ...(groupId ? { customerGroupId: groupId } : {}),
      }),
  });

  return (
    <section
      aria-labelledby="explain-price"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="explain-price" className="text-base font-semibold">
            Explain price
          </h2>
          <p className="text-sm text-muted-foreground">
            The price checkout would charge right now, step by step, from the pricing engine.
          </p>
        </div>
        <Link
          href={`/pricing/simulator?productId=${encodeURIComponent(product.id)}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Open in the simulator
        </Link>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="explain-qty">Quantity</Label>
          <Input
            id="explain-qty"
            inputMode="numeric"
            className="w-24"
            value={qty}
            aria-invalid={!valid}
            onChange={(event) => setQty(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="explain-group">Customer group</Label>
          <NativeSelect
            id="explain-group"
            value={groupId}
            disabled={!groups.data}
            onChange={(event) => setGroupId(event.target.value)}
          >
            <option value="">Default (a guest)</option>
            {(groups.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button
          variant="outline"
          disabled={!valid}
          loading={simulation.isPending}
          onClick={() => {
            setOpen(true);
            simulation.mutate();
          }}
        >
          Explain this price
        </Button>
      </div>
      {valid ? null : <p className="text-sm text-destructive">Enter a quantity from 1 to 999.</p>}
      <FormAlert error={simulation.error} />
      <div aria-live="polite" className="flex flex-col gap-4">
        {simulation.data ? (
          <>
            <BreakdownView
              breakdown={simulation.data.breakdown}
              names={{ [product.id]: product.name }}
            />
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                Every rule the engine considered
              </summary>
              <div className="mt-2">
                <TraceView trace={simulation.data.trace} />
              </div>
            </details>
          </>
        ) : null}
        {open && explanation.error ? (
          <ErrorState
            error={explanation.error}
            onRetry={() => void explanation.refetch()}
            compact
          />
        ) : null}
        {explanation.data ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Rules that could apply to this product
            </summary>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
              <dt className="text-muted-foreground">Base price</dt>
              <dd>{formatRupees(explanation.data.basePricePaise)}</dd>
              <dt className="text-muted-foreground">Tax class</dt>
              <dd>{explanation.data.taxClassCode ?? 'Not set'}</dd>
              <dt className="text-muted-foreground">Price rules</dt>
              <dd>
                {explanation.data.adjustments.length === 0
                  ? 'None'
                  : explanation.data.adjustments
                      .map((a) => `${a.name}${a.active ? '' : ' (off)'}`)
                      .join(', ')}
              </dd>
              <dt className="text-muted-foreground">Quantity tiers</dt>
              <dd>
                {explanation.data.tiers.length === 0
                  ? 'None'
                  : explanation.data.tiers
                      .map((t) =>
                        t.pricePaise !== null
                          ? `${t.minQty}+ at ${formatRupees(t.pricePaise)}`
                          : `${t.minQty}+ at ${percent(t.discountBp)} off`,
                      )
                      .join(', ')}
              </dd>
              <dt className="text-muted-foreground">Price lists</dt>
              <dd>
                {explanation.data.priceListItems.length === 0
                  ? 'None'
                  : explanation.data.priceListItems
                      .map(
                        (i) => `${i.priceListCode}: ${formatRupees(i.pricePaise)} from ${i.minQty}`,
                      )
                      .join(', ')}
              </dd>
              <dt className="text-muted-foreground">Coupons</dt>
              <dd>
                {explanation.data.coupons.length === 0
                  ? 'None'
                  : explanation.data.coupons.map((c) => `${c.code} (${c.scopeNote})`).join(', ')}
              </dd>
              <dt className="text-muted-foreground">Automatic discounts</dt>
              <dd>
                {explanation.data.discountRules.length === 0
                  ? 'None'
                  : explanation.data.discountRules.map((r) => r.code).join(', ')}
              </dd>
            </dl>
          </details>
        ) : null}
      </div>
    </section>
  );
}
