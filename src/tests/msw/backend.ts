/**
 * An in-memory imitation of the ClearWood admin auth contract (backend b5861fd), used by MSW.
 * It models what the browser would do with cookies: the httpOnly access/refresh cookies live
 * here (invisible to the page, as in a browser), the readable CSRF cookie is written to
 * `document.cookie`. Behaviour mirrors admin-auth.service.ts, csrf.service.ts and authenticate.ts.
 */
import { http, HttpResponse, type HttpResponseResolver } from 'msw';

import type { Permission } from '@shared/enums';
import type { AdminMeDto, AdminUserDto } from '@shared/types/auth';

import { ROLE_PERMISSIONS, type SeededRole } from '../fixtures/roles';

export const API = 'http://admin.test/api/v1';
export const ROOT = 'http://admin.test';
export const CSRF_COOKIE = 'cw_adm_csrf';

interface Account {
  id: string;
  email: string;
  password: string;
  name: string;
  role: SeededRole;
  mustChangePassword: boolean;
  status: AdminUserDto['status'];
  lockedUntil: string | null;
}

interface BackendState {
  accounts: Account[];
  session: {
    accountId: string;
    accessValid: boolean;
    refreshToken: string;
    used: Set<string>;
  } | null;
  calls: {
    method: string;
    path: string;
    csrf: string | null;
    requestId: string | null;
    body: unknown;
  }[];
}

const ROLE_NAMES: Record<SeededRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CATALOG_MANAGER: 'Catalog Manager',
  ORDER_MANAGER: 'Order Manager',
  CONTENT_MANAGER: 'Content Manager',
};

export function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'adm_1',
    email: 'priya@clearwood.test',
    password: 'Sheesham-Teak-2026',
    name: 'Priya Sharma',
    role: 'SUPER_ADMIN',
    mustChangePassword: false,
    status: 'ACTIVE',
    lockedUntil: null,
    ...overrides,
  };
}

export const backend: BackendState = { accounts: [account()], session: null, calls: [] };

export function resetBackend(accounts: Account[] = [account()]): void {
  backend.accounts = accounts;
  backend.session = null;
  backend.calls = [];
  clearCookies();
}

