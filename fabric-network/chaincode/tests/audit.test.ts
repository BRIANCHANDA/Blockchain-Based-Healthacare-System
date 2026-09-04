/**
 * Unit tests for the AuditContract — the tamper-evident access log.
 *
 *   cd fabric-network/chaincode && bun test
 *
 * The claim being tested is that a patient can see who actually opened their
 * record, rather than who an institution says did. That holds only if:
 *
 *   · the log is append-only — the contract exposes no update or delete;
 *   · a patient can read their own log and nobody else's;
 *   · an organisation outside the network cannot read the log at all;
 *   · failed access attempts are recorded too, not just successful ones.
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { AuditContract } from "../src/audit";
import { makeCtx, readState, NUL } from "./fabricStub";

const PATIENT = "patient-chanda";
const OTHER = "patient-banda";
const RECORD = "visit-2026-a3f2";

/** A patient's own identity string contains their patient id. */
const asPatient = (id: string) => ({ mspId: "PatientOrgMSP", clientId: `x509::/CN=${id}` });

let contract: AuditContract;
beforeEach(() => { contract = new AuditContract(); });

// ── writing entries ──────────────────────────────────────────────────────────

describe("logAccess", () => {
  test("records who accessed what, and when", async () => {
    const { ctx, state, nowMs } = makeCtx({ mspId: "PractitionerOrgMSP", clientId: "x509::/CN=dr-mwape" });
    await contract.logAccess(ctx, PATIENT, RECORD, "READ_CONSULTATION", "true");

    const key = [...state.keys()].find((k) => k.startsWith(`AUDIT_${PATIENT}_`))!;
    const entry = readState(state, key)!;

    expect(entry.patientId).toBe(PATIENT);
    expect(entry.recordId).toBe(RECORD);
    expect(entry.action).toBe("READ_CONSULTATION");
    expect(entry.accessedBy).toBe("x509::/CN=dr-mwape");
    expect(entry.accessorMSP).toBe("PractitionerOrgMSP");
    expect(Date.parse(entry.timestamp)).toBe(nowMs);
  });

  test("records a DENIED attempt as well as a successful one", async () => {
    // An audit log that only contains successes hides exactly the events an
    // investigation cares about.
    const { ctx, state } = makeCtx({ mspId: "PractitionerOrgMSP" });
    await contract.logAccess(ctx, PATIENT, RECORD, "READ_DENIED", "false");

    const key = [...state.keys()].find((k) => k.startsWith(`AUDIT_${PATIENT}_`))!;
    expect(readState(state, key)?.success).toBe(false);
  });

  test("success is only true for the exact string 'true'", async () => {
    for (const v of ["false", "TRUE", "1", "yes", ""]) {
      const { ctx, state } = makeCtx({ mspId: "PractitionerOrgMSP" });
      await contract.logAccess(ctx, PATIENT, RECORD, "READ", v);
      const key = [...state.keys()].find((k) => k.startsWith(`AUDIT_${PATIENT}_`))!;
      expect(readState(state, key)?.success).toBe(false);
    }
  });

  test("timestamps come from transaction time, so peers agree", async () => {
    // Under a multi-peer endorsement policy every peer must produce an identical
    // entry, or the read-write sets will not match at validation.
    const fixed = Date.parse("2026-09-03T10:00:00.000Z");
    const a = makeCtx({ mspId: "HospitalOrgMSP", nowMs: fixed });
    const b = makeCtx({ mspId: "HospitalOrgMSP", nowMs: fixed });

    const ra = JSON.parse(await contract.logAccess(a.ctx, PATIENT, RECORD, "READ", "true"));
    const rb = JSON.parse(await contract.logAccess(b.ctx, PATIENT, RECORD, "READ", "true"));
    expect(ra.timestamp).toBe(rb.timestamp);
  });

  test("emits an AccessLogged event", async () => {
    const { ctx, events } = makeCtx({ mspId: "PractitionerOrgMSP" });
    await contract.logAccess(ctx, PATIENT, RECORD, "READ", "true");

    const ev = events.find((e) => e.name === "AccessLogged");
    expect(ev).toBeDefined();
    expect(ev!.payload).toMatchObject({ patientId: PATIENT, action: "READ" });
  });

  test("indexes entries under a per-patient composite key", async () => {
    const { ctx, state } = makeCtx({ mspId: "PractitionerOrgMSP" });
    await contract.logAccess(ctx, PATIENT, RECORD, "READ", "true");
    expect([...state.keys()].some((k) => k.startsWith(`PatientAudit${NUL}${PATIENT}`))).toBe(true);
  });
});

// ── append-only ──────────────────────────────────────────────────────────────

describe("the log is append-only", () => {
  test("the contract exposes no way to update or delete an entry", async () => {
    // Structural guard: if someone later adds a mutator, this fails and forces
    // a conversation about whether the log is still evidence.
    const methods = Object.getOwnPropertyNames(AuditContract.prototype);
    const mutators = methods.filter((m) => /delete|remove|update|edit|clear|purge/i.test(m));
    expect(mutators).toEqual([]);
  });

  test("repeated accesses accumulate rather than overwrite", async () => {
    const shared = new Map();
    for (const action of ["READ_VITALS", "READ_DIAGNOSIS", "READ_PRESCRIPTION"]) {
      const { ctx } = makeCtx({ mspId: "PractitionerOrgMSP", state: shared });
      await contract.logAccess(ctx, PATIENT, RECORD, action, "true");
    }

    const reader = makeCtx({ ...asPatient(PATIENT), state: shared });
    const logs = JSON.parse(await contract.getPatientAuditLog(reader.ctx, PATIENT));
    expect(logs.length).toBe(3);
    expect(logs.map((l: any) => l.action).sort()).toEqual(
      ["READ_DIAGNOSIS", "READ_PRESCRIPTION", "READ_VITALS"],
    );
  });
});

