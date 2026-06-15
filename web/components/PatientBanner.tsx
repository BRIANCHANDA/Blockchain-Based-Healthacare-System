// web/src/components/PatientBanner.tsx
//
// Shared component — extracted from the lab detail page so radiology (and any
// other module) can show the same patient context banner.
//
// Usage on the radiology detail page (web/src/app/dashboard/radiology/queue/[id]/page.tsx
// or wherever your radiologist opens an order):
//
//   import PatientBanner from "@/components/PatientBanner";
//   import { labApi } from "@/lib/api";
//
//   const [context, setContext] = useState<any>(null);
//   const [ctxLoading, setCtxLoading] = useState(false);
//   const [ctxError, setCtxError] = useState<string | null>(null);
//
//   useEffect(() => {
//     if (!order?.patientId) return;
//     setCtxLoading(true);
//     labApi.getPatientContext(order.patientId)          // same endpoint — it allows radiologists
//       .then(res => setContext(res.data?.data ?? null))
//       .catch(err => setCtxError(err.response?.data?.error?.message ?? "Failed to load patient details"))
//       .finally(() => setCtxLoading(false));
//   }, [order?.patientId]);
//
//   // In JSX, above the order card:
//   <div className="mb-5"><PatientBanner context={context} loading={ctxLoading} error={ctxError} /></div>
//
// (The /api/lab/patient-context endpoint already permits role 'radiologist'.)
//
// OPTIONAL: in the lab detail page, you can delete its local PatientBanner
// definition and import this one instead — identical markup.

"use client";
import {
  User,
  AlertTriangle,
  ShieldAlert,
  Droplets,
  History as HistoryIcon,
} from "lucide-react";

export default function PatientBanner({
  context,
  loading,
  error,
}: {
  context: any;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 bg-gray-100 rounded" />
            <div className="h-3 w-64 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex items-start gap-3">
        <AlertTriangle
          size={18}
          className="text-amber-600 flex-shrink-0 mt-0.5"
        />
        <div>
          <p className="text-sm font-bold text-amber-900">
            Patient details unavailable
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            {error ?? "Could not load patient context for this order."}
          </p>
        </div>
      </div>
    );
  }

  const { patient, allergies, medicalHistory, recentDiagnoses } = context;
  const severeAllergies =
    allergies?.filter((a: any) =>
      ["severe", "life_threatening"].includes(a.severity),
    ) ?? [];
  const otherAllergies =
    allergies?.filter(
      (a: any) => !["severe", "life_threatening"].includes(a.severity),
    ) ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {severeAllergies.length > 0 && (
        <div
          className="px-5 py-2 flex items-center gap-2 border-b"
          style={{ background: "#fef2f2", borderColor: "#fecaca" }}
        >
          <ShieldAlert size={14} className="text-red-600 flex-shrink-0" />
          <p className="text-xs font-bold text-red-700">
            SEVERE ALLERGY —{" "}
            {severeAllergies.map((a: any) => a.allergen).join(", ")}
          </p>
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
              }}
            >
              <User size={26} className="text-green-700" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-tight">
                {patient.fullName}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                {patient.age != null && (
                  <span className="font-semibold">{patient.age} yrs</span>
                )}
                {patient.gender && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="capitalize">{patient.gender}</span>
                  </>
                )}
                {patient.bloodType && patient.bloodType !== "unknown" && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="flex items-center gap-1">
                      <Droplets size={11} className="text-red-500" />
                      <span className="font-semibold text-red-600">
                        {patient.bloodType}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px h-12 bg-gray-100" />

          <div className="flex-1 min-w-[180px]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              Allergies
            </p>
            {allergies && allergies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {severeAllergies.map((a: any) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200"
                  >
                    <AlertTriangle size={10} /> {a.allergen}
                  </span>
                ))}
                {otherAllergies.map((a: any) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                  >
                    {a.allergen}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No known allergies</p>
            )}
          </div>

          <div className="hidden md:block w-px h-12 bg-gray-100" />

          <div className="flex-1 min-w-[180px]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              Active Conditions
            </p>
            {medicalHistory &&
            medicalHistory.filter((h: any) => h.status === "active").length >
              0 ? (
              <div className="flex flex-wrap gap-1.5">
                {medicalHistory
                  .filter((h: any) => h.status === "active")
                  .slice(0, 4)
                  .map((h: any) => (
                    <span
                      key={h.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100"
                    >
                      {h.condition}
                    </span>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">None recorded</p>
            )}
          </div>

          {recentDiagnoses && recentDiagnoses.length > 0 && (
            <>
              <div className="hidden md:block w-px h-12 bg-gray-100" />
              <div className="flex-1 min-w-[180px]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Recent Diagnoses
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recentDiagnoses.slice(0, 3).map((d: any) => (
                    <span
                      key={d.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100"
                    >
                      <HistoryIcon size={9} /> {d.diagnosisName}
                      {d.icdCode && (
                        <span className="font-mono text-[9px] text-violet-500">
                          · {d.icdCode}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
