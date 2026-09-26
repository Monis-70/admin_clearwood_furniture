'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { PRODUCT_RELATION_TYPES, type ProductRelationType } from '@shared/enums';
import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { SearchInput } from '@/components/patterns/data-table/search-input';
import { FormAlert } from '@/components/patterns/form/form-alert';
import { useUnsavedChangesGuard } from '@/components/patterns/form/use-unsaved-changes-guard';
import { EmptyState } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { productsRoutes } from '@/lib/api/routes/products';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from '../../api';
import { productKeys, productsApi } from '../api';

import { ReadOnlyNotice } from './shared';

export const RELATION_LABELS: Record<ProductRelationType, { label: string; help: string }> = {
  RELATED: { label: 'Related', help: 'Shown as "You may also like".' },
  SIMILAR: { label: 'Similar', help: 'Also linked back from the other product automatically.' },
  ALTERNATIVE: { label: 'Alternatives', help: 'Other choices for the same need.' },
  REPLACEMENT: { label: 'Replacements', help: 'Offered when this product is unavailable.' },
  COMPLEMENTARY: { label: 'Goes well with', help: 'Items that complete the look.' },
  FREQUENTLY_BOUGHT: { label: 'Frequently bought together', help: 'Suggested next to the cart.' },
  CROSS_SELL: { label: 'Cross-sell', help: 'Suggested alongside this product.' },
  UPSELL: { label: 'Upgrades', help: 'A better or bigger version.' },
  BUNDLE_ITEM: { label: 'Bundle items', help: 'Parts of a set sold with this product.' },
  VARIANT_OF_STYLE: { label: 'Same style', help: 'The same design in another form.' },
};

interface Row {
  relatedProductId: string;
  name: string;
  sku: string;
  type: ProductRelationType;
}

const fromProduct = (product: AdminProductDetailDto): Row[] =>
  [...product.relations]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      relatedProductId: r.relatedProductId,
      name: r.relatedProductName,
      sku: r.relatedProductSku,
      type: r.type,
    }));

/** Positions are per type: the order within each group is the order customers see. */
const toInput = (rows: readonly Row[]) =>
  PRODUCT_RELATION_TYPES.flatMap((type) =>
    rows
      .filter((row) => row.type === type)
      .map((row, position) => ({ relatedProductId: row.relatedProductId, type, position })),
  );

export function RelatedTab({ product }: { product: AdminProductDetailDto }) {
  return (
    <RelatedEditor key={`${product.id}:${JSON.stringify(product.relations)}`} product={product} />
  );
}

