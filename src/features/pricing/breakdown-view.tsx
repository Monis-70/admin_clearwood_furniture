'use client';

import type { PriceBreakdown, PricingTraceStep } from '@shared/types/pricing';

import { Badge } from '@/components/ui/badge';

import { formatRupees } from '../catalog/model';

const signedRupees = (paise: number) =>
  paise < 0 ? `− ${formatRupees(-paise)}` : formatRupees(paise);

/**
 * The API's price breakdown, line by line: every figure is the engine's. Nothing here adds,
 * subtracts or recomputes; it only lays out the components the API returned.
 */
export function BreakdownView({
  breakdown,
  names = {},
}: {
  breakdown: PriceBreakdown;
  names?: Readonly<Record<string, string>>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {breakdown.lines.map((line) => (
        <section
          key={line.lineId}
          aria-label={`Line: ${names[line.productId] ?? 'product'}`}
          className="rounded-md border"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-3 py-2">
            <span className="font-medium">
              {names[line.productId] ?? 'Product'} × {line.qty}
            </span>
            <span className="text-sm text-muted-foreground">
              Unit {formatRupees(line.baseUnitPaise)} → {formatRupees(line.unitPricePaise)}
            </span>
          </header>
          <table className="w-full text-sm">
            <caption className="sr-only">Price components</caption>
            <tbody>
              {line.components.map((component, index) => (
                <tr key={`${component.code}-${index}`} className="border-b last:border-0">
                  <td className="px-3 py-1.5">{component.label}</td>
                  <td className="tabular px-3 py-1.5 text-right">
                    {signedRupees(component.amountPaise)}
                  </td>
                </tr>
              ))}
              <tr className="border-t font-medium">
                <td className="px-3 py-1.5">
                  GST {line.taxRateBp / 100}% on {formatRupees(line.taxablePaise)}
                </td>
                <td className="tabular px-3 py-1.5 text-right">{formatRupees(line.taxPaise)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="px-3 py-1.5">Line total</td>
                <td className="tabular px-3 py-1.5 text-right">{formatRupees(line.totalPaise)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}
      {breakdown.components.length > 0 ? (
        <section aria-label="Cart-level components" className="rounded-md border">
          <h4 className="border-b px-3 py-2 text-sm font-medium">Applied to the whole cart</h4>
          <ul className="text-sm">
            {breakdown.components.map((component, index) => (
              <li
                key={`${component.code}-${index}`}
                className="flex justify-between border-b px-3 py-1.5 last:border-0"
              >
                <span>{component.label}</span>
                <span className="tabular">{signedRupees(component.amountPaise)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-3 text-sm">
        <dt>Subtotal</dt>
        <dd className="tabular text-right">{formatRupees(breakdown.subtotalPaise)}</dd>
        <dt>Discounts</dt>
        <dd className="tabular text-right">{signedRupees(-breakdown.discountPaise)}</dd>
        <dt>Delivery</dt>
        <dd className="tabular text-right">{formatRupees(breakdown.shippingPaise)}</dd>
        <dt>
          GST{' '}
          <span className="text-muted-foreground">
            ({breakdown.placeOfSupply.isIntraState ? 'CGST + SGST' : 'IGST'}
            {breakdown.placeOfSupply.isFallback ? ', default place of supply' : ''})
          </span>
        </dt>
        <dd className="tabular text-right">{formatRupees(breakdown.taxPaise)}</dd>
        {breakdown.roundingPaise !== 0 ? (
          <>
            <dt>Rounding</dt>
            <dd className="tabular text-right">{signedRupees(breakdown.roundingPaise)}</dd>
          </>
        ) : null}
        <dt className="font-semibold">Total</dt>
        <dd className="tabular text-right font-semibold">
          {formatRupees(breakdown.grandTotalPaise)}
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        {breakdown.pricesIncludeTax ? 'Prices include GST.' : 'GST is added to prices.'}
        {breakdown.appliedCouponCode ? ` Coupon ${breakdown.appliedCouponCode} applied.` : ''}
      </p>
    </div>
  );
}

/** Every rule the engine considered, and why it did or did not apply. */
export function TraceView({ trace }: { trace: readonly PricingTraceStep[] }) {
  if (trace.length === 0)
    return <p className="text-sm text-muted-foreground">No rules were considered.</p>;
  return (
    <ol className="flex flex-col divide-y rounded-md border text-sm" aria-label="Rules considered">
      {trace.map((step, index) => (
        <li
          key={`${step.step}-${step.ruleId ?? index}`}
          className="flex flex-wrap items-center gap-2 px-3 py-2"
        >
          <Badge tone={step.matched ? 'success' : 'neutral'}>
            {step.matched ? 'Applied' : 'Skipped'}
          </Badge>
          <span className="font-medium">{step.ruleName}</span>
          {step.reason ? <span className="text-muted-foreground">{step.reason}</span> : null}
          {step.amountPaise !== undefined ? (
            <span className="tabular ml-auto">{signedRupees(step.amountPaise)}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
