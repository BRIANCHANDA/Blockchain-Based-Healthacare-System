import { Loader2, AlertCircle } from "lucide-react";
import { Select } from "@/components/dashboard/ui";

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

/**
 * Picks a member of staff who is currently online.
 *
 * Renders three distinct states rather than an empty dropdown: loading, the
 * "nobody is online" case (which is actionable information, not an error),
 * and the populated select.
 */
export function StaffDropdown({
  value,
  onChange,
  staff,
  loading,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  staff: StaffMember[];
  loading: boolean;
  placeholder: string;
}) {
  if (loading) {
    return (
      <div
        className="flex items-center"
        style={{
          gap: 8,
          height: 40,
          padding: "0 12px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--hc-border)",
          background: "var(--surface-sunken)",
          font: "400 13px/1 var(--font-sans)",
          color: "var(--text-muted)",
        }}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading staff…
      </div>
    );
  }

  if (!staff.length) {
    return (
      <div
        className="flex items-center"
        style={{
          gap: 8,
          height: 40,
          padding: "0 12px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--amber-100)",
          background: "var(--amber-050)",
          font: "500 13px/1 var(--font-sans)",
          color: "var(--urgent-ink)",
        }}
      >
        <AlertCircle className="w-3.5 h-3.5" />
        No staff currently online
      </div>
    );
  }

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.firstName} {s.lastName}
          {s.specialization ? ` — ${s.specialization}` : ""}
        </option>
      ))}
    </Select>
  );
}

export default StaffDropdown;
