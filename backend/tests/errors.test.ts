/**
 * Unit tests for lib/errors.ts — the boundary between internal failures and
 * what a client is told.
 *
 *   bun test
 *
 * Every route funnels its failures through handleError, so this file is a
 * security boundary as much as an ergonomics helper. Two properties matter:
 *
 *   NOTHING INTERNAL ESCAPES.  A database error mentioning a table name, a
 *   connection string, or a constraint is useful to an attacker mapping the
 *   system. Only AppError — which a developer wrote deliberately for a user to
 *   read — is forwarded verbatim. Everything else is replaced.
 *
 *   THE CATEGORY IS HONEST.  A Fabric failure must not read as data loss. The
 *   system deliberately lets ledger anchoring fail while the clinical write
 *   succeeds, so its message says the action was saved but not anchored. Telling
 *   a clinician their note failed, when it did not, would cause them to write it
 *   twice.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { AppError, handleError } from "../src/lib/errors";

/** Minimal stand-in for Hono's Context: handleError only ever calls c.json. */
function fakeCtx() {
  const calls: { body: any; status: number }[] = [];
  return {
    calls,
    c: { json: (body: any, status: number) => { calls.push({ body, status }); return { body, status }; } } as any,
  };
}

/** handleError always logs server-side; keep the suite output readable. */
let originalError: typeof console.error;
beforeEach(() => { originalError = console.error; console.error = () => {}; });
afterEach(() => { console.error = originalError; });

/** Run an error through handleError and return what the client would receive. */
function respond(err: unknown) {
  const { c, calls } = fakeCtx();
  handleError(err, c);
  return calls[0];
}

// ── deliberate messages are forwarded ────────────────────────────────────────

describe("AppError", () => {
  test("forwards the developer's message and status verbatim", () => {
    const res = respond(new AppError("Patient already has a pending request", 409));
    expect(res.body).toEqual({ success: false, error: { message: "Patient already has a pending request" } });
    expect(res.status).toBe(409);
  });

  test("defaults to 400 when no status is given", () => {
    expect(respond(new AppError("Invalid consent duration")).status).toBe(400);
  });

  test("carries the statuses routes actually use", () => {
    for (const code of [400, 401, 403, 404, 409, 422]) {
      expect(respond(new AppError("x", code)).status).toBe(code);
    }
  });
});

// ── nothing internal escapes ─────────────────────────────────────────────────

describe("internal detail never reaches the client", () => {
  const leaky = [
    'relation "patients" does not exist',
    'duplicate key value violates unique constraint "patients_national_id_key"',
    'column "password_hash" of relation "practitioners" does not exist',
    "connect ECONNREFUSED 127.0.0.1:5432",
    'null value in column "institution_id" violates not-null constraint',
    "syntax error at or near \"SELECT\"",
    "insert or update on table \"visits\" violates foreign key constraint",
  ];

  test("database errors are replaced with a generic message", () => {
    for (const msg of leaky) {
      const res = respond(new Error(msg));
      expect(res.status).toBe(500);
      expect(res.body.error.message).toBe(
        "A data error occurred. Please try again or contact support if the problem persists.",
      );
    }
  });

  test("no response echoes a table, column, constraint or host from the error", () => {
    // The property that actually matters: whatever the internals said, none of
    // it appears in what the client is handed.
    const forbidden = /patients|practitioners|visits|institution_id|password_hash|5432|127\.0\.0\.1|constraint|SELECT/i;
    for (const msg of leaky) {
      expect(respond(new Error(msg)).body.error.message).not.toMatch(forbidden);
    }
  });

  test("a raw stack trace is never forwarded", () => {
    const err = new Error("Unexpected token < in JSON at position 0");
    err.stack = "Error: secret\n    at /home/brian/Project/backend/src/db/schema.ts:412:9";
    const res = respond(err);
    expect(res.body.error.message).not.toContain("schema.ts");
    expect(res.body.error.message).not.toContain("/home/brian");
    expect(JSON.stringify(res.body)).not.toContain("stack");
  });

  test("a thrown non-Error is handled without crashing", () => {
    for (const thrown of ["a string", 42, null, undefined, { weird: true }]) {
      const res = respond(thrown);
      expect(res.status).toBe(500);
      expect(typeof res.body.error.message).toBe("string");
    }
  });
});

// ── the category is honest ───────────────────────────────────────────────────

describe("classification", () => {
  test("a ledger failure says the action was SAVED but not anchored", () => {
    // The system anchors hashes asynchronously and deliberately lets that fail
    // rather than losing a clinical write. The message must reflect that, or a
    // clinician will re-enter a note that was already stored.
    for (const msg of [
      "chaincode response 500",
      "failed to endorse transaction",
      "orderer unavailable",
      "peer unreachable",
      "MSP identity not found",
    ]) {
      const res = respond(new Error(msg));
      expect(res.body.error.message).toMatch(/saved but could not be anchored/i);
    }
  });

  test("an auth failure tells the user to sign in again", () => {
    for (const msg of ["jwt expired", "invalid signature", "JsonWebTokenError: malformed token"]) {
      expect(respond(new Error(msg)).body.error.message).toMatch(/sign in again/i);
    }
  });

  test("a timeout is reported as a timeout, not as data loss", () => {
    for (const msg of ["ETIMEDOUT", "request timed out", "Query timeout"]) {
      expect(respond(new Error(msg)).body.error.message).toMatch(/took too long/i);
    }
  });

  test("a Zod validation error asks the user to check their inputs", () => {
    const zodLike: any = new Error("Validation failed");
    zodLike.name = "ZodError";
    zodLike.issues = [{ path: ["durationHours"], message: "Expected number" }];
    expect(respond(zodLike).body.error.message).toMatch(/data is invalid/i);
  });

  test("an unrecognised error falls back to the generic message", () => {
    expect(respond(new Error("something nobody anticipated")).body.error.message).toMatch(
      /unexpected error occurred/i,
    );
  });
});

// ── response shape ───────────────────────────────────────────────────────────

describe("response shape", () => {
  test("every error response is { success: false, error: { message } }", () => {
    // The web portal and mobile app both read err.response.data.error.message;
    // a differently-shaped response renders as a blank error to the user.
    for (const err of [
      new AppError("deliberate", 403),
      new Error("relation \"x\" does not exist"),
      new Error("chaincode failed"),
      "not even an error",
    ]) {
      const res = respond(err);
      expect(res.body.success).toBe(false);
      expect(typeof res.body.error.message).toBe("string");
      expect(res.body.error.message.length).toBeGreaterThan(0);
    }
  });

  test("non-AppError failures are always 500, never a misleading 200", () => {
    for (const err of [new Error("boom"), new Error("chaincode down"), "string"]) {
      expect(respond(err).status).toBe(500);
    }
  });
});
