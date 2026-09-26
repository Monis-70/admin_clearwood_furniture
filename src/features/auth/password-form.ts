import { z } from 'zod';

import { PASSWORD_MIN_LENGTH, changePasswordSchema } from '@shared/schemas/auth';

/** The API's own schema plus the confirmation, which never leaves the browser. */
export const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string().min(1, 'Repeat the new password') })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two new passwords do not match',
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from the current one',
  });

/** Mirrors the server policy; the server may still refuse and explain why. */
export const PASSWORD_GUIDANCE = [
  `At least ${PASSWORD_MIN_LENGTH} characters`,
  'Not a common password',
  'Not your email address or phone number',
  'Not one character repeated',
];
