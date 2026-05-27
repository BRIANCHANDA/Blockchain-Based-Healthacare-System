import { Loader2, LogOut, CheckCircle2 } from "lucide-react";

export function SubmitBtn({
  onClick,
  loading,
  label,
  disabled = false,
  danger = false,
}: any) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
      style={{
        background: danger
          ? "linear-gradient(135deg,#dc2626,#b91c1c)"
          : "linear-gradient(135deg,#166534,#15803d)",
      }}
    >
      {loading ? (
        <Loader2 size={15} className="animate-spin" />
      ) : danger ? (
        <LogOut size={15} />
      ) : (
        <CheckCircle2 size={15} />
      )}
      {label}
    </button>
  );
}
