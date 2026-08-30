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
// Tones match the app-wide priority mapping in the role vocab modules
// (routine=success, urgent=urgent, emergency=critical, critical=accent), so a
// suggestion here is the same colour as the priority it would set.
// `tint` exists because the old code built washes by string-appending "15" to a
// hex value — that trick cannot work once the colour is a var().
const PRIORITY_CONFIG = {
  routine: {
    color: "var(--success-ink)",
    bg: "var(--green-050)",
    border: "var(--green-200)",
    tint: "var(--brand-tint)",
    label: "Routine",
    icon: CheckCircle2,
    desc: "Can wait — schedule normally",
  },
  urgent: {
    color: "var(--urgent-ink)",
    bg: "var(--amber-050)",
    border: "var(--urgent-tint)",
    tint: "var(--urgent-tint)",
    label: "Urgent",
    icon: AlertTriangle,
    desc: "See within 1–2 hours",
  },
  emergency: {
    color: "var(--critical-ink)",
    bg: "var(--coral-050)",
    border: "var(--critical-tint)",
    tint: "var(--critical-tint)",
    label: "Emergency",
    icon: AlertCircle,
    desc: "Immediate attention required",
  },
  critical: {
    color: "var(--accent-ink)",
    bg: "var(--violet-050)",
    border: "var(--accent-tint)",
    tint: "var(--accent-tint)",
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
    <div className="space-y-4" style={{ fontFamily: "var(--font-sans)" }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-[var(--r-sm)] flex items-center justify-center"
          style={{ background: "var(--brand-deep)" }}
        >
          <Activity className="w-4 h-4 text-[var(--green-300)]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">Triage Assistant</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Enter chief complaint to get suggested priority
          </p>
        </div>
      </div>

      {/* ── Common complaints ────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--text-muted)] mb-2">
          Common Complaints
        </p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_COMPLAINTS.map((c) => (
            <button
              key={c}
              onClick={() => setComplaint(c)}
              className="px-2.5 py-1 rounded-[var(--r-xs)] text-xs font-semibold border transition-colors"
              style={{
                background: complaint === c ? "var(--brand-tint)" : "var(--surface-card)",
                borderColor: complaint === c ? "var(--green-200)" : "var(--hc-border)",
                color: complaint === c ? "var(--success-ink)" : "var(--text-secondary)",
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
          <label className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--text-muted)] block mb-1.5">
            Chief Complaint
          </label>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            rows={2}
            placeholder="Describe the patient's main symptoms…"
            className="w-full px-4 py-3 rounded-[var(--r-sm)] border border-[var(--hc-border)] text-sm text-[var(--text-primary)] bg-[var(--surface-inset)] focus:outline-none focus:border-[var(--brand)] focus:bg-[var(--surface-card)] transition-colors resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--text-muted)] block mb-1.5">
            Duration (optional)
          </label>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 2 days, since this morning, 1 week"
            className="w-full px-4 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] text-sm text-[var(--text-primary)] bg-[var(--surface-inset)] focus:outline-none focus:border-[var(--brand)] focus:bg-[var(--surface-card)] transition-colors"
          />
        </div>

        <button
          onClick={generate}
          disabled={generating || !complaint.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--r-sm)] text-sm font-bold transition-all disabled:opacity-50"
          style={{ background: "var(--brand)", color: "var(--on-brand)" }}
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
        <div className="flex items-center gap-2.5 p-3 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)]">
          <AlertCircle className="w-4 h-4 text-[var(--critical)] flex-shrink-0" />
          <p className="text-xs font-semibold text-[var(--critical-ink)]">{error}</p>
        </div>
      )}

      {/* ── Generating ───────────────────────────────────────────────────── */}
      {generating && (
        <div className="flex items-center gap-3 p-4 rounded-[var(--r-sm)] bg-[var(--brand-tint)] border border-[var(--green-100)]">
          <div className="w-5 h-5 border-2 border-[var(--green-300)] border-t-[var(--brand)] rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm font-semibold text-[var(--success-ink)]">
            Assessing priority level…
          </p>
        </div>
      )}

      {/* ── Result ───────────────────────────────────────────────────────── */}
      {result && !generating && cfg && (
        <div className="space-y-3">
          {/* Priority banner */}
          <div
            className="relative rounded-[var(--r-lg)] overflow-hidden p-4 border"
            style={{ background: cfg.bg, borderColor: cfg.border }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-[var(--r-lg)] flex items-center justify-center flex-shrink-0"
                style={{ background: cfg.tint }}
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
                    style={{ background: cfg.tint, color: cfg.color }}
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
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {result.reasoning}
              </p>
            </div>
          </div>

          {/* Red flags */}
          {result.redFlags?.length > 0 && (
            <div className="p-3.5 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)]">
              <p className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--critical-ink)] mb-2">
                ⚠ Red Flags Detected
              </p>
              <div className="space-y-1">
                {result.redFlags.map((flag, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--critical)] flex-shrink-0" />
                    <p className="text-xs font-semibold text-[var(--critical-ink)]">{flag}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="flex items-start gap-3 p-3.5 rounded-[var(--r-sm)] bg-[var(--surface-inset)] border border-[var(--border-faint)]">
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--text-muted)] mb-1">
                Recommendation
              </p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {result.recommendation}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Suggested visit type:{" "}
                <span className="font-semibold capitalize">
                  {result.suggestedVisitType}
                </span>
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 p-3 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--urgent-tint)]">
            <AlertCircle className="w-3.5 h-3.5 text-[var(--urgent)] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--urgent-ink)] leading-relaxed">
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
