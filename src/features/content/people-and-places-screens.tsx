'use client';

import { MapPin, Quote, Star } from 'lucide-react';
import dynamic from 'next/dynamic';

import { PermissionNotice } from '@/components/patterns/states';
import { Badge } from '@/components/ui/badge';
import { contentRoutes } from '@/lib/api/routes/content';
import { usePermissions } from '@/lib/permissions/use-permissions';

import { contentApi, contentKeys, type StoreRow, type TestimonialRow } from './api';
import { reorderBody } from './model';
import { OrderedContent } from './ordered-content';

const TestimonialDialog = dynamic(
  () => import('./dialogs/testimonial-dialog').then((m) => m.TestimonialDialog),
  { ssr: false },
);
const StoreDialog = dynamic(() => import('./dialogs/store-dialog').then((m) => m.StoreDialog), {
  ssr: false,
});

const e = contentRoutes;

export function TestimonialsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(e.testimonials))
    return <PermissionNotice area="testimonials" all={['cms.page.read']} />;
  return (
    <OrderedContent<TestimonialRow>
      title="Testimonials"
      description="Customer quotes shown by testimonial blocks on storefront pages."
      noun="testimonial"
      icon={Quote}
      queryKey={contentKeys.testimonials()}
      load={contentApi.testimonials}
      labelOf={(row) => row.authorName}
      render={(row) => (
        <div className="flex flex-col gap-1">
          <p className="line-clamp-2 text-sm">“{row.quote}”</p>
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{row.authorName}</span>
            {row.authorLocation ? <span>{row.authorLocation}</span> : null}
            {row.ratingBp != null ? (
              <span className="inline-flex items-center gap-0.5">
                <Star aria-hidden className="size-3" />
                {row.ratingBp / 10_000}
                <span className="sr-only"> stars</span>
              </span>
            ) : null}
            {row.isFeatured ? <Badge tone="info">Featured</Badge> : null}
            {row.isActive ? null : <Badge tone="neutral">Hidden</Badge>}
          </span>
        </div>
      )}
      Dialog={TestimonialDialog}
      can={{
        create: canCall(e.createTestimonial),
        edit: canCall(e.updateTestimonial),
        remove: canCall(e.removeTestimonial),
        reorder: canCall(e.reorderTestimonials),
      }}
      remove={contentApi.removeTestimonial}
      reorder={(ids) => contentApi.reorderTestimonials(reorderBody(ids))}
      deleteWarning="The quote disappears from every page that shows testimonials."
    />
  );
}

export function StoresScreen() {
  const { canCall } = usePermissions();
  if (!canCall(e.stores)) return <PermissionNotice area="stores" all={['cms.page.read']} />;
  return (
    <OrderedContent<StoreRow>
      title="Stores"
      description="Showrooms with their address and opening hours, used by store locator blocks."
      noun="store"
      icon={MapPin}
      queryKey={contentKeys.stores()}
      load={contentApi.stores}
      labelOf={(row) => row.name}
      render={(row) => (
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{row.name}</span>
            {row.isFlagship ? <Badge tone="info">Flagship</Badge> : null}
            {row.isActive ? null : <Badge tone="neutral">Hidden</Badge>}
          </span>
          <span className="text-xs text-muted-foreground">
            {[row.addressLine1, row.city, `${row.state} ${row.pincode}`].join(', ')}
          </span>
        </div>
      )}
      Dialog={StoreDialog}
      can={{
        create: canCall(e.createStore),
        edit: canCall(e.updateStore),
        remove: canCall(e.removeStore),
        reorder: canCall(e.reorderStores),
      }}
      remove={contentApi.removeStore}
      reorder={(ids) => contentApi.reorderStores(reorderBody(ids))}
      deleteWarning="The store disappears from the store locator."
    />
  );
}
