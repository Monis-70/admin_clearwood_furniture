'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, History } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import type { ImportEntity, Permission } from '@shared/enums';
import type { ImportJobDto } from '@shared/types/catalogAdmin';

import { DataTable, type DataTableColumn } from '@/components/patterns/data-table/data-table';
import { useListParams } from '@/components/patterns/data-table/use-list-params';
import { FormAlert } from '@/components/patterns/form/form-alert';
import { PageHeader } from '@/components/patterns/page-header';
import {
  EmptyState,
  ErrorState,
  PermissionNotice,
  SectionLoader,
} from '@/components/patterns/states';
import { StatusBadge, type StatusRegistry } from '@/components/patterns/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { importExportRoutes } from '@/lib/api/routes/importExport';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { formatCount, formatDateTime, formatNumber } from '@/lib/format/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cachePolicy } from '@/lib/query/policies';

import { catalogKeys } from '../api';

import { importApi, importKeys } from './api';

export const ENTITY_LABELS: Record<ImportEntity, string> = {
  PRODUCT: 'Products',
  VARIANT: 'Variants',
  CATEGORY: 'Categories',
  ATTRIBUTE_VALUE: 'Attribute values',
  PRICE_ADJUSTMENT: 'Price rules',
  INVENTORY: 'Stock levels',
};

/**
 * What the API's import route checks for each entity (import.service IMPORT_PERMISSIONS). Used
 * only to hide choices the admin cannot use; the server still decides.
 */
export const IMPORT_PERMISSIONS: Record<ImportEntity, Permission[]> = {
  PRODUCT: ['catalog.product.import'],
  VARIANT: ['catalog.product.import', 'catalog.variant.update'],
  CATEGORY: ['catalog.product.import', 'catalog.category.update'],
  ATTRIBUTE_VALUE: ['catalog.product.import', 'catalog.attribute.update'],
  PRICE_ADJUSTMENT: ['pricing.adjustment.create', 'pricing.adjustment.update'],
  INVENTORY: ['catalog.inventory.update'],
};

