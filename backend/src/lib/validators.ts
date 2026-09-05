/**
 * Reusable field validators.
 *
 * WHY THESE EXIST. Several fields whose names imply a format were validated only
 * as `z.string()`, which accepts anything at all — a date of birth of "banana",
 * a phone number of "abc", a national ID of "'; DROP TABLE". Nothing downstream
 * re-checked them, so the value was encrypted and stored exactly as typed, and
 * the error surfaced later as an unreadable record rather than a rejected form.
 *
 * Defined once and shared so a format cannot drift between the two routes that
 * accept the same field.
 *
 * A NOTE ON STRICTNESS. These are deliberately permissive at the edges. Real
 * clinical data is messy: a patient may present without an NRC, a phone number
 * may be written with or without spaces, and a refugee or newborn may have no
 * national ID at all. Validation that rejects a real patient at the registration
 * desk is worse than validation that accepts an odd-looking string — so the
 * rules below reject what is clearly wrong (letters in a phone number, an
 * impossible date) rather than insisting on a canonical form.
 */

import { z } from '@hono/zod-openapi';

/**
 * Zambian phone number.
 *
 * Accepts +260…, 0…, or bare digits, with spaces or hyphens as written. The
 * point is to reject letters and punctuation, not to impose one house style.
 */
export const phoneNumber = z
  .string()
  .trim()
  .min(9, 'Phone number is too short')
  .max(20, 'Phone number is too long')
  .regex(/^\+?[0-9][0-9\s-]{7,18}$/, 'Enter a valid phone number, digits only');

/**
 * Zambian National Registration Card number: 123456/78/1.
 *
 * Optional throughout the system — a patient can be registered without one, and
 * minors generally have none — so this validates the format only when a value
 * is actually supplied.
 */
export const nationalId = z
  .string()
  .trim()
  .regex(/^\d{6}\/\d{2}\/\d{1,2}$/, 'National ID must look like 123456/78/1');

/**
 * A calendar date, ISO 8601 (1990-01-01).
 *
 * `z.string().date()` alone would accept 2099-01-01 as a date of birth, so the
 * range is checked too: nobody in a clinical system was born before 1900 or in
 * the future. Both bounds have been genuine data-entry errors in real systems —
 * a mistyped year is the commonest.
 */
export const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'That date does not exist');

/** A date of birth: a real date, not in the future, within a human lifespan. */
export const dateOfBirth = isoDate.refine(
  (v) => {
    const d = new Date(v);
    const now = new Date();
    const oldest = new Date();
    oldest.setFullYear(now.getFullYear() - 130);
    return d <= now && d >= oldest;
  },
  'Date of birth must be in the past and within the last 130 years',
);

/** A future-dated value, such as a medication expiry. */
export const futureDate = isoDate.refine(
  (v) => new Date(v) >= new Date(new Date().toDateString()),
  'That date is already in the past',
);

/** A date that may sit either side of today — onset, diagnosis, last visit. */
export const clinicalDate = isoDate.refine(
  (v) => {
    const d = new Date(v);
    const oldest = new Date();
    oldest.setFullYear(oldest.getFullYear() - 130);
    const soon = new Date();
    soon.setFullYear(soon.getFullYear() + 1);
    return d >= oldest && d <= soon;
  },
  'That date is implausible',
);

/** An email address. Bare `z.string()` accepted "not-an-email". */
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254, 'Email address is too long');

/**
 * A person's name.
 *
 * Permits letters, spaces, apostrophes and hyphens — Zambian names include
 * forms like N'gandu and Mwape-Chanda — and rejects digits and symbols. Not
 * restricted to ASCII, because a name is not required to be English.
 */
export const personName = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(80, 'Too long')
  .regex(/^[\p{L}][\p{L}\s'’.-]*$/u, 'Use letters only');

/** A positive whole number: quantities, counts, bed capacity. */
export const positiveInt = z
  .number()
  .int('Must be a whole number')
  .positive('Must be greater than zero');

/** A non-negative whole number, where zero is meaningful (stock on hand). */
export const nonNegativeInt = z
  .number()
  .int('Must be a whole number')
  .min(0, 'Cannot be negative');

/**
 * Free clinical text — notes, findings, reasons.
 *
 * Bounded so a single field cannot be used to push megabytes into the database
 * or into a hashed record. Not otherwise restricted: clinical notes legitimately
 * contain numbers, punctuation and abbreviations.
 */
export const clinicalText = (max = 5000) =>
  z.string().trim().min(1, 'Required').max(max, `Must be under ${max} characters`);

/**
 * Vital signs, as bounds rather than exact values.
 *
 * The ranges are wide on purpose: they exclude the physically impossible and
 * the obviously mistyped, not the abnormal. A temperature of 41.5 °C is a real
 * emergency and must be recordable; 410 is a missing decimal point.
 */
export const vitals = {
  temperatureC: z.number().min(25, 'Too low to be real').max(45, 'Too high to be real'),
  pulseBpm: z.number().int().min(20, 'Too low to be real').max(300, 'Too high to be real'),
  systolic: z.number().int().min(40).max(300),
  diastolic: z.number().int().min(20).max(200),
  respiratoryRate: z.number().int().min(4).max(80),
  oxygenSaturation: z.number().min(50).max(100),
  weightKg: z.number().min(0.3, 'Too low to be real').max(400),
  heightCm: z.number().min(20).max(260),
};

/**
 * Coerce a query-string number.
 *
 * Query parameters arrive as strings, so `z.number()` would reject every one.
 * `z.coerce.number()` alone accepts "" as 0 and "abc" as NaN, so the pipeline
 * below rejects anything that is not actually numeric.
 */
export const queryInt = (opts: { min?: number; max?: number; default?: number } = {}) => {
  let schema = z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .refine((n) => Number.isFinite(n), 'Must be a number');
  if (opts.min !== undefined) schema = schema.min(opts.min) as any;
  if (opts.max !== undefined) schema = schema.max(opts.max) as any;
  return opts.default !== undefined ? schema.default(opts.default) : schema;
};
