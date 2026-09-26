import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthGate } from '@/lib/auth/guards';
import { callsTo, signInAs } from '@/tests/msw/backend';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { AccountScreen, describeDevice } from './account-screen';

function renderAccount() {
  navigation.reset('/account');
  return renderWithProviders(
    <AuthGate>
      <AccountScreen />
    </AuthGate>,
  );
}

describe('AccountScreen', () => {
  it('shows the profile and the devices signed in, marking this one', async () => {
    signInAs();
    const { container } = renderAccount();
    expect(await screen.findByText('Edge on Windows')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    expect(screen.getByText('Chrome on Android')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('ends another session after confirmation, with the CSRF header', async () => {
    signInAs();
    renderAccount();
    const user = userEvent.setup();
    await screen.findByText('Chrome on Android');
    await user.click(screen.getByRole('button', { name: 'End session' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'End this session?' });
    await user.click(within(confirm).getByRole('button', { name: 'End session' }));
    expect(callsTo('/api/v1/admin/auth/sessions/sess_phone', 'DELETE')[0]!.csrf).toBe('csrf-adm_1');
    expect(await screen.findByText('Edge on Windows')).toBeInTheDocument();
  });

  it('signs out everywhere and leaves the admin', async () => {
    signInAs();
    renderAccount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign out everywhere' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Sign out everywhere?' });
    await user.click(within(confirm).getByRole('button', { name: 'Sign out everywhere' }));
    expect(callsTo('/api/v1/admin/auth/logout-all', 'POST')).toHaveLength(1);
    await vi.waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/login?reason=signed-out'),
    );
  });

  it('describes devices without fingerprinting', () => {
    expect(describeDevice({ deviceLabel: 'Front desk PC', userAgent: 'x' })).toBe('Front desk PC');
    expect(
      describeDevice({
        deviceLabel: null,
        userAgent: 'Mozilla/5.0 (Macintosh; Mac OS X) Safari/605',
      }),
    ).toBe('Safari on macOS');
    expect(describeDevice({ deviceLabel: null, userAgent: null })).toBe('A browser');
  });
});
