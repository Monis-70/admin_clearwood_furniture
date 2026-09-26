import { describe, expect, it } from 'vitest';

import { PUBLIC, SESSION, endpoint, fillPath, requires } from './endpoint';
import { toQueryString } from './query-string';

describe('endpoint()', () => {
  it('derives CSRF from method and access', () => {
    expect(endpoint('GET', '/admin/x', { access: SESSION }).csrf).toBe(false);
    expect(endpoint('POST', '/admin/x', { access: SESSION }).csrf).toBe(true);
    expect(endpoint('POST', '/admin/auth/login', { access: PUBLIC }).csrf).toBe(false);
  });

  it('never renews the session for public endpoints unless asked', () => {
    expect(endpoint('POST', '/admin/auth/login', { access: PUBLIC }).renewSession).toBe(false);
    expect(endpoint('GET', '/admin/x', { access: requires('system.user.read') }).renewSession).toBe(
      true,
    );
    expect(
      endpoint('POST', '/admin/auth/logout', { access: SESSION, renewSession: false }).renewSession,
    ).toBe(false);
  });
});

describe('fillPath', () => {
  it('encodes each parameter exactly once', () => {
    expect(fillPath('/admin/search/synonyms/{term}', { term: 'sofa bed/set' })).toBe(
      '/admin/search/synonyms/sofa%20bed%2Fset',
    );
    expect(fillPath('/admin/users/{id}', { id: 'a%2F' })).toBe('/admin/users/a%252F');
  });

  it('refuses a missing parameter instead of calling a wrong URL', () => {
    expect(() => fillPath('/admin/users/{id}', {})).toThrow(/Missing path parameter "id"/);
    expect(() => fillPath('/admin/users/{id}', { id: '' })).toThrow();
  });
});

describe('toQueryString', () => {
  it('drops empty values and sorts keys for stable URLs', () => {
    expect(toQueryString({ q: '', page: 2, status: undefined, limit: 25, active: null })).toBe(
      '?limit=25&page=2',
    );
  });

  it('serialises booleans, dates and arrays', () => {
    expect(
      toQueryString({
        isActive: false,
        from: new Date('2026-09-25T00:00:00.000Z'),
        ids: ['a', 'b'],
      }),
    ).toBe('?from=2026-09-25T00%3A00%3A00.000Z&ids=a&ids=b&isActive=false');
  });

  it('returns nothing for no parameters', () => {
    expect(toQueryString(undefined)).toBe('');
    expect(toQueryString({ q: '' })).toBe('');
  });
});
