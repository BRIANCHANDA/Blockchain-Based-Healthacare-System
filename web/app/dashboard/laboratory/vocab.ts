import type { Tone } from "@/components/dashboard/ui";

/* ==========================================================================
   Laboratory vocabulary.

   Keys mirror backend/src/db/schema.ts:

     labTestStatusEnum  ordered | sample_collected | in_progress
                        | completed | resulted | cancelled
     specimenTypeEnum   blood | urine | stool | sputum | csf | tissue
                        | swab | other
     priorityLevelEnum  routine | urgent | emergency | critical

   Two of those statuses — sample_collected and in_progress — exist in the
   enum but are never written by the backend today; they are included so the
   UI stays correct if that changes. The queue previously keyed on
   "collected" and "processing", which match nothing at all.
   ========================================================================== */

export type Labelled = { tone: Tone; label: string };

const URGENCY: Record<string, Labelled> = {
  routine: { tone: "success", label: "Routine" },
  urgent: { tone: "urgent", label: "Urgent" },
  emergency: { tone: "critical", label: "Emergency" },
  critical: { tone: "accent", label: "Critical" },
};

/** Sort weight — lower is more urgent. */
export const URGENCY_ORDER: Record<string, number> = {
  critical: 0,
  emergency: 1,
  urgent: 2,
  routine: 3,
};

const STATUS: Record<string, Labelled> = {
  ordered: { tone: "urgent", label: "Ordered" },
  sample_collected: { tone: "info", label: "Sample collected" },
  in_progress: { tone: "info", label: "In progress" },
  completed: { tone: "success", label: "Completed" },
  resulted: { tone: "success", label: "Resulted" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

const SPECIMEN: Record<string, Labelled> = {
  blood: { tone: "critical", label: "Blood" },
  urine: { tone: "urgent", label: "Urine" },
  stool: { tone: "neutral", label: "Stool" },
  sputum: { tone: "info", label: "Sputum" },
  csf: { tone: "accent", label: "CSF" },
  tissue: { tone: "critical", label: "Tissue" },
  swab: { tone: "success", label: "Swab" },
  other: { tone: "neutral", label: "Other" },
};

const humanise = (v: string) =>
  (v ?? "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";

export const getUrgency = (u: string): Labelled =>
  URGENCY[u] ?? { tone: "neutral", label: humanise(u) };

export const getStatus = (s: string): Labelled =>
  STATUS[s] ?? { tone: "neutral", label: humanise(s) };

export const getSpecimen = (s: string): Labelled =>
  SPECIMEN[s] ?? { tone: "neutral", label: humanise(s) };

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
 * Lab orders arrive camelCase from Drizzle but snake_case from the raw SQL
 * paths, so every field is read both ways once, here.
 */
export function normalizeOrder(o: any) {
  return {
    ...o,
    orderedAt: o.orderedAt ?? o.ordered_at ?? null,
    specimenType: o.specimenType ?? o.specimen_type ?? "",
    visitNumber: o.visitNumber ?? o.visit_number ?? "",
    testName: o.testName ?? o.test_name ?? "",
    testCode: o.testCode ?? o.test_code ?? "",
    orderNumber: o.orderNumber ?? o.order_number ?? "",
    chiefComplaint: o.chiefComplaint ?? o.chief_complaint ?? "",
  };
}
