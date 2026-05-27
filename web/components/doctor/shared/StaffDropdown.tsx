import { Loader2, AlertCircle } from "lucide-react";

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

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
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-400">
        <Loader2 size={13} className="animate-spin" /> Loading staff…
      </div>
    );
  }
  if (!staff.length) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
        <AlertCircle size={13} /> No staff currently online
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none
        focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
    >
      <option value="">{placeholder}</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.firstName} {s.lastName}
          {s.specialization ? ` — ${s.specialization}` : ""}
        </option>
      ))}
    </select>
  );
}

export default StaffDropdown;
