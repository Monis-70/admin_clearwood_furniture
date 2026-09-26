'use client';

import { FileWarning, ImageOff, Inbox, PackageOpen, ScrollText, Warehouse } from 'lucide-react';
import Link from 'next/link';

import { StatusBadge } from '@/components/patterns/status-badge';
import { AUDIT_ACTION_LABELS, entityLabel } from '@/features/audit/model';
import { auditApi } from '@/features/audit/api';
import { catalogApi, type ProductListQuery } from '@/features/catalog/api';
import { STOCK_STATUS } from '@/features/catalog/model';
import { enquiriesApi } from '@/features/enquiries/api';
import { endpoints } from '@/lib/api/endpoints';
import { formatNumber, formatRelative } from '@/lib/format/datetime';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { WorkQueue } from './work-queue';

const TOP = { page: 1, limit: 5 } as const;

function productQueue(filter: Partial<ProductListQuery>): ProductListQuery {
  return { ...TOP, order: 'desc', sort: 'updatedAt', ...filter };
}

const DRAFTS = productQueue({ status: 'DRAFT' });
const NO_IMAGES = productQueue({ hasMedia: 'false' });
const INCOMPLETE = productQueue({ completenessMax: 49 });
const NEW_ENQUIRIES = { ...TOP, order: 'desc' as const, status: 'NEW' as const };
const LOW_STOCK = { ...TOP, order: 'desc' as const };
const ACTIVITY = { ...TOP, order: 'desc' as const };

function ProductLink({ id, name, sku }: { id: string; name: string; sku: string }) {
  return (
    <>
      <Link
        href={`/catalog/products?q=${encodeURIComponent(sku)}`}
        className="min-w-0 truncate font-medium hover:underline"
        data-id={id}
      >
        {name}
      </Link>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{sku}</span>
    </>
  );
}

/**
 * Work that is waiting, straight from the API lists. Each queue appears only for admins who can
 * open the list behind it; nothing is estimated or invented.
 */
export function WorkQueues() {
  const { canCall } = usePermissions();
  const products = canCall(endpoints.catalog.products);
  const queues = [
    canCall(endpoints.enquiries.list) ? (
      <WorkQueue
        key="enquiries"
        title="New enquiries"
        description="Customers waiting for a first reply."
        icon={Inbox}
        tone="info"
        queryKey={['dashboard', 'enquiries', NEW_ENQUIRIES]}
        load={(signal) => enquiriesApi.list(NEW_ENQUIRIES, signal)}
        rowKey={(row) => row.id}
        renderRow={(row) => (
          <>
            <Link
              href={`/enquiries?id=${encodeURIComponent(row.id)}`}
              className="min-w-0 truncate font-medium hover:underline"
            >
              {row.name}
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelative(row.createdAt)}
            </span>
          </>
        )}
        href="/enquiries?status=NEW"
        emptyText="No new enquiries."
      />
    ) : null,
    canCall(endpoints.catalog.lowStock) ? (
      <WorkQueue
        key="low-stock"
        title="Low stock"
        description="Variants at or below their low-stock level."
        icon={Warehouse}
        queryKey={['dashboard', 'low-stock', LOW_STOCK]}
        load={(signal) => catalogApi.lowStock(LOW_STOCK, signal)}
        rowKey={(row) => row.variantId}
        renderRow={(row) => (
          <>
            <Link
              href={`/catalog/products?q=${encodeURIComponent(row.productName)}`}
              className="min-w-0 truncate font-medium hover:underline"
              title={row.sku}
            >
              {row.productName}
              {row.variantName ? (
                <span className="font-normal text-muted-foreground"> · {row.variantName}</span>
              ) : null}
            </Link>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular text-xs">{formatNumber(row.availableQty)} left</span>
              <StatusBadge status={row.stockStatus} registry={STOCK_STATUS} />
            </span>
          </>
        )}
        href="/catalog/inventory"
        emptyText="Nothing is running low."
      />
    ) : null,
    products ? (
      <WorkQueue
        key="drafts"
        title="Not published yet"
        description="Draft products customers cannot see."
        icon={PackageOpen}
        tone="info"
        queryKey={['dashboard', 'products', DRAFTS]}
        load={(signal) => catalogApi.products(DRAFTS, signal)}
        rowKey={(row) => row.id}
        renderRow={(row) => <ProductLink id={row.id} name={row.name} sku={row.sku} />}
        href="/catalog/products?status=DRAFT"
        emptyText="Every product is published or archived."
      />
    ) : null,
    products ? (
      <WorkQueue
        key="no-images"
        title="Missing images"
        description="Products without a single photo."
        icon={ImageOff}
        queryKey={['dashboard', 'products', NO_IMAGES]}
        load={(signal) => catalogApi.products(NO_IMAGES, signal)}
        rowKey={(row) => row.id}
        renderRow={(row) => <ProductLink id={row.id} name={row.name} sku={row.sku} />}
        href="/catalog/products?hasMedia=false"
        emptyText="Every product has at least one image."
      />
    ) : null,
    products ? (
      <WorkQueue
        key="incomplete"
        title="Missing information"
        description="Products with a completeness score below 50%."
        icon={FileWarning}
        queryKey={['dashboard', 'products', INCOMPLETE]}
        load={(signal) => catalogApi.products(INCOMPLETE, signal)}
        rowKey={(row) => row.id}
        renderRow={(row) => (
          <>
            <Link
              href={`/catalog/products?q=${encodeURIComponent(row.sku)}`}
              className="min-w-0 truncate font-medium hover:underline"
            >
              {row.name}
            </Link>
            <span className="shrink-0 text-xs font-medium text-danger">
              {row.completenessScore}%
            </span>
          </>
        )}
        href="/catalog/products?completenessMax=50"
        emptyText="Every product is at least half complete."
      />
    ) : null,
    canCall(endpoints.audit.list) ? (
      <WorkQueue
        key="activity"
        title="Recent admin activity"
        description="The latest entries in the audit log."
        icon={ScrollText}
        tone="info"
        queryKey={['dashboard', 'audit', ACTIVITY]}
        load={(signal) => auditApi.list(ACTIVITY, signal)}
        rowKey={(row) => row.id}
        renderRow={(row) => (
          <>
            <span className="min-w-0 truncate">
              <span className="font-medium">{row.actorName ?? 'System'}</span>{' '}
              <span className="text-muted-foreground">
                {(AUDIT_ACTION_LABELS[row.action] ?? row.action).toLowerCase()} ·{' '}
                {entityLabel(row.entity)}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelative(row.createdAt)}
            </span>
          </>
        )}
        href="/system/audit-log"
        emptyText="No activity yet."
      />
    ) : null,
  ].filter(Boolean);

  if (queues.length === 0) return null;
  return (
    <section aria-labelledby="work-queues" className="mb-6 flex flex-col gap-3">
      <h2 id="work-queues" className="text-base font-semibold">
        Needs attention
      </h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{queues}</div>
    </section>
  );
}
