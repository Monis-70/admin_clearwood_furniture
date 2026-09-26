'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';

import type { PriceAdjustmentCreateInput } from '@shared/schemas/catalogAdmin';

import { Button } from '@/components/ui/button';
import { cachePolicy } from '@/lib/query/policies';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  dateTimeInput,
  intInput,
  optionalDateTime,
  optionalInt,
  optionalText,
  requiredInt,
  requiredText,
  textInput,
} from '../catalog/form-kit';
import { flattenTree, useAttributeOptions, useCategoryOptions } from '../catalog/lookups';
import { ProductSearch } from '../catalog/product-search';
import { productKeys, variantsApi } from '../catalog/products/api';
import { RecordDialog } from '../catalog/record-dialog';

import { priceAdjustmentsApi, type PriceAdjustmentRow } from './api';

import { ADJUSTMENT_BASES, ADJUSTMENT_SCOPES, ADJUSTMENT_TYPES, describeAdjustment } from './model';

/** Scopes an admin can create here. CUSTOMIZATION rules are supplied by the configurator. */
const CREATABLE_SCOPES = ['GLOBAL', 'CATEGORY', 'PRODUCT', 'VARIANT', 'ATTRIBUTE_VALUE'];
const TARGET_FIELD: Record<
  string,
  'categoryId' | 'productId' | 'variantId' | 'attributeValueId' | undefined
> = {
  CATEGORY: 'categoryId',
  PRODUCT: 'productId',
  VARIANT: 'variantId',
  ATTRIBUTE_VALUE: 'attributeValueId',
};
const NUMBER = /^\d{1,9}(\.\d{1,4})?$/;

const schema = z
  .object({
    name: requiredText(2, 160, 'Name'),
    scope: z.string(),
    adjustmentType: z.string(),
    basis: z.string(),
    direction: z.enum(['DISCOUNT', 'SURCHARGE']),
    amount: z.string().trim(),
    priority: requiredInt(0, 10_000, 'Priority'),
    isActive: z.boolean(),
    categoryId: z.string(),
    productId: z.string(),
    productLabel: z.string(),
    variantId: z.string(),
    attributeId: z.string(),
    attributeValueId: z.string(),
    minQty: optionalInt(1, 1_000_000, 'Minimum quantity'),
    maxQty: optionalInt(1, 1_000_000, 'Maximum quantity'),
    startsAt: optionalDateTime(),
    endsAt: optionalDateTime(),
    note: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (!NUMBER.test(value.amount) || Number(value.amount) === 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter a number above zero' });
    }
    const field = TARGET_FIELD[value.scope];
    if (field && !value[field]) {
      ctx.addIssue({
        code: 'custom',
        path: [field === 'variantId' && !value.productId ? 'productId' : field],
        message: 'Choose what this rule applies to',
      });
    }
    if (value.minQty !== null && value.maxQty !== null && value.maxQty < value.minQty) {
      ctx.addIssue({ code: 'custom', path: ['maxQty'], message: 'Must be at least the minimum' });
    }
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Must be after the start' });
    }
  });
type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** The typed amount as the API stores it: paise for amounts, basis points for % and ×. */
export function toStoredValue(type: string, direction: 'DISCOUNT' | 'SURCHARGE', amount: string) {
  const sign = direction === 'DISCOUNT' ? -1 : 1;
  const n = Number(amount);
  switch (type) {
    case 'PERCENT':
      return { valuePaise: null, valueBp: sign * Math.round(n * 100) };
    case 'MULTIPLIER':
      return { valuePaise: null, valueBp: Math.round(n * 10_000) };
    default:
      return { valuePaise: sign * Math.round(n * 100), valueBp: null };
  }
}

export function fromStoredValue(
  rule: Pick<PriceAdjustmentRow, 'adjustmentType' | 'valuePaise' | 'valueBp'>,
) {
  switch (rule.adjustmentType) {
    case 'PERCENT':
      return {
        direction: (rule.valueBp ?? 0) < 0 ? 'DISCOUNT' : 'SURCHARGE',
        amount: rule.valueBp === null ? '' : String(Math.abs(rule.valueBp) / 100),
      } as const;
    case 'MULTIPLIER':
      return {
        direction: 'SURCHARGE',
        amount: rule.valueBp === null ? '' : String(rule.valueBp / 10_000),
      } as const;
    default:
      return {
        direction: (rule.valuePaise ?? 0) < 0 ? 'DISCOUNT' : 'SURCHARGE',
        amount: rule.valuePaise === null ? '' : String(Math.abs(rule.valuePaise) / 100),
      } as const;
  }
}

