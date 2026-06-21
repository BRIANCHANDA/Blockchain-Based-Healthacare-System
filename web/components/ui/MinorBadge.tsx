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
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
        <Baby size={11} />
        Minor{age !== undefined ? ` · ${age}y` : ""}
      </span>
      {primaryGuardianName && (
        <span className="text-[10px] text-gray-400 leading-tight pl-1">
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
