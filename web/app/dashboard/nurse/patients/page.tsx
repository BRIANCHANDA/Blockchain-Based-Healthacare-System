"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Users,
  RefreshCw,
  Search,
  X,
  Clock,
  CheckCircle2,
  Activity,
  AlertTriangle,
  Zap,
  ChevronRight,
  Droplets,
  User,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AssignedPatient {
  id: string; // visitId
  visitNumber: string;
  patientId: string;
  patientName: string;
  gender: string;
  bloodType: string;
  chiefComplaint: string;
  priority: string;
  status: string;
  admissionDate: string;
  wardOrRoom?: string | null;
  assignedDoctorId?: string | null;
  doctorName?: string | null;
  hasVitals: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY: Record<
  string,
  { color: string; bg: string; border: string; dot: string; label: string }
> = {
  critical: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    dot: "#ef4444",
    label: "Critical",
  },
  emergency: {
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
    dot: "#f97316",
    label: "Emergency",
  },
  urgent: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Urgent",
  },
  routine: {
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Routine",
  },
};
const getP = (p: string) => PRIORITY[p] ?? PRIORITY.routine;

const BLOOD_COLOR: Record<string, string> = {
  "A+": "#3b82f6",
  "A-": "#6366f1",
  "B+": "#8b5cf6",
  "B-": "#ec4899",
  "AB+": "#f59e0b",
  "AB-": "#ef4444",
  "O+": "#10b981",
  "O-": "#14b8a6",
  unknown: "#9ca3af",
};

