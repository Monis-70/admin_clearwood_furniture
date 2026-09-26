import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { account, backend, callsTo, signInAs } from '@/tests/msw/backend';
import { navigation } from '@/tests/navigation';
import { expectNoA11yViolations, renderWithProviders } from '@/tests/render';

import { SignInScreen } from './sign-in-screen';

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^email/i), email);
  await user.type(screen.getByLabelText(/^password/i), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('SignInScreen', () => {
  it('is accessible and explains how to recover a forgotten password honestly', async () => {
    const { container } = renderWithProviders(<SignInScreen />);
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText(/Password-reset emails are not enabled yet/)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('validates with the shared schema before calling the API', async () => {
    renderWithProviders(<SignInScreen />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(callsTo('/api/v1/admin/auth/login')).toHaveLength(0);
  });

  it('shows the API message for wrong credentials and clears the password', async () => {
    renderWithProviders(<SignInScreen />);
    await fillAndSubmit('priya@clearwood.test', 'wrong-password');
    expect(await screen.findByText('Email or password is incorrect')).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toHaveValue('');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('explains a lockout with the time it ends', async () => {
    backend.accounts = [account({ lockedUntil: '2026-09-25T10:12:00.000Z' })];
    renderWithProviders(<SignInScreen />);
    await fillAndSubmit('priya@clearwood.test', 'anything');
    expect(await screen.findByText('Account temporarily locked')).toBeInTheDocument();
    expect(screen.getByText(/Try again after 15:42 IST/)).toBeInTheDocument();
  });

  it('signs in and continues to the page the admin wanted', async () => {
    navigation.reset('/login', 'next=%2Fsystem%2Fstatus');
    renderWithProviders(<SignInScreen />);
    await fillAndSubmit('priya@clearwood.test', 'Sheesham-Teak-2026');
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/system/status'));
    expect(callsTo('/api/v1/admin/auth/login')[0]!.body).toMatchObject({
      email: 'priya@clearwood.test',
      deviceLabel: expect.stringMatching(/^Admin · /),
    });
  });

  it('never follows an external next parameter', async () => {
    navigation.reset('/login', 'next=https%3A%2F%2Fevil.example');
    renderWithProviders(<SignInScreen />);
    await fillAndSubmit('priya@clearwood.test', 'Sheesham-Teak-2026');
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/'));
  });

  it('sends an admin with a temporary password to the password change', async () => {
    backend.accounts = [account({ mustChangePassword: true })];
    renderWithProviders(<SignInScreen />);
    await fillAndSubmit('priya@clearwood.test', 'Sheesham-Teak-2026');
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/change-password'));
  });

  it('explains why the admin is on this page', async () => {
    navigation.reset('/login', 'reason=reuse');
    renderWithProviders(<SignInScreen />);
    expect(screen.getByText('Signed out for your security')).toBeInTheDocument();
  });

  it('skips the form when already signed in', async () => {
    signInAs();
    renderWithProviders(<SignInScreen />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/'));
  });
});
