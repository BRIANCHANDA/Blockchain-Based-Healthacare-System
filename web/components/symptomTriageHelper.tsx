"use client";
import { useState, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Activity,
  ChevronRight,
} from "lucide-react";
import { askClaude } from "@/lib/ai";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TriageResult {
  priority: "routine" | "urgent" | "emergency" | "critical";
  confidence: "high" | "medium" | "low";
  reasoning: string;
  redFlags: string[];
  suggestedVisitType: "outpatient" | "inpatient" | "emergency" | "consultation";
  recommendation: string;
}

interface SymptomTriageHelperProps {
  onTriageComplete?: (result: TriageResult) => void;
}

// ── Priority config ───────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  routine: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    label: "Routine",
    icon: CheckCircle2,
    desc: "Can wait — schedule normally",
  },
  urgent: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    label: "Urgent",
    icon: AlertTriangle,
    desc: "See within 1–2 hours",
  },
  emergency: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    label: "Emergency",
    icon: AlertCircle,
    desc: "Immediate attention required",
  },
  critical: {
    color: "#7c3aed",
    bg: "#fdf4ff",
    border: "#ddd6fe",
    label: "Critical",
    icon: Zap,
    desc: "Life-threatening — resuscitation bay",
  },
};

const COMMON_COMPLAINTS = [
  "Fever and chills",
  "Chest pain",
  "Difficulty breathing",
  "Severe headache",
  "Abdominal pain",
  "Trauma / injury",
  "Unconscious / unresponsive",
  "Pregnancy-related",
  "Persistent vomiting",
  "Eye pain / vision loss",
];

// ── Main component ────────────────────────────────────────────────────────────
export function SymptomTriageHelper({
  onTriageComplete,
}: SymptomTriageHelperProps) {
  const [complaint, setComplaint] = useState("");
  const [duration, setDuration] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState("");

  const buildPrompt = useCallback(() => {
    return `You are a triage assistant for MedLink, a Zambian hospital EMR.
A patient has arrived at the front desk. Based on the chief complaint, determine the triage priority.

Chief complaint: "${complaint}"
${duration ? `Duration: ${duration}` : ""}

Respond ONLY with a valid JSON object — no preamble, no markdown:
{
  "priority": "routine" | "urgent" | "emergency" | "critical",
  "confidence": "high" | "medium" | "low",
  "reasoning": "1-2 sentence clinical reasoning",
  "redFlags": ["list", "of", "red", "flag", "symptoms", "if", "any"],
  "suggestedVisitType": "outpatient" | "inpatient" | "emergency" | "consultation",
  "recommendation": "1 sentence action for the receptionist"
}

Triage criteria for Zambian context:
- critical: airway compromise, cardiac arrest, severe trauma, unconscious, eclampsia, septic shock
- emergency: chest pain, stroke signs, severe respiratory distress, major trauma, severe bleeding, altered consciousness
- urgent: moderate pain, high fever (>39°C), vomiting/diarrhea with dehydration, moderate trauma
- routine: mild symptoms, chronic condition review, follow-up, minor complaints

Be conservative — when in doubt, escalate.`;
  }, [complaint, duration]);

  const generate = useCallback(async () => {
    if (!complaint.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);

    try {
      const raw = await askClaude(buildPrompt(), 800);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean) as TriageResult;
      setResult(parsed);
      onTriageComplete?.(parsed);
    } catch (err) {
      setError("Failed to assess triage. Use manual priority selection.");
      console.error("[TRIAGE_AI]", err);
    } finally {
      setGenerating(false);
    }
  }, [buildPrompt, onTriageComplete]);

  const cfg = result ? PRIORITY_CONFIG[result.priority] : null;
  const PriorityIcon = cfg?.icon ?? CheckCircle2;

  return (
    <div className="space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#052e16,#166534)" }}
        >
          <Activity className="w-4 h-4 text-green-300" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Triage Assistant</p>
          <p className="text-[11px] text-gray-400">
            Enter chief complaint to get suggested priority
          </p>
        </div>
      </div>

      {/* ── Common complaints ────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
          Common Complaints
        </p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_COMPLAINTS.map((c) => (
            <button
              key={c}
              onClick={() => setComplaint(c)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors"
              style={{
                background: complaint === c ? "#f0fdf4" : "#fff",
                borderColor: complaint === c ? "#bbf7d0" : "#e5e7eb",
                color: complaint === c ? "#166534" : "#6b7280",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
            Chief Complaint
          </label>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            rows={2}
            placeholder="Describe the patient's main symptoms…"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 focus:bg-white transition-colors resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
            Duration (optional)
          </label>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 2 days, since this morning, 1 week"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 focus:bg-white transition-colors"
          />
        </div>

        <button
          onClick={generate}
          disabled={generating || !complaint.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#052e16,#166534)" }}
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Assessing…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Assess Triage Priority
            </>
          )}
        </button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs font-semibold text-red-700">{error}</p>
        </div>
      )}

      {/* ── Generating ───────────────────────────────────────────────────── */}
      {generating && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100">
          <div className="w-5 h-5 border-2 border-green-300 border-t-green-600 rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm font-semibold text-green-700">
            Assessing priority level…
          </p>
        </div>
      )}

      {/* ── Result ───────────────────────────────────────────────────────── */}
      {result && !generating && cfg && (
        <div className="space-y-3">
          {/* Priority banner */}
          <div
            className="relative rounded-2xl overflow-hidden p-4 border"
            style={{ background: cfg.bg, borderColor: cfg.border }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${cfg.color}15` }}
              >
                <PriorityIcon
                  className="w-6 h-6"
                  style={{ color: cfg.color }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p
                    className="text-lg font-black"
                    style={{ color: cfg.color }}
                  >
                    {cfg.label}
                  </p>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${cfg.color}15`, color: cfg.color }}
                  >
                    {result.confidence} confidence
                  </span>
                </div>
                <p
                  className="text-xs font-semibold"
                  style={{ color: cfg.color, opacity: 0.7 }}
                >
                  {cfg.desc}
                </p>
              </div>
            </div>

            {/* Reasoning */}
            <div
              className="mt-3 pt-3 border-t"
              style={{ borderColor: cfg.border }}
            >
              <p className="text-xs text-gray-700 leading-relaxed">
                {result.reasoning}
              </p>
            </div>
          </div>

          {/* Red flags */}
          {result.redFlags?.length > 0 && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-2">
                ⚠ Red Flags Detected
              </p>
              <div className="space-y-1">
                {result.redFlags.map((flag, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <p className="text-xs font-semibold text-red-700">{flag}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Recommendation
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {result.recommendation}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Suggested visit type:{" "}
                <span className="font-semibold capitalize">
                  {result.suggestedVisitType}
                </span>
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              AI suggestion only. Always defer to clinical staff for final
              triage decisions. Do not use as sole basis for priority
              assignment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
