import { test as base, expect, type BrowserContext, type Page, type Route } from '@playwright/test';

/**
 * A fake ClearWood API for browser tests, faithful to the admin auth contract (backend b5861fd):
 * httpOnly cw_adm_at / cw_adm_rt on /api/v1/admin, readable cw_adm_csrf on /, double-submit CSRF,
 * rotating refresh tokens with reuse detection, and the { success, data, meta } envelope.
 */

export interface FakeAccount {
  email: string;
  password: string;
  name: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  mustChangePassword: boolean;
}

const ALL_PERMISSIONS_SAMPLE = [
  'system.user.read',
  'system.role.read',
  'system.audit.read',
  'catalog.product.read',
];

export function makeAccount(overrides: Partial<FakeAccount> = {}): FakeAccount {
  return {
    email: 'priya@clearwood.test',
    password: 'Sheesham-Teak-2026',
    name: 'Priya Sharma',
    roleCode: 'SUPER_ADMIN',
    roleName: 'Super Admin',
    permissions: ALL_PERMISSIONS_SAMPLE,
    mustChangePassword: false,
    ...overrides,
  };
}

export class FakeApi {
  accounts: FakeAccount[] = [makeAccount()];
  private signedIn: FakeAccount | null = null;
  private accessValid = false;
  private refreshToken = '';
  private usedRefreshTokens = new Set<string>();
  refreshFails = false;
  calls: { method: string; path: string; csrf: string | null }[] = [];

  constructor(
    private readonly context: BrowserContext,
    private readonly origin: string,
  ) {}

  async install(): Promise<void> {
    await this.context.route(/\/(api\/v1\/.*|health|ready)(\?.*)?$/, (route) => this.handle(route));
  }

  expireAccess(): void {
    this.accessValid = false;
  }

  count(path: string): number {
    return this.calls.filter((call) => call.path === path).length;
  }

  private me(account: FakeAccount) {
    return {
      user: {
        id: 'adm_1',
        email: account.email,
        name: account.name,
        phone: null,
        status: 'ACTIVE',
        avatarMediaId: null,
        mustChangePassword: account.mustChangePassword,
        lastLoginAt: null,
        createdAt: '2026-09-01T04:30:00.000Z',
        roles: [{ id: 'role_1', code: account.roleCode, name: account.roleName }],
      },
      roles: [account.roleCode],
      permissions: account.permissions,
      mustChangePassword: account.mustChangePassword,
    };
  }

  private async issueCookies(): Promise<void> {
    this.refreshToken = `rt-${Math.random().toString(36).slice(2)}`;
    this.accessValid = true;
    const url = this.origin;
    await this.context.addCookies([
      {
        name: 'cw_adm_at',
        value: `at-${Date.now()}`,
        url: `${url}/api/v1/admin`,
        httpOnly: true,
        sameSite: 'Lax',
      },
      {
        name: 'cw_adm_rt',
        value: this.refreshToken,
        url: `${url}/api/v1/admin`,
        httpOnly: true,
        sameSite: 'Lax',
      },
      { name: 'cw_adm_csrf', value: 'csrf-e2e-token', url: `${url}/`, sameSite: 'Lax' },
    ]);
  }

  private async clearSession(): Promise<void> {
    this.signedIn = null;
    this.accessValid = false;
    await this.context.clearCookies();
  }

  private json(route: Route, status: number, body: unknown) {
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  }

  private ok(route: Route, data: unknown, status = 200) {
    return this.json(route, status, { success: true, data, meta: null });
  }