export function clearCookies(): void {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

export function meFor(a: Account): AdminMeDto {
  const permissions = [...ROLE_PERMISSIONS[a.role]] as Permission[];
  return {
    user: {
      id: a.id,
      email: a.email,
      name: a.name,
      phone: null,
      status: a.status,
      avatarMediaId: null,
      mustChangePassword: a.mustChangePassword,
      lastLoginAt: null,
      createdAt: '2026-09-01T04:30:00.000Z',
      roles: [{ id: `role_${a.role}`, code: a.role, name: ROLE_NAMES[a.role] }],
    },
    roles: [a.role],
    permissions,
    mustChangePassword: a.mustChangePassword,
  };
}

/** Puts the fake browser into "signed in" state without going through the login form. */
export function signInAs(a: Account = backend.accounts[0]!): void {
  backend.accounts = [...backend.accounts.filter((existing) => existing.id !== a.id), a];
  backend.session = { accountId: a.id, accessValid: true, refreshToken: 'rt-1', used: new Set() };
  document.cookie = `${CSRF_COOKIE}=csrf-${a.id}; path=/`;
}

export function expireAccessToken(): void {
  if (backend.session) backend.session.accessValid = false;
}

const traceId = () => `trace-${Math.random().toString(36).slice(2, 10)}`;

export function errorBody(status: number, code: string, message: string, details: unknown = null) {
  return HttpResponse.json(
    { success: false, error: { code, message, details, traceId: traceId() } },
    { status },
  );
}

export function ok<T>(data: T, status = 200, meta: unknown = null) {
  return HttpResponse.json({ success: true, data, meta }, { status });
}

function readCookie(name: string): string | null {
  const pair = document.cookie
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

function current(): Account | null {
  if (!backend.session) return null;
  return backend.accounts.find((a) => a.id === backend.session!.accountId) ?? null;
}

async function record(request: Request): Promise<void> {
  const url = new URL(request.url);
  let body: unknown = null;
  try {
    body = request.method === 'GET' ? null : await request.clone().json();
  } catch {
    body = null;
  }
  backend.calls.push({
    method: request.method,
    path: url.pathname,
    csrf: request.headers.get('x-csrf-token'),
    requestId: request.headers.get('x-request-id'),
    body,
  });
}

/** authenticate('ADMIN') + optional csrfProtection, as the real middleware chain orders them. */
export function guarded(
  resolver: (a: Account, request: Request) => ReturnType<HttpResponseResolver>,
  options: { csrf?: boolean; allowPending?: boolean } = {},
): HttpResponseResolver {
  return async ({ request }) => {
    await record(request);
    const a = current();
    if (!a || !backend.session)
      return errorBody(401, 'NOT_AUTHENTICATED', 'Authentication required');
    if (!backend.session.accessValid)
      return errorBody(401, 'TOKEN_EXPIRED', 'Your session has expired');
    if (a.mustChangePassword && !options.allowPending) {
      return errorBody(
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'You must change your password before continuing',
      );
    }
    if (options.csrf) {
      const header = request.headers.get('x-csrf-token');
      if (!header || header !== readCookie(CSRF_COOKIE)) {
        return errorBody(403, 'CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token', {
          header: 'x-csrf-token',
          cookie: CSRF_COOKIE,
        });
      }
    }
    return resolver(a, request);
  };
}

function loginResponse(a: Account) {
  return {
    ...meFor(a),
    tokens: { accessToken: 'jwt-never-stored', expiresIn: 900, tokenType: 'Bearer' as const },
  };
}

export const handlers = [
  http.post(`${API}/admin/auth/login`, async ({ request }) => {
    await record(request);
    const body = (await request.json()) as { email?: string; password?: string };
    const a = backend.accounts.find((x) => x.email === body.email?.trim().toLowerCase());
    if (a?.lockedUntil) {
      return errorBody(401, 'ACCOUNT_LOCKED', 'Too many attempts — this account is locked', {
        lockedUntil: a.lockedUntil,
      });
    }
    if (!a || a.password !== body.password || a.status !== 'ACTIVE') {
      return errorBody(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    backend.session = { accountId: a.id, accessValid: true, refreshToken: 'rt-1', used: new Set() };
    document.cookie = `${CSRF_COOKIE}=csrf-${a.id}; path=/`;
    return ok(loginResponse(a));
  }),

  http.post(`${API}/admin/auth/refresh`, async ({ request }) => {
    await record(request);
    const session = backend.session;
    if (!session) return errorBody(401, 'NOT_AUTHENTICATED', 'No refresh token supplied');
    const presented = session.refreshToken;
    if (session.used.has(presented)) {
      backend.session = null;
      clearCookies();
      return errorBody(401, 'TOKEN_REUSE', 'Refresh token reuse detected');
    }
    const a = current();
    if (!a || a.status !== 'ACTIVE') {
      backend.session = null;
      clearCookies();
      return errorBody(401, 'ACCOUNT_DISABLED', 'This account is not active');
    }
    session.used.add(presented);
    session.refreshToken = `rt-${session.used.size + 1}`;
    session.accessValid = true;
    return ok(loginResponse(a));
  }),

  http.post(`${API}/admin/auth/logout`, async ({ request }) => {
    await record(request);
    const header = request.headers.get('x-csrf-token');
    if (backend.session && (!header || header !== readCookie(CSRF_COOKIE))) {
      return errorBody(403, 'CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token');
    }
    backend.session = null;
    clearCookies();
    return ok({ loggedOut: true });
  }),

  http.get(
    `${API}/admin/auth/me`,
    guarded((a) => ok(meFor(a)), { allowPending: true }),
  ),

  http.post(
    `${API}/admin/auth/change-password`,
    guarded(
      async (a, request) => {
        const body = (await request.clone().json()) as {
          currentPassword: string;
          newPassword: string;
        };
        if (body.currentPassword !== a.password) {
          return errorBody(401, 'INVALID_CREDENTIALS', 'Your current password is incorrect');
        }
        if (body.newPassword === body.currentPassword) {
          return errorBody(
            422,
            'VALIDATION_ERROR',
            'Password must be different from your current password',
            { field: 'newPassword' },
          );
        }
        if (/password/i.test(body.newPassword)) {
          return errorBody(422, 'VALIDATION_ERROR', 'Password is too common', {
            field: 'password',
            issues: ['is too common'],
          });
        }
        a.password = body.newPassword;
        a.mustChangePassword = false;
        return ok({ changed: true });
      },
      { csrf: true, allowPending: true },
    ),
  ),

  http.get(`${API}/version`, async ({ request }) => {
    await record(request);
    return ok({
      name: 'ClearWood Furnitures',
      version: '0.1.0',
      env: 'development',
      drivers: {
        db: 'mysql',
        cache: 'redis',
        storage: 'local',
        mail: 'log',
        payment: 'mock',
        shipping: 'manual',
        otp: 'log',
        search: 'sql',
      },
    });
  }),

  http.get(`${ROOT}/health`, async ({ request }) => {
    await record(request);
    return ok({ status: 'ok', uptime: 93_784.2, timestamp: '2026-09-25T09:30:00.000Z' });
  }),

  http.get(`${ROOT}/ready`, async ({ request }) => {
    await record(request);
    return ok({
      status: 'ready',
      timestamp: '2026-09-25T09:30:00.000Z',
      dependencies: {
        database: { status: 'up', driver: 'mysql', latencyMs: 3 },
        cache: { status: 'up', driver: 'redis', latencyMs: 1 },
      },
    });
  }),
];

export function callsTo(path: string, method?: string) {
  return backend.calls.filter((c) => c.path === path && (!method || c.method === method));
}
