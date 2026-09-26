'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import type { ProductListQuery } from '@/features/catalog/api';
import { PageHeader } from '@/components/patterns/page-header';
import { ErrorState, PermissionNotice } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/surface';
import { endpoints } from '@/lib/api/endpoints';
import { formatNumber } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from '../api';
import { productHref } from '../products/href';
import { BADGES } from '../settings/badges';

const LISTS = [
  {
    id: 'featured',
    title: 'Featured',
    description: 'Products flagged featured, including those with an end date.',
    filter: { isFeatured: 'true' },
  },
  {
    id: 'new',
    title: 'Flagged new arrivals',
    description: 'Flagged by hand. Recently published products also count as new (see below).',
    filter: { isNewArrival: 'true' },
  },
  {
    id: 'special',
    title: 'Special collection',
    description: 'Products flagged for the special collection.',
    filter: { isSpecialCollection: 'true' },
  },
] as const;

export function MerchandisingScreen() {
  const { canCall } = usePermissions();
  if (!canCall(endpoints.catalog.products)) {
    return <PermissionNotice area="merchandising" all={['catalog.product.read']} />;
  }
  return <Merchandising />;
}

function Merchandising() {
  const { canCall } = usePermissions();
  const settings = useQuery({
    queryKey: catalogKeys.settings(),
    queryFn: ({ signal }) => catalogApi.settings(signal),
    enabled: canCall(endpoints.catalog.settings),
    ...cachePolicy.reference,
  });
  const days = settings.data?.newArrivalDays;
  const badgesOn = BADGES.filter((b) => settings.data?.badges[b.code]);

  return (
    <>
      <PageHeader
        title="Merchandising"
        description="What the storefront highlights. Open a list, select products and choose Set merchandising, or change one product on its Merchandising tab."
        actions={
          <Link
            href="/catalog/products"
            className="inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
          >
            All products <ArrowRight aria-hidden className="size-4" />
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {LISTS.map((list) => (
          <MerchList key={list.id} {...list} />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New arrivals and badges</CardTitle>
            <CardDescription>From the catalog settings.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {settings.error ? (
              <ErrorState error={settings.error} onRetry={() => void settings.refetch()} compact />
            ) : (
              <>
                <p>
                  {days === undefined
                    ? 'Loading…'
                    : days === 0
                      ? 'Only flagged products are new arrivals.'
                      : `Products also count as new for ${days} day${days === 1 ? '' : 's'} after they are published.`}
                </p>
                <p>
                  Badges shown on cards:{' '}
                  {settings.data
                    ? badgesOn.length > 0
                      ? badgesOn.map((b) => settings.data.badges[b.code]!.label).join(', ')
                      : 'none'
                    : '…'}
                </p>
                <Link
                  className="w-fit font-medium underline underline-offset-2"
                  href="/catalog/settings"
                >
                  Change catalog settings
                </Link>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order on the storefront</CardTitle>
            <CardDescription>Where the sequence of products is decided.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              <Link className="font-medium underline underline-offset-2" href="/catalog/categories">
                Categories
              </Link>{' '}
              — each category&apos;s curated product order.
            </p>
            <p>
              <Link
                className="font-medium underline underline-offset-2"
                href="/catalog/collections"
              >
                Collections
              </Link>{' '}
              — the order of products in a manual collection.
            </p>
            <p>Best sellers have no list of their own: set the flag per product or in bulk.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MerchList({
  title,
  description,
  filter,
}: {
  title: string;
  description: string;
  filter: Partial<ProductListQuery>;
}) {
  const query: ProductListQuery = {
    page: 1,
    limit: 5,
    order: 'desc',
    sort: 'updatedAt',
    ...filter,
  };
  const products = useQuery({
    queryKey: catalogKeys.products(query),
    queryFn: ({ signal }) => catalogApi.products(query, signal),
    ...cachePolicy.list,
  });
  const href = `/catalog/products?${new URLSearchParams(filter as Record<string, string>).toString()}`;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {products.data ? (
          <Badge tone="info">
            {formatNumber(products.data.meta.total)}
            <span className="sr-only"> products</span>
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {products.isPending ? (
          <Skeleton className="h-24" />
        ) : products.error ? (
          <ErrorState error={products.error} onRetry={() => void products.refetch()} compact />
        ) : products.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {products.data.items.map((p) => (
              <li key={p.id} className="truncate">
                <Link
                  className="underline-offset-2 hover:underline"
                  href={productHref(p.id, 'merchandising')}
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          className="mt-auto w-fit text-sm font-medium underline underline-offset-2"
          href={href}
        >
          Open the list<span className="sr-only">: {title}</span>
        </Link>
      </CardContent>
    </Card>
  );
}
