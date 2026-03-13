"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { visitApi } from "@/lib/api";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── Schema (vitals only) ─────────────────────────────────
const vitalsSchema = z.object({
  temperature: z.number({ error: "Enter a number" }).min(30).max(45).optional(),
  bloodPressureSystolic: z
    .number({ error: "Enter a number" })
    .min(50)
    .max(300)
    .optional(),
  bloodPressureDiastolic: z
    .number({ error: "Enter a number" })
    .min(20)
    .max(200)
    .optional(),
  pulseRate: z.number({ error: "Enter a number" }).min(20).max(250).optional(),
  respiratoryRate: z
    .number({ error: "Enter a number" })
    .min(5)
    .max(60)
    .optional(),
  oxygenSaturation: z
    .number({ error: "Enter a number" })
    .min(50)
    .max(100)
    .optional(),
  weight: z.number({ error: "Enter a number" }).min(1).max(500).optional(),
  height: z.number({ error: "Enter a number" }).min(30).max(250).optional(),
  nurseNotes: z.string().optional(),
});

type VitalsData = z.infer<typeof vitalsSchema>;

// ── Field components ──────────────────────────────────────
const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm outline-none transition-all focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder:text-gray-400";

function NumField({ label, unit, error, ...props }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
        {label}
        {unit && (
          <span className="text-gray-400 normal-case font-normal ml-1">
            ({unit})
          </span>
        )}
      </label>
      <input type="number" step="any" className={inputCls} {...props} />
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function TextArea({ label, error, ...props }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <textarea className={`${inputCls} resize-none`} rows={3} {...props} />
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function PainScale({
  value,
  onChange,
}: {
  value?: number;
  onChange: (v: number) => void;
}) {
  const colors = [
    "#22c55e",
    "#4ade80",
    "#86efac",
    "#bef264",
    "#fde047",
    "#fbbf24",
    "#fb923c",
    "#f87171",
    "#ef4444",
    "#dc2626",
    "#b91c1c",
  ];
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
        Pain Level{" "}
        <span className="text-gray-400 normal-case font-normal">
          (0 = none, 10 = worst)
        </span>
      </label>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
            style={{
              background: value === i ? colors[i] : "#f3f4f6",
              color: value === i ? "#fff" : "#374151",
              transform: value === i ? "scale(1.1)" : "scale(1)",
            }}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function TriageDetailPage() {
  const router = useRouter();
  const params = useParams();
  const visitId = params.visitId as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [painLevel, setPainLevel] = useState<number | undefined>();
  const [vitalsHash, setVitalsHash] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const vitalsForm = useForm<VitalsData>({
    resolver: zodResolver(vitalsSchema),
  });

  // ── Submit vitals ─────────────────────────────────────
  const submitVitals = async (data: VitalsData) => {
    setLoading(true);
    setError("");
    try {
      const payload: any = { ...data, painLevel };
      // Strip undefined
      Object.keys(payload).forEach(
        (k) => payload[k] === undefined && delete payload[k],
      );
      const res = await visitApi.recordVitals(visitId, payload);
      setVitalsHash(res.data.data?.blockchainHash ?? "");
      setSubmitted(true);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message;
      if (msg === "No blockchain permission") {
        setError(
          "You don't have blockchain permission for this patient. Go back and request access first.",
        );
      } else {
        setError(msg || "Failed to record vitals. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Done screen ───────────────────────────────────────
  if (submitted) {
    return (
      <div
        className="max-w-lg mx-auto"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2
            className="text-xl font-bold text-gray-900 mb-1"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Vitals Recorded!
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Patient vital signs saved successfully.
          </p>
          {vitalsHash && (
            <div className="bg-gray-50 rounded-xl p-3 text-left mb-6">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Blockchain Hash
              </p>
              <p className="font-mono text-xs text-green-700 mt-0.5 break-all">
                {vitalsHash}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/dashboard/nurse/queue")}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back to Queue
            </button>
            <button
              onClick={() => router.push("/dashboard/nurse/triage")}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#166534" }}
            >
              Next Patient
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-2xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      {/* Simple header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Record Vital Signs</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            All fields optional — record what is available
          </p>
        </div>

        {/* Vitals Form */}
        <form onSubmit={vitalsForm.handleSubmit(submitVitals)}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <NumField
                label="Temperature"
                unit="°C"
                placeholder="36.5"
                {...vitalsForm.register("temperature", {
                  valueAsNumber: true,
                })}
                error={vitalsForm.formState.errors.temperature?.message}
              />
              <NumField
                label="Pulse Rate"
                unit="bpm"
                placeholder="72"
                {...vitalsForm.register("pulseRate", { valueAsNumber: true })}
                error={vitalsForm.formState.errors.pulseRate?.message}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NumField
                label="BP Systolic"
                unit="mmHg"
                placeholder="120"
                {...vitalsForm.register("bloodPressureSystolic", {
                  valueAsNumber: true,
                })}
                error={
                  vitalsForm.formState.errors.bloodPressureSystolic?.message
                }
              />
              <NumField
                label="BP Diastolic"
                unit="mmHg"
                placeholder="80"
                {...vitalsForm.register("bloodPressureDiastolic", {
                  valueAsNumber: true,
                })}
                error={
                  vitalsForm.formState.errors.bloodPressureDiastolic?.message
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NumField
                label="Respiratory Rate"
                unit="/min"
                placeholder="16"
                {...vitalsForm.register("respiratoryRate", {
                  valueAsNumber: true,
                })}
                error={vitalsForm.formState.errors.respiratoryRate?.message}
              />
              <NumField
                label="O₂ Saturation"
                unit="%"
                placeholder="98"
                {...vitalsForm.register("oxygenSaturation", {
                  valueAsNumber: true,
                })}
                error={vitalsForm.formState.errors.oxygenSaturation?.message}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <NumField
                label="Weight"
                unit="kg"
                placeholder="65"
                {...vitalsForm.register("weight", { valueAsNumber: true })}
                error={vitalsForm.formState.errors.weight?.message}
              />
              <NumField
                label="Height"
                unit="cm"
                placeholder="170"
                {...vitalsForm.register("height", { valueAsNumber: true })}
                error={vitalsForm.formState.errors.height?.message}
              />
            </div>
            <PainScale value={painLevel} onChange={setPainLevel} />
            <TextArea
              label="Nurse Notes"
              placeholder="Any observations…"
              {...vitalsForm.register("nurseNotes")}
            />
            {error && (
              <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "#166534" }}
            >
              {loading ? (
                <Spinner />
              ) : (
                <>
                  Save Vitals <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
