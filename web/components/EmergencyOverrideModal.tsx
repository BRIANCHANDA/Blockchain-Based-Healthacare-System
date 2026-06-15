// web/src/components/EmergencyOverrideModal.tsx
//
// Usage (on any page where staff hit a "no access" wall, e.g. patient detail
// or visit summary 403):
//
//   import EmergencyOverrideModal from "@/components/EmergencyOverrideModal";
//
//   const [showOverride, setShowOverride] = useState(false);
//   ...
//   <button onClick={() => setShowOverride(true)} className="...">
//     <ShieldAlert size={14} /> Emergency Access
//   </button>
//   <EmergencyOverrideModal
//     open={showOverride}
//     patientId={patientId}
//     patientName={patientName}
//     onClose={() => setShowOverride(false)}
//     onGranted={() => { setShowOverride(false); refetch(); }}
//   />
//
// Also add to web/src/lib/api.ts permissionApi:
//   emergencyOverride: (data: { patientId: string; reason: string }) =>
//       api.post('/api/permissions/emergency-override', data),

"use client";
import { useState } from "react";
import { permissionApi } from "@/lib/api";
import { ShieldAlert, Loader2, X, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function EmergencyOverrideModal({
  open, patientId, patientName, onClose, onGranted,
}: {
  open: boolean;
  patientId: string;
  patientName?: string;
  onClose: () => void;
  onGranted: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [granted, setGranted] = useState(false);

  if (!open) return null;

  const valid = reason.trim().length >= 20;

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError("");
    try {
      await (permissionApi as any).emergencyOverride({ patientId, reason: reason.trim() });
      setGranted(true);
      setTimeout(() => { onGranted(); setGranted(false); setReason(""); }, 1800);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Override failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,14,26,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Red header */}
        <div className="px-6 py-4 border-b" style={{ background: "linear-gradient(135deg,#7f1d1d,#991b1b)", borderColor: "transparent" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                <ShieldAlert size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Emergency Access Override</h2>
                <p className="text-xs text-red-200 mt-0.5">
                  {patientName ? `Patient: ${patientName}` : "Bypass patient consent"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
              <X size={18} className="text-white/70" />
            </button>
          </div>
        </div>

        {granted ? (
          <div className="p-10 text-center">
            <CheckCircle2 size={40} className="text-green-600 mx-auto mb-3" />
            <p className="text-base font-bold text-gray-900">Access granted — 24 hours</p>
            <p className="text-xs text-gray-500 mt-1">Permanently recorded on the audit trail.</p>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              {/* Warning */}
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100">
                <p className="text-xs text-red-800 leading-relaxed">
                  <strong>This action cannot be undone or hidden.</strong> The override is
                  permanently anchored on the blockchain and the patient will see it flagged
                  in their access history — including your name and this reason. Use only when
                  the patient cannot consent (unconscious, critical condition) and access is
                  clinically necessary.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  Clinical justification * <span className="font-normal normal-case">(min 20 characters)</span>
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  placeholder="e.g. Patient unconscious following RTA, need allergy history before administering medication…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-red-400 focus:bg-white resize-none placeholder:text-gray-400" />
                <p className="text-[10px] mt-1 text-right" style={{ color: valid ? "#16a34a" : "#9ca3af" }}>
                  {reason.trim().length}/20
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={!valid || submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                {submitting ? "Granting…" : "Grant Emergency Access"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}