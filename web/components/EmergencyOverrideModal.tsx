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
  // What the server actually unlocked. An override can succeed as an audited
  // action while granting nothing (e.g. the patient has no records elsewhere),
  // so we show the server's own account of it rather than assuming success.
  const [result, setResult] = useState<{
    sourcesGranted?: number;
    sourcesFound?: number;
    sourcesFailed?: number;
    message?: string;
  } | null>(null);

  if (!open) return null;

  const valid = reason.trim().length >= 20;

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await (permissionApi as any).emergencyOverride({ patientId, reason: reason.trim() });
      const data = res?.data?.data ?? {};
      setResult(data);
      setGranted(true);
      // Only auto-dismiss when records were actually unlocked. If nothing was
      // granted, leave the explanation on screen for the clinician to read.
      if ((data.sourcesGranted ?? 0) > 0) {
        setTimeout(() => { onGranted(); setGranted(false); setResult(null); setReason(""); }, 1800);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Override failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] shadow-[var(--elev-3)] w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Red header */}
        <div className="px-6 py-4 border-b" style={{ background: "var(--critical-ink)", borderColor: "transparent" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[var(--r-sm)] flex items-center justify-center" style={{ background: "var(--on-dark-raise)" }}>
                <ShieldAlert size={20} style={{ color: "var(--white)" }} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--white)]">Emergency Access Override</h2>
                <p className="text-xs text-[var(--coral-100)] mt-0.5">
                  {patientName ? `Patient: ${patientName}` : "Bypass patient consent"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-[var(--r-xs)] hover:bg-[var(--on-dark-raise)]">
              <X size={18} style={{ color: "var(--on-dark-text)" }} />
            </button>
          </div>
        </div>

        {granted ? (
          (result?.sourcesGranted ?? 0) > 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: "var(--brand)" }} />
              <p className="text-base font-bold text-[var(--text-primary)]">Access granted — 24 hours</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {result?.message ?? "Permanently recorded on the audit trail."}
              </p>
            </div>
          ) : (
            <div className="p-8 text-center">
              <AlertTriangle size={40} className="mx-auto mb-3" style={{ color: "var(--urgent)" }} />
              <p className="text-base font-bold text-[var(--text-primary)]">Nothing to unlock</p>
              <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                {result?.message ??
                  "The override was logged, but no records at other institutions were unlocked."}
              </p>
              <button
                onClick={() => { setGranted(false); setResult(null); setReason(""); onClose(); }}
                className="mt-5 px-4 py-2 rounded-[var(--r-sm)] text-xs font-semibold bg-[var(--surface-inset)] text-[var(--text-primary)] hover:bg-[var(--border-faint)] transition-all"
              >
                Close
              </button>
            </div>
          )
        ) : (
          <>
            <div className="p-6 space-y-4">
              {/* Warning */}
              <div className="p-3.5 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)]">
                <p className="text-xs text-[var(--critical-ink)] leading-relaxed">
                  <strong>This action cannot be undone or hidden.</strong> The override is
                  permanently anchored on the blockchain and the patient will see it flagged
                  in their access history — including your name and this reason. Use only when
                  the patient cannot consent (unconscious, critical condition) and access is
                  clinically necessary.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--text-muted)] block mb-1.5">
                  Clinical justification * <span className="font-normal normal-case">(min 20 characters)</span>
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  placeholder="e.g. Patient unconscious following RTA, need allergy history before administering medication…"
                  className="w-full px-3.5 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-inset)] text-sm outline-none focus:border-[var(--critical)] focus:bg-[var(--surface-card)] resize-none placeholder:text-[var(--text-muted)]" />
                <p className="text-[10px] mt-1 text-right" style={{ color: valid ? "var(--brand)" : "var(--text-muted)" }}>
                  {reason.trim().length}/20
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)] text-sm text-[var(--critical-ink)]">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[var(--border-faint)] flex items-center justify-end gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-inset)]">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={!valid || submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-[var(--r-sm)] text-sm font-bold disabled:opacity-50"
                style={{ background: "var(--critical-ink)", color: "var(--white)" }}>
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