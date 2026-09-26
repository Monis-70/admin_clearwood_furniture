import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, errorBody, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import type { BrandRow } from '../taxonomy/api';

import { BrandsScreen } from './brands-screen';

const brand = (id: string, name: string, overrides: Partial<BrandRow> = {}): BrandRow => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\W+/g, '-'),
  logoMediaId: null,
  description: null,
  isActive: true,
  position: 0,
  version: 3,
  updatedAt: '2026-09-20T09:30:00.000Z',
  ...overrides,
});

function serve(initial: BrandRow[]) {
  const rows = [...initial];
  server.use(
    http.get(
      `${API}/admin/catalog/brands`,
      guarded(() =>
        ok(rows, 200, {
          page: 1,
          limit: 25,
          total: rows.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }),
      ),
    ),
    http.post(
      `${API}/admin/catalog/brands`,
      guarded(
        async (_a, request) => {
          const body = (await request.clone().json()) as Partial<BrandRow>;
          const row = brand('brd_new', String(body.name), { ...body, version: 1 });
          rows.push(row);
          return ok(row, 201);
        },
        { csrf: true },
      ),
    ),
    http.patch(
      `${API}/admin/catalog/brands/:id`,
      guarded(
        async (_a, request) => {
          const body = (await request.clone().json()) as Partial<BrandRow>;
          const row = rows.find((r) => request.url.endsWith(r.id))!;
          Object.assign(row, body, { version: row.version + 1 });
          return ok(row);
        },
        { csrf: true },
      ),
    ),
    http.delete(
      `${API}/admin/catalog/brands/:id`,
      guarded(
        () =>
          errorBody(409, 'BRAND_IN_USE', 'Products are still assigned to this brand', {
            products: 4,
          }),
        { csrf: true },
      ),
    ),
  );
}

function renderScreen(role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' = 'SUPER_ADMIN') {
  signInAs(account({ role }));
  navigation.reset('/catalog/brands');
  return renderWithProviders(
    <AuthGate>
      <BrandsScreen />
    </AuthGate>,
  );
}

describe('BrandsScreen', () => {
  it('lists brands with their status and a link to their products', async () => {
    serve([brand('brd_teak', 'Teakline'), brand('brd_old', 'Oldwood', { isActive: false })]);
    const { container } = renderScreen();
    const table = await screen.findByRole('table', { name: 'Brands' });
    const old = within(table).getByText('Oldwood').closest('tr')!;
    expect(within(old).getByText('Inactive')).toBeInTheDocument();
    expect(
      within(within(table).getByText('Teakline').closest('tr')!).getByRole('link', {
        name: 'View products',
      }),
    ).toHaveAttribute('href', '/catalog/products?brandId=brd_teak');
    await expectNoA11yViolations(container);
  });

  it('creates a brand; an empty slug is left for the API to derive', async () => {
    serve([brand('brd_teak', 'Teakline')]);
    renderScreen();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New brand' }));
    const dialog = await screen.findByRole('dialog', { name: 'New brand' });
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Clearwood Studio');
    await user.click(within(dialog).getByRole('button', { name: 'Create brand' }));

    const table = screen.getByRole('table', { name: 'Brands' });
    expect(await within(table).findByText('Clearwood Studio')).toBeInTheDocument();
    const body = callsTo('/api/v1/admin/catalog/brands', 'POST')[0]!.body as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({ name: 'Clearwood Studio', position: 0, isActive: true });
    expect(body).not.toHaveProperty('slug');
  });

  it('sends the version it edited, so a concurrent change is refused by the API', async () => {
    serve([brand('brd_teak', 'Teakline')]);
    renderScreen();
    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: 'Brands' });
    await user.click(within(table).getByRole('button', { name: 'Actions for Teakline' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Teakline' });
    const name = within(dialog).getByRole('textbox', { name: /^Name/ });
    await user.clear(name);
    await user.type(name, 'Teakline Living');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(table).findByText('Teakline Living')).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/catalog/brands/brd_teak', 'PATCH')[0]!.body).toMatchObject({
      name: 'Teakline Living',
      version: 3,
    });
  });

  it('explains a refused delete of a brand products still use', async () => {
    serve([brand('brd_teak', 'Teakline')]);
    renderScreen();
    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: 'Brands' });
    await user.click(within(table).getByRole('button', { name: 'Actions for Teakline' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete…' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Teakline?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete brand' }));
    expect(await within(dialog).findByText('Brand still in use')).toBeInTheDocument();
    await waitFor(() =>
      expect(callsTo('/api/v1/admin/catalog/brands/brd_teak', 'DELETE')).toHaveLength(1),
    );
  });

  it('is read-only for a role that can read products but not change them', async () => {
    serve([brand('brd_teak', 'Teakline')]);
    renderScreen('CONTENT_MANAGER');
    const table = await screen.findByRole('table', { name: 'Brands' });
    expect(within(table).getByText('Teakline')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New brand' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
  });
});
