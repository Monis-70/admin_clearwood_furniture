import { act, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { notifyInfo } from '@/lib/notify';
import { API, account, backend, callsTo, expireAccessToken, signInAs } from '@/tests/msw/backend';
import { server } from '@/tests/msw/server';
import { renderWithProviders } from '@/tests/render';

import { useSession, type SessionContextValue } from './session';

vi.mock('@/lib/notify', () => ({
  notifyInfo: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

beforeEach(() => vi.mocked(notifyInfo).mockClear());

const holder: { api: SessionContextValue | null } = { api: null };

function api(): SessionContextValue {
  if (!holder.api) throw new Error('The probe has not rendered yet.');
  return holder.api;
}

function Probe() {
  const session = useSession();
  useEffect(() => {
    holder.api = session;
    return () => {
      holder.api = null;
    };
  });
  const { state } = session;
  const detail =
    state.status === 'anonymous'
      ? `:${state.reason ?? 'none'}`
      : state.status === 'authenticated'
        ? `:${state.me.user.email}:${state.permissions.size}`
        : '';
  return <output data-testid="state">{`${state.status}${detail}`}</output>;
}

const stateText = () => screen.getByTestId('state').textContent;

describe('SessionProvider', () => {
  it('does not call the API at all when there is no session cookie', async () => {
    renderWithProviders(<Probe />);
    expect(stateText()).toBe('anonymous:none');
    expect(backend.calls).toHaveLength(0);
  });

  it('restores an existing session from /auth/me', async () => {
    signInAs();
    renderWithProviders(<Probe />);
    expect(stateText()).toBe('loading');
    await waitFor(() => expect(stateText()).toBe('authenticated:priya@clearwood.test:86'));
    expect(callsTo('/api/v1/admin/auth/me')).toHaveLength(1);
  });

  it('renews an expired access token during start-up', async () => {
    signInAs();
    expireAccessToken();
    renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toBe('authenticated:priya@clearwood.test:86'));
    expect(callsTo('/api/v1/admin/auth/refresh')).toHaveLength(1);
  });

  it('treats a dead session at start-up as simply signed out', async () => {
    document.cookie = 'cw_adm_csrf=stale; path=/';
    renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toBe('anonymous:none'));
  });

  it('reports the API as unavailable instead of signing out on network failure', async () => {
    signInAs();
    server.use(http.get(`${API}/admin/auth/me`, () => HttpResponse.error()));
    renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toBe('unavailable'));
    server.resetHandlers();
    act(() => api().retryBootstrap());
    await waitFor(() => expect(stateText()).toBe('authenticated:priya@clearwood.test:86'));
  });

  it('signs in with the real permissions of the role and ignores the body token', async () => {
    backend.accounts.push(
      account({ id: 'adm_cm', email: 'cm@clearwood.test', role: 'CATALOG_MANAGER' }),
    );
    renderWithProviders(<Probe />);
    await act(async () => {
      await api().signIn({ email: 'cm@clearwood.test', password: 'Sheesham-Teak-2026' });
    });
    expect(stateText()).toBe('authenticated:cm@clearwood.test:36');
    expect(JSON.stringify(api().state)).not.toContain('jwt-never-stored');
  });

  it('signs out, tells the API, and clears cached data', async () => {
    signInAs();
    const { queryClient } = renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toMatch(/^authenticated/));
    queryClient.setQueryData(['system', 'version'], { cached: true });
    await act(async () => {
      await api().signOut();
    });
    expect(stateText()).toBe('anonymous:signed-out');
    expect(callsTo('/api/v1/admin/auth/logout')[0]!.csrf).toBe('csrf-adm_1');
    expect(queryClient.getQueryData(['system', 'version'])).toBeUndefined();
  });

  it('keeps the admin signed in when sign-out could not reach the API', async () => {
    signInAs();
    renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toMatch(/^authenticated/));
    server.use(http.post(`${API}/admin/auth/logout`, () => HttpResponse.error()));
    await act(async () => {
      await expect(api().signOut()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });
    expect(stateText()).toMatch(/^authenticated/);
  });

  it('ends the session everywhere when renewal detects token reuse', async () => {
    signInAs();
    renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toMatch(/^authenticated/));
    expireAccessToken();
    backend.session!.used.add('rt-1');
    await act(async () => {
      await api().revalidate();
    });
    await waitFor(() => expect(stateText()).toBe('anonymous:reuse'));
  });

  it('marks the session as needing a password change when the API says so', async () => {
    signInAs();
    renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toMatch(/^authenticated/));
    server.use(
      http.get(`${API}/admin/auth/me`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'x', details: null, traceId: 't' },
          },
          { status: 403 },
        ),
      ),
    );
    await act(async () => {
      await api().revalidate();
    });
    await waitFor(() => {
      const { state } = api();
      expect(state.status === 'authenticated' && state.me.mustChangePassword).toBe(true);
    });
  });

  it('changes the password and refreshes the session', async () => {
    const pending = account({
      id: 'adm_new',
      email: 'new@clearwood.test',
      mustChangePassword: true,
      role: 'CONTENT_MANAGER',
    });
    signInAs(pending);
    renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toBe('authenticated:new@clearwood.test:24'));
    await act(async () => {
      await api().changePassword({
        currentPassword: 'Sheesham-Teak-2026',
        newPassword: 'Walnut-Oak-Rosewood-9',
      });
    });
    const { state } = api();
    expect(state.status === 'authenticated' && state.me.mustChangePassword).toBe(false);
    expect(callsTo('/api/v1/admin/auth/change-password')[0]!.csrf).toBe('csrf-adm_new');
  });

  it('announces an access change found on renewal and refetches data under the new access', async () => {
    const priya = account({ role: 'CATALOG_MANAGER' });
    signInAs(priya);
    const { queryClient } = renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toBe('authenticated:priya@clearwood.test:36'));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    priya.role = 'CONTENT_MANAGER';
    expireAccessToken();
    await act(async () => {
      await api().revalidate();
    });
    await waitFor(() => expect(stateText()).toBe('authenticated:priya@clearwood.test:24'));
    expect(notifyInfo).toHaveBeenCalledWith(
      'Your access changed',
      expect.any(String),
      'access-changed',
    );
    expect(invalidate).toHaveBeenCalled();
  });

  it('stays silent when a renewal keeps the same access', async () => {
    signInAs();
    renderWithProviders(<Probe />);
    await waitFor(() => expect(stateText()).toMatch(/^authenticated/));
    expireAccessToken();
    await act(async () => {
      await api().revalidate();
    });
    expect(notifyInfo).not.toHaveBeenCalled();
  });
});
