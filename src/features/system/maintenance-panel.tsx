'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Boxes, HardDrive } from 'lucide-react';
import { useState } from 'react';

import { FormAlert } from '@/components/patterns/form/form-alert';
import { LazyConfirmDialog } from '@/components/patterns/lazy-confirm-dialog';
import { ErrorState, SectionLoader } from '@/components/patterns/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/surface';
import { maintenanceRoutes } from '@/lib/api/routes/maintenance';
import { formatNumber } from '@/lib/format/datetime';
import { notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { maintenanceApi } from '@/features/search/api';

/** Occasional upkeep actions; each is offered only to roles the API allows. */
export function MaintenancePanel() {
  const { canCall } = usePermissions();
  const canEvaluate = canCall(maintenanceRoutes.evaluateAllCollections);
  const canCheck = canCall(maintenanceRoutes.storageReport);
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);
  const evaluate = useMutation({ mutationFn: () => maintenanceApi.evaluateAllCollections() });
  const report = useQuery({
    queryKey: ['maintenance', 'storage'],
    queryFn: ({ signal }) => maintenanceApi.storageReport(signal),
    enabled: checking,
    ...cachePolicy.diagnostic,
  });
  if (!canEvaluate && !canCheck) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Maintenance</CardTitle>
        <CardDescription>
          Occasional checks and refreshes. Nothing here runs on its own.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {canEvaluate ? (
          <section aria-labelledby="evaluate-all" className="flex flex-col gap-2">
            <h3 id="evaluate-all" className="flex items-center gap-2 font-medium">
              <Boxes aria-hidden className="size-4" />
              Automatic collections
            </h3>
            <p className="text-sm text-muted-foreground">
              Re-applies every automatic collection&apos;s rules now, instead of waiting for the
              next scheduled refresh.
            </p>
            <FormAlert error={evaluate.error} />
            {evaluate.data ? (
              <p className="text-sm" role="status">
                {evaluate.data.length} collections refreshed:{' '}
                {formatNumber(evaluate.data.reduce((n, c) => n + c.added, 0))} products added,{' '}
                {formatNumber(evaluate.data.reduce((n, c) => n + c.removed, 0))} removed.
              </p>
            ) : null}
            <Button
              variant="outline"
              className="w-fit"
              loading={evaluate.isPending}
              onClick={() => setConfirming(true)}
            >
              Refresh all automatic collections
            </Button>
          </section>
        ) : null}
        {canCheck ? (
          <section aria-labelledby="storage-check" className="flex flex-col gap-2">
            <h3 id="storage-check" className="flex items-center gap-2 font-medium">
              <HardDrive aria-hidden className="size-4" />
              Storage check
            </h3>
            <p className="text-sm text-muted-foreground">
              Compares stored files with the media library. Read-only: nothing is deleted.
            </p>
            {checking ? (
              report.isPending ? (
                <SectionLoader label="Checking storage…" />
              ) : report.error ? (
                <ErrorState error={report.error} onRetry={() => void report.refetch()} compact />
              ) : (
                <div className="flex flex-col gap-2 text-sm" role="status">
                  <p>
                    Checked {formatNumber(report.data.scannedFiles)} files and{' '}
                    {formatNumber(report.data.scannedRows)} library entries.
                  </p>
                  <p>
                    {report.data.orphanedFiles.length === 0 && report.data.missingFiles.length === 0
                      ? 'Everything matches.'
                      : `${report.data.orphanedFiles.length} files are not in the library; ${report.data.missingFiles.length} library entries have no file.`}
                  </p>
                  {report.data.missingFiles.length > 0 ? (
                    <details>
                      <summary className="cursor-pointer">Library entries without a file</summary>
                      <ul className="list-disc pl-5 font-mono text-xs">
                        {report.data.missingFiles.slice(0, 50).map((m) => (
                          <li key={m.mediaId}>{m.path}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              )
            ) : null}
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => (checking ? void report.refetch() : setChecking(true))}
            >
              {checking ? 'Check again' : 'Run storage check'}
            </Button>
          </section>
        ) : null}
      </CardContent>
      {confirming ? (
        <LazyConfirmDialog
          open
          onOpenChange={(o) => (o ? undefined : setConfirming(false))}
          title="Refresh every automatic collection now?"
          description="Products join or leave collections according to their rules; storefront lists change at once."
          confirmLabel="Refresh collections"
          level="standard"
          onConfirm={async () => {
            const result = await evaluate.mutateAsync();
            notifySuccess(`${result.length} collections refreshed`);
          }}
        />
      ) : null}
    </Card>
  );
}
