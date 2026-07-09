import { db } from '../db';
import { eq, and, or, gte, lt, sql } from 'drizzle-orm';
import { crossInstitutionAccess, emergencyAccessLogs, patients, visits, consultations } from '../db/schema';
import { storeRecordHash } from './fabric';
import crypto from 'crypto';

function generateRecordHash(data: object): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export interface AccessGrant {
    patientId: string;
    sourceInstitutionId: string;
    targetInstitutionId: string;
    accessType: 'referral' | 'transfer' | 'emergency' | 'patient_consent';
    grantedBy: string;
    durationHours?: number;
    reason: string;
}

// Grant cross-institution access
export async function grantCrossInstitutionAccess(grant: AccessGrant): Promise<string> {
    const expiresAt = grant.durationHours
        ? new Date(Date.now() + grant.durationHours * 60 * 60 * 1000)
        : null;

    const hash = generateRecordHash({
        patientId: grant.patientId,
        sourceInstitutionId: grant.sourceInstitutionId,
        targetInstitutionId: grant.targetInstitutionId,
        accessType: grant.accessType,
        reason: grant.reason,
        timestamp: new Date().toISOString(),
    });

    const result = await db.insert(crossInstitutionAccess).values({
        patientId: grant.patientId,
        sourceInstitutionId: grant.sourceInstitutionId,
        targetInstitutionId: grant.targetInstitutionId,
        accessType: grant.accessType,
        grantedBy: grant.grantedBy,
        expiresAt,
        reason: grant.reason,
        status: 'active',
        blockchainHash: hash,
    })
    .onConflictDoUpdate({
        target: [crossInstitutionAccess.patientId, crossInstitutionAccess.sourceInstitutionId, crossInstitutionAccess.targetInstitutionId],
        set: {
            status: 'active',
            expiresAt,
            reason: grant.reason,
            grantedBy: grant.grantedBy,
            accessType: grant.accessType,
            blockchainHash: hash,
            updatedAt: new Date(),
        },
    })
    .returning({ id: crossInstitutionAccess.id });

    await storeRecordHash(result[0].id, grant.patientId, hash, 'cross_institution_access');

    return result[0].id;
}

// Check if staff can access a patient
export async function canAccessPatient(
    patientId: string,
    staffInstitutionId: string,
    staffId: string
): Promise<{ allowed: boolean; reason: string; accessGrant?: any }> {
    // 1. Check if patient is registered at staff's institution
    const patientAtInstitution = await db.select({
        id: patients.id,
        firstNameEncrypted: patients.firstNameEncrypted,
        lastNameEncrypted: patients.lastNameEncrypted,
    }).from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

    if (!patientAtInstitution.length) {
        return { allowed: false, reason: 'Patient not found' };
    }

    // Check if patient has a visit at this institution
    const visitAtInstitution = await db.select({ id: visits.id })
        .from(visits)
        .where(and(
            eq(visits.patientId, patientId),
            eq(visits.institutionId, staffInstitutionId)
        ))
        .limit(1);

    if (visitAtInstitution.length) {
        return { allowed: true, reason: 'Patient currently at this institution' };
    }

    // 2. Check for active cross-institution access grant
    const activeGrant = await db.select()
        .from(crossInstitutionAccess)
        .where(and(
            eq(crossInstitutionAccess.patientId, patientId),
            eq(crossInstitutionAccess.targetInstitutionId, staffInstitutionId),
            eq(crossInstitutionAccess.status, 'active'),
            or(
                sql`${crossInstitutionAccess.expiresAt} IS NULL`,
                gte(crossInstitutionAccess.expiresAt, new Date())
            )
        ))
        .limit(1);

    if (activeGrant.length) {
        return {
            allowed: true,
            reason: `Access granted via ${activeGrant[0].accessType}`,
            accessGrant: activeGrant[0]
        };
    }

    // 3. Check for emergency access (active within last 24 hours)
    const emergencyAccess = await db.select()
        .from(emergencyAccessLogs)
        .where(and(
            eq(emergencyAccessLogs.patientId, patientId),
            eq(emergencyAccessLogs.accessedByInstitutionId, staffInstitutionId),
            gte(emergencyAccessLogs.expiresAt, new Date())
        ))
        .limit(1);

    if (emergencyAccess.length) {
        return {
            allowed: true,
            reason: 'Emergency access granted',
            accessGrant: emergencyAccess[0]
        };
    }

    return { allowed: false, reason: 'No access permission. Please request access or create a referral.' };
}

// Revoke cross-institution access
export async function revokeAccess(accessId: string, revokedBy: string): Promise<void> {
    await db.update(crossInstitutionAccess)
        .set({
            status: 'revoked',
            updatedAt: new Date()
        })
        .where(eq(crossInstitutionAccess.id, accessId));
}

// Create emergency access (24-hour temporary access)
export async function createEmergencyAccess(
    patientId: string,
    accessedBy: string,
    accessedByInstitutionId: string,
    reason: string
): Promise<string> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const hash = generateRecordHash({
        patientId,
        accessedBy,
        institutionId: accessedByInstitutionId,
        reason,
        expiresAt: expiresAt.toISOString(),
        timestamp: new Date().toISOString(),
    });

    const result = await db.insert(emergencyAccessLogs).values({
        patientId,
        accessedBy,
        accessedByInstitutionId,
        reason,
        expiresAt,
        blockchainHash: hash,
    }).returning({ id: emergencyAccessLogs.id });

    await storeRecordHash(result[0].id, patientId, hash, 'emergency_access');

    return result[0].id;
}