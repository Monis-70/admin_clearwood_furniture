'use client';

import { useMutation } from '@tanstack/react-query';
import { Map as MapIcon } from 'lucide-react';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/surface';
import { formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';

import { contentApi } from './api';

/** Rebuilds the cached sitemap (the storefront also refreshes it on its own). */
export function SitemapCard() {
  const rebuild = useMutation({
    mutationFn: () => contentApi.rebuildSitemap(),
    onSuccess: () => notifySuccess('Sitemap refreshed'),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapIcon aria-hidden className="size-4" />
          Sitemap
        </CardTitle>
        <CardDescription>
          Search engines read the sitemap to find pages. It refreshes by itself; refresh it now
          after publishing many pages at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FormAlert error={rebuild.error} />
        {rebuild.data ? (
          <p role="status" className="text-sm">
            Listed:{' '}
            {Object.entries(rebuild.data.sections)
              .map(([section, n]) => `${formatNumber(n)} ${section}`)
              .join(', ')}
            .
          </p>
        ) : null}
        <Button
          variant="outline"
          className="w-fit"
          loading={rebuild.isPending}
          onClick={() => rebuild.mutate()}
        >
          Refresh sitemap
        </Button>
      </CardContent>
    </Card>
  );
}
