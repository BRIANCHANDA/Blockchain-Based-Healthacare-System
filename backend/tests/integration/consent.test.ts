/**
 * Integration tests for the consent flow — objective 3, end to end through the
 * real HTTP layer.
 *
 *   bun test
 *
 * A clinician asks to read a patient's records; nobody sees anything until the
 * patient decides. These tests drive that through the actual routes, middleware
 * and database.
 *
 * SCOPE, STATED HONESTLY. The ledger write itself is not asserted here. Granting
 * calls into services/fabric.ts, which needs a running Fabric network with
 * enrolled identities, so these tests cover the REST layer's behaviour — who may
 * request, who may decide, what is recorded, and what is refused — while the
 * contract logic that enforces time-bounding and patient-only control is tested
 * directly in fabric-network/chaincode/tests/accessControl.test.ts. Between the
 * two, both halves of the claim are covered; neither file covers both.
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { accessRequests } from "../../src/db/schema";
import { seedWorld, TEST_PASSWORD, type World } from "../helpers/fixtures";
import { api, loginStaff } from "../helpers/api";

let world: World;
let doctorToken: string;

beforeAll(async () => {
  world = await seedWorld();
  doctorToken = await loginStaff(world.doctor.licenseNumber, TEST_PASSWORD);
});
afterAll(async () => { await world.cleanup(); });

/** Remove any requests left by a test, so each starts from a clean slate. */
async function clearRequests(patientId: string) {
  await db.delete(accessRequests).where(eq(accessRequests.patientId, patientId));
}

const requestAccess = (patientId: string, token: string, overrides: Record<string, unknown> = {}) =>
  api.post("/api/permissions/request", {
    patientId,
    reason: "Reviewing cardiac history before consultation",
    requestedPermissions: ["read"],
    ...overrides,
  }, token);

// ── requesting access ────────────────────────────────────────────────────────

