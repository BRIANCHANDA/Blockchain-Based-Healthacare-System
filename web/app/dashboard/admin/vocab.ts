import type { Tone } from "@/components/dashboard/ui";

/* ==========================================================================
   Admin vocabulary.

   Keys mirror backend/src/db/schema.ts exactly:

     userTypeEnum        patient | practitioner | nurse | lab_technician
                         | radiologist | pharmacist | admin | receptionist
     encounterStatusEnum scheduled | in-progress | completed | cancelled
     actionTypeEnum      view | create | update | delete | permission_grant
                         | permission_revoke | emergency_override
     requestStatusEnum   pending | approved | rejected | expired
     permissionTypeEnum  read | write | full
     priorityLevelEnum   routine | urgent | emergency | critical

   Institution and ward types are free-text columns, so those fall back
   gracefully on anything unexpected.
   ========================================================================== */

export type Labelled = { tone: Tone; label: string };

/* "practitioner" is the DB value; everyone calls them doctors. */
const ROLE: Record<string, Labelled> = {
  practitioner: { tone: "info", label: "Doctor" },
  nurse: { tone: "success", label: "Nurse" },
  lab_technician: { tone: "urgent", label: "Lab technician" },
  radiologist: { tone: "accent", label: "Radiologist" },
  pharmacist: { tone: "brand", label: "Pharmacist" },
  receptionist: { tone: "info", label: "Receptionist" },
  admin: { tone: "critical", label: "Administrator" },
  patient: { tone: "neutral", label: "Patient" },
};

const VISIT_STATUS: Record<string, Labelled> = {
  scheduled: { tone: "info", label: "Scheduled" },
  "in-progress": { tone: "urgent", label: "In progress" },
  completed: { tone: "success", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

/* Destructive and consent-changing actions read louder than reads. */
const ACTION: Record<string, Labelled> = {
  view: { tone: "neutral", label: "View" },
  create: { tone: "success", label: "Create" },
  update: { tone: "info", label: "Update" },
  delete: { tone: "critical", label: "Delete" },
  permission_grant: { tone: "success", label: "Permission granted" },
  permission_revoke: { tone: "urgent", label: "Permission revoked" },
  emergency_override: { tone: "critical", label: "Emergency override" },
};

const REQUEST_STATUS: Record<string, Labelled> = {
  pending: { tone: "urgent", label: "Pending" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "critical", label: "Rejected" },
  expired: { tone: "neutral", label: "Expired" },
};

/* Access widens read → write → full. */
const PERMISSION: Record<string, Labelled> = {
  read: { tone: "info", label: "Read" },
  write: { tone: "urgent", label: "Write" },
  full: { tone: "critical", label: "Full" },
};

const PRIORITY: Record<string, Labelled> = {
  routine: { tone: "success", label: "Routine" },
  urgent: { tone: "urgent", label: "Urgent" },
  emergency: { tone: "critical", label: "Emergency" },
  critical: { tone: "accent", label: "Critical" },
};

const GENDER: Record<string, Tone> = {
  male: "info",
  female: "accent",
  other: "neutral",
};

const humanise = (v: string) =>
  (v ?? "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";

const lookup = (map: Record<string, Labelled>, k: string): Labelled =>
  map[k] ?? { tone: "neutral", label: humanise(k) };

export const getRole = (r: string) => lookup(ROLE, r);
export const getVisitStatus = (s: string) => lookup(VISIT_STATUS, s);
export const getAction = (a: string) => lookup(ACTION, a);
export const getRequestStatus = (s: string) => lookup(REQUEST_STATUS, s);
export const getPermission = (p: string) => lookup(PERMISSION, p);
export const getPriority = (p: string) => lookup(PRIORITY, p);
export const getGenderTone = (g: string): Tone => GENDER[g] ?? "neutral";

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
