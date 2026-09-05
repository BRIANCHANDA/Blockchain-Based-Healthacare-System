/**
 * Unit tests for lib/validators.ts.
 *
 *   bun test
 *
 * These assert the two things that matter about input validation, and they pull
 * in opposite directions:
 *
 *   IT REJECTS WHAT IS WRONG — letters where digits belong, impossible dates,
 *   negative quantities. This is what a tester will try.
 *
 *   IT ACCEPTS WHAT IS REAL — and this is the harder half. Validation that
 *   turns away a genuine patient at a registration desk is worse than
 *   validation that lets an odd-looking string through, so every rule is tested
 *   against real Zambian formats and real clinical extremes: a temperature of
 *   41.5 °C is an emergency, not a typo, and must be recordable.
 */

import { describe, expect, test } from "bun:test";
import {
  phoneNumber, nationalId, isoDate, dateOfBirth, futureDate, clinicalDate,
  email, personName, vitals,
} from "../src/lib/validators";

const ok = (schema: any, v: unknown) => schema.safeParse(v).success;

// ── phone numbers ────────────────────────────────────────────────────────────

describe("phoneNumber", () => {
  test("accepts the formats Zambian numbers are actually written in", () => {
    for (const v of [
      "+260971000001",      // seed data format
      "+260 97 100 0001",   // spaced
      "0971000001",         // local
      "+260-97-1000001",    // hyphenated
      "260971000001",
    ]) expect(ok(phoneNumber, v)).toBe(true);
  });

  test("rejects letters and symbols", () => {
    for (const v of ["abc", "+260abcdefgh", "097100000o", "'; DROP TABLE--", "<script>", ""]) {
      expect(ok(phoneNumber, v)).toBe(false);
    }
  });

  test("rejects a number that is too short or absurdly long", () => {
    expect(ok(phoneNumber, "12345")).toBe(false);
    expect(ok(phoneNumber, "1".repeat(40))).toBe(false);
  });
});

// ── national ID ──────────────────────────────────────────────────────────────

describe("nationalId", () => {
  test("accepts the NRC format", () => {
    for (const v of ["123456/78/1", "284471/61/1", "345678/90/10"]) {
      expect(ok(nationalId, v)).toBe(true);
    }
  });

  test("rejects letters, wrong shapes and injection attempts", () => {
    for (const v of [
      "abcdef/78/1", "12345/78/1", "123456-78-1", "123456/78",
      "123456/78/1 OR 1=1", "", "0",
    ]) expect(ok(nationalId, v)).toBe(false);
  });
});

// ── dates ────────────────────────────────────────────────────────────────────

describe("dates", () => {
  test("isoDate accepts YYYY-MM-DD and rejects everything else", () => {
    expect(ok(isoDate, "1990-01-01")).toBe(true);
    for (const v of ["banana", "01/01/1990", "1990-1-1", "1990-13-01", "", "20250101"]) {
      expect(ok(isoDate, v)).toBe(false);
    }
  });

  test("dateOfBirth rejects the future — the commonest data-entry error", () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    expect(ok(dateOfBirth, nextYear.toISOString().slice(0, 10))).toBe(false);
  });

  test("dateOfBirth rejects an impossible year but accepts a very old patient", () => {
    expect(ok(dateOfBirth, "1850-01-01")).toBe(false);
    expect(ok(dateOfBirth, "1935-06-30")).toBe(true);
  });

  test("dateOfBirth accepts a newborn", () => {
    // A baby registered on the day of birth is an ordinary case.
    expect(ok(dateOfBirth, new Date().toISOString().slice(0, 10))).toBe(true);
  });

  test("futureDate rejects an expiry already past", () => {
    expect(ok(futureDate, "2020-01-01")).toBe(false);
    const next = new Date();
    next.setFullYear(next.getFullYear() + 2);
    expect(ok(futureDate, next.toISOString().slice(0, 10))).toBe(true);
  });

  test("clinicalDate allows past and near-future, rejects the absurd", () => {
    expect(ok(clinicalDate, "2015-04-01")).toBe(true);
    expect(ok(clinicalDate, "2400-01-01")).toBe(false);
  });
});

