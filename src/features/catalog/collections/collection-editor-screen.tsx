'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { ErrorState, NotFoundState, PermissionNotice } from '@/components/patterns/states';
import { Workbench, type WorkbenchIssue } from '@/components/patterns/workbench';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/surface';
import { auditRoutes } from '@/lib/api/routes/audit';
import { collectionsRoutes } from '@/lib/api/routes/collections';
import { hasCode } from '@/lib/api/errors';
import { formatCount, formatRelative } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';
import { cn } from '@/lib/utils';

import { catalogKeys } from '../api';
import { collectionKeys, collectionsApi, parseRules, type CollectionDetail } from './api';

import {
  COLLECTION_TABS,
  collectionHref,
  hasEnded,
  scheduleText,
  type CollectionTab,
} from './model';

const loading = () => <Skeleton className="h-64 w-full" />;
const SECTIONS: Record<CollectionTab, React.ComponentType<{ collection: CollectionDetail }>> = {
  details: dynamic(() => import('./tabs/details-tab').then((m) => m.DetailsTab), {
    ssr: false,
    loading,
  }),
  products: dynamic(() => import('./tabs/products-tab').then((m) => m.ProductsTab), {
    ssr: false,
    loading,
  }),
  rules: dynamic(() => import('./tabs/rules-tab').then((m) => m.RulesTab), { ssr: false, loading }),
  history: dynamic(() => import('./tabs/history-tab').then((m) => m.HistoryTab), {
    ssr: false,
    loading,
  }),
};
const TAB_LABELS: Record<CollectionTab, string> = {
  details: 'Details',
  products: 'Products',
  rules: 'Rules',
  history: 'History',
};

export function CollectionEditorScreen() {
  const { canCall } = usePermissions();
  const params = useSearchParams();
  const id = params.get('id');
  const requested = params.get('tab');
  if (!canCall(collectionsRoutes.get))
    return <PermissionNotice area="collections" all={['catalog.collection.read']} />;
  if (!id)
    return (
      <NotFoundState
        title="No collection selected"
        backHref="/catalog/collections"
        backLabel="Back to collections"
      />
    );
  const tab = (COLLECTION_TABS as readonly string[]).includes(requested ?? '')
    ? (requested as CollectionTab)
    : 'details';
  return <CollectionEditor id={id} tab={tab} />;
}

