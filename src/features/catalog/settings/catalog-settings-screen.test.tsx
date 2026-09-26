import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { AdminCatalogSettingsDto } from '@shared/types/catalogAdmin';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, guarded, ok, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { CatalogSettingsScreen } from './catalog-settings-screen';

const stored: AdminCatalogSettingsDto = {
  defaultPageSize: 24,
  maxPageSize: 96,
  showOutOfStock: true,
  newArrivalDays: 30,
  badges: { NEW_ARRIVAL: { label: 'New', color: '#1F7A4D' }, SALE: { label: 'Sale', color: null } },
};

function serve() {
  let current = structuredClone(stored);
  server.use(
    http.get(
      `${API}/admin/catalog/settings`,
      guarded(() => ok(current)),
    ),
    http.put(
      `${API}/admin/catalog/settings`,
      guarded(
        async (_a, request) => {
          const body = (await request.clone().json()) as Partial<AdminCatalogSettingsDto>;
          current = {
            ...current,
            ...body,
            badges: Object.fromEntries(
              Object.entries({ ...current.badges, ...body.badges }).filter(([, v]) => v !== null),
            ),
          };
          return ok(current);
        },
        { csrf: true },
      ),
    ),
  );
}

function renderScreen(role: 'SUPER_ADMIN' | 'CONTENT_MANAGER' = 'SUPER_ADMIN') {
  signInAs(account({ role }));
  navigation.reset('/catalog/settings');
  return renderWithProviders(
    <AuthGate>
      <CatalogSettingsScreen />
    </AuthGate>,
  );
}

describe('CatalogSettingsScreen', () => {
  it('shows the stored settings and sends only what changed', async () => {
    serve();
    const { container } = renderScreen();
    const pageSize = await screen.findByLabelText(/^Products per page/);
    expect(pageSize).toHaveValue('24');
    await expectNoA11yViolations(container);

    const user = userEvent.setup();
    await user.clear(pageSize);
    await user.type(pageSize, '36');
    await user.click(screen.getByLabelText('Sale badge'));
    await user.click(screen.getByLabelText('Featured badge'));
    const words = screen.getAllByLabelText('Words on the badge');
    await user.type(words[3]!, 'Editor’s pick');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(callsTo('/api/v1/admin/catalog/settings', 'PUT')).toHaveLength(1));
    expect(callsTo('/api/v1/admin/catalog/settings', 'PUT')[0]!.body).toEqual({
      defaultPageSize: 36,
      badges: { SALE: null, FEATURED: { label: 'Editor’s pick', color: null } },
    });
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
  });

  it('refuses a default page size above the largest one before sending', async () => {
    serve();
    renderScreen();
    const user = userEvent.setup();
    const pageSize = await screen.findByLabelText(/^Products per page/);
    await user.clear(pageSize);
    await user.type(pageSize, '120');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(/between 1 and 100/)).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/catalog/settings', 'PUT')).toHaveLength(0);
  });

  it('is read-only for a role that can read the catalog but not change it', async () => {
    serve();
    renderScreen('CONTENT_MANAGER');
    expect(await screen.findByText('View only')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Products per page/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument();
  });
});
