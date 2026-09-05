/**
 * Startup validation for the secrets the system cannot safely run without.
 *
 * WHY THIS EXISTS. JWT_SECRET previously defaulted to the literal
 * 'healthcare_jwt_secret' in three separate files. That string is committed to a
 * public repository, so any deployment that forgot to set the variable would
 * boot successfully while signing tokens with a secret the whole internet can
 * read — allowing anyone to forge a session for any user, including a clinician
 * with access to patient records. A missing secret has to be loud.
 *
 * The rule below distinguishes the two cases honestly:
 *
 *   production   — a missing or obviously-weak secret aborts startup. Refusing
 *                  to boot is far better than serving forgeable tokens.
 *   development  — a generated ephemeral secret is used and a warning printed,
 *                  so `bun run dev` still works on a fresh clone without a
 *                  .env, but nothing insecure is ever silently reused. Because
 *                  it is regenerated per process, existing tokens stop working
 *                  on restart, which is the visible reminder to set the variable.
 */

import { randomBytes } from 'crypto';

const isProduction = process.env.NODE_ENV === 'production';

/** Secrets previously shipped as fallbacks; never acceptable now. */
const KNOWN_WEAK = new Set([
  'healthcare_jwt_secret',
  'secret',
  'changeme',
  'development',
]);

function requireSecret(name: string, minLength: number): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    if (isProduction) {
      throw new Error(
        `${name} is not set. Refusing to start in production — see .env.example. ` +
        `Generate one with: openssl rand -base64 48`,
      );
    }
    const ephemeral = randomBytes(48).toString('base64');
    console.warn(
      `[env] ${name} is not set. Using a random value for this process only; ` +
      `sessions will not survive a restart. Set it in backend/.env.`,
    );
    return ephemeral;
  }

  if (isProduction && KNOWN_WEAK.has(value.trim().toLowerCase())) {
    throw new Error(
      `${name} is set to a well-known placeholder value. Refusing to start in ` +
      `production — this secret is public. Generate one with: openssl rand -base64 48`,
    );
  }

  if (isProduction && value.length < minLength) {
    throw new Error(
      `${name} is shorter than ${minLength} characters. Refusing to start in production.`,
    );
  }

  return value;
}

/** Signing key for session tokens. */
export const JWT_SECRET = requireSecret('JWT_SECRET', 32);

/**
 * Key for encrypting personal and clinical fields at rest.
 *
 * services/crypto.ts pads this to the 32 bytes AES-256 requires, which means a
 * short key is zero-padded rather than rejected. That is convenient in
 * development and dangerous in production, so the length is enforced here
 * instead.
 */
export const AES_SECRET_KEY = requireSecret('AES_SECRET_KEY', 32);
