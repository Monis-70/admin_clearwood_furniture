'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { AdminProductDetailDto } from '@shared/types/catalogAdmin';
import type { DeviceTarget } from '@shared/enums';

import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { cachePolicy } from '@/lib/query/policies';

import { mediaApi, mediaKeys, type GalleryQuery } from '@/features/media/api';

import { isLive } from '../../model';

import { DEVICE_LABELS, ROLE_LABELS, type ScopeOption } from './gallery-model';

/**
 * The storefront's own answer (`GET /catalog/products/{slug}/gallery`): which images a customer
 * gets, in which order, for a chosen variant and device. Loaded only when opened, and only for a
 * live product; drafts are not public, so the API answers 404 for them.
 */
export function CustomerView({
  product,
  scopes,
  unsaved,
}: {
  product: AdminProductDetailDto;
  scopes: { variants: ScopeOption[]; values: ScopeOption[] };
  unsaved: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState('');
  const [device, setDevice] = useState<DeviceTarget>('ALL');
  const live = isLive(product);
  const query: GalleryQuery = {
    ...(variant ? { variantId: variant } : {}),
    ...(device !== 'ALL' ? { device } : {}),
  };
  const gallery = useQuery({
    queryKey: mediaKeys.publicGallery(product.slug, query),
    queryFn: ({ signal }) => mediaApi.publicGallery(product.slug, query, signal),
    enabled: open && live,
    ...cachePolicy.detail,
  });

  return (
    <details
      className="rounded-lg border bg-card p-3 text-sm"
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer font-medium">What customers see</summary>
      <div className="mt-3 flex flex-col gap-3">
        {!live ? (
          <p className="text-muted-foreground">
            The storefront shows this gallery once the product is published. Until then the
            storefront&apos;s gallery answer is not available.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              {scopes.variants.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="customer-view-variant">Customer chooses</Label>
                  <NativeSelect
                    id="customer-view-variant"
                    size="sm"
                    value={variant}
                    onChange={(event) => setVariant(event.target.value)}
                  >
                    <option value="">No variant yet</option>
                    {scopes.variants.map((option) => (
                      <option key={option.value} value={option.value.slice(8)}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <Label htmlFor="customer-view-device">Device</Label>
                <NativeSelect
                  id="customer-view-device"
                  size="sm"
                  value={device}
                  onChange={(event) => setDevice(event.target.value as DeviceTarget)}
                >
                  {(Object.keys(DEVICE_LABELS) as DeviceTarget[]).map((value) => (
                    <option key={value} value={value}>
                      {value === 'ALL' ? 'Any device' : DEVICE_LABELS[value].replace(' only', '')}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            {unsaved ? (
              <p className="text-warning">
                This is the saved gallery: save your changes to see them here.
              </p>
            ) : null}
            {gallery.isPending ? (
              <SectionLoader label="Asking the storefront…" />
            ) : gallery.error ? (
              <ErrorState error={gallery.error} onRetry={() => void gallery.refetch()} compact />
            ) : gallery.data.items.length === 0 ? (
              <p className="text-muted-foreground">Customers see no images for this choice.</p>
            ) : (
              <ol
                aria-label="Storefront gallery order"
                className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6"
              >
                {gallery.data.items.map((entry, index) => {
                  const thumb =
                    [...entry.sources]
                      .filter((source) => source.format === 'WEBP')
                      .sort((a, b) => a.width - b.width)
                      .find((source) => source.width >= 200)?.url ?? entry.url;
                  return (
                    <li key={entry.productMediaId} className="flex flex-col gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimiser */}
                      <img
                        src={thumb}
                        alt={entry.alt ?? ''}
                        loading="lazy"
                        className="aspect-square w-full rounded bg-muted object-cover"
                      />
                      <span className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="tabular">{index + 1}.</span>
                        <Badge tone={entry.role === 'PRIMARY' ? 'brand' : 'neutral'}>
                          {ROLE_LABELS[entry.role] ?? entry.role}
                        </Badge>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </details>
  );
}
