import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { adminData } from '@/tests/msw/admin-data';
import { API, account, callsTo, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { RESET_PASSWORD_WARNING } from './admin-user-actions';
import { AdminUsersScreen } from './admin-users-screen';

function renderUsers(search = '') {
  navigation.reset('/system/users', search);
  return renderWithProviders(
    <AuthGate>
      <AdminUsersScreen />
    </AuthGate>,
  );
}

const colleague = {
  id: 'adm_9',
  email: 'ravi@clearwood.test',
  name: 'Ravi Kumar',
  phone: null,
  status: 'ACTIVE' as const,
  avatarMediaId: null,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-09-10T04:30:00.000Z',
  roles: [{ id: 'role_CATALOG_MANAGER', code: 'CATALOG_MANAGER', name: 'Catalog Manager' }],
};

describe('AdminUsersScreen', () => {
  it('lists admins from the API with roles and status', async () => {
    signInAs();
    adminData.extraUsers.push({ ...colleague });
    const { container } = renderUsers();
    const table = await screen.findByRole('table', { name: 'Admin users' });
    expect(within(table).getByText('Ravi Kumar')).toBeInTheDocument();
    expect(within(table).getByText('Catalog Manager')).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/users')).toHaveLength(1);
    await expectNoA11yViolations(container);
  });

  it('explains the missing permission instead of showing the list', async () => {
    signInAs(account({ role: 'ORDER_MANAGER' }));
    renderUsers();
    expect(
      await screen.findByRole('heading', { name: "You don't have access to admin users" }),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/users')).toHaveLength(0);
  });

  it('lets an Admin add an admin with a standard role without reading the role list', async () => {
    signInAs(account({ role: 'ADMIN' }));
    renderUsers();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Add admin/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an admin' });
    expect(within(dialog).queryByLabelText(/Super Admin/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Showing the standard roles/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Full name/), 'Nikhil Das');
    await user.type(within(dialog).getByLabelText(/^Email/), 'nikhil@clearwood.test');
    await user.click(within(dialog).getByRole('button', { name: /Generate a strong/ }));
    await user.click(within(dialog).getByLabelText(/Order Manager/));
    await user.click(within(dialog).getByRole('button', { name: 'Add admin' }));

    expect(
      await screen.findByRole('heading', { name: 'Nikhil Das was added' }),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/users', 'POST')[0]!.body).toMatchObject({
      roleCodes: ['ORDER_MANAGER'],
    });
    expect(callsTo('/api/v1/admin/roles')).toHaveLength(0);
  });

  it('shows the API refusal when a role cannot be granted', async () => {
    signInAs(account({ role: 'ADMIN' }));
    server.use(
      http.post(`${API}/admin/users`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ROLE_NOT_GRANTABLE',
              message: 'You cannot grant a role that carries permissions you do not hold',
              details: { roleCodes: ['ADMIN'] },
            },
          },
          { status: 403 },
        ),
      ),
    );
    renderUsers();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Add admin/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an admin' });
    await user.type(within(dialog).getByLabelText(/Full name/), 'Nikhil Das');
    await user.type(within(dialog).getByLabelText(/^Email/), 'nikhil@clearwood.test');
    await user.click(within(dialog).getByRole('button', { name: /Generate a strong/ }));
    await user.click(within(dialog).getByLabelText(/^Admin/));
    await user.click(within(dialog).getByRole('button', { name: 'Add admin' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/cannot grant a role/);
  });

  it('shows changing roles as unavailable to an Admin, with the permission it needs', async () => {
    signInAs(account({ role: 'ADMIN' }));
    adminData.extraUsers.push({ ...colleague });
    renderUsers();
    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: 'Admin users' });
    await user.click(within(table).getByRole('button', { name: 'Actions for Ravi Kumar' }));
    const item = await screen.findByRole('menuitem', { name: /Change roles/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveTextContent(/View roles and permissions/);
    expect(screen.getByRole('menuitem', { name: /Reset password/ })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('creates an admin with a temporary password and shows it once', async () => {
    signInAs();
    renderUsers();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Add admin/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an admin' });
    await user.type(within(dialog).getByLabelText(/Full name/), 'Asha Rao');
    await user.type(within(dialog).getByLabelText(/^Email/), 'Asha@ClearWood.test');
    await user.click(within(dialog).getByRole('button', { name: /Generate a strong/ }));
    await user.click(await within(dialog).findByLabelText(/Content Manager/));
    await user.click(within(dialog).getByRole('button', { name: 'Add admin' }));

    expect(await screen.findByRole('heading', { name: 'Asha Rao was added' })).toBeInTheDocument();
    const post = callsTo('/api/v1/admin/users', 'POST')[0]!;
    expect(post.csrf).toBe('csrf-adm_1');
    expect(post.body).toMatchObject({
      email: 'asha@clearwood.test',
      roleCodes: ['CONTENT_MANAGER'],
    });
    const password = (post.body as { password: string }).password;
    expect(password.length).toBeGreaterThanOrEqual(10);
    expect(screen.getByText(password)).toBeInTheDocument();
  });

  it('shows the API refusal inside the form when the email is taken', async () => {
    signInAs();
    adminData.extraUsers.push({ ...colleague });
    renderUsers();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Add admin/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an admin' });
    await user.type(within(dialog).getByLabelText(/Full name/), 'Ravi Again');
    await user.type(within(dialog).getByLabelText(/^Email/), 'ravi@clearwood.test');
    await user.type(within(dialog).getByLabelText(/Temporary password/), 'Walnut-Oak-2026');
    await user.click(await within(dialog).findByLabelText(/Catalog Manager/));
    await user.click(within(dialog).getByRole('button', { name: 'Add admin' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/already/i);
  });

  it('resets a password only after an explicit confirmation that states the consequence', async () => {
    signInAs();
    adminData.extraUsers.push({ ...colleague });
    renderUsers();
    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: 'Admin users' });
    await user.click(within(table).getByRole('button', { name: 'Actions for Ravi Kumar' }));
    await user.click(await screen.findByRole('menuitem', { name: /Reset password/ }));
    const dialog = await screen.findByRole('dialog', { name: /Reset password for Ravi Kumar/ });
    expect(within(dialog).getByText(RESET_PASSWORD_WARNING)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Generate a strong/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    const confirm = await screen.findByRole('alertdialog', { name: /Reset Ravi Kumar's password/ });
    expect(callsTo('/api/v1/admin/users/adm_9/password')).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Reset password' }));
    expect(
      await screen.findByRole('heading', { name: 'Password reset for Ravi Kumar' }),
    ).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/users/adm_9/password', 'POST')[0]!.csrf).toBe('csrf-adm_1');
  });

  it('offers no management actions on your own account and explains why', async () => {
    signInAs();
    renderUsers();
    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: 'Admin users' });
    await user.click(within(table).getByRole('button', { name: 'Actions for Priya Sharma' }));
    expect(
      await screen.findByText('This is your own account. Use My account instead.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Reset password/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete admin/ })).not.toBeInTheDocument();
  });

  it('opens the details from the URL and shows effective permissions from the role', async () => {
    signInAs();
    adminData.extraUsers.push({ ...colleague });
    renderUsers('id=adm_9');
    const sheet = await screen.findByRole('dialog', { name: /Ravi Kumar/ });
    const user = userEvent.setup();
    await user.click(within(sheet).getByRole('tab', { name: 'Permissions' }));
    expect(await within(sheet).findByText('Edit products')).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/roles/role_CATALOG_MANAGER')).toHaveLength(1);
  });

  it('shows an error state with retry when the list fails', async () => {
    server.use(
      http.get(`${API}/admin/users`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'x', details: null, traceId: 't' },
          },
          { status: 500 },
        ),
      ),
    );
    signInAs();
    renderUsers();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument(),
    );
  });
});
