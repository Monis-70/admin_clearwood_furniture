'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import type { AdminProductSummaryDto } from '@shared/types/catalogAdmin';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { collectionsRoutes } from '@/lib/api/routes/collections';
import { formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from '../../api';
import { PUBLICATION } from '../../model';
import { ProductSearch } from '../../product-search';
import { productHref } from '../../products/href';
import { collectionKeys, collectionsApi, type CollectionDetail } from '../api';

/** Every member, 100 per page (a manual collection holds at most 1,000 products). */
async function allMembers(collectionId: string, signal?: AbortSignal) {
  const items: AdminProductSummaryDto[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const result = await catalogApi.products(
      { page, limit: 100, collectionId, sort: 'name', order: 'asc' },
      signal,
    );
    items.push(...result.items);
    if (!result.meta.hasNext) break;
  }
  return items;
}

export function ProductsTab({ collection }: { collection: CollectionDetail }) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const manual = collection.type === 'MANUAL';
  const canEdit = manual && canCall(collectionsRoutes.setProducts) && !collection.deletedAt;
  const canReorder = manual && canCall(collectionsRoutes.reorderProducts) && !collection.deletedAt;
  const members = useQuery({
    queryKey: [...collectionKeys.detail(collection.id), 'members'],
    queryFn: ({ signal }) => allMembers(collection.id, signal),
    ...cachePolicy.list,
  });
  const [order, setOrder] = useState<AdminProductSummaryDto[] | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
    void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
  };

  const replace = useMutation({
    mutationFn: (ids: string[]) => collectionsApi.setProducts(collection.id, ids),
    onSuccess: (_, ids) => {
      refresh();
      notifySuccess(
        'Collection products saved',
        `${ids.length} product${ids.length === 1 ? '' : 's'} in ${collection.name}.`,
      );
    },
  });
  const saveOrder = useMutation({
    mutationFn: (list: AdminProductSummaryDto[]) =>
      collectionsApi.reorderProducts(
        collection.id,
        list.map((p, position) => ({ id: p.id, position })),
      ),
    onSuccess: () => {
      setOrder(null);
      refresh();
      notifySuccess('Order saved');
    },
  });

  if (members.isPending) return <SectionLoader label="Loading products…" />;
  if (members.error)
    return <ErrorState error={members.error} onRetry={() => void members.refetch()} compact />;
  const ids = members.data.map((p) => p.id);
  const list = order ?? members.data;
  const move = (index: number, by: -1 | 1) => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    setOrder(next);
  };

  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="members-heading" className="text-base font-semibold">
          Products{' '}
          <span className="text-sm font-normal text-muted-foreground">
            ({formatNumber(members.data.length)})
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          {manual
            ? 'Products you picked for this collection.'
            : 'Chosen by the rules and refreshed when products change. Edit the rules to change who is in.'}
        </p>
      </div>
      <FormAlert error={replace.error ?? saveOrder.error} />
      {canEdit ? (
        <ProductSearch
          label="Add a product"
          actionLabel="Add"
          exclude={new Set(ids)}
          onPick={(product) => replace.mutate([...ids, product.id])}
        />
      ) : null}
      {canReorder && members.data.length > 1 ? (
        <Alert tone="info" title="About the order">
          The API does not return the saved order, so this list is shown by name. Arrange it and
          press &ldquo;Save this order&rdquo; to store exactly the order shown.
        </Alert>
      ) : null}
      {list.length === 0 ? (
        <EmptyState
          title="No products yet"
          description={
            manual
              ? 'Search above to add the first product.'
              : 'No published product matches the rules.'
          }
          compact
        />
      ) : (
        <ol
          className="flex flex-col divide-y rounded-md border"
          aria-label="Products in this collection"
        >
          {list.map((product, index) => (
            <li key={product.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="tabular w-6 text-right text-muted-foreground">{index + 1}</span>
              <Link
                href={productHref(product.id)}
                className="min-w-0 flex-1 truncate font-medium hover:underline"
              >
                {product.name}
              </Link>
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                {product.sku}
              </span>
              <StatusBadge status={product.publication} registry={PUBLICATION} />
              {canReorder ? (
                <span className="flex">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${product.name} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${product.name} down`}
                    disabled={index === list.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                </span>
              ) : null}
              {canEdit ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${product.name} from the collection`}
                  disabled={replace.isPending}
                  onClick={() => replace.mutate(ids.filter((id) => id !== product.id))}
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {canReorder && list.length > 1 ? (
        <div className="flex justify-end gap-2">
          {order ? (
            <Button variant="ghost" onClick={() => setOrder(null)}>
              Discard order
            </Button>
          ) : null}
          <Button
            variant={order ? 'default' : 'outline'}
            loading={saveOrder.isPending}
            onClick={() => saveOrder.mutate(list)}
          >
            Save this order
          </Button>
        </div>
      ) : null}
    </section>
  );
}
