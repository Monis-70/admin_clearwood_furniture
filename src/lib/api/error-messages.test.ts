import { describe, expect, it } from 'vitest';

import { ApiError } from './errors';
import { describeError, errorReference } from './error-messages';

const error = (
  status: number,
  code: string,
  message = 'Server sentence.',
  extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
) =>
  new ApiError({
    status,
    code,
    message,
    requestId: 'req-12345678',
    method: 'GET',
    path: '/admin/x',
    ...extra,
  });

describe('describeError', () => {
  it('uses plain language for permission errors instead of the code', () => {
    const result = describeError(
      error(403, 'FORBIDDEN', 'You do not have access to this resource'),
    );
    expect(result.title).toBe("You don't have permission");
    expect(result.message).toContain("You don't have permission to perform this action");
    expect(result.retryable).toBe(false);
  });

  it('keeps human-written domain messages from the API', () => {
    const result = describeError(
      error(
        409,
        'IMPORT_FILE_MISMATCH',
        'This is not the file that was validated. Attach the same file, or validate the new one first.',
      ),
    );
    expect(result.message).toBe(
      'This is not the file that was validated. Attach the same file, or validate the new one first.',
    );
    expect(result.action).toBe('fix-input');
  });

  it('falls back to the server sentence for unknown 4xx codes', () => {
    expect(
      describeError(error(422, 'SOMETHING_NEW_FROM_THE_API', 'Pick a purchasable category.'))
        .message,
    ).toBe('Pick a purchasable category.');
  });

  it('never shows the server sentence for 5xx failures', () => {
    const result = describeError(
      error(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong: stack…'),
    );
    expect(result.message).not.toContain('stack');
    expect(result.retryable).toBe(true);
  });

  it('distinguishes retryable from final failures', () => {
    expect(describeError(error(0, 'NETWORK_ERROR')).retryable).toBe(true);
    expect(describeError(error(0, 'TIMEOUT')).retryable).toBe(true);
    expect(describeError(error(409, 'WRITE_CONFLICT')).retryable).toBe(true);
    expect(describeError(error(422, 'VALIDATION_ERROR')).retryable).toBe(false);
    expect(describeError(error(409, 'STALE_RESOURCE')).retryable).toBe(false);
  });

  it('adds the wait time from Retry-After', () => {
    expect(
      describeError(error(429, 'RATE_LIMITED', 'Too many', { retryAfterSeconds: 42 })).message,
    ).toContain('Try again in 42 seconds.');
    expect(
      describeError(error(429, 'RATE_LIMITED', 'Too many', { retryAfterSeconds: 600 })).message,
    ).toContain('about 10 minutes');
  });

  it('explains a lockout with the unlock time in IST', () => {
    const result = describeError(
      error(401, 'ACCOUNT_LOCKED', 'Too many attempts', {
        details: { lockedUntil: '2026-09-25T10:12:00.000Z' },
      }),
    );
    expect(result.message).toContain('15:42 IST');
  });

  it('handles non-API errors and aborts', () => {
    expect(describeError(new Error('boom')).title).toBe('Something went wrong');
    expect(describeError(Object.assign(new Error('x'), { name: 'AbortError' })).title).toBe(
      'Cancelled',
    );
  });

  it('references the API trace id, else the request id', () => {
    expect(errorReference(error(500, 'X', 'm', { traceId: 'trace-1' }))).toBe('trace-1');
    expect(errorReference(error(0, 'NETWORK_ERROR'))).toBe('req-12345678');
    expect(errorReference(new Error('x'))).toBeNull();
  });
});
