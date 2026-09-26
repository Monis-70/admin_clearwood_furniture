'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, CircleCheck, MoreHorizontal, TriangleAlert } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { ErrorState, NotFoundState, PermissionNotice } from '@/components/patterns/states';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Workbench, type WorkbenchIssue } from '@/components/patterns/workbench';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/surface';
import { auditRoutes } from '@/lib/api/routes/audit';
import { priceAdjustmentsRoutes } from '@/lib/api/routes/priceAdjustments';
import { productsRoutes } from '@/lib/api/routes/products';
import { hasCode } from '@/lib/api/errors';
import { formatCount, formatDateTime, formatNumber, formatRelative } from '@/lib/format/datetime';
import { useRecentItems } from '@/lib/local-history';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { PRODUCT_STATUS, PUBLICATION, formatRupees } from '../model';

import { productsApi, productKeys } from './api';
import {
  PRODUCT_TABS,
  blockerTab,
  factorTab,
  isLive,
  isProductTab,
  productHref,
  type ProductTab,
} from './model';
import { useProductActions } from './use-product-actions';
import { usePublishBlockers } from './use-publish-blockers';

const loading = () => (
  <div className="flex flex-col gap-3" role="status" aria-label="Loading section">
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-40 w-full" />
  </div>
);
const tab = <P extends object>(load: () => Promise<React.ComponentType<P>>) =>
  dynamic(load, { ssr: false, loading });

// Each section is its own chunk: opening a product loads only the section on screen.
const SECTIONS: Record<ProductTab, React.ComponentType<{ product: AdminProductDetailDto }>> = {
  general: tab(() => import('./tabs/general-tab').then((m) => m.GeneralTab)),
  pricing: tab(() => import('./tabs/pricing-tab').then((m) => m.PricingTab)),
  inventory: tab(() => import('./tabs/inventory-tab').then((m) => m.InventoryTab)),
  specifications: tab(() => import('./tabs/specifications-tab').then((m) => m.SpecificationsTab)),
  variants: tab(() => import('./tabs/variants-tab').then((m) => m.VariantsTab)),
  media: tab(() => import('./tabs/media-tab').then((m) => m.MediaTab)),
  merchandising: tab(() => import('./tabs/merchandising-tab').then((m) => m.MerchandisingTab)),
  related: tab(() => import('./tabs/related-tab').then((m) => m.RelatedTab)),
  fulfilment: tab(() => import('./tabs/fulfilment-tab').then((m) => m.FulfilmentTab)),
  seo: tab(() => import('./tabs/seo-tab').then((m) => m.SeoTab)),
  publishing: tab(() => import('./tabs/publishing-tab').then((m) => m.PublishingTab)),
  history: tab(() => import('./tabs/history-tab').then((m) => m.HistoryTab)),
};

const DuplicateDialog = dynamic(() => import('./duplicate-dialog').then((m) => m.DuplicateDialog), {
  ssr: false,
});

export function ProductEditorScreen() {
  const { canCall } = usePermissions();
  const params = useSearchParams();
  const id = params.get('id');
  const requested = params.get('tab');
  const current: ProductTab = isProductTab(requested) ? requested : 'general';

  if (!canCall(productsRoutes.get)) {
    return <PermissionNotice area="products" all={['catalog.product.read']} />;
  }
  if (!id)
    return (
      <NotFoundState
        title="No product selected"
        backHref="/catalog/products"
        backLabel="Back to products"
      />
    );
  return <ProductEditor id={id} tab={current} />;
}

