import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { API, account, callsTo, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { HomeScreen } from './home-screen';

function renderHome() {
  return renderWithProviders(
    <AuthGate>
      <HomeScreen />
    </AuthGate>,
  );
}

describe('HomeScreen', () => {
  it('greets the admin and summarises their real access', async () => {
    signInAs(account({ role: 'CONTENT_MANAGER', name: 'Meera Nair' }));
    const { container } = renderHome();
    expect(await screen.findByRole('heading', { level: 1, name: /Meera/ })).toBeInTheDocument();
    const access = screen.getByRole('heading', { name: 'Your access' }).closest('section')!;
    expect(within(access).getByText('Content Manager')).toBeInTheDocument();
    expect(within(access).getByText('Content')).toBeInTheDocument();
    expect(within(access).queryByText('Payments')).not.toBeInTheDocument();
    await screen.findByText('Meera Iyer');
    await expectNoA11yViolations(container);
  });

  it('asks only for the work queues the role can open, once each', async () => {
    signInAs(account({ role: 'CONTENT_MANAGER' }));
    renderHome();
    await screen.findByRole('heading', { name: 'New enquiries' });
    await waitFor(() => expect(callsTo('/api/v1/admin/catalog/products')).toHaveLength(3));
    expect(callsTo('/api/v1/admin/enquiries')).toHaveLength(1);
    // Content Manager holds neither inventory nor the audit log.
    expect(screen.queryByRole('heading', { name: 'Low stock' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Recent admin activity' }),
    ).not.toBeInTheDocument();
    expect(callsTo('/api/v1/admin/catalog/inventory/low-stock')).toHaveLength(0);
    expect(callsTo('/api/v1/admin/audit-logs')).toHaveLength(0);
  });

  it('shows real counts from the API and links to the filtered list', async () => {
    signInAs(account({ role: 'SUPER_ADMIN' }));
    renderHome();
    const drafts = (await screen.findByRole('heading', { name: 'Not published yet' })).closest(
      'section',
    )!;
    expect(await within(drafts).findByText('Kavya Coffee Table')).toBeInTheDocument();
    const images = screen.getByRole('heading', { name: 'Missing images' }).closest('section')!;
    expect(await within(images).findByText('Kavya Coffee Table')).toBeInTheDocument();
    const lowStock = screen.getByRole('heading', { name: 'Low stock' }).closest('section')!;
    expect(
      await within(lowStock).findByRole('link', { name: /Kavya Coffee Table/ }),
    ).toHaveAttribute('href', '/catalog/products?q=Kavya%20Coffee%20Table');
    expect(within(lowStock).getByText(/Oak/)).toBeInTheDocument();
    const activity = screen
      .getByRole('heading', { name: 'Recent admin activity' })
      .closest('section')!;
    expect(await within(activity).findByText('Priya Sharma')).toBeInTheDocument();
    const products = callsTo('/api/v1/admin/catalog/products');
    expect(products).toHaveLength(3);
  });

  it('shows an error with retry inside one queue without breaking the others', async () => {
    server.use(
      http.get(`${API}/admin/enquiries`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'x', details: null, traceId: 't' },
          },
          { status: 500 },
        ),
      ),
    );
    signInAs(account({ role: 'SUPER_ADMIN' }));
    renderHome();
    const enquiries = (await screen.findByRole('heading', { name: 'New enquiries' })).closest(
      'section',
    )!;
    expect(await within(enquiries).findByRole('alert')).toBeInTheDocument();
    const drafts = screen.getByRole('heading', { name: 'Not published yet' }).closest('section')!;
    expect(await within(drafts).findByText('Kavya Coffee Table')).toBeInTheDocument();
  });

  it('links only to areas that are built and permitted', async () => {
    signInAs(account({ role: 'ORDER_MANAGER' }));
    renderHome();
    const areas = (await screen.findByRole('heading', { name: 'Open an area' })).closest(
      'section',
    )!;
    const hrefs = within(areas)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/system/status');
    expect(hrefs).not.toContain('/system/users');
    expect(hrefs).not.toContain('/system/roles');
  });

  it('lists upcoming areas outside production, limited to what the role will be able to open', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    renderHome();
    const upcoming = (await screen.findByRole('heading', { name: 'Being built' })).closest(
      'section',
    )!;
    expect(within(upcoming).getByText('Synonyms')).toBeInTheDocument();
    expect(within(upcoming).queryByText('Merchandising')).not.toBeInTheDocument();
    expect(within(upcoming).queryByText('Attributes')).not.toBeInTheDocument();
    expect(within(upcoming).queryByText('Admin users')).not.toBeInTheDocument();
  });
});
