/**
 * Unit tests for constants/roles.ts — the role predicate that guards every
 * clinical route.
 *
 *   bun test
 *
 * isClinicalRole is the check that separates staff who may touch clinical data
 * from those who may not. It is pure, so it tests without a database, but the
 * consequences of it being wrong are the most serious in the codebase: a false
 * positive on 'patient' would let a patient act as a clinician.
 *
 * The last test guards against drift between this list and the database enum,
 * which is the realistic way this breaks — a role gets added to user_type in
 * the schema and nobody updates CLINICAL_ROLES, or vice versa.
 */

import { describe, expect, test } from "bun:test";
import { CLINICAL_ROLES, isClinicalRole } from "../src/constants/roles";
import { userTypeEnum } from "../src/db/schema";

describe("isClinicalRole", () => {
  test("accepts every declared clinical role", () => {
    for (const role of CLINICAL_ROLES) {
      expect(isClinicalRole(role)).toBe(true);
    }
  });

  test("rejects 'patient' — the check that stops a patient acting as staff", () => {
    expect(isClinicalRole("patient")).toBe(false);
  });

  test("rejects 'admin' — administrative, not clinical", () => {
    // An administrator manages institutions and staff; they are not a caregiver
    // and must not pass a check that gates clinical data.
    expect(isClinicalRole("admin")).toBe(false);
  });

  test("rejects unknown, empty and malformed values", () => {
    for (const v of ["", " ", "doctor", "Practitioner", "PRACTITIONER", "practitioner "]) {
      expect(isClinicalRole(v)).toBe(false);
    }
  });

  test("is case-sensitive, matching the database enum exactly", () => {
    expect(isClinicalRole("nurse")).toBe(true);
    expect(isClinicalRole("Nurse")).toBe(false);
  });
});

describe("alignment with the database", () => {
  const dbRoles = userTypeEnum.enumValues as readonly string[];

  test("every clinical role is a real user_type in the schema", () => {
    // Catches a role being renamed or removed in the database while the
    // predicate still claims it exists.
    for (const role of CLINICAL_ROLES) {
      expect(dbRoles).toContain(role);
    }
  });

  test("the only non-clinical user types are patient and admin", () => {
    // Catches the opposite drift: a new staff role added to the schema but
    // never added to CLINICAL_ROLES, which would silently deny it access.
    const nonClinical = dbRoles.filter((r) => !isClinicalRole(r)).sort();
    expect(nonClinical).toEqual(["admin", "patient"]);
  });
});
