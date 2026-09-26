import { describe, expect, it } from 'vitest';

import type { CoverageEntry } from '../../src/config/api-coverage';
import { PUBLIC, SESSION, endpoint, requires } from '../../src/lib/api/endpoint';

import { checkCoverage, flattenRegistry, screenTarget, type CoverageInput, type InventoryRoute } from './check';

const route = (method: string, path: string, extra: Partial<InventoryRoute> = {}): InventoryRoute => ({
  method,
  path,
  auth: 'session',
  csrf: method !== 'GET',
  permissions: [],
  anyPermissions: [],
  permissionExpression: null,
  idempotency: false,
  ...extra,
});

const entry = (status: CoverageEntry['status'], screen = '/system/users'): CoverageEntry => ({
  module: 'Test',
  purpose: 'p',
  screen,
  action: 'a',
  kind: 'L',
  destructive: '-',
  status,
});

function input(overrides: Partial<CoverageInput> = {}): CoverageInput {
  return {
    inventory: {
      duplicates: [],
      routes: [
        route('GET', '/api/v1/admin/users', { permissions: ['system.user.read'] }),
        route('POST', '/api/v1/admin/payments/split-rules', { permissions: ['payment.split.update'] }),
        route('GET', '/api/v1/version', { auth: 'public', csrf: false }),
      ],
    },
    coverage: {
      'GET /users': entry('P1'),
      'POST /payments/split-rules': entry('hold:payments', '(hidden)'),
    },
    screenlessReasons: { 'hold:payments': {} },
    externalRoutes: { 'GET /api/v1/version': {} },
    registry: flattenRegistry({
      users: { list: endpoint('GET', '/admin/users', { access: requires('system.user.read') }) },
      version: endpoint('GET', '/version', { access: PUBLIC }),
    }),
    implementedThroughPhase: 1,
    appRoutes: new Set(['/', '/system/users']),
    ...overrides,
  };
}

describe('checkCoverage', () => {
  it('passes a consistent setup', () => {
    const result = checkCoverage(input());
    expect(result.failures).toEqual([]);
    expect([...result.implemented]).toEqual(['GET /users']);
  });

  it('fails on a newly added admin route nobody classified', () => {
    const base = input();
    base.inventory.routes.push(route('GET', '/api/v1/admin/roles/{id}'));
    expect(checkCoverage(base).failures).toContain('unclassified admin route: GET /roles/{id} (add it to src/config/api-coverage.ts)');
  });

  it('fails on a classification for a route that is gone, and names a method mismatch', () => {
    const result = checkCoverage(
      input({ coverage: { ...input().coverage, 'DELETE /gone': entry('P1'), 'PUT /users': entry('P1') } }),
    );
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'stale classification: DELETE /gone (Test) is not mounted any more',
        'method mismatch: PUT /users is classified but the backend mounts GET /users',
      ]),
    );
  });

  it('fails when the code calls a route that does not exist, or with the wrong method', () => {
    const result = checkCoverage(
      input({
        registry: flattenRegistry({
          stale: endpoint('GET', '/admin/nope', { access: SESSION }),
          wrong: endpoint('DELETE', '/admin/users', { access: SESSION }),
        }),
      }),
    );
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'endpoints.stale: stale endpoint, GET /api/v1/admin/nope is not mounted',
        'endpoints.wrong: method mismatch, DELETE /api/v1/admin/users is not mounted (the backend has GET)',
      ]),
    );
  });

  it('fails when the UI calls an on-hold route', () => {
    const result = checkCoverage(
      input({
        registry: flattenRegistry({
          users: endpoint('GET', '/admin/users', { access: requires('system.user.read') }),
          split: endpoint('POST', '/admin/payments/split-rules', { access: requires('payment.split.update') }),
        }),
      }),
    );
    expect(result.failures).toContain(
      'endpoints.split: calls POST /payments/split-rules, classified hold:payments: the admin must not use it',
    );
  });

  it('fails when a route planned for an implemented phase is not wired', () => {
    const result = checkCoverage(input({ registry: [] }));
    expect(result.failures).toContain('missing UI wiring: GET /users is planned for P1 (/system/users) but no endpoint calls it');
  });

  it('fails when the registry disagrees with the backend guard', () => {
    const result = checkCoverage(
      input({
        registry: flattenRegistry({
          users: endpoint('GET', '/admin/users', { access: requires('system.user.update') }),
          version: endpoint('GET', '/version', { access: SESSION }),
        }),
      }),
    );
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'endpoints.users: permissions [system.user.update] differ from the backend guard [system.user.read]',
        'endpoints.version: backend route is public but the registry says session',
      ]),
    );
  });

  it('fails on missing screens, duplicates, undocumented holds and unknown external calls', () => {
    const base = input({
      appRoutes: new Set(['/']),
      screenlessReasons: {},
      registry: flattenRegistry({
        a: endpoint('GET', '/admin/users', { access: requires('system.user.read') }),
        b: endpoint('GET', '/admin/users', { access: requires('system.user.read') }),
        health: endpoint('GET', '/health', { access: PUBLIC, base: 'root' }),
      }),
    });
    base.inventory.routes.push(route('GET', '/health', { auth: 'public', csrf: false }));
    base.inventory.duplicates.push('GET /api/v1/admin/users');
    const failures = checkCoverage(base).failures;
    expect(failures).toEqual(
      expect.arrayContaining([
        'GET /users: its screen /system/users has no page in src/app',
        'endpoints.b duplicates endpoints.a (GET /api/v1/admin/users); define each endpoint once',
        'POST /payments/split-rules: status hold:payments has no documented reason',
        'endpoints.health: calls GET /health, which is not listed in EXTERNAL_ROUTES_USED',
        'backend registers GET /api/v1/admin/users more than once',
      ]),
    );
  });
});

describe('screenTarget', () => {
  it('extracts the app route from a screen description', () => {
    expect(screenTarget('/catalog/products/edit?id=&tab=media')).toBe('/catalog/products/edit');
    expect(screenTarget('/media (Trash)')).toBe('/media');
    expect(screenTarget('(API client)')).toBeNull();
    expect(screenTarget('/')).toBe('/');
  });
});
