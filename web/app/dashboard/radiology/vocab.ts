import type { Tone } from "@/components/dashboard/ui";

/* ==========================================================================
   Radiology vocabulary.

   Modality, urgency and status were previously redeclared in each radiology
   page with DIFFERENT keys — the worklist keyed modality on "CT"/"MRI"/"XRAY"
   while the API sends the Postgres enum values below, so every row fell
   through to the fallback. Keys here mirror backend/src/db/schema.ts exactly:

     imagingModalityEnum  x-ray | ct_scan | mri | ultrasound | pet_scan
                          | mammogram | fluoroscopy
     imagingStatusEnum    ordered | scheduled | in_progress | completed
                          | reported | cancelled
     priorityLevelEnum    routine | urgent | emergency | critical

   If the enum changes, this file is the only place the UI needs updating.
   ========================================================================== */

export type Labelled = { tone: Tone; label: string };

/* Urgency climbs routine → critical; tone climbs with it. */
const URGENCY: Record<string, Labelled> = {
  routine: { tone: "success", label: "Routine" },
  urgent: { tone: "urgent", label: "Urgent" },
  emergency: { tone: "critical", label: "Emergency" },
  critical: { tone: "accent", label: "Critical" },
};

/** Sort weight — lower is more urgent. Used to order the worklist. */
export const URGENCY_ORDER: Record<string, number> = {
  critical: 0,
  emergency: 1,
  urgent: 2,
  routine: 3,
};

const MODALITY: Record<string, Labelled> = {
  "x-ray": { tone: "info", label: "X-Ray" },
  ct_scan: { tone: "accent", label: "CT Scan" },
  mri: { tone: "urgent", label: "MRI" },
  ultrasound: { tone: "success", label: "Ultrasound" },
  pet_scan: { tone: "critical", label: "PET Scan" },
  mammogram: { tone: "brand", label: "Mammogram" },
  fluoroscopy: { tone: "neutral", label: "Fluoroscopy" },
};

const STATUS: Record<string, Labelled> = {
  ordered: { tone: "urgent", label: "Ordered" },
  scheduled: { tone: "info", label: "Scheduled" },
  in_progress: { tone: "info", label: "In progress" },
  completed: { tone: "success", label: "Completed" },
  reported: { tone: "accent", label: "Reported" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

/** Turn an unknown enum value into something printable rather than blank. */
const humanise = (v: string) =>
  (v ?? "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";

export const getUrgency = (u: string): Labelled =>
  URGENCY[u] ?? { tone: "neutral", label: humanise(u) };

export const getModality = (m: string): Labelled =>
  MODALITY[m] ?? { tone: "neutral", label: humanise(m) };

export const getStatus = (s: string): Labelled =>
  STATUS[s] ?? { tone: "neutral", label: humanise(s) };

/* ── Shared helpers ──────────────────────────────────────────────────────── */

/** Elapsed time as "43m" / "2h 5m". Returns "—" for missing or bad dates. */
export function timeSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** Turnaround in minutes, rendered in whichever unit reads better. */
export function formatTurnaround(minutes: number) {
  if (!minutes) return "—";
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${minutes}m`;
}

/**
 * Imaging orders arrive camelCase from Drizzle but snake_case from the raw
 * SQL paths, so every field is read both ways once, here.
 */
export function normalizeOrder(o: any) {
  return {
    ...o,
    orderedAt: o.orderedAt ?? o.ordered_at ?? null,
    bodyPart: o.bodyPart ?? o.body_part ?? "",
    orderNumber: o.orderNumber ?? o.order_number ?? "",
    visitNumber: o.visitNumber ?? o.visit_number ?? "",
    chiefComplaint: o.chiefComplaint ?? o.chief_complaint ?? "",
  };
}
