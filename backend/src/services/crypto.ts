/**
 * Cryptographic helpers for data at rest and for integrity anchoring.
 *
 * Two distinct jobs live here and they must not be confused:
 *
 *   encrypt/decrypt      — confidentiality. Reversible. Used for PII and
 *                          clinical text so a database dump yields ciphertext.
 *   hashData/generateRecordHash
 *                        — integrity. One-way. Used to anchor a fingerprint of
 *                          a record on the blockchain so later tampering with
 *                          the PostgreSQL row becomes detectable.
 *
 * The ledger never receives plaintext or ciphertext — only hashes.
 */

import crypto from 'crypto';

/*
 * NOTE ON THE CIPHER MODE.
 *
 * This is AES-256 in CBC mode, which provides confidentiality only. It does
 * NOT authenticate the ciphertext: a modified ciphertext will still decrypt
 * (into garbage, or into an attacker-influenced value) rather than raising an
 * error. GCM would add that authentication tag.
 *
 * Integrity of clinical records is instead obtained separately, by anchoring
 * generateRecordHash() on-chain and re-verifying it on read — see
 * RecordContract.verifyRecordHash in the chaincode.
 *
 * Changing this to aes-256-gcm is a BREAKING change: every existing row was
 * written in CBC and would fail to decrypt. It needs a migration that decrypts
 * with CBC and re-encrypts with GCM, not a one-line edit.
 */
const ALGORITHM = 'aes-256-cbc';

/*
 * AES-256 requires exactly 32 bytes of key. padEnd/slice coerces whatever is in
 * the environment to that length, which means a short AES_SECRET_KEY is padded
 * with zero characters rather than rejected — convenient in development, but it
 * silently weakens the key. Production deployments should supply a full-length
 * random secret.
 */
const SECRET_KEY = process.env.AES_SECRET_KEY!.padEnd(32, '0').slice(0, 32);

/**
 * Encrypt a UTF-8 string for storage.
 *
 * A fresh random initialisation vector is generated per call, so encrypting the
 * same value twice yields different ciphertext. That prevents an observer
 * inferring equality between rows (for example, spotting that two patients
 * share a surname) — but it also means encrypted columns cannot be searched or
 * indexed by equality. Lookups must use a deterministic identifier instead:
 * the national-ID hash, the blockchain address, or the hospital patient number.
 *
 * Returned format is `<iv-hex>:<ciphertext-hex>`; the IV is not secret and must
 * be stored alongside the ciphertext in order to decrypt.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Reverse of encrypt(). Splits the stored value back into its IV and
 * ciphertext halves.
 *
 * Throws if the key differs from the one used to encrypt, or if the stored
 * value is malformed. Callers that decrypt many rows at once generally wrap
 * this in try/catch so one unreadable row cannot fail an entire listing.
 */
export function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** SHA-256 of an arbitrary string, hex encoded. Also used for password-free
 *  deterministic identifiers such as the national-ID lookup key. */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Serialise a value to canonical JSON: object keys sorted at EVERY level, so
 * the same data always produces the same string regardless of insertion order.
 *
 * This replaced `JSON.stringify(data, Object.keys(data).sort())`. That form
 * looked like it only reordered keys, but an ARRAY replacer is an allowlist
 * that JSON.stringify applies at every level of the tree — and the keys of a
 * nested object are never in a list built from the top-level keys. Nested
 * objects therefore serialised as `{}` and their contents never reached the
 * digest, so two records differing only inside a nested object produced an
 * identical hash and tampering there was undetectable. See the regression test
 * in tests/crypto.test.ts.
 *
 * Semantics deliberately match JSON.stringify so that flat records — every
 * caller except the client-supplied payload at POST /records/verify — hash
 * byte-identically to before, leaving already-anchored hashes valid:
 *   · toJSON() is honoured first, so Date and Drizzle timestamps behave as before
 *   · undefined, functions and symbols are dropped from objects, null in arrays
 *   · non-finite numbers serialise as null
 */
function canonicalJson(value: unknown): string {
  if (value !== null && typeof value === 'object' &&
      typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    value = (value as { toJSON: () => unknown }).toJSON();
  }

  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return Number.isFinite(value) ? String(value) : 'null';
    case 'boolean':
      return String(value);
    case 'bigint':
      // Matches JSON.stringify, which refuses to guess a representation.
      throw new TypeError('Do not know how to serialize a BigInt');
    case 'object':
      break;
    default:
      // undefined, function, symbol — only reachable as an array element here,
      // where JSON.stringify emits null.
      return 'null';
  }

  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }

  const obj = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue;
    parts.push(JSON.stringify(key) + ':' + canonicalJson(v));
  }
  return '{' + parts.join(',') + '}';
}

/**
 * Fingerprint a record for anchoring on the blockchain.
 *
 * The hash must be reproducible: verifying a record later means recomputing
 * this over the retrieved row and comparing it with the value committed to the
 * ledger. Plain JSON.stringify is not reproducible, because object key order
 * follows insertion order and can differ between the write path and the read
 * path — hence the canonical form above, which sorts keys at every depth.
 */
export function generateRecordHash(recordData: object): string {
  return hashData(canonicalJson(recordData));
}
