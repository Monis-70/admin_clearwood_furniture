import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { renderWithProviders } from '@/tests/render';

import { MaintenancePanel } from '../system/maintenance-panel';

import { SearchIndexScreen, SearchInsightsScreen, SynonymsScreen } from './search-screens';

const meta = (n: number) => ({
  page: 1,
  limit: 25,
  total: n,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
});

function render(
  ui: React.ReactElement,
  role: 'SUPER_ADMIN' | 'CATALOG_MANAGER' | 'CONTENT_MANAGER' | 'ORDER_MANAGER',
  path = '/',
) {
  signInAs(account({ role }));
  navigation.reset(path);
  return renderWithProviders(<AuthGate>{ui}</AuthGate>);
}

const synonym = {
  term: 'couch',
  synonyms: ['sofa', 'settee'],
  isTwoWay: true,
  isActive: true,
  note: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SearchInsightsScreen', () => {
  it('shows totals and turns a search with no result into a synonym', async () => {
    server.use(
      http.get(
        `${API}/admin/search/analytics`,
        guarded(() =>
          ok({
            totals: { searches: 1200, clicks: 300, zeroResults: 40, clickThroughBp: 2500 },
            topQueries: [{ query: 'sofa', count: 500, avgResults: 12.4, clickThroughBp: 3100 }],
            zeroResultQueries: [
              { query: 'divan', count: 9, lastSeenAt: '2026-01-02T00:00:00.000Z' },
            ],
            trend: [{ date: '2026-01-02', searches: 40, zeroResults: 2 }],
          }),
        ),
      ),
      http.post(
        `${API}/admin/search/synonyms`,
        guarded(() => ok({ ...synonym, term: 'divan', synonyms: ['sofa bed'] }, 201), {
          csrf: true,
        }),
      ),
    );
    const user = userEvent.setup();
    render(<SearchInsightsScreen />, 'CATALOG_MANAGER', '/search/insights');

    expect(await screen.findByText('25%')).toBeInTheDocument();
    const top = screen.getByRole('table', { name: 'Top searches' });
    expect(within(top).getByText('sofa')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add synonym for divan' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/When customers search for/)).toHaveValue('divan');
    await user.type(within(dialog).getByLabelText(/Also search for/), 'sofa bed, sofa bed');
    await user.click(within(dialog).getByRole('button', { name: 'Create synonyms' }));

    await waitFor(() => expect(callsTo('/api/v1/admin/search/synonyms', 'POST')).toHaveLength(1));
    expect(callsTo('/api/v1/admin/search/synonyms', 'POST')[0]!.body).toEqual({
      term: 'divan',
      synonyms: ['sofa bed'],
      isTwoWay: true,
      isActive: true,
      note: null,
    });
  });

  it('explains the missing permission instead of calling the API', async () => {
    render(<SearchInsightsScreen />, 'CONTENT_MANAGER', '/search/insights');
    expect(await screen.findByText("You don't have access to search insights")).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/search/analytics', 'GET')).toHaveLength(0);
  });
});

