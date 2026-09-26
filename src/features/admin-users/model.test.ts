import { describe, expect, it } from 'vitest';

import { ADMIN_ROLE_CODES } from '@shared/enums';

import { STANDARD_ROLES, SUPER_ADMIN } from './model';

describe('STANDARD_ROLES', () => {
  it('offers every built-in role of the contract except Super Admin', () => {
    expect(STANDARD_ROLES.map((role) => role.code)).toEqual(
      ADMIN_ROLE_CODES.filter((code) => code !== SUPER_ADMIN),
    );
  });
});
