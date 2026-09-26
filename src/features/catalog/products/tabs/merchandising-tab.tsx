'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { z } from 'zod';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { endpoints } from '@/lib/api/endpoints';
import { formatDateTime } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';

import {
  CheckField,
  EditorForm,
  FieldGrid,
  FormSection,
  TextField,
  dateTimeInput,
  optionalDateTime,
  optionalText,
  textInput,
} from '../../form-kit';

import { ReadOnlyNotice, productConflict, saveProduct } from './shared';

const schema = z.object({
  isFeatured: z.boolean(),
  featuredUntil: optionalDateTime(),
  isNewArrival: z.boolean(),
  isBestSeller: z.boolean(),
  isSpecialCollection: z.boolean(),
  badgeText: optionalText(40),
  badgeColor: z
    .string()
    .trim()
    .refine((v) => v === '' || /^#[0-9a-fA-F]{6}$/.test(v), 'Use a hex colour like #8B5A2B')
    .transform((v) => v || null),
});
type Values = z.input<typeof schema>;

const yesNo = (v: unknown) => (v ? 'Yes' : 'No');

export function MerchandisingTab({ product }: { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const { canCall } = usePermissions();
  const canEdit = canCall(endpoints.products.update) && !product.deletedAt;

  return (
    <EditorForm
      key={product.version}
      schema={schema}
      defaultValues={{
        isFeatured: product.isFeatured,
        featuredUntil: dateTimeInput(product.featuredUntil),
        isNewArrival: product.isNewArrival,
        isBestSeller: product.isBestSeller,
        isSpecialCollection: product.isSpecialCollection,
        badgeText: textInput(product.badgeText),
        badgeColor: textInput(product.badgeColor),
      }}
      successMessage="Merchandising saved"
      readOnly={canEdit ? undefined : <ReadOnlyNotice product={product} />}
      conflict={productConflict(product, queryClient, [
        { key: 'isFeatured', label: 'Featured', format: yesNo },
        {
          key: 'featuredUntil',
          label: 'Featured until',
          format: (v) => (v ? formatDateTime(v as string) : 'No end date'),
        },
        { key: 'isNewArrival', label: 'New arrival', format: yesNo },
        { key: 'isBestSeller', label: 'Best seller', format: yesNo },
        { key: 'isSpecialCollection', label: 'Special collection', format: yesNo },
        { key: 'badgeText', label: 'Badge text' },
        { key: 'badgeColor', label: 'Badge colour' },
      ])}
      onSubmit={(values) => saveProduct(queryClient, product, values)}
    >
      <FormSection
        title="Highlights"
        description={
          <>
            These flags feed the storefront&apos;s featured, new-arrival, best-seller and special
            collection lists. How long a product stays new after publishing is a{' '}
            <Link className="underline underline-offset-2" href="/catalog/settings">
              catalog setting
            </Link>
            .
          </>
        }
      >
        <FieldGrid>
          <CheckField<Values> name="isFeatured" label="Featured" />
          <TextField<Values>
            name="featuredUntil"
            label="Featured until"
            type="datetime-local"
            description="Leave empty to stay featured until switched off."
          />
          <CheckField<Values> name="isNewArrival" label="New arrival" />
          <CheckField<Values> name="isBestSeller" label="Best seller" />
          <CheckField<Values> name="isSpecialCollection" label="Special collection" />
        </FieldGrid>
      </FormSection>
      <FormSection
        title="Custom badge"
        description="Words shown on this product's card in addition to the standard badges."
      >
        <FieldGrid>
          <TextField<Values>
            name="badgeText"
            label="Badge text"
            description="Up to 40 characters."
          />
          <TextField<Values> name="badgeColor" label="Badge colour" placeholder="#8B5A2B" />
        </FieldGrid>
      </FormSection>
    </EditorForm>
  );
}
