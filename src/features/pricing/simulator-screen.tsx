'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState, PermissionNotice } from '@/components/patterns/states';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { pricingRoutes } from '@/lib/api/routes/pricing';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { productKeys, productsApi } from '../catalog/products/api';

import { BreakdownView, TraceView } from './breakdown-view';
import { CartBuilder, cartInput, cartProblems, emptyCart, type SampleCart } from './cart-builder';
import { SHIPPING_METHOD_LABELS } from './lookups';
import { rulesApi } from './rules-api';

export function SimulatorScreen() {
  const { canCall } = usePermissions();
  if (!canCall(pricingRoutes.simulate)) {
    return <PermissionNotice area="the price simulator" all={['pricing.adjustment.read']} />;
  }
  return <Simulator />;
}

function Simulator() {
  const params = useSearchParams();
  const productId = params.get('productId');
  const preset = useQuery({
    queryKey: productKeys.detail(productId ?? ''),
    queryFn: ({ signal }) => productsApi.get(productId!, signal),
    enabled: Boolean(productId),
    ...cachePolicy.detail,
  });
  const [cart, setCart] = useState<SampleCart | null>(null);
  const current: SampleCart =
    cart ??
    emptyCart(
      preset.data
        ? [{ id: preset.data.id, name: preset.data.name, sku: preset.data.sku, qty: 1 }]
        : [],
    );
  const [shown, setShown] = useState<string[]>([]);
  const run = useMutation({ mutationFn: () => rulesApi.simulate(cartInput(current)) });
  const names = Object.fromEntries(current.lines.map((line) => [line.id, line.name]));

  return (
    <>
      <PageHeader
        title="Price simulator"
        description="Price a what-if cart exactly as checkout would: same engine, same rules. Nothing is saved or ordered."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="sim-cart" className="flex flex-col gap-4">
          <h2 id="sim-cart" className="text-base font-semibold">
            Sample cart
          </h2>
          <CartBuilder
            cart={current}
            onChange={(next) => {
              setCart(next);
              setShown([]);
            }}
            shippingMethods={SHIPPING_METHOD_LABELS}
          />
          {shown.length > 0 ? (
            <Alert tone="warning" title="Check the sample cart">
              <ul className="list-disc pl-5">
                {shown.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          <FormAlert error={run.error} />
          <Button
            className="w-fit"
            loading={run.isPending}
            onClick={() => {
              const problems = cartProblems(current);
              setShown(problems);
              if (problems.length === 0) run.mutate();
            }}
          >
            <Calculator aria-hidden />
            Price this cart
          </Button>
        </section>
        <section aria-labelledby="sim-result" className="flex flex-col gap-4" aria-live="polite">
          <h2 id="sim-result" className="text-base font-semibold">
            Result
          </h2>
          {run.data ? (
            <>
              <BreakdownView breakdown={run.data.breakdown} names={names} />
              <h3 className="text-sm font-semibold">Why: every rule considered</h3>
              <TraceView trace={run.data.trace} />
            </>
          ) : (
            <EmptyState
              icon={Calculator}
              title="No price yet"
              description="Add products and choose Price this cart."
              compact
            />
          )}
        </section>
      </div>
    </>
  );
}
