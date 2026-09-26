'use client';

import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import type { ProductUpdateInput } from '@shared/schemas/catalogAdmin';
import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { productsRoutes } from '@/lib/api/routes/products';
import { usePermissions } from '@/lib/permissions/use-permissions';

import {
  EditorForm,
  FieldGrid,
  FormSection,
  SelectField,
  TextAreaField,
  TextField,
  optionalText,
  requiredText,
  textInput,
} from '../../form-kit';
import { useBrandOptions } from '../../lookups';
import { PRODUCT_TYPE_LABELS, VISIBILITY } from '../model';

import { CategoryAssignment } from './category-assignment';
import { ReadOnlyNotice, productConflict, saveProduct } from './shared';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  name: requiredText(2, 160, 'Name'),
  subtitle: optionalText(200),
  sku: requiredText(2, 64, 'SKU'),
  slug: z
    .string()
    .trim()
    .regex(SLUG, 'Use lowercase words joined by dashes, e.g. kabir-3-seater-sofa'),
  productType: z.string(),
  visibility: z.string(),
  brandId: z.string().transform((value) => value || null),
  shortDescription: optionalText(600),
  description: optionalText(40_000),
});
type Values = z.input<typeof schema>;

export function GeneralTab({ product }: { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const { canCall } = usePermissions();
  const brands = useBrandOptions();
  const canEdit = canCall(productsRoutes.update) && !product.deletedAt;

  const defaults: Values = {
    name: product.name,
    subtitle: textInput(product.subtitle),
    sku: product.sku,
    slug: product.slug,
    productType: product.productType,
    visibility: product.visibility,
    brandId: product.brandId ?? '',
    shortDescription: textInput(product.shortDescription),
    description: textInput(product.description),
  };

  return (
    <div className="flex flex-col gap-6">
      <EditorForm
        key={product.version}
        schema={schema}
        defaultValues={defaults}
        successMessage="Product details saved"
        readOnly={canEdit ? undefined : <ReadOnlyNotice product={product} />}
        conflict={productConflict(product, queryClient, [
          { key: 'name', label: 'Product name' },
          { key: 'subtitle', label: 'Subtitle' },
          { key: 'sku', label: 'SKU' },
          { key: 'slug', label: 'URL slug' },
          {
            key: 'productType',
            label: 'Product type',
            format: (v) => PRODUCT_TYPE_LABELS[v as string] ?? String(v),
          },
          {
            key: 'visibility',
            label: 'Where it can be found',
            format: (v) => VISIBILITY[v as string]?.label ?? String(v),
          },
          {
            key: 'brandId',
            label: 'Brand',
            format: (v) => brands.data?.find((brand) => brand.id === v)?.name ?? String(v),
          },
          { key: 'shortDescription', label: 'Short description' },
          { key: 'description', label: 'Description' },
        ])}
        onSubmit={(values) =>
          saveProduct(queryClient, product, {
            ...values,
            productType: values.productType as ProductUpdateInput['productType'],
            visibility: values.visibility as ProductUpdateInput['visibility'],
          })
        }
      >
        <FormSection title="Basics" description="What customers see first.">
          <TextField<Values> name="name" label="Product name" required />
          <TextField<Values>
            name="subtitle"
            label="Subtitle"
            description="One line under the name, e.g. the frame and fabric."
          />
          <FieldGrid>
            <TextField<Values>
              name="sku"
              label="SKU"
              required
              description="Your internal code. Must be unique."
            />
            <TextField<Values>
              name="slug"
              label="URL slug"
              required
              description="Changing it keeps the old address working through a redirect."
            />
          </FieldGrid>
          <FieldGrid columns={3}>
            <SelectField<Values>
              name="productType"
              label="Product type"
              options={Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <SelectField<Values>
              name="visibility"
              label="Where it can be found"
              options={Object.entries(VISIBILITY).map(([value, v]) => ({ value, label: v.label }))}
            />
            <SelectField<Values>
              name="brandId"
              label="Brand"
              placeholder="No brand"
              description={brands.isError ? 'Brands could not be loaded.' : undefined}
              options={(brands.data ?? []).map((brand) => ({
                value: brand.id,
                label: brand.isActive ? brand.name : `${brand.name} (inactive)`,
              }))}
            />
          </FieldGrid>
        </FormSection>
        <FormSection title="Description">
          <TextAreaField<Values>
            name="shortDescription"
            label="Short description"
            rows={3}
            description="Shown on product cards and in search results."
          />
          <TextAreaField<Values>
            name="description"
            label="Full description"
            rows={8}
            description="At least 120 characters counts towards completeness."
          />
        </FormSection>
      </EditorForm>
      <CategoryAssignment
        product={product}
        canEdit={canEdit && canCall(productsRoutes.setCategories)}
      />
    </div>
  );
}
