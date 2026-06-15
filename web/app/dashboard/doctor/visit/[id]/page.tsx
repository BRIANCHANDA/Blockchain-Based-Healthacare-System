"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  ChevronLeft,
  AlertCircle,
  ClipboardList,
  Stethoscope,
  FlaskConical,
  Scan,
  Pill,
  LogOut,
  TriangleAlert,
  Loader2,
  RefreshCw,
  Shield,
  ArrowLeftRight,
} from "lucide-react";
import { Toast } from "@/components/doctor/shared/Toast";
import { PermissionGate } from "@/components/doctor/tabs/PermissionGate";
import { OverviewTab } from "@/components/doctor/tabs/OverviewTab";
import { ConsultationTab } from "@/components/doctor/tabs/ConsultationTab";
import { DiagnosisTab } from "@/components/doctor/tabs/DiagnosisTab";
import { LabOrdersTab } from "@/components/doctor/tabs/LabOrdersTab";
import { ImagingTab } from "@/components/doctor/tabs/ImagingTab";
import { PrescriptionsTab } from "@/components/doctor/tabs/PrescriptionsTab";
import { DischargeTab } from "@/components/doctor/tabs/DischargeTab";
import PatientHistoryTab from "@/components/doctor/tabs/PatientHistoryTab";
import { ReferralTab } from "@/components/doctor/tabs/ReferralTab";

type Tab =
  | "overview"
  | "history"
  | "consultation"
  | "diagnosis"
  | "labs"
  | "imaging"
  | "prescriptions"
  | "referrals"
  | "discharge";

type PermStage =
  | "checking"
  | "granted"
  | "denied"
  | "requesting"
  | "waiting"
  | "rejected"
  | "expired";

const PRIORITY_STYLE: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  routine: {
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#86efac",
    dot: "#16a34a",
  },
  urgent: { bg: "#fffbeb", text: "#d97706", border: "#fcd34d", dot: "#f59e0b" },
  emergency: {
    bg: "#fef2f2",
    text: "#dc2626",
    border: "#fca5a5",
    dot: "#ef4444",
  },
  critical: {
    bg: "#fdf4ff",
    text: "#7c3aed",
    border: "#d8b4fe",
    dot: "#a855f7",
  },
};

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: ClipboardList },
  { key: "history", label: "Patient History", icon: ClipboardList },
  { key: "consultation", label: "Consultation", icon: Stethoscope },
  { key: "diagnosis", label: "Diagnosis", icon: AlertCircle },
  { key: "labs", label: "Lab Orders", icon: FlaskConical },
  { key: "imaging", label: "Imaging", icon: Scan },
  { key: "prescriptions", label: "Prescriptions", icon: Pill },
  { key: "referrals", label: "Referrals", icon: ArrowLeftRight },
  { key: "discharge", label: "Discharge", icon: LogOut },
];