function RelatedEditor({ product }: { product: AdminProductDetailDto }) {
  const queryClient = useQueryClient();
  const { canCall } = usePermissions();
  const canEdit = canCall(productsRoutes.setRelations) && !product.deletedAt;
  const [initial] = useState(() => fromProduct(product));
  const [rows, setRows] = useState(initial);
  const [type, setType] = useState<ProductRelationType>('RELATED');
  const [term, setTerm] = useState('');
  const dirty = JSON.stringify(toInput(rows)) !== JSON.stringify(toInput(initial));
  useUnsavedChangesGuard(dirty);

  const search = useQuery({
    queryKey: catalogKeys.products({ page: 1, limit: 8, order: 'asc', sort: 'name', q: term }),
    queryFn: ({ signal }) =>
      catalogApi.products({ page: 1, limit: 8, order: 'asc', sort: 'name', q: term }, signal),
    enabled: canEdit && term.length >= 2,
    ...cachePolicy.list,
  });

  const save = useMutation({
    mutationFn: () => productsApi.setRelations(product.id, { relations: toInput(rows) }),
    onSuccess: (next) => {
      queryClient.setQueryData(productKeys.detail(product.id), next);
      notifySuccess('Related products saved');
    },
  });

  const taken = new Set(rows.filter((r) => r.type === type).map((r) => r.relatedProductId));
  const move = (row: Row, by: -1 | 1) =>
    setRows((current) => {
      const group = current.filter((r) => r.type === row.type);
      const index = group.indexOf(row);
      const target = group[index + by];
      if (!target) return current;
      const next = [...current];
      const a = next.indexOf(row);
      const b = next.indexOf(target);
      [next[a], next[b]] = [next[b]!, next[a]!];
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      {canEdit ? null : <ReadOnlyNotice product={product} />}
      <p className="text-sm text-muted-foreground">
        Curated links to other products, shown on this product&apos;s page in the order below.
        Drafts and hidden products can be linked; the storefront shows them once they are live.
      </p>
      <FormAlert error={save.error} />

      {canEdit ? (
        <section
          aria-labelledby="add-relation"
          className="flex flex-col gap-3 rounded-lg border border-dashed p-4"
        >
          <h3 id="add-relation" className="text-base font-semibold">
            Add a product
          </h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="relation-type">Relation</Label>
              <NativeSelect
                id="relation-type"
                value={type}
                onChange={(event) => setType(event.target.value as ProductRelationType)}
              >
                {PRODUCT_RELATION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {RELATION_LABELS[value].label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <SearchInput
              value={term}
              onSearch={setTerm}
              label="Find a product by name or SKU"
              placeholder="Find a product by name or SKU"
              minLength={2}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">{RELATION_LABELS[type].help}</p>
          {term.length >= 2 ? (
            <ul className="flex flex-col divide-y rounded-md border" aria-label="Matching products">
              {search.isPending ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
              ) : (search.data?.items ?? []).filter((p) => p.id !== product.id).length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  No other product matches.
                </li>
              ) : (
                (search.data?.items ?? [])
                  .filter((p) => p.id !== product.id)
                  .map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{p.name}</span>{' '}
                        <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={taken.has(p.id)}
                        aria-label={`Add ${p.name} as ${RELATION_LABELS[type].label}`}
                        onClick={() =>
                          setRows((current) => [
                            ...current,
                            { relatedProductId: p.id, name: p.name, sku: p.sku, type },
                          ])
                        }
                      >
                        <Plus aria-hidden />
                        {taken.has(p.id) ? 'Added' : 'Add'}
                      </Button>
                    </li>
                  ))
              )}
            </ul>
          ) : null}
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No related products yet"
          description={canEdit ? 'Find a product above to link it.' : undefined}
          compact
        />
      ) : (
        PRODUCT_RELATION_TYPES.filter((t) => rows.some((r) => r.type === t)).map((t) => {
          const group = rows.filter((r) => r.type === t);
          return (
            <section key={t} aria-labelledby={`relation-${t}`} className="flex flex-col gap-2">
              <h3 id={`relation-${t}`} className="text-base font-semibold">
                {RELATION_LABELS[t].label}{' '}
                <span className="text-sm font-normal text-muted-foreground">({group.length})</span>
              </h3>
              <ol className="flex flex-col divide-y rounded-md border">
                {group.map((row, index) => (
                  <li
                    key={row.relatedProductId}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <span className="tabular w-6 text-muted-foreground">{index + 1}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{row.name}</span>{' '}
                      <span className="font-mono text-xs text-muted-foreground">{row.sku}</span>
                    </span>
                    {canEdit ? (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Move ${row.name} up`}
                          disabled={index === 0}
                          onClick={() => move(row, -1)}
                        >
                          <ArrowUp aria-hidden />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Move ${row.name} down`}
                          disabled={index === group.length - 1}
                          onClick={() => move(row, 1)}
                        >
                          <ArrowDown aria-hidden />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remove ${row.name} from ${RELATION_LABELS[t].label}`}
                          onClick={() => setRows((current) => current.filter((r) => r !== row))}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          );
        })
      )}

      {canEdit ? (
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
          <span role="status" className="mr-auto text-sm text-muted-foreground">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <Button
            variant="ghost"
            disabled={!dirty || save.isPending}
            onClick={() => setRows(initial)}
          >
            Discard
          </Button>
          <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
            Save related products
          </Button>
        </div>
      ) : null}
    </div>
  );
}