export function PriceRuleDialog({
  rule,
  initialProductId,
  onClose,
  onSaved,
}: {
  rule: PriceAdjustmentRow | null;
  initialProductId: string | null;
  onClose(): void;
  onSaved(): void;
}) {
  const stored = rule ? fromStoredValue(rule) : { direction: 'DISCOUNT' as const, amount: '' };
  return (
    <RecordDialog
      wide
      title={rule ? `Edit ${rule.name}` : 'New price rule'}
      description="The pricing engine applies active rules in priority order. This form only stores the rule."
      onClose={onClose}
    >
      <EditorForm<Values, Output, PriceAdjustmentRow>
        schema={schema}
        defaultValues={{
          name: textInput(rule?.name),
          scope: rule?.scope ?? (initialProductId ? 'PRODUCT' : 'GLOBAL'),
          adjustmentType: rule?.adjustmentType ?? 'PERCENT',
          basis: rule?.basis ?? 'BASE',
          direction: stored.direction,
          amount: stored.amount,
          priority: intInput(rule?.priority ?? 100),
          isActive: rule?.isActive ?? true,
          categoryId: textInput(rule?.categoryId),
          productId: textInput(rule?.productId ?? initialProductId),
          productLabel: rule?.productId || initialProductId ? 'The selected product' : '',
          variantId: textInput(rule?.variantId),
          attributeId: textInput(rule?.attributeId),
          attributeValueId: textInput(rule?.attributeValueId),
          minQty: intInput(rule?.minQty),
          maxQty: intInput(rule?.maxQty),
          startsAt: dateTimeInput(rule?.startsAt),
          endsAt: dateTimeInput(rule?.endsAt),
          note: textInput(rule?.note),
        }}
        successMessage={rule ? 'Price rule saved' : 'Price rule created'}
        submitLabel={rule ? 'Save changes' : 'Create rule'}
        aliases={{ valuePaise: 'amount', valueBp: 'amount' }}
        onSubmit={async (values) => {
          const value = toStoredValue(values.adjustmentType, values.direction, values.amount);
          const common = {
            name: values.name,
            priority: values.priority,
            isActive: values.isActive,
            ...value,
            minQty: values.minQty,
            maxQty: values.maxQty,
            startsAt: values.startsAt,
            endsAt: values.endsAt,
            note: values.note,
          };
          if (rule) {
            await priceAdjustmentsApi.update(rule.id, { ...common, version: rule.version });
          } else {
            const field = TARGET_FIELD[values.scope];
            await priceAdjustmentsApi.create({
              ...common,
              scope: values.scope as PriceAdjustmentCreateInput['scope'],
              adjustmentType: values.adjustmentType as PriceAdjustmentCreateInput['adjustmentType'],
              basis: values.basis as PriceAdjustmentCreateInput['basis'],
              ...(field ? { [field]: values[field] } : {}),
              ...(values.scope === 'ATTRIBUTE_VALUE'
                ? { attributeId: values.attributeId || null }
                : {}),
            });
          }
          onSaved();
        }}
      >
        <RuleFields editing={Boolean(rule)} />
      </EditorForm>
    </RecordDialog>
  );
}

function RuleFields({ editing }: { editing: boolean }) {
  const form = useFormContext<Values>();
  const values = useWatch<Values>({ control: form.control }) as Values;
  const type = values.adjustmentType;
  const preview = NUMBER.test(values.amount ?? '')
    ? describeAdjustment({
        adjustmentType: type,
        basis: values.basis,
        ...toStoredValue(type, values.direction, values.amount),
        minQty: /^\d+$/.test(values.minQty ?? '') ? Number(values.minQty) : null,
        maxQty: /^\d+$/.test(values.maxQty ?? '') ? Number(values.maxQty) : null,
        startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
        isActive: values.isActive,
      })
    : null;

  return (
    <>
      <FormSection title="Rule">
        <TextField<Values>
          name="name"
          label="Name"
          required
          description="For admins, e.g. “Diwali sofa sale”."
        />
        {editing ? (
          <p className="text-sm">
            Applies to <strong>{ADJUSTMENT_SCOPES[values.scope] ?? values.scope}</strong> ·{' '}
            {ADJUSTMENT_TYPES[type] ?? type}.{' '}
            <span className="text-muted-foreground">
              Scope, type and target are fixed once created; make a new rule to change them.
            </span>
          </p>
        ) : (
          <FieldGrid>
            <SelectField<Values>
              name="scope"
              label="Applies to"
              options={CREATABLE_SCOPES.map((value) => ({
                value,
                label: ADJUSTMENT_SCOPES[value]!,
              }))}
            />
            <SelectField<Values>
              name="adjustmentType"
              label="Kind"
              options={Object.entries(ADJUSTMENT_TYPES).map(([value, label]) => ({ value, label }))}
            />
          </FieldGrid>
        )}
        {editing ? null : <TargetFields scope={values.scope} />}
      </FormSection>
      <FormSection title="Amount">
        <FieldGrid columns={3}>
          {type === 'MULTIPLIER' ? null : (
            <SelectField<Values>
              name="direction"
              label="Direction"
              options={[
                { value: 'DISCOUNT', label: 'Discount (lower price)' },
                { value: 'SURCHARGE', label: 'Surcharge (higher price)' },
              ]}
            />
          )}
          <TextField<Values>
            name="amount"
            label={
              type === 'PERCENT' ? 'Percent' : type === 'MULTIPLIER' ? 'Multiplier' : 'Amount (₹)'
            }
            prefix={type === 'PERCENT' ? '%' : type === 'MULTIPLIER' ? '×' : '₹'}
            inputMode="decimal"
            required
          />
          {editing ? null : (
            <SelectField<Values>
              name="basis"
              label="Calculated on"
              options={Object.entries(ADJUSTMENT_BASES).map(([value, label]) => ({ value, label }))}
            />
          )}
        </FieldGrid>
        {preview ? (
          <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
            {preview}
          </p>
        ) : null}
      </FormSection>
      <FormSection title="When">
        <FieldGrid>
          <TextField<Values>
            name="startsAt"
            label="Starts"
            type="datetime-local"
            description="Empty: straight away."
          />
          <TextField<Values>
            name="endsAt"
            label="Ends"
            type="datetime-local"
            description="Empty: no end."
          />
        </FieldGrid>
        <FieldGrid>
          <NumberField<Values> name="minQty" label="Minimum quantity" />
          <NumberField<Values> name="maxQty" label="Maximum quantity" />
        </FieldGrid>
        <FieldGrid>
          <NumberField<Values>
            name="priority"
            label="Priority"
            description="Lower numbers apply first."
          />
          <CheckField<Values> name="isActive" label="Active" />
        </FieldGrid>
        <TextAreaField<Values> name="note" label="Internal note" rows={2} />
      </FormSection>
    </>
  );
}

