import { decrypt } from '../services/crypto';

export function prescriptionDetailWithPatientName(row: Record<string, any>) {
  const { patient_first_name_encrypted, patient_last_name_encrypted, ...prescription } = row;
  let patientName = 'Patient name unavailable';
  try {
    const parts = [patient_first_name_encrypted, patient_last_name_encrypted]
      .filter(Boolean).map(value => decrypt(value).trim()).filter(Boolean);
    if (parts.length) patientName = parts.join(' ');
  } catch { /* Do not expose ciphertext or substitute a visit number for a name. */ }
  return { ...prescription, patient_name: patientName };
}
