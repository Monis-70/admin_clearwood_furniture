'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useController } from 'react-hook-form';
import { z } from 'zod';

import type { CouponAppliesTo } from '@shared/types/pricing';

import { CopyButton } from '@/components/patterns/copy-button';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { pricingRoutes } from '@/lib/api/routes/pricing';
import { formatDateTime, formatNumber } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  MoneyField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  dateTimeInput,
  intInput,
  optionalDateTime,
  optionalInt,
  optionalRupees,
  optionalText,
  paiseInput,
  requiredInt,
  requiredText,
  textInput,
} from '../catalog/form-kit';
import { flattenTree, useCategoryOptions } from '../catalog/lookups';
import { formatRupees } from '../catalog/model';
import { RecordDialog } from '../catalog/record-dialog';

import { optionalPercentBp } from './fields';
import { bpInput, useCustomerGroupOptions } from './lookups';
import { TYPE_LABELS, couponState, describeCoupon } from './coupon-model';
import { couponsApi, parseAppliesTo, promotionsKeys, type CouponRow } from './promotions-api';

const couponFields = {
  name: requiredText(2, 160, 'Name'),
  type: z.string(),
  valueBp: optionalPercentBp('Percentage'),
  valuePaise: optionalRupees('Amount'),
  minSubtotalPaise: optionalRupees('Minimum cart value'),
  maxDiscountPaise: optionalRupees('Largest discount'),
  usageLimit: optionalInt(1, 1_000_000, 'Total uses'),
  perCustomerLimit: optionalInt(1, 1_000, 'Uses per customer'),
  startsAt: optionalDateTime(),
  endsAt: optionalDateTime(),
  isActive: z.boolean(),
  isStackable: z.boolean(),
  isAutoApply: z.boolean(),
  firstOrderOnly: z.boolean(),
  categoryIds: z.array(z.string()),
  customerGroupIds: z.array(z.string()),
  description: optionalText(1_000),
  termsText: optionalText(4_000),
};

const checkCoupon = (
  v: {
    type: string;
    valueBp: number | null;
    valuePaise: number | null;
    startsAt: string | null;
    endsAt: string | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (v.type === 'PERCENT' && v.valueBp === null)
    ctx.addIssue({ code: 'custom', path: ['valueBp'], message: 'Enter the percentage' });
  if (v.type === 'FIXED' && v.valuePaise === null)
    ctx.addIssue({ code: 'custom', path: ['valuePaise'], message: 'Enter the amount' });
  if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt)
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end must be after the start' });
};

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,40}$/, '3–40 letters, digits, - or _'),
    ...couponFields,
  })
  .superRefine(checkCoupon);
type CouponValues = z.input<typeof couponSchema>;

/** Only the parts of `appliesTo` this form edits; the rest of a stored value is kept. */
function mergeAppliesTo(
  stored: CouponAppliesTo | null,
  categoryIds: string[],
  customerGroupIds: string[],
) {
  const next: CouponAppliesTo = { ...(stored ?? {}) };
  if (categoryIds.length) next.categoryIds = categoryIds;
  else delete next.categoryIds;
  if (customerGroupIds.length) next.customerGroupIds = customerGroupIds;
  else delete next.customerGroupIds;
  return Object.keys(next).length > 0 ? next : null;
}