function TargetFields({ scope }: { scope: string }) {
  const form = useFormContext<Values>();
  const productId = useWatch<Values, 'productId'>({ name: 'productId' });
  const productLabel = useWatch<Values, 'productLabel'>({ name: 'productLabel' });
  const attributeId = useWatch<Values, 'attributeId'>({ name: 'attributeId' });
  const categories = useCategoryOptions();
  const attributes = useAttributeOptions();
  const [picking, setPicking] = useState(!productId);
  const variants = useQuery({
    queryKey: productKeys.variants(productId || 'none'),
    queryFn: ({ signal }) => variantsApi.list(productId, signal),
    enabled: scope === 'VARIANT' && Boolean(productId),
    ...cachePolicy.detail,
  });
  const set = (name: keyof Values, value: string) =>
    form.setValue(name, value as never, { shouldDirty: true, shouldValidate: true });

  if (scope === 'CATEGORY') {
    return (
      <SelectField<Values>
        name="categoryId"
        label="Category"
        placeholder="Choose a category…"
        options={flattenTree(categories.data ?? []).map((c) => ({
          value: c.id,
          label: `${'\u00a0\u00a0'.repeat(c.depth)}${c.name}`,
        }))}
      />
    );
  }
  if (scope === 'ATTRIBUTE_VALUE') {
    const attribute = attributes.data?.find((a) => a.id === attributeId);
    return (
      <FieldGrid>
        <SelectField<Values>
          name="attributeId"
          label="Option"
          placeholder="Choose an attribute…"
          options={(attributes.data ?? [])
            .filter((a) => a.values.length > 0)
            .map((a) => ({ value: a.id, label: a.name }))}
        />
        <SelectField<Values>
          name="attributeValueId"
          label="Value"
          placeholder={attribute ? 'Choose a value…' : 'Choose the option first'}
          options={(attribute?.values ?? []).map((v) => ({ value: v.id, label: v.label }))}
        />
      </FieldGrid>
    );
  }
  if (scope === 'PRODUCT' || scope === 'VARIANT') {
    const error = form.formState.errors.productId?.message;
    return (
      <div className="flex flex-col gap-3">
        {productId && !picking ? (
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>
              Product: <strong>{productLabel || 'The selected product'}</strong>
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPicking(true)}>
              Change
            </Button>
          </div>
        ) : (
          <ProductSearch
            label="Product"
            onPick={(product) => {
              set('productId', product.id);
              set('productLabel', `${product.name} (${product.sku})`);
              set('variantId', '');
              setPicking(false);
            }}
          />
        )}
        {error ? <p className="text-sm text-danger">{String(error)}</p> : null}
        {scope === 'VARIANT' && productId ? (
          <SelectField<Values>
            name="variantId"
            label="Variant"
            placeholder={variants.isPending ? 'Loading variants…' : 'Choose a variant…'}
            options={(variants.data ?? []).map((v) => ({
              value: v.id,
              label: `${v.sku}${v.name ? ` · ${v.name}` : ''}`,
            }))}
          />
        ) : null}
      </div>
    );
  }
  return null;
}
