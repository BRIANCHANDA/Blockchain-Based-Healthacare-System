import {
  Clock,
  AlertTriangle,
  Zap,
  Hourglass,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { Tone } from "@/components/dashboard/ui";

/* ==========================================================================
   Referral vocabulary — shared by ReferralTab, DoctorReferralsPage and the
   two referral modals, which previously each declared their own copy with
   slightly different colours for the same states.

   Keys mirror backend/src/db/schema.ts:
     priorityLevelEnum  routine | urgent | emergency | critical
     referral status    pending | accepted | completed | rejected | cancelled
   ========================================================================== */

export type Labelled = { tone: Tone; label: string; icon: React.ElementType };

const URGENCY: Record<string, Labelled> = {
  routine: { tone: "success", label: "Routine", icon: Clock },
  urgent: { tone: "urgent", label: "Urgent", icon: AlertTriangle },
  emergency: { tone: "critical", label: "Emergency", icon: AlertTriangle },
  critical: { tone: "accent", label: "Critical", icon: Zap },
};

const STATUS: Record<string, Labelled> = {
  pending: { tone: "urgent", label: "Pending", icon: Hourglass },
  accepted: { tone: "info", label: "Accepted", icon: CheckCircle2 },
  completed: { tone: "success", label: "Completed", icon: CheckCircle2 },
  rejected: { tone: "critical", label: "Rejected", icon: XCircle },
  cancelled: { tone: "neutral", label: "Cancelled", icon: XCircle },
};

const humanise = (v: string) =>
  (v ?? "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";

export const getReferralUrgency = (u: string): Labelled =>
  URGENCY[u] ?? { tone: "neutral", label: humanise(u), icon: Clock };

export const getReferralStatus = (s: string): Labelled =>
  STATUS[s] ?? { tone: "neutral", label: humanise(s), icon: Hourglass };
