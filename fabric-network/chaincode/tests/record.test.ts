/**
 * Unit tests for the RecordContract — the integrity anchoring the system's
 * tamper-evidence claim rests on.
 *
 *   cd fabric-network/chaincode && bun test
 *
 * What these prove:
 *
 *   · only hashes reach the chain, never clinical data — the property that
 *     makes off-chain erasure possible while the anchor stays immutable;
 *   · a record whose database row changed no longer verifies;
 *   · verification distinguishes "does not match" from "was never anchored",
 *     so a missing record is never reported to a clinician as tampering;
 *   · amending a record appends a version rather than overwriting the proof of
 *     what it previously said.
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { RecordContract } from "../src/record";
import { makeCtx, readState, NUL } from "./fabricStub";

const PATIENT = "patient-chanda";
const RECORD = "visit-2026-a3f2";
/** A well-formed SHA-256 digest: 64 hex characters. */
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

let contract: RecordContract;
beforeEach(() => { contract = new RecordContract(); });

// ── who may anchor ───────────────────────────────────────────────────────────

describe("write authorisation", () => {
  test("an unknown organisation cannot anchor a record", async () => {
    const { ctx } = makeCtx({ mspId: "SomeOtherOrgMSP" });
    await expect(
      contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "consultation"),
    ).rejects.toThrow(/access denied/i);
  });

  test("hospital, practitioner and patient orgs may all anchor", async () => {
    for (const msp of ["HospitalOrgMSP", "PractitionerOrgMSP", "PatientOrgMSP"]) {
      const { ctx, state } = makeCtx({ mspId: msp });
      await contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "consultation");
      expect(readState(state, `RECORD_${RECORD}`)?.creatorMSP).toBe(msp);
    }
  });
});

// ── the hash is the only thing stored ────────────────────────────────────────

describe("only a digest reaches the ledger", () => {
  test("rejects anything that is not a 64-character hex digest", async () => {
    // Guards the boundary: if a caller could anchor arbitrary text, clinical
    // data could reach the chain and the erasure argument would collapse.
    for (const bad of ["", "not-a-hash", "abc123", "a".repeat(63), "a".repeat(65), "z".repeat(64)]) {
      const { ctx } = makeCtx({ mspId: "HospitalOrgMSP" });
      await expect(
        contract.storeRecordHash(ctx, RECORD, PATIENT, bad, "consultation"),
      ).rejects.toThrow(/invalid sha256hash/i);
    }
  });

  test("the stored record contains no field that could carry clinical content", async () => {
    const { ctx, state } = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "consultation");

    const stored = readState(state, `RECORD_${RECORD}`)!;
    expect(Object.keys(stored).sort()).toEqual([
      "createdBy", "creatorMSP", "patientId", "previousTxId",
      "recordId", "recordType", "sha256Hash", "timestamp", "version",
    ].filter((k) => k in stored).sort());
    expect(stored.sha256Hash).toBe(HASH_A);
  });

  test("accepts upper-case hex, since digests are case-insensitive", async () => {
    const { ctx, state } = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(ctx, RECORD, PATIENT, "A".repeat(64), "consultation");
    expect(readState(state, `RECORD_${RECORD}`)?.sha256Hash).toBe("A".repeat(64));
  });
});

// ── verification: the tamper-evidence claim ──────────────────────────────────

describe("verifyRecordHash", () => {
  test("an unchanged record verifies", async () => {
    const { ctx } = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "consultation");

    const res = JSON.parse(await contract.verifyRecordHash(ctx, RECORD, HASH_A));
    expect(res).toEqual({ verified: true, notFound: false });
  });

  test("a record altered in the database no longer verifies", async () => {
    // This is the tamper-evidence property: the off-chain row changed, so
    // recomputing its hash yields a different digest to the anchored one.
    const { ctx } = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "consultation");

    const res = JSON.parse(await contract.verifyRecordHash(ctx, RECORD, HASH_B));
    expect(res).toEqual({ verified: false, notFound: false });
  });

  test("distinguishes 'never anchored' from 'does not match'", async () => {
    // Both are unverified, but they mean different things to a clinician: one
    // is a record that was never written to the chain, the other is evidence of
    // alteration. Collapsing them would raise false tampering alarms.
    const { ctx } = makeCtx({ mspId: "HospitalOrgMSP" });
    const res = JSON.parse(await contract.verifyRecordHash(ctx, "never-stored", HASH_A));
    expect(res).toEqual({ verified: false, notFound: true });
  });

  test("emits a distinguishable event for a mismatch and for a missing record", async () => {
    const { ctx, events } = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "consultation");

    await contract.verifyRecordHash(ctx, RECORD, HASH_B);
    await contract.verifyRecordHash(ctx, "never-stored", HASH_A);

    const names = events.map((e) => e.name);
    expect(names).toContain("RecordHashMismatch");
    expect(names).toContain("RecordVerifyMissing");
  });

  test("a successful verification emits no alarm event", async () => {
    const { ctx, events } = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "consultation");
    const before = events.length;

    await contract.verifyRecordHash(ctx, RECORD, HASH_A);
    expect(events.slice(before).map((e) => e.name)).not.toContain("RecordHashMismatch");
  });
});

// ── versioning: an amendment must not erase the earlier proof ────────────────

