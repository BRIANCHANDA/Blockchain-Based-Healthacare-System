export const CLINICAL_ROLES = [
    'practitioner',
    'nurse',
    'lab_technician',
    'radiologist',
    'pharmacist',
    'receptionist',
] as const;

export type ClinicalRole = typeof CLINICAL_ROLES[number];

export function isClinicalRole(role: string): role is ClinicalRole {
    return CLINICAL_ROLES.includes(role as ClinicalRole);
}