// ── email ────────────────────────────────────────────────────────────────────

describe("email", () => {
  test("accepts a real address and normalises case", () => {
    expect(email.parse("  Doctor@CBUH.ZM ")).toBe("doctor@cbuh.zm");
  });

  test("rejects what a bare z.string() would have accepted", () => {
    for (const v of ["not-an-email", "@nowhere", "a@", "a b@c.zm", ""]) {
      expect(ok(email, v)).toBe(false);
    }
  });
});

// ── names ────────────────────────────────────────────────────────────────────

describe("personName", () => {
  test("accepts real Zambian names, including apostrophes and hyphens", () => {
    // A single letter is rejected: the fields this replaces already required 2.
    for (const v of ["Chanda", "N'gandu", "Mwape-Chanda", "Namukolo Sichone", "José"]) {
      expect(ok(personName, v)).toBe(true);
    }
  });

  test("rejects digits, markup and empty input", () => {
    for (const v of ["Chanda2", "<script>alert(1)</script>", "123", "", "   ", "!!!", "A"]) {
      expect(ok(personName, v)).toBe(false);
    }
  });
});

// ── vitals ───────────────────────────────────────────────────────────────────

describe("vitals", () => {
  test("accepts genuinely abnormal readings — the ones that matter clinically", () => {
    // These are emergencies, not typos. Rejecting them would make the system
    // unusable in exactly the situation it exists for.
    expect(ok(vitals.temperatureC, 41.5)).toBe(true);   // severe fever
    expect(ok(vitals.pulseBpm, 180)).toBe(true);        // tachycardia
    expect(ok(vitals.systolic, 220)).toBe(true);        // hypertensive crisis
    expect(ok(vitals.oxygenSaturation, 78)).toBe(true); // severe hypoxia
    expect(ok(vitals.weightKg, 2.1)).toBe(true);        // premature newborn
  });

  test("rejects the physically impossible — usually a missing decimal point", () => {
    expect(ok(vitals.temperatureC, 410)).toBe(false);
    expect(ok(vitals.temperatureC, 0)).toBe(false);
    expect(ok(vitals.pulseBpm, 5000)).toBe(false);
    expect(ok(vitals.oxygenSaturation, 150)).toBe(false);
    expect(ok(vitals.weightKg, -5)).toBe(false);
  });

  test("rejects text where a measurement belongs", () => {
    for (const v of ["37.5", "hot", "", null]) {
      expect(ok(vitals.temperatureC, v)).toBe(false);
    }
  });
});

// ── blank optional fields ────────────────────────────────────────────────────

describe("optional fields tolerate a blank form input", () => {
  test('"" is treated as not provided, not as invalid', async () => {
    // HTML forms submit "" for a field left blank. A plain .optional() rejects
    // that, so an untouched optional field failed validation — which reads to
    // the user as a broken form on a field they deliberately skipped.
    const { optionalEmail, optionalPhone, optionalIsoDate } =
      await import("../src/lib/validators");

    for (const schema of [optionalEmail, optionalPhone, optionalIsoDate]) {
      expect(schema.safeParse("").success).toBe(true);
      expect(schema.safeParse("   ").success).toBe(true);
      expect(schema.safeParse(undefined).success).toBe(true);
    }
  });

  test("a filled optional field is still validated", async () => {
    const { optionalEmail, optionalPhone } = await import("../src/lib/validators");
    expect(optionalEmail.safeParse("not-an-email").success).toBe(false);
    expect(optionalEmail.safeParse("a@b.zm").success).toBe(true);
    expect(optionalPhone.safeParse("abc").success).toBe(false);
    expect(optionalPhone.safeParse("+260971000001").success).toBe(true);
  });
});
