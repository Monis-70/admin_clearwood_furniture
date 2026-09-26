import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { account, callsTo, signInAs } from '@/tests/msw/backend';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { AppShell } from './app-shell';

function renderShell() {
  return renderWithProviders(
    <AuthGate>
      <AppShell>
        <h1>Page content</h1>
      </AppShell>
    </AuthGate>,
  );
}

describe('AppShell inside AuthGate', () => {
  it('sends a signed-out visitor to sign in, keeping their place', async () => {
    navigation.reset('/system/status', 'x=1');
    renderShell();
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/login?next=%2Fsystem%2Fstatus%3Fx%3D1'),
    );
    expect(screen.queryByText('Page content')).not.toBeInTheDocument();
  });

  it('forces a pending password change before showing anything', async () => {
    signInAs(account({ mustChangePassword: true }));
    navigation.reset('/system/status');
    renderShell();
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/change-password?next=%2Fsystem%2Fstatus'),
    );
    expect(screen.queryByText('Page content')).not.toBeInTheDocument();
  });

  it('renders the shell with a skip link and accessible landmarks', async () => {
    signInAs();
    const { container } = renderShell();
    expect(await screen.findByText('Page content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    await expectNoA11yViolations(container);
  });

  it('lists only the built areas the admin may open, with the current page marked', async () => {
    signInAs(account({ role: 'CONTENT_MANAGER' }));
    navigation.reset('/system/status');
    renderShell();
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const links = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(links).toEqual([
      'Dashboard',
      'Products',
      'Categories',
      'Brands',
      'Merchandising',
      'Catalog settings',
      'Media library',
      'Pages',
      'Banners',
      'Announcements',
      'FAQs',
      'Help centre',
      'Testimonials',
      'Stores',
      'Navigation menus',
      'All enquiries',
      'Contract work',
      'Status & integrations',
    ]);
    expect(links).not.toContain('Admin users');
    expect(within(nav).getByRole('link', { name: 'Status & integrations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the admin screens only to roles that hold their permissions', async () => {
    signInAs(account({ role: 'SUPER_ADMIN' }));
    renderShell();
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const name of ['Admin users', 'Roles & permissions', 'Audit log', 'Products']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('shows the signed-in admin and their role in the account menu', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER', name: 'Kavya Iyer' }));
    renderShell();
    const trigger = await screen.findByRole('button', { name: 'Account menu for Kavya Iyer' });
    expect(within(trigger).getByText('Catalog Manager')).toBeInTheDocument();
  });

  it('signs out from the account menu and returns to sign-in', async () => {
    signInAs();
    renderShell();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Account menu/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/login?reason=signed-out'),
    );
    expect(callsTo('/api/v1/admin/auth/logout')).toHaveLength(1);
  });

  it('opens the navigation drawer on small screens', async () => {
    signInAs();
    renderShell();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open navigation' }));
    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(within(drawer).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('remembers a collapsed sidebar on this device only', async () => {
    signInAs();
    renderShell();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Collapse the sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument();
    expect(window.localStorage.getItem('cw-admin:pref:sidebar-collapsed')).toBe('true');
  });
});
