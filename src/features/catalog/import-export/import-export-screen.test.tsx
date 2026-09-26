import { File as NodeFile } from 'node:buffer';

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportJobDto } from '@shared/types/catalogAdmin';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { renderWithProviders } from '@/tests/render';

import { ImportExportScreen } from './import-export-screen';

const job = (overrides: Partial<ImportJobDto> = {}): ImportJobDto => ({
  id: 'job_1',
  entity: 'PRODUCT',
  status: 'VALIDATED',
  fileName: 'products.csv',
  dryRun: true,
  totalRows: 2,
  processedRows: 2,
  successRows: 2,
  errorRows: 0,
  errors: [],
  summary: { created: 1, updated: 1 },
  startedAt: '2026-09-25T09:30:00.000Z',
  finishedAt: '2026-09-25T09:30:01.000Z',
  createdAt: '2026-09-25T09:30:00.000Z',
  ...overrides,
});

// jsdom's FormData stringifies a Node File, and Node's fetch cannot read a jsdom Blob: multipart
// tests use Node's FormData and File together, the consistent pair a browser has.
const NodeFormData = (await new Response(new URLSearchParams('a=1')).formData())
  .constructor as typeof FormData;
const csv = () =>
  new NodeFile(['sku,name\nCW-1,Chair\nCW-2,Table\n'], 'products.csv', {
    type: 'text/csv',
  }) as unknown as File;

let commitKeys: (string | null)[] = [];
let uploaded: { dryRun: unknown; file: unknown }[] = [];

/** A job store like the API's: upload creates the checked job, a successful apply replaces it. */
function serveImports(checked: ImportJobDto, commit: () => ImportJobDto | Response) {
  commitKeys = [];
  uploaded = [];
  let stored = checked;
  server.use(
    http.get(
      `${API}/admin/catalog/import/jobs`,
      guarded(() => ok([], 200, { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false })),
    ),
    http.get(
      `${API}/admin/catalog/import/jobs/:id`,
      guarded(() => ok(stored)),
    ),
    http.post(
      `${API}/admin/catalog/import/:entity`,
      guarded(
        async (_a, request) => {
          const form = await request.formData();
          const file = form.get('files');
          uploaded.push({
            dryRun: form.get('dryRun'),
            file: typeof file === 'string' ? file : file?.name,
          });
          return ok(checked, 201);
        },
        { csrf: true },
      ),
    ),
    http.post(
      `${API}/admin/catalog/import/jobs/:id/commit`,
      guarded(
        (_a, request) => {
          commitKeys.push(request.headers.get('idempotency-key'));
          const result = commit();
          if (result instanceof Response) return result;
          stored = result;
          return ok(result);
        },
        { csrf: true },
      ),
    ),
  );
}

async function checkFile() {
  navigation.reset('/catalog/import-export');
  renderWithProviders(
    <AuthGate>
      <ImportExportScreen />
    </AuthGate>,
  );
  const user = userEvent.setup();
  const panel = await screen.findByRole('region', { name: 'Import' });
  await user.upload(within(panel).getByLabelText('CSV file'), csv());
  await user.click(within(panel).getByRole('button', { name: 'Check file' }));
  const check = await screen.findByRole('region', { name: 'Import check' });
  return { user, check };
}

describe('ImportExportScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('FormData', NodeFormData);
    vi.stubGlobal('File', NodeFile);
    signInAs(account({ role: 'CATALOG_MANAGER' }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('checks a file first, then applies the same file once with an idempotency key', async () => {
    serveImports(job(), () => job({ status: 'COMPLETED', dryRun: false }));
    const { user, check } = await checkFile();

    expect(callsTo('/api/v1/admin/catalog/import/PRODUCT', 'POST')).toHaveLength(1);
    expect(uploaded).toEqual([{ dryRun: 'true', file: 'products.csv' }]);
    expect(await within(check).findByText('Checked: ready to apply')).toBeInTheDocument();
    expect(within(check).getByText('created: 1 · updated: 1')).toBeInTheDocument();
    await user.click(within(check).getByRole('button', { name: 'Apply 2 rows' }));

    expect(
      await within(check).findByRole('link', { name: 'See it in the audit log' }),
    ).toBeVisible();
    expect(within(check).queryByRole('button', { name: /^Apply/ })).not.toBeInTheDocument();
    expect(commitKeys).toHaveLength(1);
    expect(commitKeys[0]).toMatch(/^.{8,200}$/);
  });

  it('shows row errors and offers no apply when the check fails', async () => {
    serveImports(
      job({
        status: 'FAILED_VALIDATION',
        successRows: 1,
        errorRows: 1,
        errors: [{ row: 3, column: 'sku', message: 'SKU CW-2 already exists' }],
      }),
      () => job(),
    );
    const { check } = await checkFile();

    const table = await within(check).findByRole('table', { name: 'Rows with errors' });
    expect(within(table).getByText('SKU CW-2 already exists')).toBeInTheDocument();
    expect(within(check).getByText('Fix the file and check it again')).toBeInTheDocument();
    expect(within(check).queryByRole('button', { name: /^Apply/ })).not.toBeInTheDocument();
  });

  it("explains the API's refusal when the file changed after the check", async () => {
    serveImports(job(), () =>
      errorBody(
        409,
        'IMPORT_FILE_MISMATCH',
        'This is not the file that was validated. Attach the same file, or validate the new one first.',
      ),
    );
    const { user, check } = await checkFile();
    await user.click(await within(check).findByRole('button', { name: 'Apply 2 rows' }));

    const alert = await within(check).findByRole('alert');
    expect(alert).toHaveTextContent('This is not the file that was validated');
    await waitFor(() => expect(commitKeys).toHaveLength(1));
  });

  it('hides import and export from an admin without catalogue import rights', async () => {
    signInAs(account({ role: 'CONTENT_MANAGER' }));
    navigation.reset('/catalog/import-export');
    renderWithProviders(
      <AuthGate>
        <ImportExportScreen />
      </AuthGate>,
    );
    expect(
      await screen.findByRole('heading', { name: /You don't have access to catalog import/ }),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/catalog/import/jobs')).toHaveLength(0);
  });
});
