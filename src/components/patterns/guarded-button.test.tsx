import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { endpoint, requires } from '@/lib/api/endpoint';
import { account, signInAs } from '@/tests/msw/backend';
import { renderWithProviders } from '@/tests/render';

import { GuardedButton } from './guarded-button';
import { PermissionNotice } from './states';

const deleteUser = endpoint('DELETE', '/admin/users/{id}', {
  access: requires('system.user.delete'),
});

describe('GuardedButton', () => {
  it('works normally when the admin holds the permission', async () => {
    signInAs();
    const onClick = vi.fn();
    renderWithProviders(
      <GuardedButton endpoint={deleteUser} onClick={onClick}>
        Delete admin
      </GuardedButton>,
    );
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete admin' })).not.toHaveAttribute(
        'aria-disabled',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Delete admin' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('stays focusable, explains the missing permission and does nothing when clicked', async () => {
    signInAs(account({ role: 'CATALOG_MANAGER' }));
    const onClick = vi.fn();
    renderWithProviders(
      <GuardedButton endpoint={deleteUser} onClick={onClick}>
        Delete admin
      </GuardedButton>,
    );
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete admin' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    const button = screen.getByRole('button', { name: 'Delete admin' });
    await waitFor(() =>
      expect(button).toHaveAccessibleDescription('You need the permission: Delete admin users.'),
    );
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('explains non-permission reasons too', async () => {
    signInAs();
    renderWithProviders(
      <GuardedButton unavailableReason="Online payments are on hold.">Refund</GuardedButton>,
    );
    expect(await screen.findByRole('button', { name: 'Refund' })).toHaveAccessibleDescription(
      'Online payments are on hold.',
    );
  });
});

describe('PermissionNotice', () => {
  it('names the missing permission in plain words', async () => {
    renderWithProviders(<PermissionNotice area="the audit log" all={['system.audit.read']} />);
    expect(
      await screen.findByRole('heading', { name: "You don't have access to the audit log" }),
    ).toBeInTheDocument();
    expect(screen.getByText('View the audit log')).toBeInTheDocument();
  });
});