  private fail(
    route: Route,
    status: number,
    code: string,
    message: string,
    details: unknown = null,
  ) {
    return this.json(route, status, {
      success: false,
      error: { code, message, details, traceId: `trace-${Date.now()}` },
    });
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const headers = await request.allHeaders();
    const cookies = headers.cookie ?? '';
    const csrfHeader = headers['x-csrf-token'] ?? null;
    this.calls.push({ method: request.method(), path, csrf: csrfHeader });
    const csrfOk =
      csrfHeader === 'csrf-e2e-token' && cookies.includes('cw_adm_csrf=csrf-e2e-token');
    const key = `${request.method()} ${path}`;

    switch (key) {
      case 'POST /api/v1/admin/auth/login': {
        const body = request.postDataJSON() as { email: string; password: string };
        const account = this.accounts.find(
          (a) => a.email === body.email && a.password === body.password,
        );
        if (!account)
          return this.fail(route, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
        this.signedIn = account;
        await this.issueCookies();
        return this.ok(route, {
          ...this.me(account),
          tokens: { accessToken: 'never-stored', expiresIn: 900, tokenType: 'Bearer' },
        });
      }
      case 'POST /api/v1/admin/auth/refresh': {
        const presented = /cw_adm_rt=([^;]+)/.exec(cookies)?.[1];
        if (!presented || !this.signedIn || this.refreshFails) {
          await this.clearSession();
          return this.fail(route, 401, 'NOT_AUTHENTICATED', 'No refresh token supplied');
        }
        if (this.usedRefreshTokens.has(presented) || presented !== this.refreshToken) {
          await this.clearSession();
          return this.fail(route, 401, 'TOKEN_REUSE', 'Refresh token reuse detected');
        }
        this.usedRefreshTokens.add(presented);
        await this.issueCookies();
        return this.ok(route, {
          ...this.me(this.signedIn),
          tokens: { accessToken: 'never-stored', expiresIn: 900, tokenType: 'Bearer' },
        });
      }
      case 'POST /api/v1/admin/auth/logout':
        if (this.signedIn && !csrfOk)
          return this.fail(route, 403, 'CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token');
        await this.clearSession();
        return this.ok(route, { loggedOut: true });
      case 'GET /api/v1/admin/auth/me':
        if (!this.signedIn || !cookies.includes('cw_adm_at='))
          return this.fail(route, 401, 'NOT_AUTHENTICATED', 'Authentication required');
        if (!this.accessValid)
          return this.fail(route, 401, 'TOKEN_EXPIRED', 'Your session has expired');
        return this.ok(route, this.me(this.signedIn));
      case 'POST /api/v1/admin/auth/change-password': {
        if (!this.signedIn)
          return this.fail(route, 401, 'NOT_AUTHENTICATED', 'Authentication required');
        if (!csrfOk)
          return this.fail(route, 403, 'CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token');
        const body = request.postDataJSON() as { currentPassword: string; newPassword: string };
        if (body.currentPassword !== this.signedIn.password) {
          return this.fail(route, 401, 'INVALID_CREDENTIALS', 'Your current password is incorrect');
        }
        this.signedIn.password = body.newPassword;
        this.signedIn.mustChangePassword = false;
        return this.ok(route, { changed: true });
      }
      case 'GET /api/v1/version':
        return this.ok(route, {
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
      case 'GET /health':
        return this.ok(route, { status: 'ok', uptime: 5400, timestamp: new Date().toISOString() });
      case 'GET /ready':
        return this.ok(route, {
          status: 'ready',
          timestamp: new Date().toISOString(),
          dependencies: {
            database: { status: 'up', driver: 'mysql', latencyMs: 3 },
            cache: { status: 'up', driver: 'redis', latencyMs: 1 },
          },
        });
      default:
        return this.fail(route, 404, 'NOT_FOUND', `No fake for ${key}`);
    }
  }
}

export const test = base.extend<{ api: FakeApi }>({
  // auto: every test gets the fake, so no request can ever leave the browser for a real API.
  api: [
    async ({ context, baseURL }, use) => {
      const api = new FakeApi(context, baseURL!);
      await api.install();
      await use(api);
    },
    { auto: true },
  ],
});

export { expect };

export async function signIn(
  page: Page,
  email = 'priya@clearwood.test',
  password = 'Sheesham-Teak-2026',
) {
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
