import type { Tone } from "@/components/dashboard/ui";

/* ==========================================================================
   Nurse vocabulary.

   Priority mirrors priorityLevelEnum in backend/src/db/schema.ts
   (routine | urgent | emergency | critical).

   Bed status and ward type are free-text columns rather than enums —
   ward_beds.status is documented in the schema as
   "available | occupied | maintenance", and wards.ward_type is unconstrained
   — so both fall back gracefully on anything unexpected.
   ========================================================================== */

export type Labelled = { tone: Tone; label: string };

const PRIORITY: Record<string, Labelled> = {
  routine: { tone: "success", label: "Routine" },
  urgent: { tone: "urgent", label: "Urgent" },
  emergency: { tone: "critical", label: "Emergency" },
  critical: { tone: "accent", label: "Critical" },
};

/** Sort weight — lower is more urgent. */
export const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  emergency: 1,
  urgent: 2,
  routine: 3,
};

const BED_STATUS: Record<string, Labelled> = {
  available: { tone: "success", label: "Available" },
  occupied: { tone: "info", label: "Occupied" },
  maintenance: { tone: "urgent", label: "Maintenance" },
};

const WARD_TYPE: Record<string, Tone> = {
  icu: "accent",
  general: "info",
  maternity: "critical",
  paediatric: "success",
  surgical: "urgent",
  isolation: "critical",
};

const humanise = (v: string) =>
  (v ?? "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";

export const getPriority = (p: string): Labelled =>
  PRIORITY[p] ?? { tone: "neutral", label: humanise(p) };

export const getBedStatus = (s: string): Labelled =>
  BED_STATUS[s] ?? { tone: "neutral", label: humanise(s) };

export const getWardTone = (t: string): Tone =>
  WARD_TYPE[(t ?? "").toLowerCase()] ?? "neutral";

/* ── Shared helpers ──────────────────────────────────────────────────────── */

/** Initials for an avatar, tolerant of missing or single-word names. */
export function getInitials(name: string) {
  return (
    (name ?? "")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/** Elapsed time as "43m" / "2h 5m". Returns "—" for missing or bad dates. */
export function timeSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/* ── Vital-sign ranges ───────────────────────────────────────────────────── */

/**
 * Classify a vital against [normalLow, normalHigh, criticalLow, criticalHigh].
 * Outside the critical bounds is "critical"; outside normal but inside
 * critical is "warning". Measurements with no range (weight, height) read as
 * normal — they carry no threshold on their own.
 */
export function vitalStatus(
  key: string,
  val?: number | null,
): "normal" | "warning" | "critical" | "empty" {
  if (val == null) return "empty";
  const ranges: Record<string, [number, number, number, number]> = {
    temperature: [35.5, 37.5, 34, 39],
    bloodPressureSystolic: [90, 140, 80, 180],
    bloodPressureDiastolic: [60, 90, 50, 120],
    pulseRate: [60, 100, 40, 140],
    respiratoryRate: [12, 20, 8, 30],
    oxygenSaturation: [95, 100, 90, 100],
  };
  const r = ranges[key];
  if (!r) return "normal";
  const [lo, hi, cLo, cHi] = r;
  if (val < cLo || val > cHi) return "critical";
  if (val < lo || val > hi) return "warning";
  return "normal";
}

export const VITAL_TONE: Record<string, Tone> = {
  normal: "success",
  warning: "urgent",
  critical: "critical",
  empty: "neutral",
};
