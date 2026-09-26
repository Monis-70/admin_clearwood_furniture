'use client';

import { useQuery } from '@tanstack/react-query';

import type { AdminCartDetailDto } from '@shared/types/cart';

import { KeyValueList } from '@/components/patterns/key-value-list';
import { EmptyState, ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDateTime } from '@/lib/format/datetime';
import { cachePolicy } from '@/lib/query/policies';

import { formatRupees } from '../catalog/model';

import { cartKeys, cartsApi } from './api';
import { CART_STATUS_LABELS } from './model';

function CartBody({ cart }: { cart: AdminCartDetailDto }) {
  const inCart = cart.lines.filter((l) => l.saveState === 'IN_CART');
  const saved = cart.lines.filter((l) => l.saveState !== 'IN_CART');
  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {cart.customerName ?? (cart.isGuest ? 'Guest cart' : 'Cart')}
          <Badge tone={cart.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {CART_STATUS_LABELS[cart.status] ?? cart.status}
          </Badge>
        </SheetTitle>
        <SheetDescription>
          Last activity {formatDateTime(cart.lastActivityAt)} · read-only support view
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 p-4">
        <KeyValueList
          items={[
            { label: 'Customer', value: cart.customerEmail ?? (cart.isGuest ? 'Guest' : '—') },
            { label: 'Delivery pincode', value: cart.pincode ?? '—' },
            { label: 'Coupon', value: cart.couponCode ?? '—' },
            { label: 'Created', value: formatDateTime(cart.createdAt) },
            ...(cart.convertedOrderId
              ? [{ label: 'Became order', value: cart.convertedOrderId }]
              : []),
            ...(cart.mergedIntoCartId
              ? [{ label: 'Merged into cart', value: cart.mergedIntoCartId }]
              : []),
          ]}
        />
        {cart.issues.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
            {cart.issues.map((issue, i) => (
              <li key={i}>
                <Badge tone={issue.severity === 'BLOCKING' ? 'danger' : 'warning'}>
                  {issue.severity.toLowerCase()}
                </Badge>{' '}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
        <section aria-labelledby="cart-lines" className="flex flex-col gap-2">
          <h3 id="cart-lines" className="text-sm font-semibold">
            In the cart ({inCart.length})
          </h3>
          {inCart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Empty.</p>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Cart lines</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-medium">Product</th>
                  <th className="py-1 text-right font-medium">Qty</th>
                  <th className="py-1 text-right font-medium">Now</th>
                  <th className="py-1 text-right font-medium">When added</th>
                </tr>
              </thead>
              <tbody>
                {inCart.map((l) => (
                  <tr key={l.id} className="border-t align-top">
                    <td className="py-1.5">
                      <span className="block font-medium">{l.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[l.variantName, l.sku].filter(Boolean).join(' · ')}
                        {l.inStock ? '' : ' · out of stock'}
                      </span>
                    </td>
                    <td className="tabular py-1.5 text-right">{l.qty}</td>
                    <td className="tabular py-1.5 text-right">{formatRupees(l.totalPaise)}</td>
                    <td className="tabular py-1.5 text-right text-muted-foreground">
                      {formatRupees(l.addedUnitPricePaise)} each
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {saved.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Saved for later: {saved.map((l) => l.name).join(', ')}
            </p>
          ) : null}
        </section>
        {cart.breakdown ? (
          <KeyValueList
            items={[
              { label: 'Subtotal', value: formatRupees(cart.breakdown.subtotalPaise) },
              { label: 'Discounts', value: formatRupees(cart.breakdown.discountPaise) },
              { label: 'Delivery', value: formatRupees(cart.breakdown.shippingPaise) },
              { label: 'GST', value: formatRupees(cart.breakdown.taxPaise) },
              { label: 'Total now', value: formatRupees(cart.breakdown.grandTotalPaise) },
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            The pricing engine could not price this cart right now.
          </p>
        )}
        {cart.events.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              History ({cart.events.length})
            </summary>
            <ol className="mt-2 flex flex-col gap-1 text-xs">
              {cart.events.map((ev) => (
                <li key={ev.id}>
                  <span className="text-muted-foreground">{formatDateTime(ev.createdAt)}</span>{' '}
                  {ev.type.replace(/_/g, ' ').toLowerCase()}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </>
  );
}

/** One cart by id, or a customer's live cart; totals are a fresh quote from the pricing engine. */
export function CartDetailSheet({
  id,
  customerId,
  onClose,
}: {
  id?: string;
  customerId?: string;
  onClose(): void;
}) {
  const cart = useQuery({
    queryKey: id ? cartKeys.detail(id) : cartKeys.customer(customerId ?? ''),
    queryFn: ({ signal }) =>
      id ? cartsApi.get(id, signal) : cartsApi.customerCart(customerId ?? '', signal),
    ...cachePolicy.detail,
  });
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {cart.isPending || cart.error || !cart.data ? (
          <div className="p-4">
            <SheetTitle className="sr-only">Cart</SheetTitle>
            <SheetDescription className="sr-only">One cart</SheetDescription>
            {cart.isPending ? (
              <SectionLoader label="Loading cart…" />
            ) : cart.error ? (
              <ErrorState error={cart.error} onRetry={() => void cart.refetch()} compact />
            ) : (
              <EmptyState
                title="This customer has no active cart"
                description="Their basket is empty, or they checked out and the cart became an order."
                compact
              />
            )}
          </div>
        ) : (
          <CartBody cart={cart.data} />
        )}
      </SheetContent>
    </Sheet>
  );
}
