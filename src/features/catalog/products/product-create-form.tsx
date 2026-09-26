'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { ProductCreateInput } from '@shared/schemas/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-field';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import { Button } from '@/components/ui/button';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { notifySuccess } from '@/lib/notify';
import { applyServerErrors } from '@/lib/validation/server-errors';

import { catalogKeys } from '../api';
import {
  FieldGrid,
  FormSection,
  MoneyField,
  SelectField,
  TextField,
  requiredText,
  rupees,
} from '../form-kit';
import { flattenTree, useCategoryOptions } from '../lookups';

import { productsApi, productKeys } from './api';
import { PRODUCT_TYPE_LABELS, productHref } from './model';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  name: requiredText(2, 160, 'Name'),
  sku: requiredText(2, 64, 'SKU'),
  slug: z
    .string()
    .trim()
    .refine((value) => value === '' || SLUG.test(value), 'Use lowercase words joined by dashes')
    .transform((value) => value || undefined),
  productType: z.string(),
  basePricePaise: rupees('Base price'),
  primaryCategoryId: z.string().transform((value) => value || undefined),
});
type Values = z.input<typeof schema>;

export function ProductCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const categories = useCategoryOptions();
  const keyFor = useIdempotencyKey();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      sku: '',
      slug: '',
      productType: 'VARIABLE',
      basePricePaise: '',
      primaryCategoryId: '',
    },
  });
  const { isDirty, isSubmitting, isSubmitSuccessful } = form.formState;
  useUnsavedChangesGuard(isDirty && !isSubmitting && !isSubmitSuccessful);

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setMessages([]);
    const body = {
      ...values,
      productType: values.productType as ProductCreateInput['productType'],
      ...(values.primaryCategoryId ? { categoryIds: [values.primaryCategoryId] } : {}),
    };
    try {
      const created = await productsApi.create(body, keyFor(body));
      queryClient.setQueryData(productKeys.detail(created.id), created);
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      notifySuccess('Product created', 'Add images, variants and pricing next.');
      router.push(productHref(created.id));
    } catch (error) {
      const mapped = applyServerErrors(error, form.setError);
      if (mapped && Object.keys(mapped.fields).length > 0) setMessages(mapped.form);
      else setSubmitError(error);
    }
  });

  const ordered = flattenTree(categories.data ?? []);

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <FormAlert error={submitError} messages={messages} />
        <FormSection title="Essentials">
          <TextField<Values> name="name" label="Product name" required />
          <FieldGrid>
            <TextField<Values>
              name="sku"
              label="SKU"
              required
              description="Your internal code; unique."
            />
            <TextField<Values>
              name="slug"
              label="URL slug"
              description="Optional: made from the name when empty."
            />
          </FieldGrid>
          <FieldGrid>
            <SelectField<Values>
              name="productType"
              label="Product type"
              description="Variants are versions of the same product, such as sizes or colours."
              options={Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <MoneyField<Values> name="basePricePaise" label="Base price" required />
          </FieldGrid>
          <SelectField<Values>
            name="primaryCategoryId"
            label="Primary category"
            placeholder="Choose later"
            description="Needed before publishing."
            options={ordered.map((category) => ({
              value: category.id,
              label: `${'\u00a0\u00a0'.repeat(category.depth)}${category.name}`,
              disabled: !category.isActive,
            }))}
          />
        </FormSection>
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href="/catalog/products">Cancel</Link>
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create draft
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
