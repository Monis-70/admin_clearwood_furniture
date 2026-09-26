import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { account, callsTo, signInAs } from '@/tests/msw/backend';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { RolesScreen } from './roles-screen';

function renderRoles(search = '') {
  navigation.reset('/system/roles', search);
  return renderWithProviders(
    <AuthGate>
      <RolesScreen />
    </AuthGate>,
  );
}

describe('RolesScreen', () => {
  it('lists the roles the API returns', async () => {
    signInAs();
    const { container } = renderRoles();
    expect(await screen.findByRole('link', { name: /Catalog Manager/ })).toHaveAttribute(
      'href',
      '/system/roles?id=role_CATALOG_MANAGER',
    );
    expect(screen.getAllByText('Built-in').length).toBe(5);
    await expectNoA11yViolations(container);
  });

  it('shows a role in plain language, grouped by area, with codes in small print', async () => {
    signInAs();
    renderRoles('id=role_CATALOG_MANAGER');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Catalog Manager' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByText('Edit products')).toBeInTheDocument();
    expect(screen.getByText('catalog.product.update')).toBeInTheDocument();
    // The seeded Catalog Manager exports products: flagged as sensitive.
    expect(screen.getAllByText(/Downloads data in bulk/).length).toBeGreaterThan(0);
  });

  it('refuses the screen without the permission to read roles', async () => {
    signInAs(account({ role: 'ADMIN' }));
    renderRoles();
    expect(
      await screen.findByRole('heading', {
        name: "You don't have access to roles and permissions",
      }),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/roles')).toHaveLength(0);
  });

  it('creates a custom role and confirms sensitive permissions first', async () => {
    signInAs();
    renderRoles('new=1');
    const user = userEvent.setup();
    const dialog = await screen.findByRole('dialog', { name: 'New role' });
    await user.type(await within(dialog).findByLabelText(/^Name/), 'Store Manager');
    await user.type(within(dialog).getByLabelText(/^Code/), 'STORE_MANAGER');
    await user.click(await within(dialog).findByLabelText('View products'));
    await user.click(within(dialog).getByLabelText('Export catalog data'));
    await user.click(within(dialog).getByRole('button', { name: 'Create role' }));

    const confirm = await screen.findByRole('alertdialog', {
      name: 'Give these sensitive permissions?',
    });
    expect(within(confirm).getByText('catalog.product.export')).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/roles', 'POST')).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Create role' }));

    await screen.findByRole('heading', { level: 1, name: 'Store Manager' });
    const post = callsTo('/api/v1/admin/roles', 'POST')[0]!;
    expect(post.body).toMatchObject({ code: 'STORE_MANAGER', name: 'Store Manager' });
    expect((post.body as { permissions: string[] }).permissions.sort()).toEqual([
      'catalog.product.export',
      'catalog.product.read',
    ]);
  });
});
