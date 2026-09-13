import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { patients, practitioners, visits } from '../db/schema';
import { decrypt } from './crypto';
import { notifyUser } from './realtime';

// Delivery is best-effort and must never turn a saved assignment into a 500.
export async function notifyPatientAssigned(visitId: string, recipientId: string, role: 'nurse' | 'practitioner') {
  try {
    const [visit] = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
    if (!visit?.institutionId) return;
    if ((role === 'nurse' ? visit.assignedNurseId : visit.assignedDoctorId) !== recipientId) return;
    const [recipient] = await db.select({ id: practitioners.id }).from(practitioners)
      .where(and(eq(practitioners.id, recipientId), eq(practitioners.institutionId, visit.institutionId),
        eq(practitioners.role, role), eq(practitioners.isActive, true))).limit(1);
    if (!recipient) return;
    const [patient] = await db.select({ first: patients.firstNameEncrypted, last: patients.lastNameEncrypted })
      .from(patients).where(eq(patients.id, visit.patientId)).limit(1);
    let patientName = 'Patient';
    try { if (patient) patientName = `${decrypt(patient.first)} ${decrypt(patient.last)}`.trim(); } catch { /* use fallback */ }
    notifyUser(recipientId, 'patient_assigned', {
      visitId, visitNumber: visit.visitNumber, patientName, priority: visit.priority, assignedRole: role,
    });
  } catch (error) {
    console.warn('[ASSIGNMENT_NOTIFICATION]', error instanceof Error ? error.message : 'Delivery failed');
  }
}
