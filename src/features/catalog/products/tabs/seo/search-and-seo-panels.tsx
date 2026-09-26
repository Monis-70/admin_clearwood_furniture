'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { contentApi, contentKeys } from '@/features/content/api';
import { searchApi, searchKeys } from '@/features/search/api';

function Fields({ value, label }: { value: Record<string, unknown> | null; label: string }) {
  if (!value) return <p className="text-sm text-muted-foreground">{label}: nothing.</p>;
  return (
    <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]" aria-label={label}>
      {Object.entries(value).map(([key, v]) => (
        <div key={key} className="contents">
          <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
          <dd className="break-words">
            {v === null || v === undefined
              ? '—'
              : typeof v === 'object'
                ? JSON.stringify(v)
                : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** What the storefront renders in <head> for this product, and what search indexed for it. */
export function SearchAndSeoPanels({ product }: { product: AdminProductDetailDto }) {
  const { canCall } = usePermissions();
  const [showMeta, setShowMeta] = useState(false);
  const [showDoc, setShowDoc] = useState(false);
  const meta = useQuery({
    queryKey: contentKeys.seoPreview('PRODUCT', product.id),
    queryFn: ({ signal }) => contentApi.seoPreview('PRODUCT', product.id, signal),
    enabled: showMeta,
    ...cachePolicy.diagnostic,
  });
  const doc = useQuery({
    queryKey: searchKeys.document(product.id),
    queryFn: ({ signal }) => searchApi.productDocument(product.id, signal),
    enabled: showDoc,
    ...cachePolicy.diagnostic,
  });

  return (
    <>
      {canCall(endpoints.content.seoPreview) ? (
        <section
          aria-labelledby="seo-preview"
          className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="seo-preview" className="text-base font-semibold">
                Search engine preview
              </h2>
              <p className="text-sm text-muted-foreground">
                The title, description and tags the storefront renders for this product.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (showMeta ? void meta.refetch() : setShowMeta(true))}
            >
              {showMeta ? 'Check again' : 'Show preview'}
            </Button>
          </div>
          {showMeta ? (
            meta.isPending ? (
              <SectionLoader label="Loading preview…" />
            ) : meta.error ? (
              <ErrorState error={meta.error} onRetry={() => void meta.refetch()} compact />
            ) : (
              <Fields value={meta.data} label="Meta tags" />
            )
          ) : null}
        </section>
      ) : null}
      {canCall(endpoints.search.productDocument) ? (
        <section
          aria-labelledby="search-document"
          className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="search-document" className="text-base font-semibold">
                What search sees
              </h2>
              <p className="text-sm text-muted-foreground">
                The stored search entry next to one rebuilt from the product now. A difference means
                the index is behind.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (showDoc ? void doc.refetch() : setShowDoc(true))}
            >
              {showDoc ? 'Check again' : 'Compare'}
            </Button>
          </div>
          {showDoc ? (
            doc.isPending ? (
              <SectionLoader label="Loading the search entry…" />
            ) : doc.error ? (
              <ErrorState error={doc.error} onRetry={() => void doc.refetch()} compact />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Stored in the index</h3>
                  <Fields value={doc.data.stored} label="Stored entry" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Rebuilt from the product now</h3>
                  <Fields value={doc.data.rebuilt} label="Rebuilt entry" />
                </div>
              </div>
            )
          ) : null}
        </section>
      ) : null}
    </>
  );
}
