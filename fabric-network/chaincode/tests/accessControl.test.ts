/**
 * Unit tests for the AccessControl chaincode — the consent mechanism that
 * objective 3 rests on.
 *
 *   cd fabric-network/chaincode && bun test
 *
 * These run against an in-memory stub of the Fabric Context rather than a live
 * network, so they execute in milliseconds and need no peers, no orderer and no
 * certificates. The stub implements only the surface the contract actually
 * touches: world state, transaction identity, transaction time and events.
 *
 * What these tests are for: proving the four properties objective 3 claims —
 * patient-only control, grant, revoke, and time-bounding — hold in the contract
 * logic itself, independently of the REST layer above it.
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { AccessControlContract } from "../src/accessControl";

// ── in-memory Fabric Context stub ────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;

function makeCtx(opts: {
  mspId?: string;
  patientAttr?: string | null;
  /** Transaction time. Fabric sets this once per proposal, so it is fixed here. */
  nowMs?: number;
} = {}) {
  const state = new Map<string, Uint8Array>();
  const events: { name: string; payload: any }[] = [];
  const nowMs = opts.nowMs ?? Date.parse("2026-09-03T10:00:00.000Z");

  const ctx: any = {
    // Mirrors google-protobuf's shape: getters, not plain fields. txtime.ts
    // exists precisely because fabric-shim 2.5 returns this form.
    stub: {
      getTxTimestamp: () => ({
        getSeconds: () => Math.floor(nowMs / 1000),
        getNanos: () => (nowMs % 1000) * 1_000_000,
      }),
      getTxID: () => "tx-" + state.size,
      getState: async (k: string) => state.get(k) ?? new Uint8Array(),
      putState: async (k: string, v: Uint8Array) => { state.set(k, v); },
      createCompositeKey: (objectType: string, attrs: string[]) =>
        `${objectType}\u0000${attrs.join("\u0000")}`,
      getStateByPartialCompositeKey: async function* () { /* no history needed here */ },
      getStateByRange: async function* () { /* no range scans needed here */ },
      setEvent: (name: string, payload: Uint8Array) => {
        events.push({ name, payload: JSON.parse(Buffer.from(payload).toString()) });
      },
    },
    clientIdentity: {
      getID: () => "x509::/CN=test",
      getMSPID: () => opts.mspId ?? "PatientOrgMSP",
      getAttributeValue: (_a: string) =>
        opts.patientAttr === undefined ? null : opts.patientAttr,
    },
  };

  return { ctx, state, events, nowMs };
}

/** Read a permission back out of the stubbed world state. */
function readPerm(state: Map<string, Uint8Array>, patient: string, practitioner: string) {
  const raw = state.get(`PERM_${patient}_${practitioner}`);
  return raw && raw.length ? JSON.parse(Buffer.from(raw).toString()) : null;
}

const PATIENT = "patient-chanda";
const DOCTOR = "practitioner-mwape";

let contract: AccessControlContract;
beforeEach(() => { contract = new AccessControlContract(); });

// ── who may grant ────────────────────────────────────────────────────────────

describe("patient-only control", () => {
  test("a practitioner cannot grant themselves access", async () => {
    const { ctx } = makeCtx({ mspId: "PractitionerOrgMSP" });
    await expect(contract.grantPermission(ctx, PATIENT, DOCTOR, "24")).rejects.toThrow(
      /only patients can manage permissions/i,
    );
  });

  test("a hospital cannot grant access on a patient's behalf", async () => {
    const { ctx } = makeCtx({ mspId: "HospitalOrgMSP" });
    await expect(contract.grantPermission(ctx, PATIENT, DOCTOR, "24")).rejects.toThrow(
      /only patients can manage permissions/i,
    );
  });

  test("a patient certificate cannot act for a different patient", async () => {
    const { ctx } = makeCtx({ patientAttr: "patient-someone-else" });
    await expect(contract.grantPermission(ctx, PATIENT, DOCTOR, "24")).rejects.toThrow(
      /cannot act as/i,
    );
  });

  test("the patient themselves may grant", async () => {
    const { ctx, state } = makeCtx({ patientAttr: PATIENT });
    await contract.grantPermission(ctx, PATIENT, DOCTOR, "24");
    expect(readPerm(state, PATIENT, DOCTOR)?.active).toBe(true);
  });
});

// ── time-bounding — objective 3's headline property ──────────────────────────

