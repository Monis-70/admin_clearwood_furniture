import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { account, callsTo, signInAs } from '@/tests/msw/backend';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { ChangePasswordScreen } from './change-password-screen';

const pending = () =>
  account({
    id: 'adm_new',
    email: 'new@clearwood.test',
    name: 'Arjun Mehta',
    mustChangePassword: true,
  });

async function submit(current: string, next: string, repeat = next) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/current \(temporary\) password/i), current);
  await user.type(screen.getByLabelText(/^new password/i), next);
  await user.type(screen.getByLabelText(/repeat new password/i), repeat);
  await user.click(screen.getByRole('button', { name: 'Save new password' }));
}

describe('ChangePasswordScreen', () => {
  it('is accessible and shows the password rules', async () => {
    signInAs(pending());
    const { container } = renderWithProviders(<ChangePasswordScreen />);
    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/At least 10 characters/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('checks the confirmation and the minimum length locally', async () => {
    signInAs(pending());
    renderWithProviders(<ChangePasswordScreen />);
    await submit('Sheesham-Teak-2026', 'short', 'shorter');
    expect(
      await screen.findByText(/at least 10 characters/i, { selector: 'p' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The two new passwords do not match')).toBeInTheDocument();
    expect(callsTo('/api/v1/admin/auth/change-password')).toHaveLength(0);
  });

  it('puts a wrong current password on that field', async () => {
    signInAs(pending());
    renderWithProviders(<ChangePasswordScreen />);
    await submit('not-the-temporary', 'Walnut-Oak-Rosewood-9');
    expect(await screen.findByText('Your current password is incorrect')).toBeInTheDocument();
    expect(screen.getByLabelText(/current \(temporary\) password/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('maps the server password policy onto the new password field', async () => {
    signInAs(pending());
    renderWithProviders(<ChangePasswordScreen />);
    await submit('Sheesham-Teak-2026', 'MyPassword-2026');
    expect(await screen.findByText('Password is too common')).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('saves and continues once the password is changed', async () => {
    navigation.reset('/change-password', 'next=%2Fsystem%2Fstatus');
    signInAs(pending());
    renderWithProviders(<ChangePasswordScreen />);
    await submit('Sheesham-Teak-2026', 'Walnut-Oak-Rosewood-9');
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/system/status'));
  });

  it('sends a signed-out visitor to sign in', async () => {
    renderWithProviders(<ChangePasswordScreen />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
  });

  it('sends an admin without a pending change onwards', async () => {
    signInAs();
    renderWithProviders(<ChangePasswordScreen />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/'));
  });
});
