"use client";
import { Baby } from "lucide-react";

type Props = {
  age?: number;
  primaryGuardianName?: string | null;
  primaryGuardianRelationship?: string | null;
  className?: string;
};

export function MinorBadge({ age, primaryGuardianName, primaryGuardianRelationship, className = "" }: Props) {
  return (
    <span className={`inline-flex flex-col gap-0.5 ${className}`}>
      {/* Minor status carries the "urgent" tone: it gates consent, so it should
          read as a caution rather than as neutral demographic trivia. */}
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--urgent-tint)] px-2 py-0.5 text-xs font-semibold text-[var(--urgent-ink)] border border-[var(--amber-500)]">
        <Baby size={11} />
        Minor{age !== undefined ? ` · ${age}y` : ""}
      </span>
      {primaryGuardianName && (
        <span className="text-[10px] text-[var(--text-muted)] leading-tight pl-1">
          Guardian: {primaryGuardianName}{primaryGuardianRelationship ? ` (${primaryGuardianRelationship})` : ""}
        </span>
      )}
    </span>
  );
}

// Compute age from ISO date string
export function ageFromDob(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
