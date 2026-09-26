'use client';

import dynamic from 'next/dynamic';

import { PermissionNotice, SectionLoader } from '@/components/patterns/states';
import { contentRoutes } from '@/lib/api/routes/content';
import { usePermissions } from '@/lib/permissions/use-permissions';

const SiteSettingsForm = dynamic(
  () => import('./site-settings-form').then((m) => m.SiteSettingsForm),
  { ssr: false, loading: () => <SectionLoader label="Loading settings…" /> },
);

export function SiteSettingsScreen() {
  const { canCall } = usePermissions();
  if (!canCall(contentRoutes.settings))
    return <PermissionNotice area="site settings" all={['system.setting.read']} />;
  return <SiteSettingsForm />;
}
