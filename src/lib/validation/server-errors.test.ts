import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { applyServerErrors, mapServerErrors } from './server-errors';

const validation = (details: unknown, message = 'Request validation failed') =>
  new ApiError({
    status: 422,
    code: 'VALIDATION_ERROR',
    message,
    details,
    requestId: 'r-12345678',
    method: 'POST',
    path: '/x',
  });

describe('mapServerErrors', () => {
  it('maps validate() middleware issues by body path', () => {
    const mapped = mapServerErrors(
      validation([
        { location: 'body', path: 'email', code: 'invalid_string', message: 'invalid email' },
        { location: 'body', path: 'items.0.name', code: 'too_small', message: 'required' },
        { location: 'query', path: 'page', code: 'too_small', message: 'page must be positive' },
      ]),
    );
    expect(mapped).toEqual({
      fields: { email: 'Invalid email', 'items.0.name': 'Required' },
      form: ['Page must be positive'],
    });
  });

  it('maps the password policy shape onto the aliased field', () => {
    const mapped = mapServerErrors(
      validation(
        { field: 'password', issues: ['is too common', 'must not be your email address'] },
        'Password is too common',
      ),
      { aliases: { password: 'newPassword' } },
    );
    expect(mapped?.fields).toEqual({
      newPassword: 'Password is too common. Password must not be your email address',
    });
  });

  it('maps single-field service checks', () => {
    const mapped = mapServerErrors(
      validation({ field: 'newPassword' }, 'Password must be different from your current password'),
    );
    expect(mapped?.fields).toEqual({
      newPassword: 'Password must be different from your current password',
    });
  });

  it('puts errors for fields the form does not show at form level', () => {
    const mapped = mapServerErrors(
      validation([{ location: 'body', path: 'secret', message: 'nope' }]),
      { fields: ['email'] },
    );
    expect(mapped).toEqual({ fields: {}, form: ['Nope'] });
  });

  it('keeps settings rejections readable', () => {
    const mapped = mapServerErrors(
      validation(
        { rejected: ['storeName', 'gstin'], writable: [] },
        'These settings cannot be edited here',
      ),
    );
    expect(mapped?.form).toEqual(['These settings cannot be edited here: storeName, gstin']);
  });

  it('never drops an unknown shape', () => {
    expect(mapServerErrors(validation(null, 'Something specific'))?.form).toEqual([
      'Something specific',
    ]);
    expect(mapServerErrors(validation({ odd: true }, 'Odd'))?.form).toEqual(['Odd']);
  });

  it('ignores errors that are not 422', () => {
    expect(mapServerErrors(new Error('x'))).toBeNull();
    expect(
      mapServerErrors(
        new ApiError({
          status: 409,
          code: 'CONFLICT',
          message: 'm',
          requestId: 'r',
          method: 'GET',
          path: '/',
        }),
      ),
    ).toBeNull();
  });
});

describe('applyServerErrors', () => {
  it('sets errors on the form and focuses the first one', () => {
    const setError = vi.fn();
    applyServerErrors(
      validation([
        { location: 'body', path: 'email', message: 'taken' },
        { location: 'body', path: 'name', message: 'short' },
      ]),
      setError,
    );
    expect(setError).toHaveBeenNthCalledWith(
      1,
      'email',
      { type: 'server', message: 'Taken' },
      { shouldFocus: true },
    );
    expect(setError).toHaveBeenNthCalledWith(
      2,
      'name',
      { type: 'server', message: 'Short' },
      { shouldFocus: false },
    );
  });
});
