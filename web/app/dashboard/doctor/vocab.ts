import type { Tone } from "@/components/dashboard/ui";

/* ==========================================================================
   Doctor vocabulary.

   Keys mirror backend/src/db/schema.ts:

     priorityLevelEnum  routine | urgent | emergency | critical
     visitStatusEnum    the lifecycle a visit moves through

   Radiology keeps its own vocab module for modality; priority is duplicated
   between the two rather than shared, because two copies of a four-entry map
   is cheaper than a cross-role abstraction. Worth promoting to a shared
   lib/ module once a third role needs it.
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

const humanise = (v: string) =>
  (v ?? "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";

export const getPriority = (p: string): Labelled =>
  PRIORITY[p] ?? { tone: "neutral", label: humanise(p) };

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

/** Elapsed time as "43m" / "2h 5m". */
export function waitLabel(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}
