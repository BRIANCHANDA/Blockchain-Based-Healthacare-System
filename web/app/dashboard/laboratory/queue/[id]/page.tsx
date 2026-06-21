// web/src/app/dashboard/laboratory/queue/[id]/page.tsx

"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, visitApi } from "@/lib/api";
import {
  FlaskConical,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  TriangleAlert,
  Loader2,
  Save,
  Plus,
  Trash2,
  ClipboardList,
  Clock,
  Beaker,
  User,
  Heart,
  Activity,
  Ban,
  ShieldAlert,
  X,
  Droplets,
  History as HistoryIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { MinorBadge, ageFromDob } from "@/components/ui/MinorBadge";

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════
type Flag = "normal" | "high" | "low" | "critical";
type ResultRow = {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: Flag;
  autoFlagged?: boolean;
};

// ════════════════════════════════════════════════════════════════════════════
// Design tokens
// ════════════════════════════════════════════════════════════════════════════
const URGENCY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  routine: { color: "#0A6640", bg: "#E6F4EE", label: "Routine" },
  urgent: { color: "#C9952A", bg: "#FDF3DC", label: "Urgent" },
  emergency: { color: "#C0392B", bg: "#FDECEA", label: "Emergency" },
  critical: { color: "#6D28D9", bg: "#EDE9FE", label: "Critical" },
};
const FLAG_CONFIG: Record<Flag, { color: string; bg: string; label: string }> =
  {
    normal: { color: "#0A6640", bg: "#E6F4EE", label: "Normal" },
    high: { color: "#C0392B", bg: "#FDECEA", label: "High ↑" },
    low: { color: "#1A6B8A", bg: "#E3F2F8", label: "Low ↓" },
    critical: { color: "#6D28D9", bg: "#EDE9FE", label: "Critical" },
  };

