/**
 * Fixtures for the integration tests: a minimal but realistic world, built in
 * the test database and torn down afterwards.
 *
 * Each call to seedWorld() creates its own institution, practitioners and
 * patient with unique identifiers, so tests never collide with one another and
 * can run in any order. Nothing here is shared mutable state.
 *
 * Values that are encrypted in production are encrypted here too, via the real
 * services/crypto.ts — using plaintext would let a test pass against a login
 * path that had stopped decrypting correctly.
 */

import { randomUUID } from "crypto";
import { hash } from "bcryptjs";
import { eq, inArray } from "drizzle-orm";

import { db } from "../../src/db";
import {
  institutions, practitioners, patients, accessRequests,
  accessPermissions, deviceTokens, authSessions,
} from "../../src/db/schema";
import { encrypt } from "../../src/services/crypto";

/** The password every seeded account uses. */
export const TEST_PASSWORD = "TestPassw0rd!";

export type World = {
  institutionId: string;
  /** A verified, active practitioner — the happy path. */
  doctor: { id: string; licenseNumber: string; blockchainAddress: string };
  /** Registered but NOT verified by an administrator. */
  unverifiedDoctor: { id: string; licenseNumber: string };
  /** Verified but deactivated. */
  inactiveDoctor: { id: string; licenseNumber: string };
  patient: { id: string; nationalId: string; blockchainAddress: string };
  otherPatient: { id: string; nationalId: string; blockchainAddress: string };
  /** Everything created, for teardown. */
  cleanup: () => Promise<void>;
};

const addr = () => "0x" + randomUUID().replace(/-/g, "").slice(0, 40);

export async function seedWorld(): Promise<World> {
  const tag = randomUUID().slice(0, 8);
  const passwordHash = await hash(TEST_PASSWORD, 4); // low cost: speed over strength in tests

  const [inst] = await db.insert(institutions).values({
    institutionCode: `TST-${tag}`,
    institutionName: `Test Hospital ${tag}`,
    institutionType: "hospital",
    blockchainAddress: addr(),
    addressEncrypted: encrypt("1 Test Road, Ndola"),
    phoneEncrypted: encrypt("+260970000000"),
    emailEncrypted: encrypt(`hospital-${tag}@test.local`),
    licenseNumber: `LIC-${tag}`,
    isActive: true,
  }).returning({ id: institutions.id });

  const mkDoctor = async (suffix: string, isVerified: boolean, isActive: boolean) => {
    const licenseNumber = `DOC-${tag}-${suffix}`;
    const blockchainAddress = addr();
    const [row] = await db.insert(practitioners).values({
      blockchainAddress,
      institutionId: inst.id,
      firstNameEncrypted: encrypt("Test"),
      lastNameEncrypted: encrypt(`Doctor${suffix}`),
      licenseNumber,
      institutionalId: `TST-${tag}-${suffix}`,
      role: "practitioner",
      specialization: "General Medicine",
      department: "Outpatient",
      phoneNumberEncrypted: encrypt("+260970000001"),
      emailEncrypted: encrypt(`doctor-${tag}-${suffix}@test.local`),
      passwordHash,
      isVerified,
      isActive,
      mustChangePassword: false,
    }).returning({ id: practitioners.id });
    return { id: row.id, licenseNumber, blockchainAddress };
  };

  const doctor = await mkDoctor("A", true, true);
  const unverifiedDoctor = await mkDoctor("B", false, true);
  const inactiveDoctor = await mkDoctor("C", true, false);

  const mkPatient = async (suffix: string) => {
    const nationalId = `${tag}${suffix}/61/1`;
    const blockchainAddress = addr();
    const [row] = await db.insert(patients).values({
      blockchainAddress,
      firstNameEncrypted: encrypt("Test"),
      lastNameEncrypted: encrypt(`Patient${suffix}`),
      nationalIdEncrypted: encrypt(nationalId),
      dateOfBirthEncrypted: encrypt("1990-01-01"),
      gender: "male",
      phoneNumberEncrypted: encrypt("+260970000002"),
      addressEncrypted: encrypt("1 Test Street"),
      emergencyContactEncrypted: encrypt("+260970000003"),
      passwordHash,
      isMinor: false,
      mustChangePassword: false,
      isActive: true,
      isDeceased: false,
    }).returning({ id: patients.id });
    return { id: row.id, nationalId, blockchainAddress };
  };

  const patient = await mkPatient("P");
  const otherPatient = await mkPatient("Q");

  const practitionerIds = [doctor.id, unverifiedDoctor.id, inactiveDoctor.id];
  const patientIds = [patient.id, otherPatient.id];

  const cleanup = async () => {
    // Children before parents — these tables carry foreign keys.
    await db.delete(accessRequests).where(inArray(accessRequests.patientId, patientIds));
    await db.delete(accessPermissions).where(inArray(accessPermissions.patientId, patientIds));
    await db.delete(deviceTokens).where(inArray(deviceTokens.userId, [...patientIds, ...practitionerIds]));
    await db.delete(authSessions).where(inArray(authSessions.userId, [...patientIds, ...practitionerIds]));
    await db.delete(patients).where(inArray(patients.id, patientIds));
    await db.delete(practitioners).where(inArray(practitioners.id, practitionerIds));
    await db.delete(institutions).where(eq(institutions.id, inst.id));
  };

  return { institutionId: inst.id, doctor, unverifiedDoctor, inactiveDoctor, patient, otherPatient, cleanup };
}