function CollectionEditor({ id, tab }: { id: string; tab: CollectionTab }) {
  const { canCall } = usePermissions();
  const collection = useQuery({
    queryKey: collectionKeys.detail(id),
    queryFn: ({ signal }) => collectionsApi.get(id, signal),
    ...cachePolicy.detail,
  });
  if (collection.isPending) return <Skeleton className="h-96 w-full" />;
  if (collection.error) {
    return hasCode(collection.error, 'NOT_FOUND') ? (
      <NotFoundState
        title="Collection not found"
        backHref="/catalog/collections"
        backLabel="Back to collections"
      />
    ) : (
      <ErrorState error={collection.error} onRetry={() => void collection.refetch()} />
    );
  }
  const data = collection.data;
  const tabs = COLLECTION_TABS.filter(
    (t) =>
      (t !== 'rules' || data.type === 'AUTOMATIC') &&
      (t !== 'history' || canCall(auditRoutes.list)),
  );
  const current = tabs.includes(tab) ? tab : 'details';
  const Section = SECTIONS[current];

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/catalog/collections"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Collections
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{data.name}</h1>
        <p className="text-sm text-muted-foreground">
          /{data.slug} ·{' '}
          {data.type === 'AUTOMATIC' ? 'Products chosen by rules' : 'Products chosen by hand'}
        </p>
      </div>
      {data.deletedAt ? (
        <Alert tone="warning" title="This collection is deleted">
          It is hidden from the storefront. Restore it from the collections list.
        </Alert>
      ) : null}
      <nav aria-label="Collection sections" className="-mx-1 overflow-x-auto">
        <ul className="relative flex min-w-max gap-1 border-b px-1">
          {tabs.map((item) => (
            <li key={item}>
              <Link
                href={collectionHref(data.id, item)}
                aria-current={item === current ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap',
                  item === current
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {TAB_LABELS[item]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Section collection={data} />
        </div>
        <CollectionWorkbench collection={data} className="lg:sticky lg:top-20" />
      </div>
    </div>
  );
}

export function CollectionWorkbench({
  collection,
  className,
}: {
  collection: CollectionDetail;
  className?: string;
}) {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const rules = parseRules(collection.rulesJson);
  const automatic = collection.type === 'AUTOMATIC';
  const ended = hasEnded(collection.endsAt);

  const evaluate = useMutation({
    mutationFn: () => collectionsApi.evaluate(collection.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      notifySuccess('Collection re-evaluated', 'Its products now match the current rules.');
    },
    onError: (error) => notifyError(error, 'Could not re-evaluate'),
  });

  const issues: WorkbenchIssue[] = [];
  if (!collection.isActive)
    issues.push({
      key: 'inactive',
      label: 'Inactive: hidden from the storefront.',
      href: collectionHref(collection.id, 'details'),
      tone: 'warning',
    });
  if (ended)
    issues.push({
      key: 'ended',
      label: 'Its schedule has ended.',
      href: collectionHref(collection.id, 'details'),
      tone: 'warning',
    });
  if (automatic && !rules)
    issues.push({
      key: 'rules',
      label: 'No rules yet: it matches nothing.',
      href: collectionHref(collection.id, 'rules'),
    });
  if ((collection.evaluatedCount ?? 0) === 0) {
    issues.push({
      key: 'empty',
      label: 'No products in it.',
      href: collectionHref(collection.id, automatic ? 'rules' : 'products'),
      tone: automatic && !rules ? 'warning' : undefined,
    });
  }
  if (!collection.seoDescription)
    issues.push({
      key: 'seo',
      label: 'No SEO description.',
      href: collectionHref(collection.id, 'details'),
      tone: 'warning',
    });

  return (
    <>
      <Workbench
        kind="Collection"
        title={collection.name}
        className={className}
        status={
          <>
            <Badge
              tone={collection.deletedAt ? 'danger' : collection.isActive ? 'success' : 'warning'}
            >
              {collection.deletedAt ? 'Deleted' : collection.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge tone={automatic ? 'info' : 'neutral'}>
              {automatic ? 'Automatic' : 'Manual'}
            </Badge>
          </>
        }
        issues={issues}
        facts={[
          { label: 'Shown', value: scheduleText(collection) },
          ...(automatic
            ? [
                {
                  label: 'Last evaluated',
                  value: collection.lastEvaluatedAt
                    ? formatRelative(collection.lastEvaluatedAt)
                    : 'Never',
                },
              ]
            : []),
          { label: 'Updated', value: formatRelative(collection.updatedAt) },
        ]}
        related={[
          {
            label: 'Products',
            count: collection.evaluatedCount,
            href: `/catalog/products?collectionId=${encodeURIComponent(collection.id)}`,
          },
        ]}
        actions={
          collection.deletedAt ? null : (
            <>
              {automatic && rules && canCall(collectionsRoutes.evaluate) ? (
                <Button
                  size="sm"
                  variant="outline"
                  loading={evaluate.isPending}
                  onClick={() => evaluate.mutate()}
                >
                  Re-evaluate now
                </Button>
              ) : null}
              {!automatic && canCall(collectionsRoutes.setProducts) ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={collectionHref(collection.id, 'products')}>Choose products</Link>
                </Button>
              ) : null}
              {canCall(collectionsRoutes.remove) ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setRemoving(true)}
                >
                  Delete…
                </Button>
              ) : null}
            </>
          )
        }
        history={
          canCall(auditRoutes.list) ? { entity: 'Collection', entityId: collection.id } : undefined
        }
      />
      {removing ? (
        <LazyConfirmDialog
          open
          onOpenChange={(open) => (open ? undefined : setRemoving(false))}
          title={`Delete ${collection.name}?`}
          description={`It leaves the storefront (${formatCount(collection.evaluatedCount, 'product')} keep existing). Restore it from the collections list.`}
          confirmLabel="Delete collection"
          level="destructive"
          onConfirm={async () => {
            await collectionsApi.remove(collection.id);
            void queryClient.invalidateQueries({ queryKey: collectionKeys.all });
            notifySuccess('Collection deleted');
            router.push('/catalog/collections');
          }}
        />
      ) : null}
    </>
  );
}
