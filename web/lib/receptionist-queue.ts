export interface ReceptionQueueRow {
  id: string;
  patientName?: string | null;
  visitNumber?: string | null;
  chiefComplaint?: string | null;
  admissionDate?: string | null;
  priority: string;
  status: string;
}

export function receptionistQueueItem(row: ReceptionQueueRow, now = Date.now()) {
  const admitted = row.admissionDate ? new Date(row.admissionDate).getTime() : NaN;
  return {
    ...row,
    name: row.patientName?.trim() || 'Patient name unavailable',
    ticket: row.visitNumber || '—',
    reason: row.chiefComplaint || '',
    waitMins: Number.isFinite(admitted) ? Math.max(0, Math.floor((now - admitted) / 60_000)) : null,
  };
}

export function queueWaitLabel(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}
