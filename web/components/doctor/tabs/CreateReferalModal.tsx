"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  X,
  Building2,
  Search,
  CheckCircle2,
  Clock,
  Zap,
  AlertTriangle,
  Send,
  Loader2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Institution {
  id: string;
  institutionName: string;
  institutionType: string;
  institutionCode: string;
}

interface CreateReferralModalProps {
  visitId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  onClose: () => void;
  onSuccess: (referralNumber: string) => void;
}

type UrgencyValue = "routine" | "urgent" | "emergency" | "critical";

const URGENCY = [
  {
    value: "routine" as UrgencyValue,
    label: "Routine",
    desc: "Non-urgent, within days",
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    icon: Clock,
  },
  {
    value: "urgent" as UrgencyValue,
    label: "Urgent",
    desc: "Attention within hours",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    icon: AlertTriangle,
  },
  {
    value: "emergency" as UrgencyValue,
    label: "Emergency",
    desc: "Prompt transfer today",
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    icon: AlertTriangle,
  },
  {
    value: "critical" as UrgencyValue,
    label: "Critical",
    desc: "Immediate, life-threatening",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: Zap,
  },
] as const;

// ── Step dot ──────────────────────────────────────────────────────────────────
function StepDot({
  n,
  active,
  done,
}: {
  n: number;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
      style={
        done
          ? { background: "#16a34a", color: "#fff" }
          : active
            ? { background: "#1d4ed8", color: "#fff" }
            : { background: "#f3f4f6", color: "#9ca3af" }
      }
    >
      {done ? <CheckCircle2 className="w-4 h-4" /> : n}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function CreateReferralModal({
  visitId,
  patientId,
  patientName,
  chiefComplaint,
  onClose,
  onSuccess,
}: CreateReferralModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loadingInst, setLoadingInst] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Institution | null>(null);
  const [urgency, setUrgency] = useState<UrgencyValue>("routine");
  const [reason, setReason] = useState("");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralNumber, setReferralNumber] = useState<string | null>(null);

  // Pre-fill reason from chief complaint
  useEffect(() => {
    if (chiefComplaint) setReason(`Referral for: ${chiefComplaint}`);
  }, [chiefComplaint]);

  // Load institutions
  useEffect(() => {
    api
      .get("/api/institutions")
      .then((res) =>
        setInstitutions(
          res.data?.data?.institutions ?? res.data?.institutions ?? [],
        ),
      )
      .catch(() => setInstitutions([]))
      .finally(() => setLoadingInst(false));
  }, []);

  const filtered = institutions.filter(
    (i) =>
      i.institutionName.toLowerCase().includes(search.toLowerCase()) ||
      i.institutionCode.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSubmit = async () => {
    if (!selected) return;
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    if (clinicalSummary.trim().length < 10) {
      setError("Clinical summary must be at least 10 characters.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/api/referrals", {
        patientId,
        visitId,
        receivingInstitutionId: selected.id,
        reason: reason.trim(),
        clinicalSummary: clinicalSummary.trim(),
        urgency,
      });
      const num = res.data.data.referralNumber;
      setReferralNumber(num);
      setStep(3); // show success screen first
      onSuccess(num); // notify parent (parent should NOT close modal immediately)
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to create referral.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const urgencyCfg = URGENCY.find((u) => u.value === urgency)!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
        style={{ fontFamily: "'DM Sans', sans-serif", maxHeight: "90vh" }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Create Referral
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Referring{" "}
              <span className="font-semibold text-gray-700">{patientName}</span>{" "}
              to another institution
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step indicators ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-3 flex-shrink-0">
          {[
            { n: 1, label: "Institution" },
            { n: 2, label: "Details" },
            { n: 3, label: "Done" },
          ].map(({ n, label }, i, arr) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <StepDot n={n} active={step === n} done={step > n} />
                <span
                  className="text-xs font-semibold hidden sm:block"
                  style={{
                    color:
                      step === n ? "#1d4ed8" : step > n ? "#16a34a" : "#9ca3af",
                  }}
                >
                  {label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-px bg-gray-200 mx-2" />
              )}
            </div>
          ))}
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Step 1 — Institution picker */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">
                Select receiving institution
              </p>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or code…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-gray-400 transition-all"
                />
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {loadingInst ? (
                  [...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-14 rounded-xl bg-gray-50 animate-pulse"
                    />
                  ))
                ) : filtered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">
                    No institutions found
                  </div>
                ) : (
                  filtered.map((inst) => {
                    const isSel = selected?.id === inst.id;
                    return (
                      <button
                        key={inst.id}
                        onClick={() => setSelected(inst)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                        style={
                          isSel
                            ? { background: "#eff6ff", borderColor: "#2563eb" }
                            : { background: "#fafafa", borderColor: "#f1f5f9" }
                        }
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: isSel ? "#dbeafe" : "#f1f5f9" }}
                        >
                          <Building2
                            className="w-4 h-4"
                            style={{ color: isSel ? "#2563eb" : "#9ca3af" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {inst.institutionName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {inst.institutionCode} · {inst.institutionType}
                          </p>
                        </div>
                        {isSel && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Urgency + details */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Institution recap */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">
                    Referring to
                  </p>
                  <p className="text-sm font-bold text-blue-900 truncate">
                    {selected?.institutionName}
                  </p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-semibold"
                >
                  Change
                </button>
              </div>

              {/* Urgency */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Urgency *
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {URGENCY.map(
                    ({ value, label, desc, color, bg, border, icon: Icon }) => {
                      const active = urgency === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setUrgency(value)}
                          className="flex items-start gap-2.5 px-3 py-3 rounded-xl border text-left transition-all"
                          style={
                            active
                              ? { background: bg, borderColor: color }
                              : {
                                  background: "#fafafa",
                                  borderColor: "#f1f5f9",
                                }
                          }
                        >
                          <Icon
                            className="w-4 h-4 flex-shrink-0 mt-0.5"
                            style={{ color: active ? color : "#9ca3af" }}
                          />
                          <div>
                            <p
                              className="text-sm font-bold"
                              style={{ color: active ? color : "#374151" }}
                            >
                              {label}
                            </p>
                            <p
                              className="text-[10px] leading-tight mt-0.5"
                              style={{
                                color: active ? color : "#9ca3af",
                                opacity: active ? 0.75 : 1,
                              }}
                            >
                              {desc}
                            </p>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  Reason for Referral *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why is this patient being referred? (min. 10 characters)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none placeholder:text-gray-400 transition-all"
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">
                  {reason.length} chars
                </p>
              </div>

              {/* Clinical summary */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  Clinical Summary *
                </label>
                <textarea
                  value={clinicalSummary}
                  onChange={(e) => setClinicalSummary(e.target.value)}
                  rows={4}
                  placeholder="Relevant history, investigations done, current medications, allergies, working diagnosis…"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none placeholder:text-gray-400 transition-all"
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">
                  {clinicalSummary.length} chars
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Success */}
          {step === 3 && referralNumber && (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">
                  Referral Created
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {patientName} has been referred to{" "}
                  <span className="font-semibold text-gray-800">
                    {selected?.institutionName}
                  </span>
                </p>
              </div>

              {/* Referral number — most important thing on this screen */}
              <div className="px-6 py-5 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-2">
                  Referral Number
                </p>
                <p className="text-2xl font-extrabold text-blue-900 font-mono tracking-wide">
                  {referralNumber}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Tell this number to the patient — they will present it at{" "}
                  {selected?.institutionName}
                </p>
              </div>

              {/* Urgency recap */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: urgencyCfg.bg,
                  color: urgencyCfg.color,
                  border: `1px solid ${urgencyCfg.border}`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: urgencyCfg.color }}
                />
                {urgencyCfg.label} urgency
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          {step === 1 && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => selected && setStep(2)}
                disabled={!selected}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
                }}
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  reason.trim().length < 10 ||
                  clinicalSummary.trim().length < 10
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? "Sending…" : "Send Referral"}
              </button>
            </>
          )}

          {step === 3 && (
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              <CheckCircle2 className="w-4 h-4" /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
