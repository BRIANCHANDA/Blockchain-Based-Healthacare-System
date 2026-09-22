import { expect, test } from 'bun:test';
import { encrypt } from '../src/services/crypto';
import { prescriptionDetailWithPatientName } from '../src/lib/prescription-detail';

test('prescription detail includes the decrypted patient name, not ciphertext', () => {
  const detail = prescriptionDetailWithPatientName({
    id: 'prescription', visit_number: 'VIS-123',
    patient_first_name_encrypted: encrypt('Jane'),
    patient_last_name_encrypted: encrypt('Banda'),
  });
  expect(detail.patient_name).toBe('Jane Banda');
  expect(detail.visit_number).toBe('VIS-123');
  expect(detail).not.toHaveProperty('patient_first_name_encrypted');
  expect(detail).not.toHaveProperty('patient_last_name_encrypted');
});

test('missing names use an explicit fallback without hiding prescription details', () => {
  const detail = prescriptionDetailWithPatientName({ id: 'prescription', status: 'prescribed' });
  expect(detail.patient_name).toBe('Patient name unavailable');
  expect(detail.status).toBe('prescribed');
});

test('corrupt encrypted names do not leak ciphertext or crash the detail view', () => {
  const detail = prescriptionDetailWithPatientName({ patient_first_name_encrypted: 'invalid-ciphertext' });
  expect(detail.patient_name).toBe('Patient name unavailable');
  expect(detail).not.toHaveProperty('patient_first_name_encrypted');
});