// ── read authorisation ───────────────────────────────────────────────────────

describe("who may read the log", () => {
  test("a patient may read their own log", async () => {
    const shared = new Map();
    const writer = makeCtx({ mspId: "PractitionerOrgMSP", state: shared });
    await contract.logAccess(writer.ctx, PATIENT, RECORD, "READ", "true");

    const reader = makeCtx({ ...asPatient(PATIENT), state: shared });
    const logs = JSON.parse(await contract.getPatientAuditLog(reader.ctx, PATIENT));
    expect(logs.length).toBe(1);
  });

  test("a patient cannot read another patient's log", async () => {
    // The central privacy property of the audit trail.
    const reader = makeCtx(asPatient(OTHER));
    await expect(contract.getPatientAuditLog(reader.ctx, PATIENT)).rejects.toThrow(
      /only read their own/i,
    );
  });

  test("an organisation outside the network cannot read any log", async () => {
    const { ctx } = makeCtx({ mspId: "SomeOtherOrgMSP" });
    await expect(contract.getPatientAuditLog(ctx, PATIENT)).rejects.toThrow(/access denied/i);
  });

  test("hospital and practitioner orgs may read for compliance purposes", async () => {
    const shared = new Map();
    const writer = makeCtx({ mspId: "PractitionerOrgMSP", state: shared });
    await contract.logAccess(writer.ctx, PATIENT, RECORD, "READ", "true");

    for (const msp of ["HospitalOrgMSP", "PractitionerOrgMSP"]) {
      const reader = makeCtx({ mspId: msp, state: shared });
      const logs = JSON.parse(await contract.getPatientAuditLog(reader.ctx, PATIENT));
      expect(logs.length).toBe(1);
    }
  });

  test("an empty log is an empty list, not an error", async () => {
    const reader = makeCtx(asPatient(PATIENT));
    expect(JSON.parse(await contract.getPatientAuditLog(reader.ctx, PATIENT))).toEqual([]);
  });
});

// ── ordering and filtering ───────────────────────────────────────────────────

describe("reading the log", () => {
  test("entries come back newest first", async () => {
    const shared = new Map();
    const base = Date.parse("2026-09-03T10:00:00.000Z");
    for (const [i, action] of ["FIRST", "SECOND", "THIRD"].entries()) {
      const { ctx } = makeCtx({ mspId: "PractitionerOrgMSP", state: shared, nowMs: base + i * 60_000 });
      await contract.logAccess(ctx, PATIENT, RECORD, action, "true");
    }

    const reader = makeCtx({ ...asPatient(PATIENT), state: shared });
    const logs = JSON.parse(await contract.getPatientAuditLog(reader.ctx, PATIENT));
    expect(logs.map((l: any) => l.action)).toEqual(["THIRD", "SECOND", "FIRST"]);
  });

  test("one patient's entries never appear in another's log", async () => {
    const shared = new Map();
    for (const p of [PATIENT, OTHER, PATIENT]) {
      const { ctx } = makeCtx({ mspId: "PractitionerOrgMSP", state: shared });
      await contract.logAccess(ctx, p, RECORD, "READ", "true");
    }

    const reader = makeCtx({ ...asPatient(PATIENT), state: shared });
    const logs = JSON.parse(await contract.getPatientAuditLog(reader.ctx, PATIENT));
    expect(logs.length).toBe(2);
    expect(logs.every((l: any) => l.patientId === PATIENT)).toBe(true);
  });

  test("a date range rejects unparseable dates rather than returning everything", async () => {
    const reader = makeCtx({ mspId: "HospitalOrgMSP" });
    await expect(
      contract.getAuditLogByDateRange(reader.ctx, PATIENT, "not-a-date", "also-not"),
    ).rejects.toThrow(/valid iso date/i);
  });

  test("a date range returns only entries inside the window", async () => {
    const shared = new Map();
    const day = (d: string) => Date.parse(`2026-09-${d}T10:00:00.000Z`);
    for (const d of ["01", "05", "10"]) {
      const { ctx } = makeCtx({ mspId: "PractitionerOrgMSP", state: shared, nowMs: day(d) });
      await contract.logAccess(ctx, PATIENT, RECORD, `READ_${d}`, "true");
    }

    const reader = makeCtx({ ...asPatient(PATIENT), state: shared });
    const logs = JSON.parse(await contract.getAuditLogByDateRange(
      reader.ctx, PATIENT, "2026-09-03T00:00:00.000Z", "2026-09-07T00:00:00.000Z",
    ));
    expect(logs.map((l: any) => l.action)).toEqual(["READ_05"]);
  });

  test("a patient cannot pull another patient's entries by date range either", async () => {
    const reader = makeCtx(asPatient(OTHER));
    await expect(contract.getAuditLogByDateRange(
      reader.ctx, PATIENT, "2026-09-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z",
    )).rejects.toThrow(/only read their own/i);
  });
});
