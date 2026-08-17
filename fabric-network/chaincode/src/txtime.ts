// fabric/chaincode/src/txtime.ts
//
// Deterministic transaction time for chaincode.
//
// WHY THIS EXISTS
// ---------------
// Two separate bugs were causing every write transaction to fail:
//
// 1. `ctx.stub.getTxTimestamp()` returns the timestamp straight off the channel
//    header, which fabric-shim 2.5 builds with google-protobuf. That object
//    exposes `getSeconds()` / `getNanos()` METHODS — it has no `.seconds` or
//    `.nanos` properties. `txTs.seconds * 1000` was therefore
//    `undefined * 1000` = NaN, and `new Date(NaN).toISOString()` threw
//    "RangeError: Invalid time value" — surfacing at the gateway as
//    `chaincode response 500, Invalid time value`. (fabric-shim's own
//    `stub.getDateTimestamp()` has exactly this bug in 2.5, so don't use it.)
//
// 2. The attempted workaround — using `new Date()` (peer wall-clock time) —
//    is NON-DETERMINISTIC. Under this channel's OutOf(2, Hospital, Practitioner,
//    Patient) endorsement policy the transaction is executed independently on
//    two or more peers. Each peer would stamp a slightly different time, produce
//    a different read-write set, and the mismatched endorsements would be
//    rejected at validation (ENDORSEMENT_POLICY_FAILURE).
//
// The transaction timestamp is set once by the client in the proposal, so every
// endorsing peer observes the identical value. That is the only correct source
// of time for a value that gets written to the ledger.

import { Context } from 'fabric-contract-api';

/**
 * Read a protobuf scalar that may be exposed either as a getter method
 * (google-protobuf, which is what fabric-shim 2.5 uses) or as a plain field
 * (protobufjs). Tries the getter first, then the property.
 */
function readField(message: any, getter: string, property: string): unknown {
  if (message && typeof message[getter] === 'function') {
    return message[getter]();
  }
  return message ? message[property] : undefined;
}

/**
 * Coerce a protobuf numeric field to a JS number.
 * Handles plain numbers, strings, Long objects (`.toNumber()`), and raw
 * `{ low, high }` pairs — every shape these libraries have been seen to return.
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? NaN : parsed;
  }
  if (value && typeof value === 'object') {
    const obj = value as { toNumber?: () => number; low?: number; high?: number };
    if (typeof obj.toNumber === 'function') {
      try {
        return obj.toNumber();
      } catch {
        /* fall through to low/high reconstruction */
      }
    }
    if (typeof obj.low === 'number') {
      const high = typeof obj.high === 'number' ? obj.high : 0;
      // Long is a signed 64-bit value split into two 32-bit halves.
      return high * 4294967296 + (obj.low >>> 0);
    }
  }
  return NaN;
}

/**
 * Milliseconds since the Unix epoch for the current transaction.
 * Identical on every endorsing peer.
 */
export function txTimeMillis(ctx: Context): number {
  const ts = ctx.stub.getTxTimestamp() as any;
  if (!ts) {
    throw new Error('Transaction timestamp unavailable — cannot produce a deterministic time');
  }

  const rawSeconds = readField(ts, 'getSeconds', 'seconds');
  const seconds = toNumber(rawSeconds);
  if (!Number.isFinite(seconds)) {
    throw new Error(
      `Transaction timestamp has an unreadable "seconds" field (${JSON.stringify(rawSeconds)})`,
    );
  }

  const nanosRaw = toNumber(readField(ts, 'getNanos', 'nanos'));
  const nanos = Number.isFinite(nanosRaw) ? nanosRaw : 0;

  const millis = seconds * 1000 + Math.floor(nanos / 1_000_000);
  if (!Number.isFinite(millis)) {
    throw new Error(`Computed an invalid transaction time (seconds=${seconds}, nanos=${nanos})`);
  }
  return millis;
}

/** ISO-8601 string for the current transaction time. Safe to write to the ledger. */
export function txTimeISO(ctx: Context): string {
  return new Date(txTimeMillis(ctx)).toISOString();
}