function waitMins(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}
function waitLabel(mins: number) {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function waitColor(mins: number) {
  return mins > 60 ? "#dc2626" : mins > 30 ? "#d97706" : "#9ca3af";
}

function safeDistance(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

// ── Gender avatar colour ──────────────────────────────────────────────────────
function avatarBg(gender: string) {
  if (gender === "female") return "#ec4899";
  if (gender === "male") return "#3b82f6";
  return "#8b5cf6";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PulseDot({
  color,
  animate = false,
}: {
  color: string;
  animate?: boolean;
}) {
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {animate && (
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
          style={{ background: color }}
        />
      )}
      <span
        className="relative inline-flex rounded-full h-2.5 w-2.5"
        style={{ background: color }}
      />
    </span>
  );
}

function TriageStatus({ hasVitals }: { hasVitals: boolean }) {
  return hasVitals ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">
      <CheckCircle2 className="w-3 h-3" /> Triaged
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
      <Activity className="w-3 h-3" /> Pending Triage
    </span>
  );
}

// ── Patient card ──────────────────────────────────────────────────────────────
function PatientCard({
  patient,
  onClick,
}: {
  patient: AssignedPatient;
  onClick: () => void;
}) {
  const p = getP(patient.priority);
  const mins = waitMins(patient.admissionDate);
  const isUrgent = ["critical", "emergency"].includes(patient.priority);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden group"
      style={{ borderColor: isUrgent ? p.border : "#f1f5f9" }}
    >
      {/* Priority strip */}
      <div className="h-0.5 w-full" style={{ background: p.dot }} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: avatarBg(patient.gender) }}
          >
            {getInitials(patient.patientName)}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-bold text-gray-900 leading-snug">
                  {patient.patientName}
                </p>
                <p className="text-xs font-mono text-gray-400 mt-0.5">
                  {patient.visitNumber}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 transition-colors flex-shrink-0 mt-0.5" />
            </div>

            {/* Tags row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Priority badge */}
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize"
                style={{
                  background: p.bg,
                  color: p.color,
                  border: `1px solid ${p.border}`,
                }}
              >
                <PulseDot
                  color={p.dot}
                  animate={isUrgent && !patient.hasVitals}
                />
                {p.label}
              </span>

              {/* Triage status */}
              <TriageStatus hasVitals={patient.hasVitals} />

              {/* Blood type */}
              {patient.bloodType && patient.bloodType !== "unknown" && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{
                    background: BLOOD_COLOR[patient.bloodType] ?? "#6b7280",
                  }}
                >
                  <Droplets className="w-2.5 h-2.5" />
                  {patient.bloodType}
                </span>
              )}
            </div>

            {/* Complaint */}
            <p className="text-xs text-gray-500 mt-2 truncate">
              {patient.chiefComplaint || "No chief complaint recorded"}
            </p>

            {/* Footer row */}
            <div className="flex flex-wrap items-center gap-3 mt-2.5">
              {/* Wait time */}
              <div
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: waitColor(mins) }}
              >
                <Clock className="w-3 h-3" />
                {waitLabel(mins)} wait
                {mins > 45 && (
                  <span className="ml-1 text-red-500">· overdue</span>
                )}
              </div>

              {/* Ward */}
              {patient.wardOrRoom && (
                <span className="text-xs text-gray-400">
                  Ward: {patient.wardOrRoom}
                </span>
              )}

              {/* Doctor */}
              {patient.doctorName ? (
                <span className="text-xs text-green-600 font-medium">
                  Dr. {patient.doctorName}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">
                  No doctor assigned
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-gray-100 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 bg-gray-100 rounded" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
          <div className="flex gap-2 mt-2">
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
            <div className="h-5 w-20 bg-gray-100 rounded-full" />
          </div>
          <div className="h-3 w-48 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NursePatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "triaged">("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.get("/api/visits/assigned-to-me");
      console.log("[NursePatients] response:", res.data);

      // The endpoint returns an array directly in data
      const raw: any[] = res.data?.data ?? [];
      const sorted = [...raw].sort((a, b) => {
        const order: Record<string, number> = {
          critical: 0,
          emergency: 1,
          urgent: 2,
          routine: 3,
        };
        return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
      });
      setPatients(sorted);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error(
        "[NursePatients] error:",
        err.response?.status,
        err.response?.data,
      );
      setError(
        err.response?.data?.error?.message ??
          err.message ??
          "Failed to load patients.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const pendingCount = patients.filter((p) => !p.hasVitals).length;
  const triagedCount = patients.filter((p) => p.hasVitals).length;

  const filtered = patients.filter((p) => {
    const matchFilter =
      filter === "all"
        ? true
        : filter === "pending"
          ? !p.hasVitals
          : p.hasVitals;

    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      [p.patientName, p.visitNumber, p.chiefComplaint, p.doctorName].some((f) =>
        f?.toLowerCase().includes(q),
      );

    return matchFilter && matchSearch;
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            My Patients
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-gray-700">
                  {patients.length}
                </span>{" "}
                assigned patient{patients.length !== 1 ? "s" : ""}
                {pendingCount > 0 && (
                  <span className="text-amber-500 ml-2">
                    · {pendingCount} awaiting triage
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastRefresh && !loading && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Updated {format(lastRefresh, "HH:mm")}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-white transition-all disabled:opacity-40"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button
            onClick={() => load(false)}
            className="text-xs font-semibold text-red-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            label: "Total",
            value: patients.length,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
            icon: Users,
          },
          {
            label: "Pending",
            value: pendingCount,
            color: "#d97706",
            bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
            border: "#fde68a",
            icon: AlertTriangle,
          },
          {
            label: "Triaged",
            value: triagedCount,
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
            icon: CheckCircle2,
          },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div
            key={label}
            className="relative rounded-2xl p-4 border overflow-hidden"
            style={{ background: bg, borderColor: border }}
          >
            <div
              className="absolute -right-2 -bottom-2 w-12 h-12 rounded-full opacity-10"
              style={{ background: color }}
            />
            <Icon className="w-3.5 h-3.5 mb-2" style={{ color }} />
            <p
              className="text-2xl font-extrabold leading-none"
              style={{ color }}
            >
              {loading ? (
                <span
                  className="inline-block w-5 h-5 rounded animate-pulse"
                  style={{ background: `${color}20` }}
                />
              ) : (
                value
              )}
            </p>
            <p
              className="text-xs font-semibold mt-1"
              style={{ color, opacity: 0.65 }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Filter + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1.5 p-1 rounded-xl bg-gray-100/80 w-fit">
          {(["all", "pending", "triaged"] as const).map((key) => {
            const count =
              key === "all"
                ? patients.length
                : key === "pending"
                  ? pendingCount
                  : triagedCount;
            const activeColor =
              key === "pending"
                ? "#d97706"
                : key === "triaged"
                  ? "#1d4ed8"
                  : "#166534";
            const activeBg =
              key === "pending"
                ? "#fffbeb"
                : key === "triaged"
                  ? "#eff6ff"
                  : "#f0fdf4";
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize"
                style={
                  filter === key
                    ? {
                        background: "#fff",
                        color: activeColor,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      }
                    : { color: "#6b7280" }
                }
              >
                {key === "all"
                  ? "All"
                  : key === "pending"
                    ? "Pending Triage"
                    : "Triaged"}
                {count > 0 && (
                  <span
                    className="text-xs font-bold px-1.5 rounded-full"
                    style={
                      filter === key
                        ? { background: activeBg, color: activeColor }
                        : { background: "rgba(0,0,0,0.06)", color: "#9ca3af" }
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, visit, complaint…"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Patient list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "#f0fdf4" }}
          >
            <Users className="w-6 h-6 text-green-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">
            {patients.length === 0
              ? "No patients assigned to you"
              : "No patients match your filters"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {patients.length === 0
              ? "The receptionist will assign patients to you"
              : "Try clearing your search or changing the filter"}
          </p>
          {(search || filter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
              className="mt-4 text-xs font-semibold px-4 py-2 rounded-xl transition-all"
              style={{ background: "#f0fdf4", color: "#166534" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              onClick={() => router.push(`/dashboard/nurse/triage/${p.id}`)}
            />
          ))}
        </div>
      )}

      {/* Footer count */}
      {!loading && patients.length > 0 && (
        <p className="text-xs text-center text-gray-400 mt-5">
          Showing {filtered.length} of {patients.length} patient
          {patients.length !== 1 ? "s" : ""}
          {(search || filter !== "all") && (
            <>
              {" "}
              ·{" "}
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
                className="underline hover:text-gray-600 transition-colors"
              >
                clear
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
