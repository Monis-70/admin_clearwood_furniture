import { describe, expect, it } from 'vitest';

import { PAGINATION } from '@shared/constants';

import { MAX_LIMIT, PAGE_SIZES } from './use-list-params';

describe('list paging limits', () => {
  it('match the backend contract', () => {
    expect(MAX_LIMIT).toBe(PAGINATION.MAX_LIMIT);
    expect(Math.max(...PAGE_SIZES)).toBeLessThanOrEqual(PAGINATION.MAX_LIMIT);
  });
});
