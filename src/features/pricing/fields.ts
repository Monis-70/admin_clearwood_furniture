import { z } from 'zod';

const PERCENT = /^\d{1,3}(\.\d{1,2})?$/;

/** A percentage typed by a person ("12.5") as basis points (1250); '' is "not set". */
export const optionalPercentBp = (label = 'Percentage') =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || PERCENT.test(v), `${label}: enter a percentage like 10 or 12.5`)
    .transform((v) => (v === '' ? null : Math.round(Number(v) * 100)))
    .refine((v) => v === null || v <= 10_000, `${label}: at most 100%`);
