'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

import { PageHeader } from '@/components/patterns/page-header';
import { ErrorState, PermissionNotice, SectionLoader } from '@/components/patterns/states';
import { catalogRoutes } from '@/lib/api/routes/catalog';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogApi, catalogKeys } from '../api';

const CatalogSettingsForm = dynamic(
  () => import('./catalog-settings-form').then((m) => m.CatalogSettingsForm),
  { ssr: false, loading: () => <SectionLoader label="Loading catalog settings…" /> },
);

export function CatalogSettingsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(catalogRoutes.settings)) {
    return <PermissionNotice area="catalog settings" all={['catalog.product.read']} />;
  }
  return <CatalogSettings />;
}

function CatalogSettings() {
  const { canCall } = usePermissions();
  const settings = useQuery({
    queryKey: catalogKeys.settings(),
    queryFn: ({ signal }) => catalogApi.settings(signal),
    ...cachePolicy.detail,
  });
  const canEdit = canCall(catalogRoutes.updateSettings);

  return (
    <>
      <PageHeader
        title="Catalog settings"
        description="How the storefront lists products: page sizes, out-of-stock products, what counts as new, and the words on product badges."
      />
      {settings.isPending ? (
        <SectionLoader label="Loading catalog settings…" />
      ) : settings.error ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <CatalogSettingsForm settings={settings.data} canEdit={canEdit} />
      )}
    </>
  );
}
