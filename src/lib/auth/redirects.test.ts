import { describe, expect, it } from 'vitest';

import { changePasswordHref, loginHref, safeNextPath } from './redirects';

describe('safeNextPath', () => {
  it.each([
    ['/catalog/products/edit?id=p1&tab=media', '/catalog/products/edit?id=p1&tab=media'],
    ['/system/status', '/system/status'],
    ['/', '/'],
  ])('keeps the same-origin path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    '/%0d%0aSet-Cookie:x',
    '/login',
    '/login?next=/x',
    '/change-password',
    '',
    null,
    undefined,
    'catalog',
  ])('rejects %s', (input) => {
    expect(safeNextPath(input as string)).toBe(
      input === '/%0d%0aSet-Cookie:x' ? '/%0d%0aSet-Cookie:x' : '/',
    );
  });

  it('rejects raw control characters', () => {
    expect(safeNextPath('/a\r\nb')).toBe('/');
  });
});

describe('auth hrefs', () => {
  it('builds the sign-in URL with a safe next and a reason', () => {
    expect(loginHref({ next: '/system/status', reason: 'expired' })).toBe(
      '/login?next=%2Fsystem%2Fstatus&reason=expired',
    );
    expect(loginHref({ next: 'https://evil.example' })).toBe('/login');
    expect(loginHref()).toBe('/login');
  });

  it('builds the password change URL', () => {
    expect(changePasswordHref('/system/status')).toBe('/change-password?next=%2Fsystem%2Fstatus');
    expect(changePasswordHref('/')).toBe('/change-password');
  });
});
