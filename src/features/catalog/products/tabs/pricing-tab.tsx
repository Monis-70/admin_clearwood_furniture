'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { z } from 'zod';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { endpoints } from '@/lib/api/endpoints';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  EditorForm,
  FieldGrid,
  FormSection,
  MoneyField,
  SelectField,
  optionalRupees,
  paiseInput,
  rupees,
} from '../../form-kit';
import { useTaxClassOptions } from '../../lookups';
import { formatRupees } from '../../model';
import { priceAdjustmentsApi, pricingKeys } from '@/features/pricing/api';
import { describeAdjustment } from '@/features/pricing/model';

import { ReadOnlyNotice, productConflict, saveProduct } from './shared';

const ProductTiers = dynamic(
  () => import('./pricing/tiers-and-explain').then((m) => m.ProductTiers),
  { ssr: false },
);
const ExplainPrice = dynamic(
  () => import('./pricing/tiers-and-explain').then((m) => m.ExplainPrice),
  { ssr: false },
);

const schema = z.object({
  basePricePaise: rupees('Base price'),
  compareAtPricePaise: optionalRupees('Compare-at price'),
  costPricePaise: optionalRupees('Cost price'),
  taxClassId: z.string().transform((value) => value || null),
});
type Values = z.input<typeof schema>;

export function PricingTab({ product }: { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const { canCall } = usePermissions();
  const taxClasses = useTaxClassOptions();
  const canEdit = canCall(endpoints.products.update) && !product.deletedAt;

  return (
    <div className="flex flex-col gap-6">
      <EditorForm
        key={product.version}
        schema={schema}
        defaultValues={{
          basePricePaise: paiseInput(product.basePricePaise),
          compareAtPricePaise: paiseInput(product.compareAtPricePaise),
          costPricePaise: paiseInput(product.costPricePaise),
          taxClassId: product.taxClassId ?? '',
        }}
        successMessage="Pricing saved"
        readOnly={canEdit ? undefined : <ReadOnlyNotice product={product} />}
        conflict={productConflict(product, queryClient, [
          { key: 'basePricePaise', label: 'Base price', format: (v) => formatRupees(v as number) },
          {
            key: 'compareAtPricePaise',
            label: 'Compare-at price',
            format: (v) => formatRupees(v as number),
          },
          { key: 'costPricePaise', label: 'Cost price', format: (v) => formatRupees(v as number) },
          {
            key: 'taxClassId',
            label: 'Tax class',
            format: (v) => taxClasses.data?.find((tax) => tax.id === v)?.name ?? String(v),
          },
        ])}
        onSubmit={(values) => saveProduct(queryClient, product, values)}
      >
        <FormSection
          title="Prices"
          description="Prices include GST. Variant prices, when set, replace the base price; price rules then apply on top."
        >
          <FieldGrid columns={3}>
            <MoneyField<Values> name="basePricePaise" label="Base price" required />
            <MoneyField<Values>
              name="compareAtPricePaise"
              label="Compare-at price"
              description="Shown struck through as the original price."
            />
            <MoneyField<Values>
              name="costPricePaise"
              label="Cost price"
              description="Internal only; never shown to customers."
            />
          </FieldGrid>
          <SelectField<Values>
            name="taxClassId"
            label="Tax class"
            placeholder="Not set"
            description="The GST rate and HSN code come from the tax class."
            options={(taxClasses.data ?? []).map((tax) => ({
              value: tax.id,
              label: `${tax.name}${tax.hsnCode ? ` · HSN ${tax.hsnCode}` : ''}${tax.isActive ? '' : ' (inactive)'}`,
            }))}
          />
        </FormSection>
      </EditorForm>
      {canCall(endpoints.priceAdjustments.list) ? <ProductPriceRules product={product} /> : null}
      {canCall(endpoints.pricing.tierPrices) ? <ProductTiers product={product} /> : null}
      {canCall(endpoints.pricing.simulate) ? <ExplainPrice product={product} /> : null}
    </div>
  );
}

function ProductPriceRules({ product }: { product: AdminProductDetailDto }) {
  const query = { page: 1, limit: 50, productId: product.id };
  const rules = useQuery({
    queryKey: pricingKeys.list(query),
    queryFn: ({ signal }) => priceAdjustmentsApi.list(query, signal),
    ...cachePolicy.list,
  });
  return (
    <section
      aria-labelledby="product-rules"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="product-rules" className="text-base font-semibold">
            Price rules for this product
          </h2>
          <p className="text-sm text-muted-foreground">
            Rules that target this product directly. Category, option and store-wide rules also
            apply; the pricing engine combines them at checkout.
          </p>
        </div>
        <Link
          href={`/pricing/price-rules?productId=${encodeURIComponent(product.id)}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Manage price rules
        </Link>
      </div>
      {rules.isPending ? (
        <SectionLoader label="Loading price rules…" />
      ) : rules.error ? (
        <ErrorState error={rules.error} onRetry={() => void rules.refetch()} compact />
      ) : rules.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rule targets this product.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {rules.data.items.map((rule) => (
            <li key={rule.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
              <span className="font-medium">
                {rule.name}
                {rule.isActive ? null : (
                  <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                )}
              </span>
              <span className="text-muted-foreground">{describeAdjustment(rule)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
