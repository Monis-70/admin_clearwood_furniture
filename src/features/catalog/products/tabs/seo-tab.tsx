'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { z } from 'zod';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { endpoints } from '@/lib/api/endpoints';
import { formatDate, formatNumber } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import {
  EditorForm,
  FormSection,
  TextAreaField,
  TextField,
  optionalText,
  textInput,
} from '../../form-kit';
import { productsApi, productKeys } from '../api';

import { ReadOnlyNotice, productConflict, saveProduct } from './shared';

const SearchAndSeoPanels = dynamic(
  () => import('./seo/search-and-seo-panels').then((m) => m.SearchAndSeoPanels),
  { ssr: false },
);

const schema = z.object({
  seoTitle: optionalText(180),
  seoDescription: optionalText(400),
  seoKeywords: optionalText(400),
  searchKeywords: optionalText(1_000),
});
type Values = z.input<typeof schema>;

export function SeoTab({ product }: { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const { canCall } = usePermissions();
  const canEdit = canCall(endpoints.products.update) && !product.deletedAt;

  return (
    <div className="flex flex-col gap-6">
      <EditorForm
        key={product.version}
        schema={schema}
        defaultValues={{
          seoTitle: textInput(product.seoTitle),
          seoDescription: textInput(product.seoDescription),
          seoKeywords: textInput(product.seoKeywords),
          searchKeywords: textInput(product.searchKeywords),
        }}
        successMessage="SEO saved"
        readOnly={canEdit ? undefined : <ReadOnlyNotice product={product} />}
        conflict={productConflict(product, queryClient, [
          { key: 'seoTitle', label: 'SEO title' },
          { key: 'seoDescription', label: 'SEO description' },
          { key: 'seoKeywords', label: 'SEO keywords' },
          { key: 'searchKeywords', label: 'Search keywords' },
        ])}
        onSubmit={(values) => saveProduct(queryClient, product, values)}
      >
        <FormSection
          title="Search engines"
          description="How the product appears in Google results. Empty fields fall back to the name and short description."
        >
          <TextField<Values>
            name="seoTitle"
            label="SEO title"
            description="About 60 characters show in results."
          />
          <TextAreaField<Values>
            name="seoDescription"
            label="SEO description"
            rows={3}
            description="About 155 characters show in results."
          />
          <TextField<Values> name="seoKeywords" label="SEO keywords" />
        </FormSection>
        <FormSection
          title="Store search"
          description="Extra words customers might type, such as local names or misspellings."
        >
          <TextAreaField<Values> name="searchKeywords" label="Search keywords" rows={2} />
        </FormSection>
      </EditorForm>
      {canCall(endpoints.products.redirects) ? <Redirects product={product} /> : null}
      <SearchAndSeoPanels product={product} />
    </div>
  );
}

function Redirects({ product }: { product: AdminProductDetailDto }) {
  const redirects = useQuery({
    queryKey: productKeys.redirects(product.id),
    queryFn: ({ signal }) => productsApi.redirects(product.id, signal),
    ...cachePolicy.detail,
  });
  return (
    <section
      aria-labelledby="redirects-heading"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5"
    >
      <div>
        <h2 id="redirects-heading" className="text-base font-semibold">
          Old addresses
        </h2>
        <p className="text-sm text-muted-foreground">
          When the URL slug changes, the old address keeps working and forwards here.
        </p>
      </div>
      {redirects.isPending ? (
        <SectionLoader label="Loading redirects…" />
      ) : redirects.error ? (
        <ErrorState error={redirects.error} onRetry={() => void redirects.refetch()} compact />
      ) : redirects.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">The address has never changed.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border text-sm">
          {redirects.data.map((redirect) => (
            <li
              key={redirect.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <span className="font-mono break-all">/{redirect.fromSlug}</span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(redirect.hitCount)} visits · since {formatDate(redirect.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
