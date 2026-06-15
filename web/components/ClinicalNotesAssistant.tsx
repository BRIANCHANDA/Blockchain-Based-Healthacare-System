"use client";
import { useState, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Copy,
  Check,
  ChevronDown,
  Wand2,
} from "lucide-react";
import { askClaude } from "@/lib/ai";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClinicalNotesAssistantProps {
  patientContext?: {
    firstName?: string;
    lastName?: string;
    gender?: string;
    bloodType?: string;
    vitals?: any;
    diagnoses?: any[];
  };
  onNotesReady?: (notes: {
    chiefComplaint?: string;
    historyOfPresentIllness?: string;
    physicalExamination?: string;
    clinicalFindings?: string;
    assessment?: string;
    plan?: string;
  }) => void;
}

const TEMPLATES = [
  {
    label: "Malaria",
    prompt:
      "Patient presenting with fever, chills, headache, and body aches for 3 days",
  },
  {
    label: "Hypertension",
    prompt: "Patient with elevated blood pressure, headache, and dizziness",
  },
  {
    label: "Chest Pain",
    prompt: "Patient with acute chest pain, shortness of breath, diaphoresis",
  },
  {
    label: "Diabetes Review",
    prompt:
      "Known diabetic presenting for routine review, polyuria and polydipsia",
  },
  {
    label: "Pneumonia",
    prompt:
      "Cough with productive sputum, fever, reduced breath sounds on left",
  },
  {
    label: "Trauma",
    prompt:
      "Patient involved in road traffic accident, pain and swelling right leg",
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export function ClinicalNotesAssistant({
  patientContext,
  onNotesReady,
}: ClinicalNotesAssistantProps) {
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const SOAP_FIELDS = [
    { key: "chiefComplaint", label: "Chief Complaint", color: "#2563eb" },
    {
      key: "historyOfPresentIllness",
      label: "History of Present Illness",
      color: "#0e7490",
    },
    {
      key: "physicalExamination",
      label: "Physical Examination",
      color: "#166534",
    },
    { key: "clinicalFindings", label: "Clinical Findings", color: "#d97706" },
    { key: "assessment", label: "Assessment", color: "#7c3aed" },
    { key: "plan", label: "Plan", color: "#dc2626" },
  ];

  const buildPrompt = useCallback(() => {
    const ctx = patientContext;
    const v = ctx?.vitals;

    const patientInfo = ctx
      ? `Patient: ${ctx.firstName ?? ""} ${ctx.lastName ?? ""}, ${ctx.gender ?? "unknown"}, Blood type: ${ctx.bloodType ?? "unknown"}`
      : "";

    const vitalsInfo = v
      ? `Vitals: Temp ${v.temperature ?? "—"}°C, BP ${v.bloodPressureSystolic ?? "—"}/${v.bloodPressureDiastolic ?? "—"} mmHg, HR ${v.pulseRate ?? "—"} bpm, SpO₂ ${v.oxygenSaturation ?? "—"}%, Pain ${v.painLevel ?? "—"}/10`
      : "";

    const diagInfo = ctx?.diagnoses?.length
      ? `Known diagnoses: ${ctx.diagnoses.map((d: any) => d.diagnosisName).join(", ")}`
      : "";

    return `You are a clinical documentation assistant for MedLink, a Zambian EMR system.
Expand the following brief clinical note into a structured SOAP-style consultation record.

${patientInfo}
${vitalsInfo}
${diagInfo}

Brief note from doctor: "${input}"

Respond ONLY with a valid JSON object with exactly these keys:
{
  "chiefComplaint": "...",
  "historyOfPresentIllness": "...",
  "physicalExamination": "...",
  "clinicalFindings": "...",
  "assessment": "...",
  "plan": "..."
}

Rules:
- Use clinical language appropriate for a Zambian tertiary hospital
- Each field 1-4 sentences, no bullet points
- Do not invent lab values or specific measurements not provided
- If information is insufficient for a field, write a clinically appropriate placeholder like "To be assessed"
- Output only the JSON, no preamble, no markdown backticks`;
  }, [input, patientContext]);

  const generate = useCallback(async () => {
    if (!input.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);

    try {
      const raw = await askClaude(buildPrompt(), 1000);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      onNotesReady?.(parsed);
    } catch (err) {
      setError("Failed to expand notes. Try again or write manually.");
      console.error("[CLINICAL_NOTES_AI]", err);
    } finally {
      setGenerating(false);
    }
  }, [buildPrompt, onNotesReady]);

  const handleCopyAll = () => {
    if (!result) return;
    const text = SOAP_FIELDS.map(
      (f) => `${f.label}:\n${result[f.key] ?? ""}`,
    ).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateField = (key: string, value: string) => {
    setResult((r: any) => ({ ...r, [key]: value }));
    onNotesReady?.({ ...result, [key]: value });
  };

  return (
    <div className="space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-1">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#052e16,#166634)" }}
        >
          <Wand2 className="w-4 h-4 text-green-300" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">
            Clinical Notes Assistant
          </p>
          <p className="text-[11px] text-gray-400">
            Type brief notes — AI expands into full SOAP format
          </p>
        </div>
      </div>

      {/* ── Quick templates ──────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
          Quick Templates
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => setInput(t.prompt)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors"
              style={{
                background: input === t.prompt ? "#f0fdf4" : "#fff",
                borderColor: input === t.prompt ? "#bbf7d0" : "#e5e7eb",
                color: input === t.prompt ? "#166534" : "#6b7280",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
          Your Brief Notes
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="e.g. 35yo male, 3 day fever and chills, splenomegaly on exam, from malaria-endemic area…"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 focus:bg-white transition-colors resize-none"
        />
        <button
          onClick={generate}
          disabled={generating || !input.trim()}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#052e16,#166534)" }}
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Expanding…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Expand to SOAP Notes
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
            Structuring clinical notes…
          </p>
        </div>
      )}

      {/* ── Result ───────────────────────────────────────────────────────── */}
      {result && !generating && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <p className="text-xs font-bold text-gray-700">
                Review and edit each section
              </p>
            </div>
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-green-500" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy All
                </>
              )}
            </button>
          </div>

          {SOAP_FIELDS.map(({ key, label, color }) => (
            <div
              key={key}
              className="rounded-xl border border-gray-100 overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === key ? null : key)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <p
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color }}
                >
                  {label}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-400 truncate max-w-[180px]">
                    {result[key]
                      ? result[key].slice(0, 50) +
                        (result[key].length > 50 ? "…" : "")
                      : "—"}
                  </p>
                  {expanded === key ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 rotate-180 transition-transform" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 transition-transform" />
                  )}
                </div>
              </button>
              {expanded === key && (
                <div className="px-4 pb-3 pt-0 border-t border-gray-50">
                  <textarea
                    value={result[key] ?? ""}
                    onChange={(e) => updateField(key, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 mt-2 rounded-xl border border-gray-200 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 focus:bg-white transition-colors resize-none"
                  />
                </div>
              )}
            </div>
          ))}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 mt-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              AI-generated. Review all sections before submitting. You are
              clinically responsible for this record.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
