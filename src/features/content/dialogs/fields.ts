import { z } from 'zod';

/* Form field rules shared by the CMS dialogs (kept apart so list screens don't load zod). */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'URL slug is required')
  .max(140)
  .regex(SLUG, 'Use lowercase words joined by single dashes, e.g. summer-sale');

/** The shared rule: a relative path, or an https:// address. '' means not set. */
export const optionalLink = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || (v.startsWith('/') && !v.startsWith('//')) || /^https:\/\/[^\s/]+/i.test(v),
    'Use a path starting with / or an https:// address',
  )
  .transform((v) => (v === '' ? null : v));

export const optionalHex = z
  .string()
  .trim()
  .refine((v) => v === '' || /^#[0-9a-fA-F]{6}$/.test(v), 'Use a colour like #1f2937')
  .transform((v) => (v === '' ? null : v));

export const optionalMediaId = z
  .string()
  .trim()
  .max(40)
  .transform((v) => (v === '' ? null : v));

/** Ids typed one per line (or comma separated) to a de-duplicated array; empty means none. */
export const idLines = (max: number) =>
  z
    .string()
    .transform((v) => [
      ...new Set(
        v
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ])
    .refine((list) => list.length <= max, `At most ${max}`)
    .refine((list) => list.every((id) => id.length <= 40), 'Each id is at most 40 characters');
