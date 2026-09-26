'use client';

import dynamic from 'next/dynamic';

import { PageHeader } from '@/components/patterns/page-header';
import { PermissionNotice, SectionLoader } from '@/components/patterns/states';
import { collectionsRoutes } from '@/lib/api/routes/collections';
import { usePermissions } from '@/lib/permissions/use-permissions';

// The form stack (React Hook Form + Zod) loads after the page shell has painted.
const CollectionCreateForm = dynamic(
  () => import('./collection-create-form').then((m) => m.CollectionCreateForm),
  { ssr: false, loading: () => <SectionLoader label="Loading the form…" /> },
);

export function CollectionCreateScreen() {
  const { canCall } = usePermissions();
  if (!canCall(collectionsRoutes.create)) {
    return <PermissionNotice area="new collections" all={['catalog.collection.create']} />;
  }
  return (
    <>
      <PageHeader
        title="New collection"
        description="Name it and choose how products join. Products or rules come next."
      />
      <div className="max-w-3xl">
        <CollectionCreateForm />
      </div>
    </>
  );
}