// ════════════════════════════════════════════════════════════════════════════
// Test templates — expanded for Zambian clinical context
// ════════════════════════════════════════════════════════════════════════════
const TEST_TEMPLATES: Record<string, ResultRow[]> = {
  FBC: [
    {
      parameter: "Haemoglobin",
      value: "",
      unit: "g/dL",
      referenceRange: "12.0-16.0",
      flag: "normal",
    },
    {
      parameter: "WBC",
      value: "",
      unit: "×10⁹/L",
      referenceRange: "4.0-11.0",
      flag: "normal",
    },
    {
      parameter: "Platelets",
      value: "",
      unit: "×10⁹/L",
      referenceRange: "150-400",
      flag: "normal",
    },
    {
      parameter: "RBC",
      value: "",
      unit: "×10¹²/L",
      referenceRange: "4.5-5.5",
      flag: "normal",
    },
    {
      parameter: "Haematocrit",
      value: "",
      unit: "%",
      referenceRange: "36-46",
      flag: "normal",
    },
    {
      parameter: "MCV",
      value: "",
      unit: "fL",
      referenceRange: "80-100",
      flag: "normal",
    },
    {
      parameter: "Neutrophils",
      value: "",
      unit: "%",
      referenceRange: "40-75",
      flag: "normal",
    },
    {
      parameter: "Lymphocytes",
      value: "",
      unit: "%",
      referenceRange: "20-45",
      flag: "normal",
    },
  ],
  UE: [
    {
      parameter: "Sodium",
      value: "",
      unit: "mmol/L",
      referenceRange: "136-145",
      flag: "normal",
    },
    {
      parameter: "Potassium",
      value: "",
      unit: "mmol/L",
      referenceRange: "3.5-5.0",
      flag: "normal",
    },
    {
      parameter: "Urea",
      value: "",
      unit: "mmol/L",
      referenceRange: "2.5-7.8",
      flag: "normal",
    },
    {
      parameter: "Creatinine",
      value: "",
      unit: "µmol/L",
      referenceRange: "60-120",
      flag: "normal",
    },
    {
      parameter: "eGFR",
      value: "",
      unit: "mL/min",
      referenceRange: ">60",
      flag: "normal",
    },
    {
      parameter: "Chloride",
      value: "",
      unit: "mmol/L",
      referenceRange: "98-107",
      flag: "normal",
    },
  ],
  LFT: [
    {
      parameter: "ALT",
      value: "",
      unit: "U/L",
      referenceRange: "7-56",
      flag: "normal",
    },
    {
      parameter: "AST",
      value: "",
      unit: "U/L",
      referenceRange: "10-40",
      flag: "normal",
    },
    {
      parameter: "ALP",
      value: "",
      unit: "U/L",
      referenceRange: "44-147",
      flag: "normal",
    },
    {
      parameter: "Bilirubin Total",
      value: "",
      unit: "µmol/L",
      referenceRange: "3-17",
      flag: "normal",
    },
    {
      parameter: "Bilirubin Direct",
      value: "",
      unit: "µmol/L",
      referenceRange: "0-5",
      flag: "normal",
    },
    {
      parameter: "Albumin",
      value: "",
      unit: "g/L",
      referenceRange: "35-50",
      flag: "normal",
    },
    {
      parameter: "Total Protein",
      value: "",
      unit: "g/L",
      referenceRange: "64-83",
      flag: "normal",
    },
  ],
  BGL: [
    {
      parameter: "Blood Glucose",
      value: "",
      unit: "mmol/L",
      referenceRange: "4.0-7.8",
      flag: "normal",
    },
  ],
  HbA1c: [
    {
      parameter: "HbA1c",
      value: "",
      unit: "%",
      referenceRange: "<6.0",
      flag: "normal",
    },
    {
      parameter: "Estimated Avg Glucose",
      value: "",
      unit: "mmol/L",
      referenceRange: "<7.0",
      flag: "normal",
    },
  ],
  Lipids: [
    {
      parameter: "Total Cholesterol",
      value: "",
      unit: "mmol/L",
      referenceRange: "<5.2",
      flag: "normal",
    },
    {
      parameter: "HDL",
      value: "",
      unit: "mmol/L",
      referenceRange: ">1.0",
      flag: "normal",
    },
    {
      parameter: "LDL",
      value: "",
      unit: "mmol/L",
      referenceRange: "<3.0",
      flag: "normal",
    },
    {
      parameter: "Triglycerides",
      value: "",
      unit: "mmol/L",
      referenceRange: "<1.7",
      flag: "normal",
    },
  ],
  TFT: [
    {
      parameter: "TSH",
      value: "",
      unit: "mIU/L",
      referenceRange: "0.4-4.0",
      flag: "normal",
    },
    {
      parameter: "Free T4",
      value: "",
      unit: "pmol/L",
      referenceRange: "9-19",
      flag: "normal",
    },
    {
      parameter: "Free T3",
      value: "",
      unit: "pmol/L",
      referenceRange: "3.5-6.5",
      flag: "normal",
    },
  ],
  Cardiac: [
    {
      parameter: "Troponin-I",
      value: "",
      unit: "ng/mL",
      referenceRange: "<0.04",
      flag: "normal",
    },
    {
      parameter: "CK-MB",
      value: "",
      unit: "ng/mL",
      referenceRange: "<5.0",
      flag: "normal",
    },
    {
      parameter: "BNP",
      value: "",
      unit: "pg/mL",
      referenceRange: "<100",
      flag: "normal",
    },
  ],
  ABG: [
    {
      parameter: "pH",
      value: "",
      unit: "",
      referenceRange: "7.35-7.45",
      flag: "normal",
    },
    {
      parameter: "PaCO2",
      value: "",
      unit: "mmHg",
      referenceRange: "35-45",
      flag: "normal",
    },
    {
      parameter: "PaO2",
      value: "",
      unit: "mmHg",
      referenceRange: "80-100",
      flag: "normal",
    },
    {
      parameter: "HCO3",
      value: "",
      unit: "mmol/L",
      referenceRange: "22-26",
      flag: "normal",
    },
    {
      parameter: "Base Excess",
      value: "",
      unit: "mmol/L",
      referenceRange: "-2 to +2",
      flag: "normal",
    },
    {
      parameter: "Lactate",
      value: "",
      unit: "mmol/L",
      referenceRange: "0.5-2.2",
      flag: "normal",
    },
  ],
  Coag: [
    {
      parameter: "PT",
      value: "",
      unit: "sec",
      referenceRange: "11-14",
      flag: "normal",
    },
    {
      parameter: "INR",
      value: "",
      unit: "",
      referenceRange: "0.8-1.2",
      flag: "normal",
    },
    {
      parameter: "aPTT",
      value: "",
      unit: "sec",
      referenceRange: "25-35",
      flag: "normal",
    },
    {
      parameter: "Fibrinogen",
      value: "",
      unit: "g/L",
      referenceRange: "2.0-4.0",
      flag: "normal",
    },
  ],
  UA: [
    {
      parameter: "pH",
      value: "",
      unit: "",
      referenceRange: "4.5-8.0",
      flag: "normal",
    },
    {
      parameter: "Protein",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Glucose",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Ketones",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Leucocytes",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Nitrites",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Blood",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
  ],
  Malaria: [
    {
      parameter: "Malaria RDT",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Plasmodium species",
      value: "",
      unit: "",
      referenceRange: "—",
      flag: "normal",
    },
    {
      parameter: "Parasitaemia",
      value: "",
      unit: "%",
      referenceRange: "Negative",
      flag: "normal",
    },
  ],
  HIV: [
    {
      parameter: "HIV Rapid Test 1",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "HIV Rapid Test 2",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
  ],
  CD4: [
    {
      parameter: "CD4 absolute",
      value: "",
      unit: "cells/µL",
      referenceRange: ">500",
      flag: "normal",
    },
    {
      parameter: "CD4 %",
      value: "",
      unit: "%",
      referenceRange: "30-60",
      flag: "normal",
    },
  ],
  Hepatitis: [
    {
      parameter: "HBsAg",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
    {
      parameter: "Anti-HCV",
      value: "",
      unit: "",
      referenceRange: "Negative",
      flag: "normal",
    },
  ],
  Pregnancy: [
    {
      parameter: "Beta-hCG",
      value: "",
      unit: "mIU/mL",
      referenceRange: "<5",
      flag: "normal",
    },
  ],
};

// ════════════════════════════════════════════════════════════════════════════
// Auto-flag logic — parses reference ranges and flags values
// ════════════════════════════════════════════════════════════════════════════
function autoFlag(value: string, refRange: string): Flag {
  const v = value.trim();
  const r = refRange.trim();
  if (!v || !r) return "normal";

  // Text-based (Negative / Positive / etc.)
  const num = parseFloat(v);
  if (isNaN(num)) {
    if (
      r.toLowerCase() === "negative" &&
      /^(positive|pos|reactive|\+|\+\+|\+\+\+|\+\+\+\+)$/i.test(v)
    ) {
      return "high";
    }
    return "normal";
  }

  // Range "12.0-16.0" or "12.0–16.0"
  const rangeMatch = r.match(/(-?\d+\.?\d*)\s*[–\-to ]+\s*(-?\d+\.?\d*)/i);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const span = high - low;
    // Critical if very far out (>50% beyond range)
    if (num < low - span * 0.5 || num > high + span * 0.5) return "critical";
    if (num < low) return "low";
    if (num > high) return "high";
    return "normal";
  }

  // ">60" pattern (anything below is low)
  const gtMatch = r.match(/^>\s*(-?\d+\.?\d*)/);
  if (gtMatch) {
    const threshold = parseFloat(gtMatch[1]);
    if (num < threshold * 0.5) return "critical";
    return num >= threshold ? "normal" : "low";
  }

  // "<7.0" pattern (anything above is high)
  const ltMatch = r.match(/^<\s*(-?\d+\.?\d*)/);
  if (ltMatch) {
    const threshold = parseFloat(ltMatch[1]);
    if (num > threshold * 2) return "critical";
    return num <= threshold ? "normal" : "high";
  }

  return "normal";
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
function normalizeOrder(raw: any) {
  return {
    id: raw.id,
    orderNumber: raw.orderNumber ?? raw.order_number ?? "",
    testName: raw.testName ?? raw.test_name ?? "",
    testCode: raw.testCode ?? raw.test_code ?? "",
    specimenType: raw.specimenType ?? raw.specimen_type ?? "",
    urgency: raw.urgency ?? "routine",
    clinicalNotes: raw.clinicalNotes ?? raw.clinical_notes ?? "",
    status: raw.status ?? "",
    orderedAt: raw.orderedAt ?? raw.ordered_at ?? null,
    visitId: raw.visitId ?? raw.visit_id ?? "",
    patientId: raw.patientId ?? raw.patient_id ?? "",
    visitNumber: raw.visitNumber ?? raw.visit_number ?? "",
    chiefComplaint: raw.chiefComplaint ?? raw.chief_complaint ?? "",
  };
}

function safeDistance(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

// ════════════════════════════════════════════════════════════════════════════
// Toast
// ════════════════════════════════════════════════════════════════════════════
function Toast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
      ${type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-100"}`}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} className="text-green-600" />
      ) : (
        <AlertTriangle size={16} className="text-red-500" />
      )}
      {message}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Patient context panel
// ════════════════════════════════════════════════════════════════════════════
function PatientContextPanel({
  context,
  loading,
}: {
  context: any;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-100 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }
  if (!context) return null;

  const { patient, allergies, medicalHistory, recentDiagnoses, summary } =
    context;
  const severeAllergies =
    allergies?.filter((a: any) =>
      ["severe", "life_threatening"].includes(a.severity),
    ) ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Critical allergies banner */}
      {severeAllergies.length > 0 && (
        <div
          className="px-5 py-2.5 flex items-center gap-2.5 border-b"
          style={{ background: "#fef2f2", borderColor: "#fecaca" }}
        >
          <ShieldAlert size={15} className="text-red-600 flex-shrink-0" />
          <p className="text-xs font-bold text-red-700">
            SEVERE ALLERGY:{" "}
            {severeAllergies.map((a: any) => a.allergen).join(", ")}
          </p>
        </div>
      )}

      {/* Patient identity */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}
          >
            <User size={22} className="text-green-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold text-gray-900">
                {patient.fullName}
              </p>
              {patient.isMinor && (
                <MinorBadge age={patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : patient.age} />
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
              {patient.age != null && (
                <span className="font-semibold">{patient.age} yrs</span>
              )}
              {patient.gender && (
                <span className="capitalize">{patient.gender}</span>
              )}
              {patient.bloodType && patient.bloodType !== "unknown" && (
                <span className="flex items-center gap-1">
                  <Droplets size={11} className="text-red-500" />
                  <span className="font-semibold text-red-600">
                    {patient.bloodType}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick summary chips */}
        {(summary?.allergyCount > 0 || summary?.activeConditions > 0) && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {summary.allergyCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  background:
                    severeAllergies.length > 0 ? "#fef2f2" : "#fffbeb",
                  color: severeAllergies.length > 0 ? "#dc2626" : "#d97706",
                }}
              >
                <AlertTriangle size={11} />
                {summary.allergyCount}{" "}
                {summary.allergyCount === 1 ? "allergy" : "allergies"}
              </div>
            )}
            {summary.activeConditions > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                <Activity size={11} />
                {summary.activeConditions} active condition
                {summary.activeConditions !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}

        {/* Allergies detail */}
        {allergies && allergies.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Allergies
            </p>
            <div className="space-y-1.5">
              {allergies.slice(0, 4).map((a: any) => {
                const severe = ["severe", "life_threatening"].includes(
                  a.severity,
                );
                return (
                  <div key={a.id} className="flex items-start gap-2 text-xs">
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: severe ? "#dc2626" : "#d97706" }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-800">
                        {a.allergen}
                      </span>
                      <span className="text-gray-400 capitalize">
                        {" "}
                        · {a.severity?.replace(/_/g, " ")}
                      </span>
                      {a.reaction && (
                        <p className="text-gray-500 mt-0.5">{a.reaction}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active conditions */}
        {medicalHistory && medicalHistory.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Medical History
            </p>
            <div className="space-y-1.5">
              {medicalHistory.slice(0, 5).map((h: any) => (
                <div key={h.id} className="flex items-start gap-2 text-xs">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{
                      background: h.status === "active" ? "#2563eb" : "#9ca3af",
                    }}
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-800">
                      {h.condition}
                    </span>
                    {h.diagnosedDate && (
                      <span className="text-gray-400">
                        {" "}
                        · since {format(new Date(h.diagnosedDate), "MMM yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent diagnoses */}
        {recentDiagnoses && recentDiagnoses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Recent Diagnoses
            </p>
            <div className="space-y-1.5">
              {recentDiagnoses.slice(0, 4).map((d: any) => (
                <div key={d.id} className="flex items-start gap-2 text-xs">
                  <HistoryIcon
                    size={11}
                    className="text-gray-400 mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-800">
                      {d.diagnosisName}
                    </span>
                    {d.icdCode && (
                      <span className="text-gray-400 font-mono text-[10px]">
                        {" "}
                        · {d.icdCode}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Specimen rejection modal
// ════════════════════════════════════════════════════════════════════════════
const REJECTION_REASONS = [
  { key: "haemolysed", label: "Haemolysed", desc: "Sample shows haemolysis" },
  {
    key: "insufficient_quantity",
    label: "Insufficient quantity",
    desc: "Not enough sample for analysis",
  },
  {
    key: "wrong_container",
    label: "Wrong container",
    desc: "Incorrect tube/preservative",
  },
  { key: "clotted", label: "Clotted", desc: "Sample has clotted" },
  {
    key: "contaminated",
    label: "Contaminated",
    desc: "Sample appears contaminated",
  },
  {
    key: "mislabelled",
    label: "Mislabelled",
    desc: "Labels missing or incorrect",
  },
  {
    key: "transport_delay",
    label: "Transport delay",
    desc: "Sample exceeded acceptable transit time",
  },
  { key: "other", label: "Other", desc: "Other (specify in notes)" },
];

function RejectModal({
  open,
  onClose,
  onConfirm,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,14,26,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#fef2f2" }}
            >
              <Ban size={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Reject Specimen
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                The doctor will be notified to re-order
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Reason
            </p>
            <div className="space-y-1.5">
              {REJECTION_REASONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setReason(r.key)}
                  className="w-full text-left px-3 py-2.5 rounded-xl border transition-all"
                  style={
                    reason === r.key
                      ? { background: "#fef2f2", borderColor: "#fca5a5" }
                      : { background: "#fff", borderColor: "#e5e7eb" }
                  }
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {r.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Notes <span className="font-normal normal-case">(optional)</span>
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional details for the ordering doctor…"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-red-400 focus:bg-white resize-none placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason, notes)}
            disabled={!reason || submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Ban size={14} />
            )}
            {submitting ? "Rejecting…" : "Reject Specimen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Critical value confirmation modal
// ════════════════════════════════════════════════════════════════════════════
function CriticalConfirmModal({
  open,
  criticalRows,
  onClose,
  onConfirm,
}: {
  open: boolean;
  criticalRows: ResultRow[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,14,26,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#fef2f2" }}
            >
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Critical Values Detected
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Confirm before submitting
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-3">
            The following{" "}
            {criticalRows.length === 1 ? "value is" : "values are"}{" "}
            <strong>critical</strong>:
          </p>
          <div className="space-y-2 mb-4">
            {criticalRows.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-red-50 border border-red-100"
              >
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    {r.parameter}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Reference: {r.referenceRange} {r.unit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-red-700 tabular-nums">
                    {r.value}
                  </p>
                  <p className="text-xs text-red-500">{r.unit}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>
                Critical values require immediate clinical attention.
              </strong>{" "}
              The ordering doctor will be notified automatically after you
              submit.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Re-check values
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}
          >
            <CheckCircle2 size={14} /> Confirm & Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main page
// ════════════════════════════════════════════════════════════════════════════
export default function LabOrderDetailPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([
    { parameter: "", value: "", unit: "", referenceRange: "", flag: "normal" },
  ]);
  const [interpretation, setInterpretation] = useState("");
  const [abnormalFindings, setAbnormalFindings] = useState("");
  const [error, setError] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showCritical, setShowCritical] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load order
  useEffect(() => {
    (visitApi as any)
      .getPendingLabOrders()
      .then((res: any) => {
        const rawOrders = res.data.data?.orders ?? [];
        const foundRaw = rawOrders.find((o: any) => o.id === orderId);
        if (foundRaw) {
          const normalized = normalizeOrder(foundRaw);
          setOrder(normalized);

          // Auto-pick a template based on testCode/testName
          const code = (
            normalized.testCode ||
            normalized.testName ||
            ""
          ).toUpperCase();
          const matched = Object.keys(TEST_TEMPLATES).find((k) =>
            code.includes(k.toUpperCase()),
          );
          if (matched) setRows(TEST_TEMPLATES[matched].map((r) => ({ ...r })));
        }
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  // Load patient context once we have the order
  useEffect(() => {
    if (!order?.patientId) return;
    setContextLoading(true);
    api
      .get(`/api/lab/patient-context/${order.patientId}`)
      .then((res) => setContext(res.data?.data ?? null))
      .catch(() => setContext(null))
      .finally(() => setContextLoading(false));
  }, [order?.patientId]);

  // Auto-flag on value/range change
  const updateRow = (i: number, field: keyof ResultRow, value: string) => {
    setRows((p) =>
      p.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, [field]: value };
        // Auto-flag when value or range changes, but only if user hasn't manually overridden
        if (
          (field === "value" || field === "referenceRange") &&
          !r.autoFlagged !== false
        ) {
          next.flag = autoFlag(next.value, next.referenceRange);
          next.autoFlagged = true;
        }
        return next;
      }),
    );
  };

  const setManualFlag = (i: number, flag: Flag) => {
    setRows((p) =>
      p.map((r, idx) => (idx === i ? { ...r, flag, autoFlagged: false } : r)),
    );
  };

  const addRow = () =>
    setRows((p) => [
      ...p,
      {
        parameter: "",
        value: "",
        unit: "",
        referenceRange: "",
        flag: "normal",
      },
    ]);
  const removeRow = (i: number) =>
    setRows((p) => p.filter((_, idx) => idx !== i));

  const applyTemplate = (code: string) => {
    const tpl = TEST_TEMPLATES[code];
    if (tpl) setRows(tpl.map((r) => ({ ...r })));
  };

  const criticalRows = useMemo(
    () =>
      rows.filter(
        (r) => r.flag === "critical" && r.parameter.trim() && r.value.trim(),
      ),
    [rows],
  );
  const hasAbnormal = rows.some((r) => r.flag !== "normal");

  const doSubmit = async () => {
    const valid = rows.filter((r) => r.parameter.trim() && r.value.trim());
    if (!valid.length) {
      setError("Add at least one result parameter with a value.");
      return;
    }
    if (!order) return;
    setShowCritical(false);
    setSubmitting(true);
    setError("");
    try {
      await (visitApi as any).enterLabResult(order.visitId, order.id, {
        resultsData: valid,
        interpretation: interpretation.trim() || undefined,
        abnormalFindings: abnormalFindings.trim() || undefined,
        referenceRanges: valid.reduce((acc: any, r) => {
          acc[r.parameter] = r.referenceRange;
          return acc;
        }, {}),
        hasCritical: criticalRows.length > 0,
      });
      showToast(
        criticalRows.length > 0
          ? "Critical results submitted — doctor notified."
          : "Results saved successfully.",
        "success",
      );
      setTimeout(() => router.push("/dashboard/laboratory/queue"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to save results.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const valid = rows.filter((r) => r.parameter.trim() && r.value.trim());
    if (!valid.length) {
      setError("Add at least one result parameter with a value.");
      return;
    }
    if (criticalRows.length > 0) {
      setShowCritical(true);
      return;
    }
    doSubmit();
  };

  const handleReject = async (reason: string, notes: string) => {
    if (!order) return;
    setRejecting(true);
    try {
      await api.post(`/api/lab/reject-specimen/${order.id}`, {
        reason,
        notes: notes || undefined,
      });
      showToast("Specimen rejected. Doctor will be notified.", "success");
      setTimeout(() => router.push("/dashboard/laboratory/queue"), 1500);
    } catch (err: any) {
      showToast(
        err.response?.data?.error?.message ?? "Failed to reject specimen.",
        "error",
      );
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-green-700" />
        <p className="text-sm text-gray-400">Loading order…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FlaskConical size={28} className="text-gray-400" />
        </div>
        <p className="text-gray-700 font-semibold mb-1">Order not found</p>
        <p className="text-gray-400 text-sm mb-4">
          This order may have already been resulted or doesn't exist.
        </p>
        <button
          onClick={() => router.push("/dashboard/laboratory/queue")}
          className="text-green-700 text-sm font-medium hover:underline"
        >
          ← Back to queue
        </button>
      </div>
    );
  }

  const urgency = URGENCY_CONFIG[order.urgency] ?? URGENCY_CONFIG.routine;

  return (
    <div
      className="max-w-6xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {toast && <Toast message={toast.message} type={toast.type} />}

      <button
        onClick={() => router.push("/dashboard/laboratory/queue")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <ChevronLeft size={16} /> Back to Queue
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── LEFT COLUMN: Patient context ── */}
        <div className="lg:col-span-1 space-y-4">
          <PatientContextPanel context={context} loading={contextLoading} />
        </div>

        {/* ── RIGHT COLUMN: Order + Result entry ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Order header */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            style={{ borderTop: `4px solid ${urgency.color}` }}
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: urgency.bg }}
                >
                  <FlaskConical size={26} style={{ color: urgency.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-xl font-bold text-gray-900">
                      {order.testName}
                    </h1>
                    {order.testCode && (
                      <span className="text-sm font-mono font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {order.testCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: urgency.bg,
                        color: urgency.color,
                      }}
                    >
                      {urgency.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {order.orderNumber}
                    </span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-500">
                      {order.visitNumber}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Beaker size={14} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Specimen</p>
                    <p className="text-sm font-semibold text-gray-800 capitalize">
                      {order.specimenType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Clock size={14} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Ordered</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {safeDistance(order.orderedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Activity size={14} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Status</p>
                    <p className="text-sm font-semibold text-gray-800 capitalize">
                      {order.status}
                    </p>
                  </div>
                </div>
              </div>

              {order.chiefComplaint && (
                <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <ClipboardList
                    size={14}
                    className="text-blue-500 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-0.5">
                      Chief Complaint
                    </p>
                    <p className="text-sm text-blue-800">
                      {order.chiefComplaint}
                    </p>
                  </div>
                </div>
              )}
              {order.clinicalNotes && (
                <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <ClipboardList
                    size={14}
                    className="text-amber-500 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-0.5">
                      Clinical Notes
                    </p>
                    <p className="text-sm text-amber-800 italic">
                      "{order.clinicalNotes}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Templates */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Quick Templates
            </p>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(TEST_TEMPLATES).map((code) => (
                <button
                  key={code}
                  onClick={() => applyTemplate(code)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-all"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {/* Results entry */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-800">Enter Results</p>
                <span className="text-xs text-gray-400">
                  · Auto-flagged from reference range
                </span>
              </div>
              <div className="flex items-center gap-2">
                {criticalRows.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                    <TriangleAlert size={11} /> {criticalRows.length} critical
                  </span>
                )}
                {hasAbnormal && criticalRows.length === 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    <TriangleAlert size={11} /> Abnormal present
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 mb-2 px-1">
              {[
                { label: "Parameter", span: "col-span-3" },
                { label: "Value", span: "col-span-2" },
                { label: "Unit", span: "col-span-2" },
                { label: "Reference Range", span: "col-span-3" },
                { label: "Flag", span: "col-span-2" },
              ].map(({ label, span }) => (
                <p
                  key={label}
                  className={`${span} text-xs font-semibold text-gray-400 uppercase tracking-wide`}
                >
                  {label}
                </p>
              ))}
            </div>

            <div className="space-y-2 mb-4">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="col-span-3 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:bg-white"
                    placeholder="e.g. Haemoglobin"
                    value={row.parameter}
                    onChange={(e) => updateRow(i, "parameter", e.target.value)}
                  />
                  <input
                    className="col-span-2 px-2.5 py-2 rounded-lg border text-sm outline-none focus:bg-white"
                    style={{
                      borderColor:
                        row.flag === "critical"
                          ? "#fca5a5"
                          : row.flag === "high" || row.flag === "low"
                            ? "#fde68a"
                            : "#e5e7eb",
                      background:
                        row.flag === "critical"
                          ? "#fef2f2"
                          : row.flag === "high" || row.flag === "low"
                            ? "#fffbeb"
                            : "#f9fafb",
                      fontWeight: row.flag !== "normal" ? 700 : 400,
                      color:
                        row.flag === "critical"
                          ? "#dc2626"
                          : row.flag === "high"
                            ? "#dc2626"
                            : row.flag === "low"
                              ? "#1d4ed8"
                              : "#111827",
                    }}
                    placeholder="12.5"
                    value={row.value}
                    onChange={(e) => updateRow(i, "value", e.target.value)}
                  />
                  <input
                    className="col-span-2 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:bg-white"
                    placeholder="g/dL"
                    value={row.unit}
                    onChange={(e) => updateRow(i, "unit", e.target.value)}
                  />
                  <input
                    className="col-span-3 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:bg-white"
                    placeholder="12.0-16.0"
                    value={row.referenceRange}
                    onChange={(e) =>
                      updateRow(i, "referenceRange", e.target.value)
                    }
                  />
                  <div className="col-span-2 flex items-center gap-1">
                    <select
                      value={row.flag}
                      onChange={(e) => setManualFlag(i, e.target.value as Flag)}
                      className="flex-1 px-1.5 py-2 rounded-lg border text-xs font-semibold outline-none cursor-pointer"
                      style={{
                        borderColor: "transparent",
                        backgroundColor: FLAG_CONFIG[row.flag].bg,
                        color: FLAG_CONFIG[row.flag].color,
                      }}
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High ↑</option>
                      <option value="low">Low ↓</option>
                      <option value="critical">Critical</option>
                    </select>
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(i)}
                        className="text-gray-300 hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addRow}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition-all mb-5"
            >
              <Plus size={14} /> Add parameter
            </button>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Interpretation
                </label>
                <textarea
                  rows={2}
                  value={interpretation}
                  onChange={(e) => setInterpretation(e.target.value)}
                  placeholder="Overall interpretation of results…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:bg-white resize-none placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Abnormal Findings{" "}
                  <span className="text-gray-300 font-normal normal-case">
                    (optional)
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={abnormalFindings}
                  onChange={(e) => setAbnormalFindings(e.target.value)}
                  placeholder="Highlight any critical or abnormal values for the clinician…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-500 focus:bg-white resize-none placeholder:text-gray-400"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100 flex-wrap gap-3">
              <button
                onClick={() => setShowReject(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <Ban size={14} /> Reject Specimen
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/dashboard/laboratory/queue")}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg,#0A6640,#15803d)",
                  }}
                >
                  {submitting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {submitting ? "Saving…" : "Save & Submit Results"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RejectModal
        open={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={handleReject}
        submitting={rejecting}
      />
      <CriticalConfirmModal
        open={showCritical}
        criticalRows={criticalRows}
        onClose={() => setShowCritical(false)}
        onConfirm={doSubmit}
      />
    </div>
  );
}