export const IMPORT_STATUS: StatusRegistry<string> = {
  PENDING: { label: 'Waiting', tone: 'neutral' },
  VALIDATING: { label: 'Checking', tone: 'info' },
  VALIDATED: { label: 'Checked: ready to apply', tone: 'success' },
  FAILED_VALIDATION: { label: 'Has errors', tone: 'danger' },
  IMPORTING: { label: 'Applying', tone: 'info' },
  COMPLETED: { label: 'Applied', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

const ENTITIES = Object.keys(ENTITY_LABELS) as ImportEntity[];

async function save(download: Promise<{ blob: Blob; fileName: string | null }>, fallback: string) {
  const { blob, fileName } = await download;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName ?? fallback;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function ImportExportScreen() {
  const { canCall, canAll } = usePermissions();
  const params = useListParams<'job'>({ filters: ['job'] });
  const importable = ENTITIES.filter((entity) => canAll(IMPORT_PERMISSIONS[entity]));
  const canExport = canCall(importExportRoutes.exportCsv);
  const canJobs = canCall(importExportRoutes.jobs);
  if (!canExport && importable.length === 0 && !canJobs) {
    return <PermissionNotice area="catalog import and export" all={['catalog.product.import']} />;
  }
  return (
    <>
      <PageHeader
        title="Import & export"
        description="Download the catalogue as CSV, or bring changes in from a spreadsheet: every file is checked first and only applied when it has no errors."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DownloadPanel canExport={canExport} canTemplate={canCall(importExportRoutes.template)} />
        {importable.length > 0 ? (
          <ImportPanel entities={importable} onJob={(id) => params.setFilter('job', id)} />
        ) : null}
      </div>
      {params.filters.job && canCall(importExportRoutes.job) ? (
        <JobDetail
          id={params.filters.job}
          entitiesAllowed={importable}
          onClose={() => params.setFilter('job', null)}
        />
      ) : null}
      {canJobs ? <JobsList onOpen={(id) => params.setFilter('job', id)} /> : null}
    </>
  );
}

function DownloadPanel({ canExport, canTemplate }: { canExport: boolean; canTemplate: boolean }) {
  const [entity, setEntity] = useState<ImportEntity>('PRODUCT');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const run = useMutation({
    mutationFn: (kind: 'template' | 'export') =>
      kind === 'template'
        ? save(importApi.template(entity), `clearwood-${entity.toLowerCase()}-template.csv`)
        : save(
            importApi.exportCsv(entity, includeDeleted ? { includeDeleted: 'true' } : {}),
            `clearwood-${entity.toLowerCase()}.csv`,
          ),
    onError: (error) => notifyError(error, 'Download failed'),
  });
  if (!canExport && !canTemplate) return null;
  return (
    <section
      aria-labelledby="download-heading"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <h2 id="download-heading" className="flex items-center gap-2 font-semibold">
        <Download aria-hidden className="size-4" />
        Download
      </h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="download-entity">What</Label>
        <NativeSelect
          id="download-entity"
          value={entity}
          onChange={(event) => setEntity(event.target.value as ImportEntity)}
        >
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {ENTITY_LABELS[e]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {canExport ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={includeDeleted}
            onChange={(event) => setIncludeDeleted(event.target.checked)}
          />
          Include deleted records in the export
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canExport ? (
          <Button
            loading={run.isPending && run.variables === 'export'}
            onClick={() => run.mutate('export')}
          >
            Export CSV
          </Button>
        ) : null}
        {canTemplate ? (
          <Button
            variant="outline"
            loading={run.isPending && run.variables === 'template'}
            onClick={() => run.mutate('template')}
          >
            Empty template
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        An export is also the easiest template: edit it and import it back.
      </p>
    </section>
  );
}

function ImportPanel({ entities, onJob }: { entities: ImportEntity[]; onJob(id: string): void }) {
  const queryClient = useQueryClient();
  const [entity, setEntity] = useState<ImportEntity>(entities[0]!);
  const [file, setFile] = useState<File | null>(null);
  const check = useMutation({
    mutationFn: () => importApi.upload(entity, file!),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: importKeys.all });
      queryClient.setQueryData(importKeys.job(job.id), job);
      pendingFiles.set(job.id, file!);
      onJob(job.id);
    },
  });
  return (
    <section
      aria-labelledby="import-heading"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <h2 id="import-heading" className="flex items-center gap-2 font-semibold">
        <FileUp aria-hidden className="size-4" />
        Import
      </h2>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (file) check.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-entity">What the file contains</Label>
          <NativeSelect
            id="import-entity"
            value={entity}
            onChange={(event) => setEntity(event.target.value as ImportEntity)}
          >
            {entities.map((e) => (
              <option key={e} value={e}>
                {ENTITY_LABELS[e]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-file">CSV file</Label>
          <Input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <FormAlert error={check.error} />
        <Button type="submit" className="w-fit" disabled={!file} loading={check.isPending}>
          Check file
        </Button>
        <p className="text-xs text-muted-foreground">
          Checking changes nothing. You review the result, then apply it.
        </p>
      </form>
    </section>
  );
}

/** Files checked in this tab, so "Apply" can re-send the exact same bytes without asking again. */
const pendingFiles = new Map<string, File>();

/** The API answers upload and apply when they finish; these states are only seen mid-run. */
const IN_PROGRESS = new Set(['PENDING', 'VALIDATING', 'IMPORTING']);

function JobDetail({
  id,
  entitiesAllowed,
  onClose,
}: {
  id: string;
  entitiesAllowed: ImportEntity[];
  onClose(): void;
}) {
  const queryClient = useQueryClient();
  const keyFor = useIdempotencyKey();
  const [file, setFile] = useState<File | null>(pendingFiles.get(id) ?? null);
  const job = useQuery({
    queryKey: importKeys.job(id),
    queryFn: ({ signal }) => importApi.job(id, signal),
    ...cachePolicy.detail,
  });
  const commit = useMutation({
    mutationFn: () =>
      importApi.commit(
        id,
        file!,
        keyFor({ id, name: file!.name, size: file!.size, modified: file!.lastModified }),
      ),
    onSuccess: (result) => {
      pendingFiles.delete(id);
      queryClient.setQueryData(importKeys.job(id), result);
      void queryClient.invalidateQueries({ queryKey: importKeys.all });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      notifySuccess('Import applied', `${formatCount(result.successRows, 'row')} written.`);
    },
  });

  return (
    <section
      aria-labelledby="job-heading"
      className="mt-6 flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="job-heading" className="font-semibold">
          Import check
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {job.isPending ? (
        <SectionLoader label="Loading import…" />
      ) : job.error ? (
        <ErrorState error={job.error} onRetry={() => void job.refetch()} compact />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{job.data.fileName}</span>·{' '}
            {ENTITY_LABELS[job.data.entity]} ·
            <StatusBadge status={job.data.status} registry={IMPORT_STATUS} />
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            {[
              ['Rows', job.data.totalRows],
              ['Fine', job.data.successRows],
              ['With errors', job.data.errorRows],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border p-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="tabular text-lg font-semibold">{formatNumber(value as number)}</dd>
              </div>
            ))}
          </dl>
          {job.data.summary ? (
            <p className="text-sm text-muted-foreground">
              {Object.entries(job.data.summary)
                .map(([key, value]) => `${key}: ${formatNumber(value)}`)
                .join(' · ')}
            </p>
          ) : null}
          {job.data.errors.length > 0 ? (
            <div
              tabIndex={0}
              role="region"
              aria-label="Rows with errors"
              className="max-h-72 overflow-auto rounded-md border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <table className="w-full text-sm">
                <caption className="sr-only">Rows with errors</caption>
                <thead className="bg-muted text-left">
                  <tr>
                    <th scope="col" className="px-3 py-2">
                      Row
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Column
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Problem
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {job.data.errors.map((error, index) => (
                    <tr key={`${error.row}-${index}`}>
                      <td className="tabular px-3 py-1.5">{error.row}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{error.column ?? '—'}</td>
                      <td className="px-3 py-1.5">{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {job.data.status === 'FAILED_VALIDATION' ? (
            <Alert tone="warning" title="Fix the file and check it again">
              Nothing was changed. Correct the rows above in your spreadsheet and upload it again.
            </Alert>
          ) : null}
          {IN_PROGRESS.has(job.data.status) ? (
            <Alert tone="info" title="Still running">
              <div className="flex flex-wrap items-center gap-3">
                <span>This import had not finished when it was loaded.</span>
                <Button
                  size="sm"
                  variant="outline"
                  loading={job.isFetching}
                  onClick={() => void job.refetch()}
                >
                  Refresh
                </Button>
              </div>
            </Alert>
          ) : null}
          {job.data.status === 'VALIDATED' &&
          job.data.dryRun &&
          entitiesAllowed.includes(job.data.entity) ? (
            <div className="flex flex-col gap-2 border-t pt-3">
              {!pendingFiles.has(id) ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="commit-file">Attach the same file again to apply it</Label>
                  <Input
                    id="commit-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The server compares it with the file it checked; any change needs a new check.
                  </p>
                </div>
              ) : null}
              <FormAlert error={commit.error} />
              <Button
                className="w-fit"
                disabled={!file}
                loading={commit.isPending}
                onClick={() => commit.mutate()}
              >
                Apply {formatCount(job.data.totalRows, 'row')}
              </Button>
            </div>
          ) : null}
          {job.data.status === 'COMPLETED' ? (
            <Alert tone="success" title="Applied">
              Finished {job.data.finishedAt ? formatDateTime(job.data.finishedAt) : ''}.{' '}
              <Link href="/system/audit-log" className="underline">
                See it in the audit log
              </Link>
              .
            </Alert>
          ) : null}
        </>
      )}
    </section>
  );
}

function JobsList({ onOpen }: { onOpen(id: string): void }) {
  const [page, setPage] = useState(1);
  const jobs = useQuery({
    queryKey: importKeys.jobs(page),
    queryFn: ({ signal }) => importApi.jobs(page, signal),
    ...cachePolicy.list,
  });
  const columns: DataTableColumn<ImportJobDto>[] = [
    {
      id: 'file',
      meta: { label: 'File', pinned: true, mobile: 'title' },
      header: 'File',
      cell: ({ row }) => (
        <button
          type="button"
          className="text-left font-medium hover:underline"
          onClick={() => onOpen(row.original.id)}
        >
          {row.original.fileName}
        </button>
      ),
    },
    {
      id: 'entity',
      meta: { label: 'Contains', mobile: 'detail' },
      header: 'Contains',
      cell: ({ row }) => ENTITY_LABELS[row.original.entity],
    },
    {
      id: 'status',
      meta: { label: 'Status', mobile: 'detail' },
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} registry={IMPORT_STATUS} />,
    },
    {
      id: 'rows',
      meta: { label: 'Rows (errors)', align: 'right', mobile: 'detail' },
      header: 'Rows (errors)',
      cell: ({ row }) => (
        <span className="tabular">
          {formatNumber(row.original.totalRows)} ({formatNumber(row.original.errorRows)})
        </span>
      ),
    },
    {
      id: 'created',
      meta: { label: 'When', mobile: 'detail' },
      header: 'When',
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
  ];
  return (
    <section aria-labelledby="jobs-heading" className="mt-6 flex flex-col gap-3">
      <h2 id="jobs-heading" className="flex items-center gap-2 font-semibold">
        <History aria-hidden className="size-4" />
        Recent imports
      </h2>
      <DataTable
        label="Recent imports"
        columns={columns}
        query={jobs}
        getRowId={(row) => row.id}
        onPageChange={setPage}
        onLimitChange={() => undefined}
        preferenceKey="import-jobs"
        empty={
          <EmptyState
            title="No imports yet"
            description="Checked and applied files appear here."
            compact
          />
        }
      />
    </section>
  );
}