function CouponFields({ creating }: { creating: boolean }) {
  const categories = useCategoryOptions();
  const groups = useCustomerGroupOptions();
  return (
    <>
      <FormSection title="Coupon">
        <FieldGrid>
          {creating ? (
            <TextField<CouponValues>
              name="code"
              label="Code"
              required
              description="Customers type it; saved in capitals."
            />
          ) : null}
          <TextField<CouponValues> name="name" label="Name" required />
        </FieldGrid>
        <FieldGrid columns={3}>
          <SelectField<CouponValues>
            name="type"
            label="Gives"
            options={Object.entries(TYPE_LABELS)
              .filter(([value]) => value !== 'TIERED' || !creating)
              .map(([value, label]) => ({ value, label, disabled: value === 'TIERED' }))}
          />
          <TextField<CouponValues>
            name="valueBp"
            label="Percentage"
            prefix="%"
            inputMode="decimal"
          />
          <MoneyField<CouponValues> name="valuePaise" label="Amount" />
        </FieldGrid>
        <FieldGrid>
          <MoneyField<CouponValues> name="minSubtotalPaise" label="Minimum cart value" />
          <MoneyField<CouponValues>
            name="maxDiscountPaise"
            label="Largest discount"
            description="For percentage coupons."
          />
        </FieldGrid>
      </FormSection>
      <FormSection title="Limits and dates">
        <FieldGrid>
          <NumberField<CouponValues>
            name="usageLimit"
            label="Total uses"
            description="Empty: unlimited."
          />
          <NumberField<CouponValues>
            name="perCustomerLimit"
            label="Uses per customer"
            description="Empty: unlimited."
          />
          <TextField<CouponValues> name="startsAt" label="Starts" type="datetime-local" />
          <TextField<CouponValues> name="endsAt" label="Ends" type="datetime-local" />
        </FieldGrid>
        <FieldGrid>
          <CheckField<CouponValues> name="isActive" label="Active" />
          <CheckField<CouponValues> name="isStackable" label="Combines with other coupons" />
          <CheckField<CouponValues>
            name="isAutoApply"
            label="Apply automatically"
            description="No code needed; applied when the cart qualifies."
          />
          <CheckField<CouponValues> name="firstOrderOnly" label="First order only" />
        </FieldGrid>
      </FormSection>
      <FormSection
        title="Who and what"
        description="Leave empty for every product and every customer."
      >
        <MultiSelect
          name="categoryIds"
          label="Only these categories"
          options={flattenTree(categories.data ?? []).map((c) => ({
            value: c.id,
            label: `${'\u00a0\u00a0'.repeat(c.depth)}${c.name}`,
          }))}
        />
        <MultiSelect
          name="customerGroupIds"
          label="Only these customer groups"
          options={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
        />
      </FormSection>
      <FormSection title="Text">
        <TextAreaField<CouponValues> name="description" label="Description" rows={2} />
        <TextAreaField<CouponValues> name="termsText" label="Terms shown to customers" rows={3} />
      </FormSection>
    </>
  );
}

function MultiSelect({
  name,
  label,
  options,
}: {
  name: 'categoryIds' | 'customerGroupIds';
  label: string;
  options: { value: string; label: string }[];
}) {
  const { field } = useController<CouponValues, typeof name>({ name });
  const id = `multi-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        multiple
        size={Math.min(6, Math.max(3, options.length))}
        className="rounded-md border bg-background p-1 text-sm disabled:opacity-60"
        value={field.value}
        disabled={field.disabled}
        onChange={(e) => field.onChange(Array.from(e.target.selectedOptions, (o) => o.value))}
        onBlur={field.onBlur}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">Hold Ctrl (or ⌘) to choose several.</span>
    </div>
  );
}

export function CouponDialog({
  coupon,
  onClose,
  onSaved,
}: {
  coupon: CouponRow | null;
  onClose(): void;
  onSaved(): void;
}) {
  const keyFor = useIdempotencyKey();
  const stored = coupon ? parseAppliesTo(coupon) : null;
  return (
    <RecordDialog title={coupon ? `Edit ${coupon.code}` : 'New coupon'} onClose={onClose} wide>
      <EditorForm
        schema={couponSchema}
        defaultValues={{
          code: textInput(coupon?.code),
          name: textInput(coupon?.name),
          type: coupon?.type ?? 'PERCENT',
          valueBp: bpInput(coupon?.valueBp),
          valuePaise: paiseInput(coupon?.valuePaise),
          minSubtotalPaise: paiseInput(coupon?.minSubtotalPaise),
          maxDiscountPaise: paiseInput(coupon?.maxDiscountPaise),
          usageLimit: intInput(coupon?.usageLimit),
          perCustomerLimit: intInput(coupon?.perCustomerLimit),
          startsAt: dateTimeInput(coupon?.startsAt),
          endsAt: dateTimeInput(coupon?.endsAt),
          isActive: coupon?.isActive ?? true,
          isStackable: coupon?.isStackable ?? false,
          isAutoApply: coupon?.isAutoApply ?? false,
          firstOrderOnly: coupon?.firstOrderOnly ?? false,
          categoryIds: stored?.categoryIds ?? [],
          customerGroupIds: stored?.customerGroupIds ?? [],
          description: textInput(coupon?.description),
          termsText: textInput(coupon?.termsText),
        }}
        successMessage={coupon ? 'Coupon saved' : 'Coupon created'}
        submitLabel={coupon ? 'Save changes' : 'Create coupon'}
        onSubmit={async ({ code, type, categoryIds, customerGroupIds, ...values }) => {
          const appliesTo = mergeAppliesTo(stored, categoryIds, customerGroupIds);
          if (coupon) {
            await couponsApi.update(coupon.id, { ...values, appliesTo, version: coupon.version });
          } else {
            const input = {
              ...values,
              code: code.toUpperCase(),
              type: type as 'PERCENT',
              appliesTo,
            };
            await couponsApi.create(input, keyFor(input));
          }
          onSaved();
        }}
      >
        <CouponFields creating={!coupon} />
      </EditorForm>
    </RecordDialog>
  );
}

const generateSchema = z
  .object({
    prefix: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{0,12}$/, 'Up to 12 capital letters or digits'),
    count: requiredInt(1, 500, 'How many'),
    ...couponFields,
  })
  .superRefine(checkCoupon);
type GenerateValues = z.input<typeof generateSchema>;

export function GenerateDialog({ onClose, onDone }: { onClose(): void; onDone(): void }) {
  const keyFor = useIdempotencyKey();
  const [codes, setCodes] = useState<string[] | null>(null);
  return (
    <RecordDialog
      title="Generate coupon codes"
      description="Creates unique codes that share the same settings, for example one per customer."
      onClose={onClose}
      wide
    >
      {codes ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">{codes.length} codes created.</p>
          <textarea
            readOnly
            aria-label="Generated codes"
            className="h-48 rounded-md border bg-muted/30 p-2 font-mono text-sm"
            value={codes.join('\n')}
          />
          <div className="flex gap-2">
            <CopyButton value={codes.join('\n')} label="Copy all codes" />
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <EditorForm
          schema={generateSchema}
          defaultValues={{
            prefix: '',
            count: '10',
            name: '',
            type: 'PERCENT',
            valueBp: '',
            valuePaise: '',
            minSubtotalPaise: '',
            maxDiscountPaise: '',
            usageLimit: '1',
            perCustomerLimit: '1',
            startsAt: '',
            endsAt: '',
            isActive: true,
            isStackable: false,
            isAutoApply: false,
            firstOrderOnly: false,
            categoryIds: [],
            customerGroupIds: [],
            description: '',
            termsText: '',
          }}
          successMessage="Codes generated"
          submitLabel="Generate codes"
          onSubmit={async ({ prefix, count, type, categoryIds, customerGroupIds, ...template }) => {
            const input = {
              prefix,
              count,
              template: {
                ...template,
                type: type as 'PERCENT',
                appliesTo: mergeAppliesTo(null, categoryIds, customerGroupIds),
              },
            };
            const result = await couponsApi.generate(input, keyFor(input));
            setCodes(result.codes);
            onDone();
          }}
        >
          <FieldGrid>
            <TextField<GenerateValues>
              name="prefix"
              label="Prefix"
              description="e.g. DIWALI → DIWALI7F3K9QX2"
            />
            <NumberField<GenerateValues>
              name="count"
              label="How many codes"
              required
              description="1 to 500."
            />
          </FieldGrid>
          <CouponFields creating={false} />
        </EditorForm>
      )}
    </RecordDialog>
  );
}

export function CouponSheet({
  id,
  onClose,
  onEdit,
}: {
  id: string;
  onClose(): void;
  onEdit(coupon: CouponRow): void;
}) {
  const { canCall } = usePermissions();
  const coupon = useQuery({
    queryKey: promotionsKeys.coupon(id),
    queryFn: ({ signal }) => couponsApi.get(id, signal),
    ...cachePolicy.detail,
  });
  const redemptions = useQuery({
    queryKey: promotionsKeys.redemptions(id),
    queryFn: ({ signal }) => couponsApi.redemptions(id, signal),
    ...cachePolicy.list,
  });
  return (
    <Sheet open onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {coupon.isPending ? (
          <>
            <SheetTitle className="sr-only">Coupon</SheetTitle>
            <SheetDescription className="sr-only">Loading</SheetDescription>
            <SectionLoader label="Loading coupon…" />
          </>
        ) : coupon.error ? (
          <>
            <SheetTitle>Coupon</SheetTitle>
            <SheetDescription className="sr-only">Could not load</SheetDescription>
            <ErrorState error={coupon.error} onRetry={() => void coupon.refetch()} />
          </>
        ) : (
          <div className="flex flex-col gap-5">
            <SheetHeader className="p-0">
              <SheetTitle className="font-mono">{coupon.data.code}</SheetTitle>
              <SheetDescription>{coupon.data.name}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap gap-2">
              <Badge tone={couponState(coupon.data).tone}>{couponState(coupon.data).label}</Badge>
              <CopyButton value={coupon.data.code} label="Copy code" />
              {canCall(pricingRoutes.updateCoupon) ? (
                <Button size="sm" variant="outline" onClick={() => onEdit(coupon.data)}>
                  Edit
                </Button>
              ) : null}
            </div>
            <dl className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
              <dt className="text-muted-foreground">Gives</dt>
              <dd>{describeCoupon(coupon.data)}</dd>
              <dt className="text-muted-foreground">Uses</dt>
              <dd>
                {formatNumber(coupon.data.usedCount)}
                {coupon.data.usageLimit ? ` of ${formatNumber(coupon.data.usageLimit)}` : ''}
                {coupon.data.perCustomerLimit
                  ? `, ${coupon.data.perCustomerLimit} per customer`
                  : ''}
              </dd>
              <dt className="text-muted-foreground">Valid</dt>
              <dd>
                {coupon.data.startsAt ? formatDateTime(coupon.data.startsAt) : 'Now'} –{' '}
                {coupon.data.endsAt ? formatDateTime(coupon.data.endsAt) : 'no end'}
              </dd>
              <dt className="text-muted-foreground">Redemptions</dt>
              <dd>
                {Object.entries(coupon.data.redemptions ?? {}).length === 0
                  ? 'None yet'
                  : Object.entries(coupon.data.redemptions)
                      .map(([status, count]) => `${count} ${status.toLowerCase()}`)
                      .join(', ')}
              </dd>
            </dl>
            <section aria-labelledby="redemptions" className="flex flex-col gap-2">
              <h3 id="redemptions" className="text-sm font-semibold">
                Recent redemptions
              </h3>
              {redemptions.isPending ? (
                <SectionLoader label="Loading redemptions…" />
              ) : redemptions.error ? (
                <ErrorState
                  error={redemptions.error}
                  onRetry={() => void redemptions.refetch()}
                  compact
                />
              ) : redemptions.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody has used this coupon yet.</p>
              ) : (
                <ul className="flex flex-col divide-y rounded-md border text-sm">
                  {redemptions.data.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <Badge
                        tone={
                          r.status === 'CONFIRMED'
                            ? 'success'
                            : r.status === 'RELEASED'
                              ? 'neutral'
                              : 'info'
                        }
                      >
                        {r.status.toLowerCase()}
                      </Badge>
                      <span className="tabular">{formatRupees(r.amountPaise)}</span>
                      <span className="ml-auto text-muted-foreground">
                        {formatDateTime(r.reservedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