export default function DoctorVisitPage() {
  const { id: visitId } = useParams<{ id: string }>();
  const router = useRouter();

  const [permStage, setPermStage] = useState<PermStage>("checking");
  const [patientName, setPatientName] = useState("this patient");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [visitData, setVisitData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const checkPermission = useCallback(async () => {
    setPermStage("checking");
    try {
      const res = await visitApi.checkMyPermission(visitId);
      setPermStage(res.data.data?.hasPermission ? "granted" : "denied");
    } catch {
      setPermStage("denied");
    }
  }, [visitId]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const loadVisit = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await visitApi.getSummary(visitId);
        setVisitData(res.data.data);
        const p = res.data.data?.patient;
        if (p) setPatientName(`${p.firstName} ${p.lastName}`);
      } catch (err: any) {
        if (err.response?.status === 403) setPermStage("denied");
        else
          showToast(
            err.response?.data?.error?.message ?? "Failed to load visit.",
            "error",
          );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [visitId],
  );

  useEffect(() => {
    if (permStage === "granted") loadVisit();
  }, [permStage, loadVisit]);

  const visit = visitData?.visit;
  const patient = visitData?.patient;
  const consultations = visitData?.consultations ?? [];
  const diagnoses = visitData?.diagnoses ?? [];
  const vitals = visitData?.vitalSigns ?? [];
  const labOrders = visitData?.labOrders ?? [];
  const imagingOrders = visitData?.imagingOrders ?? [];
  const prescriptions = visitData?.prescriptions ?? [];
  const ps = PRIORITY_STYLE[visit?.priority] ?? PRIORITY_STYLE.routine;
  const latestConsultation = consultations[consultations.length - 1];

  // ── Permission states ─────────────────────────────────────────────────────
  if (permStage === "checking") {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)" }}
        >
          <Shield size={24} className="text-green-700" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700">
            Verifying access…
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Checking blockchain permissions
          </p>
        </div>
        <Loader2 size={20} className="animate-spin text-green-600" />
      </div>
    );
  }

  if (permStage === "denied") {
    return (
      <div className="max-w-xl mx-auto py-4">
        {toast && <Toast message={toast.message} type={toast.type} />}
        <PermissionGate
          visitId={visitId}
          patientName={patientName}
          onGranted={() => setPermStage("granted")}
          onBack={() => router.back()}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2
            size={32}
            className="animate-spin text-green-700 mx-auto mb-3"
          />
          <p className="text-gray-400 text-sm">Loading visit…</p>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-semibold">Visit not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-green-700 text-sm font-medium hover:underline"
        >
          ← Go back
        </button>
      </div>
    );
  }

  const isCompleted = visit.status === "completed";

  return (
    <div className="max-w-5xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── Visit header ── */}
      <div className="flex items-start gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="mt-0.5 p-1.5 rounded-lg hover:bg-gray-200"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 font-mono">
              {visit.visitNumber}
            </h1>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
              style={{
                background: ps.bg,
                color: ps.text,
                border: `1px solid ${ps.border}`,
              }}
            >
              {visit.priority}
            </span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
              style={{ background: "#f3f4f6", color: "#374151" }}
            >
              {visit.visitType}
            </span>
            {!isCompleted && (
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "#fef2f2", color: "#dc2626" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{" "}
                Active
              </span>
            )}
          </div>
          <p className="text-gray-600 text-sm mt-0.5 truncate">
            {visit.chiefComplaint}
          </p>
        </div>

        <button
          onClick={() => loadVisit(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {TABS.map(({ key, label, icon: Icon }) => {
          const done =
            (key === "consultation" && consultations.length > 0) ||
            (key === "diagnosis" && diagnoses.length > 0) ||
            (key === "labs" && labOrders.length > 0) ||
            (key === "imaging" && imagingOrders.length > 0) ||
            (key === "prescriptions" && prescriptions.length > 0) ||
            (key === "discharge" && isCompleted);

          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0"
              style={
                activeTab === key
                  ? { background: "#166534", color: "#fff" }
                  : {
                      background: "#fff",
                      color: "#6b7280",
                      border: "1px solid #e5e7eb",
                    }
              }
            >
              <Icon size={13} /> {label}
              {done && activeTab !== key && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {activeTab === "overview" && (
          <OverviewTab
            visit={visit}
            consultations={consultations}
            diagnoses={diagnoses}
            vitals={vitals}
            labOrders={labOrders}
            imagingOrders={imagingOrders}
            prescriptions={prescriptions}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "history" && <PatientHistoryTab visitId={visitId} />}

        {activeTab === "consultation" && (
          <ConsultationTab
            visitId={visitId}
            consultations={consultations}
            patient={patient}
            vitalSigns={vitals}
            diagnoses={diagnoses}
            onSaved={() => {
              showToast("Consultation saved.", "success");
              loadVisit(true);
            }}
            onError={(msg: string) => showToast(msg, "error")}
            isCompleted={isCompleted}
          />
        )}

        {activeTab === "diagnosis" && (
          <DiagnosisTab
            visitId={visitId}
            diagnoses={diagnoses}
            consultationId={latestConsultation?.id}
            onSaved={() => {
              showToast("Diagnosis added.", "success");
              loadVisit(true);
            }}
            onError={(msg: string) => showToast(msg, "error")}
            isCompleted={isCompleted}
          />
        )}

        {activeTab === "labs" && (
          <LabOrdersTab
            visitId={visitId}
            labOrders={labOrders}
            onSaved={() => {
              showToast("Lab order(s) submitted.", "success");
              loadVisit(true);
            }}
            onError={(msg) => showToast(msg, "error")}
            isCompleted={isCompleted}
          />
        )}

        {activeTab === "imaging" && (
          <ImagingTab
            visitId={visitId}
            imagingOrders={imagingOrders}
            onSaved={() => {
              showToast("Imaging order submitted.", "success");
              loadVisit(true);
            }}
            onError={(msg) => showToast(msg, "error")}
            isCompleted={isCompleted}
          />
        )}

        {activeTab === "prescriptions" && (
          <PrescriptionsTab
            visitId={visitId}
            prescriptions={prescriptions}
            onSaved={() => {
              showToast("Prescription created.", "success");
              loadVisit(true);
            }}
            onError={(msg: string) => showToast(msg, "error")}
            isCompleted={isCompleted}
          />
        )}

        {activeTab === "referrals" && (
          <ReferralTab
            visitId={visitId}
            patientId={visit.patientId}
            patientName={visit.patientName ?? patientName}
            chiefComplaint={visit.chiefComplaint ?? ""}
            isCompleted={isCompleted}
            onSuccess={(msg) => showToast(msg, "success")}
            onError={(msg) => showToast(msg, "error")}
          />
        )}

        {activeTab === "discharge" && (
          <DischargeTab
            visitId={visitId}
            visit={visit}
            patient={patient}
            consultations={consultations}
            diagnoses={diagnoses}
            vitalSigns={vitals}
            labOrders={labOrders}
            imagingOrders={imagingOrders}
            prescriptions={prescriptions}
            onSaved={() => {
              showToast("Patient discharged.", "success");
              loadVisit(true);
            }}
            onError={(msg: string) => showToast(msg, "error")}
          />
        )}
      </div>
    </div>
  );
}
