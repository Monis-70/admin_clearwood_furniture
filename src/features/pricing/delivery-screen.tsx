'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, MoreHorizontal, Plus, Trash2, Truck } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { pricingRoutes } from '@/lib/api/routes/pricing';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { formatRupees } from '../catalog/model';

import { deliveryApi, deliveryKeys, type RateRow, type ZoneRow } from './delivery-api';
import { CONDITIONS, SHIPPING_METHOD_LABELS } from './lookups';

const ZoneDialog = dynamic(() => import('./delivery-dialogs').then((m) => m.ZoneDialog), {
  ssr: false,
});
const RateDialog = dynamic(() => import('./delivery-dialogs').then((m) => m.RateDialog), {
  ssr: false,
});
const Pincodes = dynamic(() => import('./delivery-dialogs').then((m) => m.Pincodes), {
  ssr: false,
});

export function DeliveryScreen() {
  const { canCall } = usePermissions();
  if (!canCall(pricingRoutes.zones)) {
    return <PermissionNotice area="delivery charges" all={['pricing.tax.read']} />;
  }
  return <Delivery />;
}

function Delivery() {
  const { canCall } = usePermissions();
  const queryClient = useQueryClient();
  const params = useListParams<'zone'>({ filters: ['zone'] });
  const zones = useQuery({
    queryKey: deliveryKeys.zones(),
    queryFn: ({ signal }) => deliveryApi.zones(signal),
    ...cachePolicy.list,
  });
  const rates = useQuery({
    queryKey: deliveryKeys.rates(),
    queryFn: ({ signal }) => deliveryApi.rates(signal),
    ...cachePolicy.list,
  });
  const [editingZone, setEditingZone] = useState<ZoneRow | 'new' | null>(null);
  const [removingZone, setRemovingZone] = useState<ZoneRow | null>(null);
  const [editingRate, setEditingRate] = useState<{ rate: RateRow | null; zoneId: string } | null>(
    null,
  );
  const [removingRate, setRemovingRate] = useState<RateRow | null>(null);
  const canEdit = canCall(pricingRoutes.updateZone);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
  const openZone = zones.data?.find((z) => z.id === params.filters.zone);

  return (
    <>
      <PageHeader
        title="Delivery charges"
        description="Delivery zones, the rates charged in each and the pincodes they cover. Checkout picks the zone from the pincode and the rate from the cart."
        actions={
          canCall(pricingRoutes.createZone) ? (
            <Button onClick={() => setEditingZone('new')}>
              <Plus aria-hidden />
              New zone
            </Button>
          ) : undefined
        }
      />
      {zones.isPending || rates.isPending ? (
        <SectionLoader label="Loading delivery zones…" />
      ) : zones.error || rates.error ? (
        <ErrorState
          error={zones.error ?? rates.error}
          onRetry={() => void (zones.refetch(), rates.refetch())}
        />
      ) : zones.data.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No delivery zones"
          description="Create a zone, add its pincodes, then its rates."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {zones.data.map((zone) => {
            const zoneRates = (rates.data ?? []).filter((r) => r.zoneId === zone.id);
            return (
              <section
                key={zone.id}
                aria-labelledby={`zone-${zone.id}`}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`zone-${zone.id}`} className="text-base font-semibold">
                    {zone.name}
                  </h2>
                  <span className="font-mono text-xs text-muted-foreground">{zone.code}</span>
                  <Badge tone={zone.isActive ? 'success' : 'neutral'}>
                    {zone.isActive ? 'Active' : 'Off'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Priority {zone.priority}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => params.setFilter('zone', zone.id)}
                    >
                      <MapPin aria-hidden />
                      Pincodes
                    </Button>
                    {canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for zone ${zone.name}`}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditingZone(zone)}>
                            Edit zone
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setEditingRate({ rate: null, zoneId: zone.id })}
                          >
                            Add rate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setRemovingZone(zone)}
                          >
                            Delete zone…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
                {zoneRates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No rates: checkout cannot deliver here yet.
                  </p>
                ) : (
                  <ul
                    className="flex flex-col divide-y rounded-md border text-sm"
                    aria-label={`Rates in ${zone.name}`}
                  >
                    {zoneRates.map((rate) => (
                      <li key={rate.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <span className="font-medium">{rate.name}</span>
                        <span className="text-muted-foreground">
                          {SHIPPING_METHOD_LABELS[rate.method] ?? rate.method}
                        </span>
                        <span>{describeRate(rate)}</span>
                        {rate.isActive ? null : <Badge tone="neutral">Off</Badge>}
                        {canEdit ? (
                          <span className="ml-auto flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingRate({ rate, zoneId: zone.id })}
                            >
                              Edit<span className="sr-only"> {rate.name}</span>
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Delete rate ${rate.name}`}
                              onClick={() => setRemovingRate(rate)}
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={() => setEditingRate({ rate: null, zoneId: zone.id })}
                  >
                    <Plus aria-hidden />
                    Add rate<span className="sr-only"> to {zone.name}</span>
                  </Button>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
      {editingZone ? (
        <ZoneDialog
          zone={editingZone === 'new' ? null : editingZone}
          onClose={() => setEditingZone(null)}
          onSaved={() => {
            refresh();
            setEditingZone(null);
          }}
        />
      ) : null}
      {editingRate ? (
        <RateDialog
          rate={editingRate.rate}
          zoneId={editingRate.zoneId}
          onClose={() => setEditingRate(null)}
          onSaved={() => {
            refresh();
            setEditingRate(null);
          }}
        />
      ) : null}
      {removingZone ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemovingZone(null))}
          title={`Delete zone ${removingZone.name}?`}
          description="Its pincodes lose their delivery rates; checkout may no longer deliver there."
          confirmLabel="Delete zone"
          level="destructive"
          onConfirm={async () => {
            await deliveryApi.removeZone(removingZone.id);
            refresh();
            notifySuccess('Zone deleted');
          }}
        />
      ) : null}
      {removingRate ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRemovingRate(null))}
          title={`Delete rate ${removingRate.name}?`}
          description="Checkout stops offering it immediately."
          confirmLabel="Delete rate"
          level="destructive"
          onConfirm={async () => {
            await deliveryApi.removeRate(removingRate.id);
            refresh();
            notifySuccess('Rate deleted');
          }}
        />
      ) : null}
      {params.filters.zone ? (
        <Sheet open onOpenChange={(o) => (o ? undefined : params.setFilter('zone', null))}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader className="p-0">
              <SheetTitle>Pincodes · {openZone?.name ?? 'Zone'}</SheetTitle>
              <SheetDescription>
                Where this zone delivers, with cash-on-delivery and delivery times.
              </SheetDescription>
            </SheetHeader>
            <Pincodes zoneId={params.filters.zone} canEdit={canEdit} />
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}

function describeRate(rate: RateRow): string {
  const unit = CONDITIONS[rate.conditionType];
  const bound = (v: number) =>
    rate.conditionType === 'PRICE' ? formatRupees(v) : `${v} ${unit?.unit ?? ''}`;
  const range =
    rate.minValue !== null || rate.maxValue !== null
      ? ` for ${unit?.label.toLowerCase() ?? 'value'} ${rate.minValue !== null ? `from ${bound(rate.minValue)}` : ''}${rate.maxValue !== null ? ` up to ${bound(rate.maxValue)}` : ''}`
      : '';
  const extra = rate.perUnitPaise ? ` + ${formatRupees(rate.perUnitPaise)} per unit` : '';
  const free = rate.freeAbovePaise ? `, free above ${formatRupees(rate.freeAbovePaise)}` : '';
  const eta =
    rate.etaMinDays !== null || rate.etaMaxDays !== null
      ? `, ${rate.etaMinDays ?? '?'}–${rate.etaMaxDays ?? '?'} days`
      : '';
  return `${formatRupees(rate.basePaise)}${extra}${range}${free}${eta}`;
}