describe('SynonymsScreen', () => {
  it('edits and deletes a synonym set with confirmation', async () => {
    server.use(
      http.get(
        `${API}/admin/search/synonyms`,
        guarded(() => ok([synonym], 200, meta(1))),
      ),
      http.patch(
        `${API}/admin/search/synonyms/couch`,
        guarded(() => ok({ ...synonym, isTwoWay: false }), { csrf: true }),
      ),
      http.delete(
        `${API}/admin/search/synonyms/couch`,
        guarded(() => ok(null), { csrf: true }),
      ),
    );
    const user = userEvent.setup();
    render(<SynonymsScreen />, 'SUPER_ADMIN', '/search/synonyms');

    const table = await screen.findByRole('table', { name: 'Synonyms' });
    expect(within(table).getByText('sofa, settee')).toBeInTheDocument();

    await user.click(within(table).getByRole('button', { name: 'Actions for couch' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText(/Works both ways/));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(callsTo('/api/v1/admin/search/synonyms/couch', 'PATCH')).toHaveLength(1),
    );
    expect(callsTo('/api/v1/admin/search/synonyms/couch', 'PATCH')[0]!.body).toMatchObject({
      synonyms: ['sofa', 'settee'],
      isTwoWay: false,
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(within(table).getByRole('button', { name: 'Actions for couch' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete…' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(callsTo('/api/v1/admin/search/synonyms/couch', 'DELETE')).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Delete synonyms' }));
    await waitFor(() =>
      expect(callsTo('/api/v1/admin/search/synonyms/couch', 'DELETE')).toHaveLength(1),
    );
  });
});

describe('SearchIndexScreen', () => {
  it('rebuilds one entity type only after confirmation and lists the job', async () => {
    const job = {
      id: 'job_1',
      status: 'COMPLETED',
      entityType: 'PRODUCT',
      isFull: true,
      total: 40,
      processed: 40,
      failed: 0,
      startedAt: '2026-01-02T10:00:00.000Z',
      finishedAt: '2026-01-02T10:01:00.000Z',
      errors: [],
    };
    let jobs: (typeof job)[] = [];
    let asked: URLSearchParams | null = null;
    server.use(
      http.get(
        `${API}/admin/search/jobs`,
        guarded(() => ok(jobs)),
      ),
      http.post(
        `${API}/admin/search/reindex`,
        guarded(
          (_account, request) => {
            asked = new URL(request.url).searchParams;
            jobs = [job];
            return ok(job);
          },
          { csrf: true },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<SearchIndexScreen />, 'CATALOG_MANAGER', '/search/index');

    expect(await screen.findByText('No rebuilds yet')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('What to rebuild'), 'PRODUCT');
    await user.click(screen.getByLabelText(/Clear first/));
    await user.click(screen.getByRole('button', { name: 'Rebuild' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText('Rebuild Products?')).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/search/reindex', 'POST')).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Rebuild now' }));

    await waitFor(() => expect(callsTo('/api/v1/admin/search/reindex', 'POST')).toHaveLength(1));
    const url = { searchParams: asked! as URLSearchParams };
    expect(url.searchParams.get('entityType')).toBe('PRODUCT');
    expect(url.searchParams.get('full')).toBe('true');
    const list = await screen.findByRole('list', { name: 'Recent rebuilds' });
    expect(within(list).getByText('40 of 40')).toBeInTheDocument();
  });
});

describe('MaintenancePanel', () => {
  it('refreshes automatic collections after confirmation and runs a read-only storage check', async () => {
    server.use(
      http.post(
        `${API}/admin/collections/evaluate-all`,
        guarded(
          () =>
            ok([
              {
                collectionId: 'c1',
                slug: 'sale',
                matched: 5,
                added: 2,
                removed: 1,
                kept: 3,
                evaluatedAt: '',
              },
            ]),
          { csrf: true },
        ),
      ),
      http.get(
        `${API}/admin/media/gc`,
        guarded(() =>
          ok({
            dryRun: true,
            orphanedFiles: [],
            missingFiles: [],
            scannedFiles: 10,
            scannedRows: 10,
          }),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<MaintenancePanel />, 'SUPER_ADMIN', '/system/status');

    await user.click(
      await screen.findByRole('button', { name: 'Refresh all automatic collections' }),
    );
    const confirm = await screen.findByRole('alertdialog');
    expect(callsTo('/api/v1/admin/collections/evaluate-all', 'POST')).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: /Refresh/ }));
    expect(
      await screen.findByText(/1 collections refreshed: 2 products added/),
    ).toBeInTheDocument();

    expect(callsTo('/api/v1/admin/media/gc', 'GET')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Run storage check' }));
    expect(await screen.findByText('Everything matches.')).toBeInTheDocument();
  });

  it('is hidden from roles that can do neither', async () => {
    render(<MaintenancePanel />, 'ORDER_MANAGER');
    await waitFor(() => expect(screen.queryByText(/Checking your session/)).toBeNull());
    expect(screen.queryByText('Maintenance')).toBeNull();
  });
});
