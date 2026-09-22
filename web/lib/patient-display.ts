/** Never render missing name fields as the literal text "undefined". */
export function patientDisplayName(patient?: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
} | null): string {
  return [patient?.firstName, patient?.middleName, patient?.lastName]
    .filter((part): part is string => typeof part === 'string' && !!part.trim())
    .map(part => part.trim()).join(' ') || 'Patient name unavailable';
}
