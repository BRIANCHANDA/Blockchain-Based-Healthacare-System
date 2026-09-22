/** Consent is patient-wide; source-specific grants only expose their sources. */
export function historyVisibility<T extends { hasPermission: boolean }>(hasPatientConsent: boolean, institutions: T[]) {
  const accessibleInstitutions = institutions.filter(i => i.hasPermission);
  return {
    accessibleInstitutions,
    needsPatientConsent: !hasPatientConsent && institutions.some(i => !i.hasPermission),
  };
}

export function groupHistoryRecords<T extends { visit: { institutionId?: string | null } }>(records: T[], names: Record<string, string>) {
  const groups = new Map<string, { institutionId: string; institutionName: string; visits: T[] }>();
  for (const record of records) {
    const id = record.visit.institutionId ?? 'unspecified';
    if (!groups.has(id)) groups.set(id, { institutionId: id, institutionName: names[id] ?? (id === 'unspecified' ? 'Unspecified institution' : 'Unknown institution'), visits: [] });
    groups.get(id)!.visits.push(record);
  }
  return [...groups.values()];
}
