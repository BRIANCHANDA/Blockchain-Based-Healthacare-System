"use client";
import { useState, useEffect } from "react";
import { appointmentApi, visitApi } from "@/lib/api";
import {
  X, Stethoscope, Search, CheckCircle2, Clock,
  AlertTriangle, Zap, Send, Loader2, ArrowRight, AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Specialist {
  id: string;
  name: string;
  specialization: string | null;
}

interface InternalReferralModalProps {
  visitId:        string;
  patientId:      string;
  patientName:    string;
  chiefComplaint: string;
  onClose:        () => void;
  onSuccess:      (msg: string) => void;
}

// ── Urgency config ────────────────────────────────────────────────────────────
const URGENCY = [
  { value: "routine",   label: "Routine",   desc: "Within the next few days",   color: "#166534", bg: "#f0fdf4", border: "#bbf7d0", icon: Clock         },
  { value: "urgent",    label: "Urgent",    desc: "Same day, within hours",      color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: AlertTriangle  },
  { value: "emergency", label: "Emergency", desc: "See specialist immediately",  color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", icon: AlertTriangle  },
  { value: "critical",  label: "Critical",  desc: "Life-threatening — now",      color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: Zap            },
] as const;

type UrgencyValue = "routine" | "urgent" | "emergency" | "critical";

// ── Step dot ──────────────────────────────────────────────────────────────────
function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
      style={
        done   ? { background: "#16a34a", color: "#fff" } :
        active ? { background: "#1d4ed8", color: "#fff" } :
                 { background: "#f3f4f6", color: "#9ca3af" }
      }
    >
      {done ? <CheckCircle2 className="w-4 h-4" /> : n}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function InternalReferralModal({
  visitId, patientId, patientName, chiefComplaint, onClose, onSuccess,
}: InternalReferralModalProps) {
  const [step,         setStep]         = useState<1 | 2 | 3>(1);
  const [specialists,  setSpecialists]  = useState<Specialist[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState<Specialist | null>(null);
  const [urgency,      setUrgency]      = useState<UrgencyValue>("routine");
  const [reason,       setReason]       = useState(`Internal referral: ${chiefComplaint}`);
  const [apptDate,     setApptDate]     = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [apptNumber,   setApptNumber]   = useState<string | null>(null);

  // Load practitioners at this institution with role=practitioner
  useEffect(() => {
    visitApi.getStaffByRole("practitioner")
      .then(res => {
        const staff: Specialist[] = (res.data?.data ?? []).map((s: any) => ({
          id:             s.id,
          name:           s.name,
          specialization: s.specialization ?? null,
        }));
        setSpecialists(staff);
      })
      .catch(() => setSpecialists([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = specialists.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.specialization ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selected) return;
    if (reason.trim().length < 5) { setError("Reason must be at least 5 characters."); return; }

    // For urgent/emergency/critical — book for today if no date selected
    const bookDate = apptDate
      ? new Date(apptDate).toISOString()
      : (() => {
          const d = new Date();
          if (urgency === "routine") {
            d.setDate(d.getDate() + 1); // tomorrow for routine
          } else {
            d.setHours(d.getHours() + 1); // 1hr from now for urgent+
          }
          return d.toISOString();
        })();

    setError(null);
    setSubmitting(true);
    try {
      const res = await appointmentApi.book({
        patientId,
        appointmentDate:  bookDate,
        visitType:        "consultation",
        priority:         urgency,
        chiefComplaint:     reason.trim(),
        admittingDiagnosis: reason.trim(),
        assignedDoctorId: selected.id,
        originVisitId:    visitId,
      });
      setApptNumber(res.data.data.visitNumber);
      setStep(3);
      onSuccess(`Internal referral to Dr. ${selected.name} booked — ${res.data.data.visitNumber}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to create internal referral.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedUrgency = URGENCY.find(u => u.value === urgency)!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col"
        style={{ fontFamily: "'DM Sans', sans-serif", maxHeight: "90vh" }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Internal Referral</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Referring <span className="font-semibold text-gray-700">{patientName}</span> to a specialist
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step indicators ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-3 flex-shrink-0">
          {[
            { n: 1, label: "Specialist" },
            { n: 2, label: "Details"   },
            { n: 3, label: "Done"      },
          ].map(({ n, label }, i, arr) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <StepDot n={n} active={step === n} done={step > n} />
                <span
                  className="text-xs font-semibold hidden sm:block"
                  style={{ color: step === n ? "#1d4ed8" : step > n ? "#16a34a" : "#9ca3af" }}
                >
                  {label}
                </span>
              </div>
              {i < arr.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
            </div>
          ))}
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Step 1 — Pick specialist */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">
                Select a specialist at your institution
              </p>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or specialization…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-gray-400 transition-all"
                />
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {loading ? (
                  [...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-50 animate-pulse" />)
                ) : filtered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">
                    No specialists found at your institution
                  </div>
                ) : (
                  filtered.map(spec => {
                    const isSel = selected?.id === spec.id;
                    return (
                      <button
                        key={spec.id}
                        onClick={() => setSelected(spec)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                        style={isSel
                          ? { background: "#eff6ff", borderColor: "#2563eb" }
                          : { background: "#fafafa", borderColor: "#f1f5f9" }}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
                          style={{
                            background: isSel ? "#dbeafe" : "#f1f5f9",
                            color:      isSel ? "#2563eb" : "#9ca3af",
                          }}
                        >
                          {spec.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">Dr. {spec.name}</p>
                          <p className="text-xs text-gray-400">
                            {spec.specialization ?? "General Practitioner"}
                          </p>
                        </div>
                        {isSel && <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Urgency + reason + date */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Selected specialist recap */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                <Stethoscope className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Referring to</p>
                  <p className="text-sm font-bold text-blue-900">
                    Dr. {selected?.name}
                    {selected?.specialization && (
                      <span className="font-normal text-blue-600"> · {selected.specialization}</span>
                    )}
                  </p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">
                  Change
                </button>
              </div>

              {/* Urgency */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Urgency *</p>
                <div className="grid grid-cols-2 gap-2">
                  {URGENCY.map(({ value, label, desc, color, bg, border, icon: Icon }) => {
                    const active = urgency === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setUrgency(value)}
                        className="flex items-start gap-2.5 px-3 py-3 rounded-xl border text-left transition-all"
                        style={active
                          ? { background: bg, borderColor: color, borderWidth: 1.5 }
                          : { background: "#fafafa", borderColor: "#f1f5f9" }}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: active ? color : "#9ca3af" }} />
                        <div>
                          <p className="text-sm font-bold" style={{ color: active ? color : "#374151" }}>{label}</p>
                          <p className="text-[10px] leading-tight mt-0.5" style={{ color: active ? color : "#9ca3af", opacity: active ? 0.8 : 1 }}>
                            {desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  Reason for Referral *
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="Clinical reason, working diagnosis, what you need the specialist to assess…"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none placeholder:text-gray-400 transition-all"
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">{reason.length} chars</p>
              </div>

              {/* Preferred date — optional for urgent, skipped for critical */}
              {(urgency === "routine" || urgency === "urgent") && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                    Preferred Date & Time{" "}
                    <span className="normal-case font-normal text-gray-400">
                      {urgency === "routine" ? "(optional — defaults to tomorrow)" : "(optional — defaults to 1hr from now)"}
                    </span>
                  </label>
                  <input
                    type="datetime-local"
                    value={apptDate}
                    onChange={e => setApptDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              )}

              {/* Emergency/critical note */}
              {(urgency === "emergency" || urgency === "critical") && (
                <div
                  className="flex items-start gap-2.5 px-4 py-3 rounded-xl border"
                  style={{ background: "#fef2f2", borderColor: "#fecaca" }}
                >
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 leading-relaxed">
                    <span className="font-bold capitalize">{urgency}</span> referral — appointment booked for 1 hour from now.
                    Notify Dr. {selected?.name} directly if immediate attention is required.
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Success */}
          {step === 3 && apptNumber && (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">Internal Referral Created</p>
                <p className="text-sm text-gray-500 mt-1">
                  {patientName} has been referred to{" "}
                  <span className="font-semibold text-gray-800">Dr. {selected?.name}</span>
                </p>
              </div>

              {/* Appointment number */}
              <div
                className="px-6 py-5 rounded-2xl border-2 border-dashed"
                style={{ borderColor: selectedUrgency.border, background: selectedUrgency.bg }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: selectedUrgency.color }}>
                  Appointment Number
                </p>
                <p className="text-2xl font-extrabold font-mono tracking-wide" style={{ color: selectedUrgency.color }}>
                  {apptNumber}
                </p>
                <p className="text-xs mt-2" style={{ color: selectedUrgency.color, opacity: 0.75 }}>
                  Receptionist will see this in the Appointments queue
                </p>
              </div>

              {/* Urgency tag */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: selectedUrgency.bg, color: selectedUrgency.color, border: `1px solid ${selectedUrgency.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedUrgency.color }} />
                {selectedUrgency.label} urgency
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          {step === 1 && (
            <>
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all">
                Cancel
              </button>
              <button
                onClick={() => selected && setStep(2)}
                disabled={!selected}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #1d4ed8, #1e40af)" }}
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button onClick={() => { setStep(1); setError(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all">
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || reason.trim().length < 5}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? "Booking…" : "Book Referral"}
              </button>
            </>
          )}

          {step === 3 && (
            <button onClick={onClose}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #166534, #15803d)" }}>
              <CheckCircle2 className="w-4 h-4" /> Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}