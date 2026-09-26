'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { AdminProductDetailDto, AdminVariantDto } from '@shared/types/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { hasCode } from '@/lib/api/errors';
import { notifySuccess } from '@/lib/notify';
import { applyServerErrors } from '@/lib/validation/server-errors';

import {
  CheckField,
  FieldGrid,
  MoneyField,
  NumberField,
  TextField,
  intInput,
  optionalInt,
  optionalRupees,
  optionalText,
  paiseInput,
  requiredInt,
  textInput,
} from '../../form-kit';
import type { AttributeRow } from '../../taxonomy/api';
import { productKeys, variantsApi } from '../api';

const schema = z.object({
  sku: z.string().trim().max(64),
  name: optionalText(160),
  pricePaise: optionalRupees('Price'),
  compareAtPricePaise: optionalRupees('Compare-at price'),
  costPricePaise: optionalRupees('Cost price'),
  lowStockThreshold: requiredInt(0, 100_000, 'Low-stock level'),
  allowBackorder: z.boolean(),
  isActive: z.boolean(),
  barcode: optionalText(64),
  weightGrams: optionalInt(0, 10_000_000, 'Weight'),
  leadTimeDays: optionalInt(0, 365, 'Lead time'),
  openingStock: optionalInt(0, 1_000_000, 'Opening stock'),
});
type Values = z.input<typeof schema>;

/**
 * Add or edit one variant. Options are chosen from the attribute values (one per option); the
 * API refuses a combination that already exists (409 VARIANT_COMBINATION_EXISTS) and a stale edit
 * (409 STALE_RESOURCE), and both are explained here.
 */
