/**
 * Unit tests for txtime.ts — deterministic transaction time.
 *
 *   cd fabric-network/chaincode && bun test
 *
 * Small file, disproportionate consequences. Every write in every contract
 * timestamps itself through this, and two properties must hold:
 *
 *   DETERMINISM   Under an OutOf(2,...) endorsement policy the same transaction
 *                 executes on several peers. Each must compute an identical
 *                 time, or their read-write sets differ and the transaction
 *                 fails validation. That is why Date.now() must never appear in
 *                 a contract.
 *
 *   SHAPE TOLERANCE  The timestamp comes off the channel header, and the
 *                 libraries that build it disagree about representation:
 *                 google-protobuf exposes getSeconds()/getNanos() METHODS,
 *                 protobufjs exposes Long objects with { low, high }, and some
 *                 paths yield plain numbers or strings. Reading `.seconds`
 *                 directly returned undefined and made every write fail — the
 *                 defect this module was written to fix.
 *
 * The tests below pin each of those shapes, so a library upgrade that changes
 * the representation fails here rather than silently in production.
 */

import { describe, expect, test } from "bun:test";
import { txTimeMillis, txTimeISO } from "../src/txtime";

const WHEN = Date.parse("2026-09-03T10:00:00.000Z");

/** Build a context whose getTxTimestamp returns the given object. */
const ctxWith = (ts: any): any => ({ stub: { getTxTimestamp: () => ts } });

// ── the shapes Fabric actually returns ───────────────────────────────────────

describe("timestamp representations", () => {
  test("google-protobuf style: getSeconds()/getNanos() methods", () => {
    // The shape fabric-shim 2.5 produces, and the one that broke the original
    // implementation because it has no .seconds property at all.
    const ctx = ctxWith({
      getSeconds: () => Math.floor(WHEN / 1000),
      getNanos: () => (WHEN % 1000) * 1_000_000,
    });
    expect(txTimeMillis(ctx)).toBe(WHEN);
  });

  test("plain numeric fields", () => {
    const ctx = ctxWith({ seconds: Math.floor(WHEN / 1000), nanos: (WHEN % 1000) * 1_000_000 });
    expect(txTimeMillis(ctx)).toBe(WHEN);
  });

  test("string fields, as JSON round-tripping produces", () => {
    const ctx = ctxWith({ seconds: String(Math.floor(WHEN / 1000)), nanos: String((WHEN % 1000) * 1_000_000) });
    expect(txTimeMillis(ctx)).toBe(WHEN);
  });

  test("protobufjs Long with a toNumber() method", () => {
    const secs = Math.floor(WHEN / 1000);
    const ctx = ctxWith({ seconds: { toNumber: () => secs }, nanos: 0 });
    expect(txTimeMillis(ctx)).toBe(secs * 1000);
  });

  test("Long as { low, high } when toNumber is absent", () => {
    const secs = Math.floor(WHEN / 1000);
    const ctx = ctxWith({
      seconds: { low: secs & 0xffffffff, high: Math.floor(secs / 4294967296) },
      nanos: 0,
    });
    expect(txTimeMillis(ctx)).toBe(secs * 1000);
  });

  test("nanosecond precision is truncated to whole milliseconds", () => {
    // Fabric reports nanoseconds; JavaScript Dates are millisecond-resolution.
    // Truncation must be consistent, or two peers could round differently.
    const ctx = ctxWith({ seconds: 1000, nanos: 999_999 }); // 0.999999 ms
    expect(txTimeMillis(ctx)).toBe(1_000_000);
  });
});

// ── determinism ──────────────────────────────────────────────────────────────

describe("determinism across peers", () => {
  test("the same timestamp yields the same millisecond value every time", () => {
    const make = () => ctxWith({
      getSeconds: () => Math.floor(WHEN / 1000),
      getNanos: () => (WHEN % 1000) * 1_000_000,
    });
    const results = [txTimeMillis(make()), txTimeMillis(make()), txTimeMillis(make())];
    expect(new Set(results).size).toBe(1);
  });

  test("does not fall back to wall-clock time", () => {
    // If this ever returned Date.now(), two peers endorsing the same proposal
    // would disagree and the transaction would fail at validation. The value
    // must come from the header and nowhere else.
    const ctx = ctxWith({ seconds: 1_600_000_000, nanos: 0 });
    expect(txTimeMillis(ctx)).toBe(1_600_000_000_000);
    expect(txTimeMillis(ctx)).not.toBeCloseTo(Date.now(), -5);
  });
});

// ── failure is loud ──────────────────────────────────────────────────────────

describe("unusable timestamps throw rather than guess", () => {
  test("throws when the timestamp is missing entirely", () => {
    // Silently substituting the current time here would reintroduce
    // non-determinism, so an absent timestamp must fail the transaction.
    expect(() => txTimeMillis(ctxWith(null))).toThrow(/unavailable/i);
    expect(() => txTimeMillis(ctxWith(undefined))).toThrow(/unavailable/i);
  });

  test("throws when seconds cannot be interpreted", () => {
    for (const bad of [{ seconds: "not-a-number", nanos: 0 }, { seconds: {}, nanos: 0 }, { nanos: 0 }]) {
      expect(() => txTimeMillis(ctxWith(bad))).toThrow();
    }
  });

  test("treats unusable nanos as zero rather than failing the whole write", () => {
    // Sub-millisecond precision is not worth aborting a clinical write over.
    const ctx = ctxWith({ seconds: 1000, nanos: "rubbish" });
    expect(txTimeMillis(ctx)).toBe(1_000_000);
  });
});

// ── ISO formatting ───────────────────────────────────────────────────────────

describe("txTimeISO", () => {
  test("formats as an ISO-8601 UTC string", () => {
    const ctx = ctxWith({
      getSeconds: () => Math.floor(WHEN / 1000),
      getNanos: () => (WHEN % 1000) * 1_000_000,
    });
    expect(txTimeISO(ctx)).toBe("2026-09-03T10:00:00.000Z");
  });

  test("round-trips back to the same millisecond value", () => {
    const ctx = ctxWith({ seconds: Math.floor(WHEN / 1000), nanos: 0 });
    expect(Date.parse(txTimeISO(ctx))).toBe(txTimeMillis(ctx));
  });
});
