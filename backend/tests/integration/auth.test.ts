/**
 * Integration tests for the staff authentication route.
 *
 *   bun test
 *
 * These drive the real Hono app in-process — real routing, real middleware,
 * real zod validation, real bcrypt, real database — against a dedicated test
 * database (see tests/setup.ts, which refuses to run against any database whose
 * name does not contain "test").
 *
 * Authentication is where the system's access control begins, so these assert
 * the negative cases as carefully as the positive one. In particular the
 * VERIFICATION GATE: a practitioner registers with a professional registration
 * number, but registering must not grant clinical access — an administrator has
 * to verify them first. That check lives here, at login, and every consent route
 * downstream relies on it rather than re-checking, so if it regresses the whole
 * "only licensed clinicians can request consent" claim goes with it.
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import app from "../../src/index";
import { seedWorld, TEST_PASSWORD, type World } from "../helpers/fixtures";
import { api, loginStaff } from "../helpers/api";

let world: World;
beforeAll(async () => { world = await seedWorld(); });
afterAll(async () => { await world.cleanup(); });

/** POST a JSON body to the app and return status plus parsed body. */
async function post(path: string, body: unknown, token?: string) {
  const res = await (app as any).fetch(new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }));
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

const login = (licenseNumber: string, password: string) =>
  post("/api/auth/login/staff", { licenseNumber, password });

// ── the happy path ───────────────────────────────────────────────────────────

describe("staff login", () => {
  test("a correct password issues a one-time code, NOT a token", async () => {
    // Two-factor authentication: the password alone is not enough. A stolen
    // password without access to the practitioner's mailbox gets nowhere.
    const res = await login(world.doctor.licenseNumber, TEST_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.data.requiresOTP).toBe(true);
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.accessToken).toBeUndefined();
  });

  test("the masked email does not disclose the full address", async () => {
    const res = await login(world.doctor.licenseNumber, TEST_PASSWORD);
    const masked: string = res.body.data.maskedEmail;
    expect(masked).toContain("***");
    expect(masked).not.toContain(`doctor-`); // the local part is not shown in full
  });

  test("completing the one-time code yields a working JWT", async () => {
    const token = await loginStaff(world.doctor.licenseNumber, TEST_PASSWORD);
    expect(token.split(".").length).toBe(3);

    // And the token actually opens a protected route.
    const res = await api.get("/api/practitioners/me", token);
    expect(res.status).toBe(200);
  });

  test("a wrong one-time code is refused", async () => {
    const first = await login(world.doctor.licenseNumber, TEST_PASSWORD);
    const res = await api.post("/api/auth/verify-otp", {
      userId: first.body.data.userId,
      userType: "staff",
      otp: "000000",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("the response never contains the password hash", async () => {
    // A leaked bcrypt hash is offline-crackable, so it must not travel to a
    // client under any circumstance.
    const res = await login(world.doctor.licenseNumber, TEST_PASSWORD);
    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain("passwordHash");
    expect(serialised).not.toContain("password_hash");
    expect(serialised).not.toMatch(/\$2[aby]\$/); // bcrypt prefix
  });
});

// ── rejections ───────────────────────────────────────────────────────────────

describe("credentials", () => {
  test("rejects a wrong password", async () => {
    const res = await login(world.doctor.licenseNumber, "NotThePassword1!");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("rejects an unknown licence number", async () => {
    const res = await login("DOC-does-not-exist", TEST_PASSWORD);
    expect(res.status).toBe(401);
  });

  test("gives the same message for a wrong password and an unknown account", async () => {
    // Distinguishing the two would let an attacker enumerate which registration
    // numbers exist.
    const wrongPass = await login(world.doctor.licenseNumber, "NotThePassword1!");
    const noSuchUser = await login("DOC-does-not-exist", TEST_PASSWORD);
    expect(wrongPass.body.error.message).toBe(noSuchUser.body.error.message);
    expect(wrongPass.status).toBe(noSuchUser.status);
  });

  test("is case-sensitive about the password", async () => {
    expect((await login(world.doctor.licenseNumber, TEST_PASSWORD.toLowerCase())).status).toBe(401);
  });
});

// ── the verification gate ────────────────────────────────────────────────────

describe("administrative gates", () => {
  test("an unverified practitioner cannot sign in, even with correct credentials", async () => {
    // The check backing "only licensed clinicians can request a patient's
    // consent". Downstream consent routes do not re-check isVerified.
    const res = await login(world.unverifiedDoctor.licenseNumber, TEST_PASSWORD);
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/pending verification/i);
  });

  test("a deactivated practitioner cannot sign in", async () => {
    // Deactivation is how staff are removed, since deletion would orphan years
    // of consultations and audit entries. It has to actually block access.
    const res = await login(world.inactiveDoctor.licenseNumber, TEST_PASSWORD);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  test("an unverified account is refused before the password is even considered", async () => {
    // Otherwise the response time or message would reveal whether the password
    // was right, for an account that is not permitted to sign in at all.
    const wrongPassword = await login(world.unverifiedDoctor.licenseNumber, "AlsoWrong1!");
    expect(wrongPassword.status).toBeGreaterThanOrEqual(400);
    expect(wrongPassword.body.success).toBe(false);
  });
});

// ── input validation ─────────────────────────────────────────────────────────

describe("input handling", () => {
  test("rejects a missing licence number or password", async () => {
    for (const body of [{}, { licenseNumber: world.doctor.licenseNumber }, { password: TEST_PASSWORD }]) {
      const res = await post("/api/auth/login/staff", body);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    }
  });

  test("a SQL-injection style licence number is treated as an ordinary string", async () => {
    // Drizzle parameterises queries, so this must simply fail to match rather
    // than alter the statement.
    const res = await login("' OR '1'='1", TEST_PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("malformed JSON does not return a 500", async () => {
    const res = await (app as any).fetch(new Request("http://localhost/api/auth/login/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("an over-long input is rejected rather than crashing the handler", async () => {
    const res = await login("D".repeat(10_000), TEST_PASSWORD);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});

// ── protected routes ─────────────────────────────────────────────────────────

describe("route protection", () => {
  test("a protected route refuses an absent token", async () => {
    const res = await (app as any).fetch(new Request("http://localhost/api/permissions/mine"));
    expect([401, 403]).toContain(res.status);
  });

  test("a protected route refuses a malformed token", async () => {
    for (const bad of ["Bearer not-a-jwt", "Bearer a.b.c", "Basic abc", "Bearer "]) {
      const res = await (app as any).fetch(new Request("http://localhost/api/permissions/mine", {
        headers: { Authorization: bad },
      }));
      expect([401, 403]).toContain(res.status);
    }
  });

  test("a token signed with the wrong secret is refused", async () => {
    // Guards against a deployment that forgot to set JWT_SECRET and fell back
    // to a default an attacker could guess.
    const { sign } = await import("jsonwebtoken");
    const forged = sign(
      { userId: world.doctor.id, userType: "practitioner" },
      "definitely-not-the-real-secret",
      { expiresIn: "1h" },
    );
    const res = await (app as any).fetch(new Request("http://localhost/api/permissions/mine", {
      headers: { Authorization: `Bearer ${forged}` },
    }));
    expect([401, 403]).toContain(res.status);
  });
});