describe("time-bound access", () => {
  test("expiry is derived from transaction time, not wall-clock", async () => {
    // Determinism matters: under an OutOf(2,...) endorsement policy the same
    // transaction executes on several peers, and each must compute an identical
    // expiry or the endorsements will not match at validation.
    const { ctx, state, nowMs } = makeCtx();
    await contract.grantPermission(ctx, PATIENT, DOCTOR, "24");

    const perm = readPerm(state, PATIENT, DOCTOR);
    expect(Date.parse(perm.grantedAt)).toBe(nowMs);
    expect(Date.parse(perm.expiresAt)).toBe(nowMs + 24 * HOUR);
  });

  test("two peers executing the same transaction derive the same expiry", async () => {
    const a = makeCtx({ nowMs: Date.parse("2026-09-03T10:00:00.000Z") });
    const b = makeCtx({ nowMs: Date.parse("2026-09-03T10:00:00.000Z") });
    await contract.grantPermission(a.ctx, PATIENT, DOCTOR, "24");
    await contract.grantPermission(b.ctx, PATIENT, DOCTOR, "24");
    expect(readPerm(a.state, PATIENT, DOCTOR).expiresAt)
      .toBe(readPerm(b.state, PATIENT, DOCTOR).expiresAt);
  });

  test("access is granted before expiry", async () => {
    const grant = makeCtx();
    await contract.grantPermission(grant.ctx, PATIENT, DOCTOR, "24");

    // A later transaction, 23 hours on, sharing the same world state.
    const later = makeCtx({ nowMs: grant.nowMs + 23 * HOUR });
    later.state.set(`PERM_${PATIENT}_${DOCTOR}`, grant.state.get(`PERM_${PATIENT}_${DOCTOR}`)!);

    expect(await contract.checkPermission(later.ctx, PATIENT, DOCTOR)).toBe(true);
  });

  test("access lapses on its own once the window passes — no revoke needed", async () => {
    const grant = makeCtx();
    await contract.grantPermission(grant.ctx, PATIENT, DOCTOR, "24");

    const later = makeCtx({ nowMs: grant.nowMs + 25 * HOUR });
    later.state.set(`PERM_${PATIENT}_${DOCTOR}`, grant.state.get(`PERM_${PATIENT}_${DOCTOR}`)!);

    expect(await contract.checkPermission(later.ctx, PATIENT, DOCTOR)).toBe(false);
  });

  test("rejects a non-positive or unparseable duration", async () => {
    for (const bad of ["0", "-4", "abc", ""]) {
      const { ctx } = makeCtx();
      await expect(contract.grantPermission(ctx, PATIENT, DOCTOR, bad)).rejects.toThrow(
        /invalid durationhours/i,
      );
    }
  });
});

// ── revocation ───────────────────────────────────────────────────────────────

describe("revocation", () => {
  test("revoking makes a live permission fail the check immediately", async () => {
    const { ctx, state } = makeCtx();
    await contract.grantPermission(ctx, PATIENT, DOCTOR, "24");
    expect(await contract.checkPermission(ctx, PATIENT, DOCTOR)).toBe(true);

    await contract.revokePermission(ctx, PATIENT, DOCTOR);
    expect(await contract.checkPermission(ctx, PATIENT, DOCTOR)).toBe(false);
    expect(readPerm(state, PATIENT, DOCTOR).active).toBe(false);
  });

  test("revoking keeps the record rather than deleting it, preserving the trail", async () => {
    const { ctx, state } = makeCtx();
    await contract.grantPermission(ctx, PATIENT, DOCTOR, "24");
    await contract.revokePermission(ctx, PATIENT, DOCTOR);

    const perm = readPerm(state, PATIENT, DOCTOR);
    expect(perm).not.toBeNull();
    expect(perm.grantedAt).toBeDefined();
    expect(perm.active).toBe(false);
  });

  test("revoking something never granted is an error, not a silent no-op", async () => {
    const { ctx } = makeCtx();
    await expect(contract.revokePermission(ctx, PATIENT, DOCTOR)).rejects.toThrow(/not found/i);
  });

  test("a practitioner cannot revoke — only the patient controls the grant", async () => {
    const granted = makeCtx();
    await contract.grantPermission(granted.ctx, PATIENT, DOCTOR, "24");

    const attacker = makeCtx({ mspId: "PractitionerOrgMSP" });
    attacker.state.set(`PERM_${PATIENT}_${DOCTOR}`, granted.state.get(`PERM_${PATIENT}_${DOCTOR}`)!);

    await expect(contract.revokePermission(attacker.ctx, PATIENT, DOCTOR)).rejects.toThrow(
      /only patients can manage permissions/i,
    );
  });
});

// ── default deny ─────────────────────────────────────────────────────────────

describe("default deny", () => {
  test("an unknown pairing has no access", async () => {
    const { ctx } = makeCtx();
    expect(await contract.checkPermission(ctx, PATIENT, "practitioner-stranger")).toBe(false);
  });

  test("a grant to one practitioner does not leak to another", async () => {
    const { ctx } = makeCtx();
    await contract.grantPermission(ctx, PATIENT, DOCTOR, "24");
    expect(await contract.checkPermission(ctx, PATIENT, "practitioner-other")).toBe(false);
  });
});

// ── emitted events ───────────────────────────────────────────────────────────

describe("events", () => {
  test("grant and revoke each emit an auditable event", async () => {
    const { ctx, events } = makeCtx();
    await contract.grantPermission(ctx, PATIENT, DOCTOR, "24");
    await contract.revokePermission(ctx, PATIENT, DOCTOR);

    const actions = events.map((e) => e.payload.action);
    expect(actions).toContain("grant");
    expect(actions).toContain("revoke");
  });
});
