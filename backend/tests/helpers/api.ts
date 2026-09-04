/**
 * Helpers for driving the real Hono app in-process.
 *
 * The app is imported rather than served over a socket, so requests go through
 * genuine routing, middleware, validation and database access without binding a
 * port. Responses come back as real Response objects.
 */

import { and, desc, eq } from "drizzle-orm";

import app from "../../src/index";
import { db } from "../../src/db";
import { otpCodes } from "../../src/db/schema";

type Json = Record<string, unknown>;

async function send(method: string, path: string, opts: { body?: unknown; token?: string; raw?: string } = {}) {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
  };
  if (opts.raw !== undefined) init.body = opts.raw;
  else if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  const res = await (app as any).fetch(new Request(`http://localhost${path}`, init));
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

export const api = {
  get: (path: string, token?: string) => send("GET", path, { token }),
  post: (path: string, body?: unknown, token?: string) => send("POST", path, { body, token }),
  patch: (path: string, body?: unknown, token?: string) => send("PATCH", path, { body, token }),
  del: (path: string, body?: unknown, token?: string) => send("DELETE", path, { body, token }),
  /** Send a body verbatim, for testing malformed input. */
  postRaw: (path: string, raw: string) => send("POST", path, { raw }),
};

/**
 * Sign in a member of staff and return a usable bearer token.
 *
 * Staff login is two-step: the password check issues a one-time code by email
 * rather than a token, so this completes the second step by reading the code
 * out of the database — the same code the email would have carried.
 *
 * That keeps the test on the real path. Bypassing 2FA by minting a token
 * directly would leave the verification step permanently untested, and it is
 * the step that decides whether a stolen password alone is enough.
 */
export async function loginStaff(licenseNumber: string, password: string): Promise<string> {
  const first = await api.post("/api/auth/login/staff", { licenseNumber, password });
  if (first.status !== 200) {
    throw new Error(`login failed (${first.status}): ${JSON.stringify(first.body)}`);
  }

  // Some accounts skip OTP and receive a token immediately.
  const direct = first.body?.data?.token ?? first.body?.data?.accessToken;
  if (direct) return direct;

  const userId = first.body?.data?.userId as string;
  if (!userId) throw new Error(`no userId in login response: ${JSON.stringify(first.body)}`);

  const [code] = await db
    .select({ code: otpCodes.code })
    .from(otpCodes)
    .where(and(eq(otpCodes.userId, userId), eq(otpCodes.used, false)))
    .orderBy(desc(otpCodes.expiresAt))
    .limit(1);

  if (!code) throw new Error("login issued no OTP code");

  const second = await api.post("/api/auth/verify-otp", {
    userId,
    userType: "staff",
    otp: code.code,
  });

  const token = second.body?.data?.token ?? second.body?.data?.accessToken;
  if (!token) throw new Error(`OTP verification returned no token: ${JSON.stringify(second.body)}`);
  return token;
}
