'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { formatDateTime } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { contentApi, contentKeys, type CmsPage, type PageRevision } from './api';

/** Saved versions of the page; restoring writes a new version and keeps the old ones. */
export function PageHistory({
  page,
  onRestored,
}: {
  page: CmsPage;
  onRestored(page: CmsPage): void;
}) {
  const { canCall } = usePermissions();
  const [restoring, setRestoring] = useState<PageRevision | null>(null);
  const revisions = useQuery({
    queryKey: contentKeys.revisions(page.id),
    queryFn: ({ signal }) => contentApi.revisions(page.id, signal),
    ...cachePolicy.list,
  });
  if (!canCall(endpoints.content.revisions))
    return <PermissionNotice area="page history" all={['cms.page.read']} compact />;
  if (revisions.isPending) return <SectionLoader label="Loading history…" />;
  if (revisions.error)
    return <ErrorState error={revisions.error} onRetry={() => void revisions.refetch()} compact />;
  if (revisions.data.length === 0)
    return (
      <EmptyState
        icon={History}
        title="No saved versions yet"
        description="The server saves a version as the page changes."
        compact
      />
    );
  const canRestore = canCall(endpoints.content.restoreRevision);
  return (
    <>
      <ol className="flex flex-col divide-y rounded-md border bg-card" aria-label="Page versions">
        {[...revisions.data]
          .sort((a, b) => b.version - a.version)
          .map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
              <span className="font-medium">Version {r.version}</span>
              <span className="text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              <span className="text-muted-foreground">{r.editedByName ?? 'System'}</span>
              {r.note ? <span className="text-muted-foreground">“{r.note}”</span> : null}
              {canRestore ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => setRestoring(r)}
                >
                  Restore<span className="sr-only"> version {r.version}</span>
                </Button>
              ) : null}
            </li>
          ))}
      </ol>
      {restoring ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setRestoring(null))}
          title={`Restore version ${restoring.version}?`}
          description="The page's blocks and settings go back to that version. The current state is saved as a new version first, so this can be undone."
          confirmLabel="Restore"
          onConfirm={async () => {
            onRestored(await contentApi.restoreRevision(page.id, restoring.version));
            notifySuccess(`Version ${restoring.version} restored`);
          }}
        />
      ) : null}
    </>
  );
}

function Summary({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(value)) return <span>{value.length} items</span>;
  if (typeof value === 'object') return <span>{Object.keys(value).length} fields</span>;
  return <span className="break-words">{String(value)}</span>;
}

/** What the storefront would receive for this page right now, including hidden blocks. */
export function PagePreview({ page }: { page: CmsPage }) {
  const preview = useMutation({ mutationFn: () => contentApi.previewPage(page.id) });
  const blocks = (preview.data?.blocks as Record<string, unknown>[] | undefined) ?? [];
  return (
    <section aria-label="Preview" className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Builds the page as the storefront would, with the products, images and questions each block
        resolves to. Hidden and scheduled blocks are included so they can be checked.
      </p>
      <FormAlert error={preview.error} />
      <Button className="w-fit" loading={preview.isPending} onClick={() => preview.mutate()}>
        {preview.data ? 'Build again' : 'Build preview'}
      </Button>
      {preview.data ? (
        <>
          <ol className="flex flex-col gap-2" aria-label="Previewed blocks">
            {blocks.map((b, i) => (
              <li key={String(b.id ?? i)} className="rounded-md border p-3">
                <p className="text-sm font-medium">
                  {i + 1}.{' '}
                  {String(b.type ?? 'Block')
                    .replace(/_/g, ' ')
                    .toLowerCase()}
                </p>
                <dl className="mt-1 grid gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[10rem_1fr]">
                  {Object.entries(b)
                    .filter(([k]) => !['id', 'type'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="font-mono text-muted-foreground">{k}</dt>
                        <dd>
                          <Summary value={v} />
                        </dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ol>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Full response
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(preview.data, null, 2)}
            </pre>
          </details>
        </>
      ) : null}
    </section>
  );
}

/** The title, description and tags search engines get for this page. */
export function PageSeo({ page }: { page: CmsPage }) {
  const { canCall } = usePermissions();
  const meta = useQuery({
    queryKey: contentKeys.seoPreview('PAGE', page.id),
    queryFn: ({ signal }) => contentApi.seoPreview('PAGE', page.id, signal),
    enabled: canCall(endpoints.content.seoPreview),
    ...cachePolicy.diagnostic,
  });
  if (!canCall(endpoints.content.seoPreview))
    return <PermissionNotice area="the search preview" all={['cms.page.read']} compact />;
  if (meta.isPending) return <SectionLoader label="Loading preview…" />;
  if (meta.error)
    return <ErrorState error={meta.error} onRetry={() => void meta.refetch()} compact />;
  return (
    <section aria-label="Search preview" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Edit these under Settings &amp; SEO. Saved changes show here after “Check again”.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void meta.refetch()}
          loading={meta.isFetching}
        >
          Check again
        </Button>
      </div>
      <dl
        className="grid gap-x-3 gap-y-1 rounded-md border p-4 text-sm sm:grid-cols-[10rem_1fr]"
        aria-label="Meta tags"
      >
        {Object.entries(meta.data).map(([key, v]) => (
          <div key={key} className="contents">
            <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
            <dd className="break-words">
              {v === null || v === undefined
                ? '—'
                : typeof v === 'object'
                  ? JSON.stringify(v)
                  : String(v)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
