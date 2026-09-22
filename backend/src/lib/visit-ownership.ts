export function clinicalWriteDenial(
  visit: { status: string; assignedDoctorId: string | null; institutionId: string | null },
  doctor: { id: string; institutionId: string | null },
): string | null {
  if (!doctor.institutionId || doctor.institutionId !== visit.institutionId)
    return 'This visit belongs to another institution.';
  if (visit.assignedDoctorId !== doctor.id)
    return 'This visit is read-only. Only the currently assigned doctor can perform clinical actions.';
  if (visit.status !== 'in-progress') return 'This visit is not active and is read-only.';
  return null;
}