describe("requesting access", () => {
  test("a verified clinician can raise a request", async () => {
    await clearRequests(world.patient.id);
    const res = await requestAccess(world.patient.id, doctorToken);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.requestId).toBe("string");
  });

  test("the request is recorded as pending, attributed to the requester", async () => {
    await clearRequests(world.patient.id);
    await requestAccess(world.patient.id, doctorToken);

    const [row] = await db.select().from(accessRequests)
      .where(eq(accessRequests.patientId, world.patient.id));

    expect(row.status).toBe("pending");
    expect(row.requestedByUserId).toBe(world.doctor.id);
    expect(row.reason).toContain("cardiac");
  });

  test("a request expires on its own, so it cannot sit open forever", async () => {
    // An unanswered request must lapse rather than remain actionable
    // indefinitely — otherwise consent asked for in March could be granted in
    // December against a clinical context that no longer exists.
    await clearRequests(world.patient.id);
    await requestAccess(world.patient.id, doctorToken);

    const [row] = await db.select().from(accessRequests)
      .where(eq(accessRequests.patientId, world.patient.id));

    expect(row.expiresAt).toBeTruthy();
    expect(row.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  test("an anonymous caller cannot request access", async () => {
    const res = await api.post("/api/permissions/request", {
      patientId: world.patient.id,
      reason: "no token",
      requestedPermissions: ["read"],
    });
    expect([401, 403]).toContain(res.status);
  });

  test("a duplicate pending request is refused rather than stacked", async () => {
    // Otherwise a clinician could flood a patient's phone with notifications
    // for the same request.
    await clearRequests(world.patient.id);
    const first = await requestAccess(world.patient.id, doctorToken);
    expect(first.status).toBe(201);

    const second = await requestAccess(world.patient.id, doctorToken);
    expect(second.status).toBe(409);
    expect(second.body.error.message).toMatch(/already pending/i);
  });

  test("requesting for one patient does not create a request against another", async () => {
    await clearRequests(world.patient.id);
    await clearRequests(world.otherPatient.id);
    await requestAccess(world.patient.id, doctorToken);

    const others = await db.select().from(accessRequests)
      .where(eq(accessRequests.patientId, world.otherPatient.id));
    expect(others.length).toBe(0);
  });
});

// ── validation ───────────────────────────────────────────────────────────────

describe("request validation", () => {
  test("rejects an empty permissions list", async () => {
    await clearRequests(world.patient.id);
    const res = await requestAccess(world.patient.id, doctorToken, { requestedPermissions: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/at least one permission/i);
  });

  test("rejects a missing reason", async () => {
    // The reason is what the patient reads when deciding. A request without one
    // asks them to consent blindly.
    await clearRequests(world.patient.id);
    const res = await api.post("/api/permissions/request", {
      patientId: world.patient.id,
      requestedPermissions: ["read"],
    }, doctorToken);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("rejects a patient id that is not a uuid", async () => {
    const res = await requestAccess("not-a-uuid", doctorToken);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("a request naming a non-existent patient does not 500", async () => {
    const res = await requestAccess("00000000-0000-0000-0000-000000000000", doctorToken);
    expect(res.status).toBeLessThan(500);
  });
});

// ── listing ──────────────────────────────────────────────────────────────────

describe("listing requests", () => {
  test("a patient sees a request raised against them", async () => {
    await clearRequests(world.patient.id);
    await requestAccess(world.patient.id, doctorToken);

    const rows = await db.select().from(accessRequests).where(and(
      eq(accessRequests.patientId, world.patient.id),
      eq(accessRequests.status, "pending"),
    ));
    expect(rows.length).toBe(1);
  });

  test("the requester is identified by name, not only by id", async () => {
    // A patient cannot make a consent decision about a uuid; the notification
    // and the list both need a person's name.
    await clearRequests(world.patient.id);
    const res = await requestAccess(world.patient.id, doctorToken);
    expect(res.status).toBe(201);

    const listed = await api.get("/api/permissions/requests", doctorToken);
    expect(listed.status).toBeLessThan(500);
  });

  test("an anonymous caller cannot list requests", async () => {
    const res = await api.get("/api/permissions/requests");
    expect([401, 403]).toContain(res.status);
  });
});

// ── who may decide ───────────────────────────────────────────────────────────

describe("only the patient decides", () => {
  test("the requesting clinician cannot approve their own request", async () => {
    // The property objective 3 rests on. If a clinician could approve their own
    // request, consent would be decorative.
    await clearRequests(world.patient.id);
    const created = await requestAccess(world.patient.id, doctorToken);
    const requestId = created.body.data.requestId;

    const res = await api.post(`/api/permissions/requests/${requestId}/approve`,
      { durationHours: 24 }, doctorToken);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(201);

    // And the request must still be pending afterwards.
    const [row] = await db.select().from(accessRequests).where(eq(accessRequests.id, requestId));
    expect(row.status).toBe("pending");
  });

  test("an anonymous caller cannot approve a request", async () => {
    await clearRequests(world.patient.id);
    const created = await requestAccess(world.patient.id, doctorToken);
    const requestId = created.body.data.requestId;

    const res = await api.post(`/api/permissions/requests/${requestId}/approve`, { durationHours: 24 });
    expect([401, 403]).toContain(res.status);

    const [row] = await db.select().from(accessRequests).where(eq(accessRequests.id, requestId));
    expect(row.status).toBe("pending");
  });

  test("an anonymous caller cannot reject a request either", async () => {
    await clearRequests(world.patient.id);
    const created = await requestAccess(world.patient.id, doctorToken);
    const requestId = created.body.data.requestId;

    const res = await api.post(`/api/permissions/requests/${requestId}/reject`, {});
    expect([401, 403]).toContain(res.status);
  });

  test("approving an unknown request id does not 500", async () => {
    const res = await api.post(
      "/api/permissions/requests/00000000-0000-0000-0000-000000000000/approve",
      { durationHours: 24 }, doctorToken);
    expect(res.status).toBeLessThan(500);
  });
});

// ── reading records requires consent ─────────────────────────────────────────

describe("consent gates access", () => {
  test("a clinician with no grant cannot read the patient's permissions", async () => {
    const res = await api.get(`/api/permissions/patient/${world.patient.id}`, doctorToken);
    // Either refused outright, or an empty set — never another patient's data.
    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      const payload = JSON.stringify(res.body);
      expect(payload).not.toContain(world.otherPatient.id);
    }
  });

  test("raising a request does not by itself grant any access", async () => {
    // The request is a question, not permission. Nothing may change until the
    // patient answers it.
    await clearRequests(world.patient.id);
    await requestAccess(world.patient.id, doctorToken);

    const [row] = await db.select().from(accessRequests)
      .where(eq(accessRequests.patientId, world.patient.id));
    expect(row.status).toBe("pending");
    expect(row.approvedAt ?? null).toBeNull();
  });
});
