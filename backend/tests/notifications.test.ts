/**
 * Unit tests for the SSE half of services/notifications.ts — the in-memory
 * registry of open client connections.
 *
 *   bun test
 *
 * This is the channel that reaches a web portal already open on someone's
 * screen. It is pure in-process state, so it tests without a database, a
 * network or a browser.
 *
 * The push half of that module (pushToUser / sendPushNotification) is not
 * covered here: it queries device_tokens and calls Expo's servers, so it needs
 * a database and network. Its behaviour is exercised separately.
 *
 * Two properties carry real consequences:
 *
 *   ISOLATION      A notification addressed to one user must never be written
 *                  to another user's stream. In this system an access-request
 *                  event names a patient, so a leak here is a privacy breach.
 *   FAULT TOLERANCE  A browser that closed without unsubscribing leaves a dead
 *                  stream behind. Writing to it throws, and that must not stop
 *                  the remaining recipients from being notified.
 */

import { describe, expect, test } from "bun:test";
import { addConnection, notifyUser, activeConnectionCount } from "../src/services/notifications";

/** A fake SSE stream that records what was written to it. */
function fakeStream() {
  const writes: string[] = [];
  let closed = false;
  return {
    writes,
    get closed() { return closed; },
    stream: {
      write: (d: string) => { writes.push(d); },
      close: () => { closed = true; },
    },
  };
}

/** A stream whose write always throws, as a dead connection's does. */
function deadStream() {
  return { write: () => { throw new Error("client gone"); }, close: () => {} };
}

/** Parse the SSE wire format: "event: <name>\ndata: <json>\n\n". */
function parseSse(raw: string) {
  const event = raw.match(/^event: (.+)$/m)?.[1];
  const data = raw.match(/^data: (.+)$/m)?.[1];
  return { event, data: data ? JSON.parse(data) : null };
}

/** Unique ids per test, since the registry is module-level state. */
let n = 0;
const uid = (label: string) => `${label}-${++n}`;

// ── delivery ─────────────────────────────────────────────────────────────────

describe("notifyUser", () => {
  test("writes a well-formed SSE frame to a connected user", () => {
    const user = uid("patient");
    const s = fakeStream();
    const cleanup = addConnection(user, s.stream);

    notifyUser(user, "access_request", { requestId: "req-1" });

    expect(s.writes.length).toBe(1);
    const { event, data } = parseSse(s.writes[0]);
    expect(event).toBe("access_request");
    expect(data).toEqual({ requestId: "req-1" });
    // The blank line terminator is what makes EventSource dispatch the event.
    expect(s.writes[0].endsWith("\n\n")).toBe(true);

    cleanup();
  });

  test("delivers to every device the same user has open", () => {
    // A patient with the portal open on a laptop and a tablet should see the
    // request on both.
    const user = uid("patient");
    const a = fakeStream(), b = fakeStream();
    const ca = addConnection(user, a.stream);
    const cb = addConnection(user, b.stream);

    notifyUser(user, "access_request", { requestId: "req-2" });

    expect(a.writes.length).toBe(1);
    expect(b.writes.length).toBe(1);

    ca(); cb();
  });

  test("never writes to a different user's stream", () => {
    // The privacy property: these payloads name patients.
    const alice = uid("alice"), bob = uid("bob");
    const sa = fakeStream(), sb = fakeStream();
    const ca = addConnection(alice, sa.stream);
    const cb = addConnection(bob, sb.stream);

    notifyUser(alice, "access_request", { requestId: "for-alice" });

    expect(sa.writes.length).toBe(1);
    expect(sb.writes.length).toBe(0);

    ca(); cb();
  });

  test("a user with no open connection is a silent no-op, not an error", () => {
    // Ordinary case: the patient is not looking at the portal. The push channel
    // covers them; this must not throw and abort the surrounding request.
    expect(() => notifyUser(uid("absent"), "access_request", { requestId: "x" })).not.toThrow();
  });

  test("serialises the payload as JSON on a single line", () => {
    // A raw newline inside data would split the frame and corrupt the stream.
    const user = uid("patient");
    const s = fakeStream();
    const cleanup = addConnection(user, s.stream);

    notifyUser(user, "access_request", { message: "Line one\nLine two", quote: 'He said "hello"' });

    const body = s.writes[0];
    expect(body.split("\n").filter((l) => l.startsWith("data: ")).length).toBe(1);
    expect(parseSse(body).data.message).toBe("Line one\nLine two");

    cleanup();
  });
});

// ── lifecycle ────────────────────────────────────────────────────────────────

describe("connection lifecycle", () => {
  test("the cleanup function stops further delivery", () => {
    const user = uid("patient");
    const s = fakeStream();
    const cleanup = addConnection(user, s.stream);

    notifyUser(user, "e1", {});
    cleanup();
    notifyUser(user, "e2", {});

    expect(s.writes.length).toBe(1);
  });

  test("closing one of two connections leaves the other receiving", () => {
    const user = uid("patient");
    const a = fakeStream(), b = fakeStream();
    const ca = addConnection(user, a.stream);
    const cb = addConnection(user, b.stream);

    ca();
    notifyUser(user, "access_request", {});

    expect(a.writes.length).toBe(0);
    expect(b.writes.length).toBe(1);

    cb();
  });

  test("cleanup is idempotent", () => {
    const user = uid("patient");
    const s = fakeStream();
    const cleanup = addConnection(user, s.stream);
    expect(() => { cleanup(); cleanup(); }).not.toThrow();
  });

  test("activeConnectionCount tracks opens and closes", () => {
    const before = activeConnectionCount();
    const c1 = addConnection(uid("a"), fakeStream().stream);
    const c2 = addConnection(uid("b"), fakeStream().stream);
    expect(activeConnectionCount()).toBe(before + 2);

    c1();
    expect(activeConnectionCount()).toBe(before + 1);
    c2();
    expect(activeConnectionCount()).toBe(before);
  });
});

// ── dead connections ─────────────────────────────────────────────────────────

describe("dead connections", () => {
  test("a stream that throws does not prevent the others being notified", () => {
    // A browser tab closed without unsubscribing. The remaining recipients must
    // still receive the event.
    const user = uid("patient");
    const good = fakeStream();
    const cDead = addConnection(user, deadStream());
    const cGood = addConnection(user, good.stream);

    expect(() => notifyUser(user, "access_request", { requestId: "req" })).not.toThrow();
    expect(good.writes.length).toBe(1);

    cDead(); cGood();
  });

  test("a throwing stream is dropped from the registry", () => {
    // Otherwise every future notification pays for a connection that is gone.
    const user = uid("patient");
    const cDead = addConnection(user, deadStream());
    const before = activeConnectionCount();

    notifyUser(user, "e", {});

    expect(activeConnectionCount()).toBe(before - 1);
    cDead();
  });
});