export function VariantDialog({
  product,
  variant,
  attributes,
  options,
  onClose,
  onSaved,
}: {
  product: AdminProductDetailDto;
  variant: AdminVariantDto | null;
  attributes: readonly AttributeRow[];
  options: readonly AttributeRow[];
  onClose(): void;
  onSaved(): void;
}) {
  const queryClient = useQueryClient();
  const creating = variant === null;
  const choices = options.length > 0 ? options : [];
  const variantDefining = attributes.filter((a) => a.isVariantDefining && a.isActive);
  const [extra, setExtra] = useState<string[]>([]);
  const optionList = [
    ...choices,
    ...variantDefining.filter((a) => extra.includes(a.id) && !choices.includes(a)),
  ];
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (variant?.attributeValues ?? []).map((v) => [v.attributeId, v.attributeValueId]),
    ),
  );
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [messages, setMessages] = useState<string[]>([]);

  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: variant?.sku ?? '',
      name: textInput(variant?.name),
      pricePaise: paiseInput(variant?.pricePaise),
      compareAtPricePaise: paiseInput(variant?.compareAtPricePaise),
      costPricePaise: paiseInput(variant?.costPricePaise),
      lowStockThreshold: intInput(variant?.lowStockThreshold ?? 0),
      allowBackorder: variant?.allowBackorder ?? false,
      isActive: variant?.isActive ?? true,
      barcode: textInput(variant?.barcode),
      weightGrams: intInput(variant?.weightGrams),
      leadTimeDays: intInput(variant?.leadTimeDays),
      openingStock: '',
    },
  });
  const missing = optionList.filter((attribute) => !picked[attribute.id]);

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setMessages([]);
    const attributeValues = optionList
      .filter((attribute) => picked[attribute.id])
      .map((attribute) => ({ attributeId: attribute.id, attributeValueId: picked[attribute.id]! }));
    const { openingStock, sku, ...rest } = values;
    try {
      if (creating) {
        await variantsApi.create(product.id, {
          ...rest,
          ...(sku ? { sku } : {}),
          attributeValues,
          ...(openingStock !== null ? { openingStock } : {}),
          position: product.variants.length,
          isDefault: product.variants.length === 0,
        });
        notifySuccess('Variant added');
      } else {
        await variantsApi.update(product.id, variant.id, {
          ...rest,
          ...(sku ? { sku } : {}),
          attributeValues,
          version: variant.version,
        });
        notifySuccess('Variant saved');
      }
      onSaved();
      onClose();
    } catch (error) {
      if (hasCode(error, 'STALE_RESOURCE')) {
        void queryClient.invalidateQueries({ queryKey: productKeys.detail(product.id) });
      }
      const mapped = applyServerErrors(error, form.setError);
      if (mapped && Object.keys(mapped.fields).length > 0) setMessages(mapped.form);
      else setSubmitError(error);
    }
  });

  const addable = variantDefining.filter((a) => !optionList.includes(a));

  return (
    <Dialog
      open
      onOpenChange={(open) => (open || form.formState.isSubmitting ? undefined : onClose())}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{creating ? 'Add a variant' : `Edit ${variant.sku}`}</DialogTitle>
          <DialogDescription>
            {creating
              ? 'Choose its options. Leave the SKU empty to generate one; leave the price empty to use the base price.'
              : 'Changes apply to this variant only.'}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <FormAlert error={submitError} messages={messages} />
            {hasCode(submitError, 'STALE_RESOURCE') ? (
              <p className="text-sm">
                The product was reloaded with the latest variants. Close this dialog and open the
                variant again to see the current values.
              </p>
            ) : null}
            <fieldset className="flex flex-col gap-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Options</legend>
              {optionList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No options: this variant is the product itself. Add an option to sell versions.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {optionList.map((attribute) => (
                    <div key={attribute.id} className="flex flex-col gap-1.5">
                      <Label htmlFor={`opt-${attribute.id}`}>{attribute.name}</Label>
                      <NativeSelect
                        id={`opt-${attribute.id}`}
                        value={picked[attribute.id] ?? ''}
                        aria-invalid={!picked[attribute.id] || undefined}
                        onChange={(event) =>
                          setPicked((current) => ({
                            ...current,
                            [attribute.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose {attribute.name.toLowerCase()}</option>
                        {attribute.values
                          .filter((value) => value.isActive || picked[attribute.id] === value.id)
                          .map((value) => (
                            <option key={value.id} value={value.id}>
                              {value.label}
                            </option>
                          ))}
                      </NativeSelect>
                    </div>
                  ))}
                </div>
              )}
              {creating && options.length === 0 && addable.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-option">Add an option</Label>
                  <NativeSelect
                    id="add-option"
                    value=""
                    onChange={(event) =>
                      event.target.value && setExtra((c) => [...c, event.target.value])
                    }
                  >
                    <option value="">Choose an attribute…</option>
                    {addable.map((attribute) => (
                      <option key={attribute.id} value={attribute.id}>
                        {attribute.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
            </fieldset>
            <FieldGrid>
              <TextField<Values>
                name="sku"
                label="SKU"
                description={creating ? 'Optional' : undefined}
              />
              <TextField<Values>
                name="name"
                label="Display name"
                description="e.g. Beige / Cotton"
              />
            </FieldGrid>
            <FieldGrid columns={3}>
              <MoneyField<Values> name="pricePaise" label="Price" description="Empty: base price" />
              <MoneyField<Values> name="compareAtPricePaise" label="Compare-at price" />
              <MoneyField<Values> name="costPricePaise" label="Cost price" />
            </FieldGrid>
            <FieldGrid columns={3}>
              {creating ? (
                <NumberField<Values>
                  name="openingStock"
                  label="Opening stock"
                  description="Recorded in the stock history."
                />
              ) : null}
              <NumberField<Values> name="lowStockThreshold" label="Low-stock level" required />
              <NumberField<Values> name="leadTimeDays" label="Lead time" unit="days" />
            </FieldGrid>
            <FieldGrid>
              <NumberField<Values> name="weightGrams" label="Weight" unit="grams" />
              <TextField<Values> name="barcode" label="Barcode" />
            </FieldGrid>
            <FieldGrid>
              <CheckField<Values>
                name="allowBackorder"
                label="Allow back-orders"
                description="Customers can order when it is out of stock."
              />
              <CheckField<Values>
                name="isActive"
                label="Active"
                description="Inactive variants are not sold."
              />
            </FieldGrid>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={form.formState.isSubmitting}
                disabled={missing.length > 0}
              >
                {creating ? 'Add variant' : 'Save variant'}
              </Button>
            </DialogFooter>
            {missing.length > 0 ? (
              <p role="status" className="text-right text-xs text-muted-foreground">
                Choose a value for: {missing.map((a) => a.name).join(', ')}.
              </p>
            ) : null}
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
