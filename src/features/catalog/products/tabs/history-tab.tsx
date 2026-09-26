'use client';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';

import { EntityHistory } from '@/features/audit/entity-history';

export function HistoryTab({ product }: { product: AdminProductDetailDto }) {
  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="history-heading" className="text-base font-semibold">
          History
        </h2>
        <p className="text-sm text-muted-foreground">
          Every change to this product, from the audit log. Stock movements are in each
          variant&apos;s stock history.
        </p>
      </div>
      <EntityHistory entity="Product" entityId={product.id} />
    </section>
  );
}
