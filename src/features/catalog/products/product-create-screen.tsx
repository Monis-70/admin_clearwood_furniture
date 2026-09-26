'use client';

import { ChevronLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { PageHeader } from '@/components/patterns/page-header';
import { PermissionNotice, SectionLoader } from '@/components/patterns/states';
import { productsRoutes } from '@/lib/api/routes/products';
import { usePermissions } from '@/lib/permissions/use-permissions';

// The form stack (React Hook Form + Zod) loads after the page shell has painted.
const ProductCreateForm = dynamic(
  () => import('./product-create-form').then((m) => m.ProductCreateForm),
  { ssr: false, loading: () => <SectionLoader label="Loading the form…" /> },
);

/** A new product starts as a draft with the essentials; everything else is added in the editor. */
export function ProductCreateScreen() {
  const { canCall } = usePermissions();
  if (!canCall(productsRoutes.create)) {
    return <PermissionNotice area="creating products" all={['catalog.product.create']} />;
  }
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href="/catalog/products"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Products
      </Link>
      <PageHeader
        title="New product"
        description="Start with the essentials. The product is saved as a draft that customers cannot see."
      />
      <ProductCreateForm />
    </div>
  );
}