function ProductEditor({ id, tab: current }: { id: string; tab: ProductTab }) {
  const product = useQuery({
    queryKey: productKeys.detail(id),
    queryFn: ({ signal }) => productsApi.get(id, signal),
    ...cachePolicy.detail,
  });
  const { record } = useRecentItems();
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    if (!product.data || recorded.current === product.data.id) return;
    recorded.current = product.data.id;
    record({
      key: `product:${product.data.id}`,
      kind: 'Product',
      label: product.data.name,
      href: productHref(product.data.id),
    });
  }, [product.data, record]);

  if (product.isPending) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Loading product">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  if (product.error) {
    return hasCode(product.error, 'NOT_FOUND') ? (
      <NotFoundState
        title="Product not found"
        backHref="/catalog/products"
        backLabel="Back to products"
      />
    ) : (
      <ErrorState error={product.error} onRetry={() => void product.refetch()} />
    );
  }

  const Section = SECTIONS[current];
  const data = product.data;
  return (
    <div className="flex flex-col gap-4">
      <ProductHeader product={data} />
      {data.deletedAt ? <DeletedNotice product={data} /> : null}
      <nav aria-label="Product sections" className="-mx-1 overflow-x-auto">
        {/* relative: the tabs' visually hidden text is absolutely positioned; its containing
            block must be inside the scroller or it widens the whole page on a phone. */}
        <ul className="relative flex min-w-max gap-1 border-b px-1">
          {PRODUCT_TABS.map((item) => (
            <li key={item.id}>
              <Link
                href={productHref(data.id, item.id)}
                aria-current={item.id === current ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                  item.id === current
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
                {item.id === 'publishing' ? <BlockerCount product={data} /> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Section product={data} />
        </div>
        <ProductWorkbench product={data} className="lg:sticky lg:top-20" />
      </div>
    </div>
  );
}

function BlockerCount({ product }: { product: AdminProductDetailDto }) {
  const gate = usePublishBlockers(product);
  const count = (gate.data ?? product.publishBlockers).length;
  if (count === 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-destructive/10 px-1.5 text-xs text-destructive">
      {count}
      <span className="sr-only"> {count === 1 ? 'blocker' : 'blockers'}</span>
    </span>
  );
}

function ProductHeader({ product }: { product: AdminProductDetailDto }) {
  const { canCall } = usePermissions();
  const actions = useProductActions(product);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const canDuplicate = canCall(productsRoutes.duplicate);
  const canDelete = canCall(productsRoutes.remove) && !product.deletedAt;

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/catalog/products"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Products
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{product.sku}</span>
            <StatusBadge status={product.status} registry={PRODUCT_STATUS} />
            <StatusBadge status={product.publication} registry={PUBLICATION} />
          </div>
        </div>
        {canDuplicate || canDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="More product actions">
                <MoreHorizontal aria-hidden />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canDuplicate ? (
                <DropdownMenuItem onSelect={() => setDuplicating(true)}>
                  Duplicate…
                </DropdownMenuItem>
              ) : null}
              {canDuplicate && canDelete ? <DropdownMenuSeparator /> : null}
              {canDelete ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setConfirmDelete(true)}
                >
                  Move to trash…
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {confirmDelete ? (
        <LazyConfirmDialog
          open
          onOpenChange={setConfirmDelete}
          title={`Move ${product.name} to trash?`}
          description="It disappears from the storefront and from lists. You can restore it from the Deleted filter on the products list."
          impact={
            <ul className="list-disc pl-4 text-sm">
              <li>
                {formatCount(product.variantCount, 'variant')} and{' '}
                {formatCount(product.mediaCount, 'image')} stay attached.
              </li>
              {isLive(product) ? <li>It is live now and stops being sold immediately.</li> : null}
            </ul>
          }
          confirmLabel="Move to trash"
          level="destructive"
          onConfirm={() => actions.remove.mutateAsync()}
        />
      ) : null}
      {duplicating ? (
        <DuplicateDialog product={product} onClose={() => setDuplicating(false)} />
      ) : null}
    </div>
  );
}

function DeletedNotice({ product }: { product: AdminProductDetailDto }) {
  const { canCall } = usePermissions();
  const { restore } = useProductActions(product);
  return (
    <Alert tone="warning" title="This product is in the trash">
      <div className="flex flex-wrap items-center gap-3">
        <span>Deleted {formatRelative(product.deletedAt!)}. Customers cannot see it.</span>
        {canCall(productsRoutes.restore) ? (
          <Button
            size="sm"
            variant="outline"
            loading={restore.isPending}
            onClick={() => restore.mutate()}
          >
            Restore
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}

export function ProductWorkbench({
  product,
  className,
}: {
  product: AdminProductDetailDto;
  className?: string;
}) {
  const { canCall } = usePermissions();
  const actions = useProductActions(product);
  const gate = usePublishBlockers(product);
  const issues: WorkbenchIssue[] = (gate.data ?? product.publishBlockers).map((blocker) => {
    const target = blockerTab(blocker);
    return {
      key: `${blocker.code}:${blocker.field ?? ''}`,
      label: blocker.message,
      href: target ? productHref(product.id, target) : undefined,
    };
  });
  const live = isLive(product);
  const canPublish = canCall(productsRoutes.publish) && !product.deletedAt;
  const blockerCodes = new Set((gate.data ?? product.publishBlockers).map((b) => b.code));

  return (
    <Workbench
      kind="Product"
      title={product.name}
      className={className}
      blocks={[
        {
          id: 'media',
          title: 'Media',
          content: (
            <MediaStatus product={product} mediaNotReady={blockerCodes.has('MEDIA_NOT_READY')} />
          ),
        },
      ]}
      status={
        <>
          <StatusBadge status={product.status} registry={PRODUCT_STATUS} />
          <StatusBadge status={product.publication} registry={PUBLICATION} />
        </>
      }
      health={{
        score: product.completeness.score,
        factors: product.completeness.factors.map((factor) => {
          const target = factorTab(factor.key);
          return {
            key: factor.key,
            label: factor.label,
            satisfied: factor.satisfied,
            href: target ? productHref(product.id, target) : undefined,
          };
        }),
      }}
      issues={issues}
      actions={
        canPublish ? (
          live ? (
            <Button
              size="sm"
              variant="outline"
              loading={actions.unpublish.isPending}
              onClick={() => actions.unpublish.mutate()}
            >
              Unpublish
            </Button>
          ) : issues.length === 0 && gate.isSuccess ? (
            <Button
              size="sm"
              loading={actions.publish.isPending}
              onClick={() => actions.publish.mutate(undefined)}
            >
              Publish now
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href={productHref(product.id, 'publishing')}>Review publishing checklist</Link>
            </Button>
          )
        ) : undefined
      }
      facts={[
        { label: 'Base price', value: formatRupees(product.basePricePaise) },
        { label: 'Stock', value: `${formatNumber(product.totalStock)} units` },
        { label: 'Updated', value: formatRelative(product.updatedAt) },
        ...(product.publishedAt
          ? [
              {
                label: live ? 'Published' : 'Publish date',
                value: formatDateTime(product.publishedAt),
              },
            ]
          : []),
      ]}
      related={[
        {
          label: 'Variants',
          count: product.variantCount,
          href: productHref(product.id, 'variants'),
        },
        { label: 'Media', count: product.mediaCount, href: productHref(product.id, 'media') },
        {
          label: 'Categories',
          count: product.categories.length,
          href: productHref(product.id, 'general'),
        },
        {
          label: 'Price rules',
          count: product.priceAdjustmentIds.length,
          href: canCall(priceAdjustmentsRoutes.list)
            ? `/pricing/price-rules?productId=${encodeURIComponent(product.id)}`
            : undefined,
        },
      ]}
      history={canCall(auditRoutes.list) ? { entity: 'Product', entityId: product.id } : undefined}
    />
  );
}

/**
 * The product's media at a glance, from the API: the completeness factors for the primary image
 * and gallery size, the media count and the MEDIA_NOT_READY publish blocker.
 */
function MediaStatus({
  product,
  mediaNotReady,
}: {
  product: AdminProductDetailDto;
  mediaNotReady: boolean;
}) {
  const factor = (key: string) => product.completeness.factors.find((f) => f.key === key);
  const primary =
    factor('primaryMedia')?.satisfied ?? product.media.some((item) => item.role === 'PRIMARY');
  const galleryOk = factor('gallery')?.satisfied ?? product.mediaCount >= 3;
  const scoped = product.media.filter((item) => item.variantId || item.attributeValueId).length;
  const href = productHref(product.id, 'media');
  const ok = <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />;
  const warn = <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />;
  return (
    <ul aria-label="Media status" className="flex flex-col gap-1.5">
      <li className="flex items-start gap-2">
        {primary ? ok : warn}
        <span className="flex flex-col">
          {primary ? 'Primary image configured' : 'No primary image'}
          {primary ? null : (
            <Link href={href} className="w-fit text-xs font-medium text-primary hover:underline">
              Add primary image
            </Link>
          )}
        </span>
      </li>
      <li className="flex items-start gap-2">
        {galleryOk ? ok : warn}
        <span>
          {formatCount(product.mediaCount, 'image')}
          {galleryOk ? '' : ' (3 or more recommended)'}
        </span>
      </li>
      {scoped > 0 ? (
        <li className="flex items-start gap-2">
          {ok}
          <span>{formatCount(scoped, 'image')} for one variant or option</span>
        </li>
      ) : null}
      {mediaNotReady ? (
        <li className="flex items-start gap-2">
          {warn}
          <span className="flex flex-col">
            Some images are processing or in the trash
            <Link href={href} className="w-fit text-xs font-medium text-primary hover:underline">
              Review images
            </Link>
          </span>
        </li>
      ) : null}
    </ul>
  );
}
