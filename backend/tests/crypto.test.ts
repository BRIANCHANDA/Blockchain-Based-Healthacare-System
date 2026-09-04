/**
 * Unit tests for services/crypto.ts — the confidentiality and integrity
 * primitives the whole system rests on.
 *
 *   bun test
 *
 * These are pure functions with no database or blockchain dependency, so the
 * suite runs in milliseconds and needs no running infrastructure.
 *
 * Several tests below deliberately assert a WEAKNESS rather than a strength.
 * They are marked "pins" in the description. Pinning a known limitation in a
 * test means it is documented, deliberate and cannot regress silently — and
 * it is what lets Chapter 6 describe the cipher choice honestly.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "crypto";
import { encrypt, decrypt, hashData, generateRecordHash } from "../src/services/crypto";

// ── encrypt / decrypt ────────────────────────────────────────────────────────

describe("encrypt / decrypt", () => {
  test("round-trips a value unchanged", () => {
    const plain = "Chanda Mulenga";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  test("round-trips unicode, punctuation and empty strings", () => {
    for (const v of ["284471/61/1", "Ndola — Teaching Hospital", "ß∂ƒ©˙∆", ""]) {
      expect(decrypt(encrypt(v))).toBe(v);
    }
  });

  test("produces different ciphertext each call, so equal rows are not linkable", () => {
    // A fresh IV per call is what stops an observer inferring that two patients
    // share a surname by comparing encrypted columns.
    const a = encrypt("Mwape");
    const b = encrypt("Mwape");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  test("stores the IV alongside the ciphertext as <iv-hex>:<ciphertext-hex>", () => {
    const [iv, body, ...rest] = encrypt("x").split(":");
    expect(rest).toHaveLength(0);
    expect(iv).toMatch(/^[0-9a-f]{32}$/); // 16 bytes
    expect(body).toMatch(/^[0-9a-f]+$/);
  });

  test("throws on a malformed stored value rather than returning junk", () => {
    expect(() => decrypt("not-a-valid-payload")).toThrow();
  });

  test("pins: CBC is unauthenticated — a tampered ciphertext does NOT throw", () => {
    // This is the property the final report must describe accurately. AES-256-CBC
    // gives confidentiality only; there is no authentication tag, so corruption
    // is not detected here. Integrity is obtained separately, by anchoring
    // generateRecordHash() on-chain and re-verifying on read.
    const original = encrypt("Aspirin 300 mg");
    const [iv, body] = original.split(":");

    // Flip one ciphertext byte.
    const flipped = (parseInt(body.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, "0");
    const tampered = `${iv}:${flipped}${body.slice(2)}`;

    let threw = false;
    let out: string | undefined;
    try {
      out = decrypt(tampered);
    } catch {
      threw = true; // padding may or may not survive the flip
    }

    // The contract being pinned: decryption never *reports* tampering. It either
    // yields a different plaintext, or fails on padding for unrelated reasons.
    if (!threw) expect(out).not.toBe("Aspirin 300 mg");
  });
});

// ── hashData ─────────────────────────────────────────────────────────────────

describe("hashData", () => {
  test("is deterministic and returns a 64-character SHA-256 hex digest", () => {
    const h = hashData("284471/61/1");
    expect(h).toBe(hashData("284471/61/1"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a single-character change produces a completely different digest", () => {
    const a = hashData("284471/61/1");
    const b = hashData("284471/61/2");
    expect(a).not.toBe(b);

    // Avalanche: the two digests should differ in a large share of positions.
    const differing = [...a].filter((ch, i) => ch !== b[i]).length;
    expect(differing).toBeGreaterThan(a.length / 3);
  });
});

// ── generateRecordHash ───────────────────────────────────────────────────────

describe("generateRecordHash", () => {
  test("is independent of key insertion order — the property it exists for", () => {
    // The write path and the read path build the object in different orders;
    // the anchored hash must still match on verification.
    const written = { patientId: "p1", visitNumber: "VIS-2026-A3F2", visitType: "outpatient" };
    const read = { visitType: "outpatient", patientId: "p1", visitNumber: "VIS-2026-A3F2" };
    expect(generateRecordHash(written)).toBe(generateRecordHash(read));
  });

  test("detects a changed top-level value", () => {
    const a = { patientId: "p1", diagnosis: "I20.0" };
    const b = { patientId: "p1", diagnosis: "I10" };
    expect(generateRecordHash(a)).not.toBe(generateRecordHash(b));
  });

  test("preserves array values", () => {
    // Arrays are not filtered by the replacer, so list fields such as an
    // institution's `specialties` do contribute to the digest.
    const a = { code: "LCH", specialties: ["cardiology"] };
    const b = { code: "LCH", specialties: ["oncology"] };
    expect(generateRecordHash(a)).not.toBe(generateRecordHash(b));
  });

  test("regression: nested content reaches the digest", () => {
    // The previous implementation passed Object.keys(data).sort() as the
    // replacer argument. An ARRAY replacer is an allowlist applied at EVERY
    // level of the tree, and the keys of a nested object are never present in a
    // list built from the top-level keys — so nested objects serialised as {}
    // and their contents never reached the hash. Two records differing only
    // inside a nested object produced an identical anchor, making tampering
    // there undetectable on verification.
    //
    // The exposed path was POST /records/verify, whose `recordData` is typed
    // z.any() and therefore accepts arbitrary nested client JSON.
    const real = { recordId: "r1", payload: { diagnosis: "angina", dose: "300mg" } };
    const forged = { recordId: "r1", payload: { diagnosis: "healthy", dose: "0mg" } };
    expect(generateRecordHash(real)).not.toBe(generateRecordHash(forged));
  });

  test("regression: detects a change at any depth", () => {
    const base = { id: "r1", a: { b: { c: { value: "original" } } } };
    const deep = { id: "r1", a: { b: { c: { value: "tampered" } } } };
    expect(generateRecordHash(base)).not.toBe(generateRecordHash(deep));
  });

  test("regression: detects a change inside an array of objects", () => {
    const a = { visitId: "v1", orders: [{ test: "Troponin I", urgency: "urgent" }] };
    const b = { visitId: "v1", orders: [{ test: "Troponin I", urgency: "routine" }] };
    expect(generateRecordHash(a)).not.toBe(generateRecordHash(b));
  });

  test("key order is irrelevant at every depth, not just the top level", () => {
    const written = { id: "r1", vitals: { bp: "164/98", pulse: 118 } };
    const read = { vitals: { pulse: 118, bp: "164/98" }, id: "r1" };
    expect(generateRecordHash(written)).toBe(generateRecordHash(read));
  });

  test("array order IS significant — a list is data, not a set", () => {
    const a = { codes: ["I20.0", "I10"] };
    const b = { codes: ["I10", "I20.0"] };
    expect(generateRecordHash(a)).not.toBe(generateRecordHash(b));
  });
});

// ── backward compatibility ───────────────────────────────────────────────────

describe("generateRecordHash · compatibility with already-anchored hashes", () => {
  /** The previous implementation, verbatim, for parity checking. */
  const legacy = (d: object) =>
    createHash("sha256").update(JSON.stringify(d, Object.keys(d).sort())).digest("hex");

  test("flat records hash exactly as before, so ledger anchors stay valid", () => {
    // Every production call site builds a flat object. Matching the legacy
    // digest for those means the fix needs no migration and no ledger reset:
    // only records affected by the defect change, and their old hash never
    // covered the nested data anyway.
    const realCallSiteShapes: object[] = [
      { patientId: "p1", blockchainAddress: "0xabc", timestamp: "2026-09-03T10:00:00.000Z" },
      { patientId: "p1", visitType: "outpatient", chiefComplaint: "Chest pain",
        visitNumber: "VIS-2026-A3F2", timestamp: "2026-09-03T10:00:00.000Z" },
      { institutionId: "i1", institutionCode: "LCH", specialties: ["cardiology", "oncology"],
        bedCapacity: 420, timestamp: "2026-09-03T10:00:00.000Z" },
      { referralNumber: "REF-1043", patientId: "p1", reason: "Cardiology review" },
      { visitId: "v1", bloodPressureSystolic: 164, temperature: "37.4", recordedBy: "u1" },
      { a: null, b: "x", c: 1.5, d: true },
      { note: 'Line1\nLine2 "quoted" — ünïcode' },
    ];
    for (const shape of realCallSiteShapes) {
      expect(generateRecordHash(shape)).toBe(legacy(shape));
    }
  });
});

// ── JSON semantics preserved ─────────────────────────────────────────────────

describe("generateRecordHash · serialisation semantics", () => {
  test("honours toJSON, so a Date hashes as its ISO string", () => {
    const iso = "2026-09-03T10:00:00.000Z";
    expect(generateRecordHash({ at: new Date(iso) })).toBe(generateRecordHash({ at: iso }));
  });

  test("drops undefined properties, matching JSON.stringify", () => {
    expect(generateRecordHash({ a: 1, b: undefined })).toBe(generateRecordHash({ a: 1 }));
  });

  test("serialises non-finite numbers as null, matching JSON.stringify", () => {
    expect(generateRecordHash({ n: NaN })).toBe(generateRecordHash({ n: null }));
    expect(generateRecordHash({ n: Infinity })).toBe(generateRecordHash({ n: null }));
  });

  test("distinguishes an empty nested object from a missing key", () => {
    // The old implementation collapsed every nested object to {}, so these two
    // were indistinguishable.
    expect(generateRecordHash({ id: "r1", meta: {} }))
      .not.toBe(generateRecordHash({ id: "r1" }));
  });
});