describe("versioning", () => {
  test("re-anchoring the same record increments the version", async () => {
    const first = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(first.ctx, RECORD, PATIENT, HASH_A, "consultation");
    expect(readState(first.state, `RECORD_${RECORD}`)?.version).toBe(1);

    // A later transaction on the same ledger.
    const second = makeCtx({ mspId: "HospitalOrgMSP", state: first.state });
    await contract.storeRecordHash(second.ctx, RECORD, PATIENT, HASH_B, "consultation");
    expect(readState(second.state, `RECORD_${RECORD}`)?.version).toBe(2);
  });

  test("the latest pointer reflects the newest hash", async () => {
    const first = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(first.ctx, RECORD, PATIENT, HASH_A, "consultation");
    const second = makeCtx({ mspId: "HospitalOrgMSP", state: first.state });
    await contract.storeRecordHash(second.ctx, RECORD, PATIENT, HASH_B, "consultation");

    const res = JSON.parse(await contract.verifyRecordHash(second.ctx, RECORD, HASH_B));
    expect(res.verified).toBe(true);

    // The superseded hash no longer verifies against the current pointer.
    const old = JSON.parse(await contract.verifyRecordHash(second.ctx, RECORD, HASH_A));
    expect(old.verified).toBe(false);
  });

  test("getRecordHistory returns every version, so the earlier proof survives", async () => {
    // The point of versioning rather than overwriting: an amended record must
    // not destroy the evidence of what it said before.
    const history = new Map();
    const first = makeCtx({ mspId: "HospitalOrgMSP", history });
    await contract.storeRecordHash(first.ctx, RECORD, PATIENT, HASH_A, "consultation");

    const second = makeCtx({ mspId: "HospitalOrgMSP", state: first.state, history });
    await contract.storeRecordHash(second.ctx, RECORD, PATIENT, HASH_B, "consultation");

    const entries = JSON.parse(await contract.getRecordHistory(second.ctx, RECORD));
    expect(entries.length).toBe(2);
    const hashes = entries.map((e: any) => e.value.sha256Hash);
    expect(hashes).toContain(HASH_A);
    expect(hashes).toContain(HASH_B);
  });

  test("a first anchor has no previousTxId; a second one does", async () => {
    const history = new Map();
    const first = makeCtx({ mspId: "HospitalOrgMSP", history });
    await contract.storeRecordHash(first.ctx, RECORD, PATIENT, HASH_A, "consultation");
    expect(readState(first.state, `RECORD_${RECORD}`)?.previousTxId).toBeUndefined();

    const second = makeCtx({ mspId: "HospitalOrgMSP", state: first.state, history });
    await contract.storeRecordHash(second.ctx, RECORD, PATIENT, HASH_B, "consultation");
    expect(readState(second.state, `RECORD_${RECORD}`)?.previousTxId).toBeDefined();
  });
});

// ── write events are audited in the same transaction ─────────────────────────

describe("writes are self-auditing", () => {
  test("anchoring also writes an audit entry, atomically", async () => {
    // Both writes happen in one transaction, so the backend cannot anchor a
    // record without also producing an audit trail — they commit or fail together.
    const { ctx, state } = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "consultation");

    const auditKeys = [...state.keys()].filter((k) => k.startsWith(`AUDIT_${PATIENT}_`));
    expect(auditKeys.length).toBe(1);

    const entry = readState(state, auditKeys[0])!;
    expect(entry.action).toBe("WRITE_CONSULTATION");
    expect(entry.patientId).toBe(PATIENT);
    expect(entry.success).toBe(true);
  });

  test("emits a RecordStored event carrying the version", async () => {
    const { ctx, events } = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "lab_result");

    const ev = events.find((e) => e.name === "RecordStored");
    expect(ev).toBeDefined();
    expect(ev!.payload).toMatchObject({ recordId: RECORD, patientId: PATIENT, version: 1 });
  });
});

// ── retrieval ────────────────────────────────────────────────────────────────

describe("retrieval", () => {
  test("getRecordHash throws for a record that was never anchored", async () => {
    const { ctx } = makeCtx({ mspId: "HospitalOrgMSP" });
    await expect(contract.getRecordHash(ctx, "never-stored")).rejects.toThrow(/not found/i);
  });

  test("getPatientRecords returns only that patient's records", async () => {
    const shared = new Map();
    for (const [rec, pat] of [["r1", PATIENT], ["r2", PATIENT], ["r3", "patient-other"]]) {
      const { ctx } = makeCtx({ mspId: "HospitalOrgMSP", state: shared });
      await contract.storeRecordHash(ctx, rec, pat, HASH_A, "consultation");
    }

    const { ctx } = makeCtx({ mspId: "HospitalOrgMSP", state: shared });
    const mine = JSON.parse(await contract.getPatientRecords(ctx, PATIENT));
    expect(mine.length).toBe(2);
    expect(mine.every((r: any) => r.patientId === PATIENT)).toBe(true);
  });

  test("an unknown organisation cannot list a patient's records", async () => {
    const { ctx } = makeCtx({ mspId: "SomeOtherOrgMSP" });
    await expect(contract.getPatientRecords(ctx, PATIENT)).rejects.toThrow(/access denied/i);
  });

  test("indexes records under a composite key delimited by NUL", async () => {
    // Guards the stub against drifting from Fabric's real key format, which the
    // partial-composite-key query depends on.
    const { ctx, state } = makeCtx({ mspId: "HospitalOrgMSP" });
    await contract.storeRecordHash(ctx, RECORD, PATIENT, HASH_A, "consultation");
    expect([...state.keys()].some((k) => k.startsWith(`PatientRecord${NUL}${PATIENT}`))).toBe(true);
  });
});
