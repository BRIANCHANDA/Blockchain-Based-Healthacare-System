"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { patientApi, api } from "@/lib/api";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Droplet,
  IdCard,
  Users,
  Shield,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { MinorBadge, ageFromDob } from "@/components/ui/MinorBadge";
import { format } from "date-fns";

const GENDER: Record<string, { bg: string; color: string; dot: string }> = {
  male: { bg: "var(--info-tint)", color: "var(--blue-600)", dot: "var(--blue-500)" },
  female: { bg: "var(--coral-050)", color: "var(--critical-ink)", dot: "var(--coral-500)" },
  other: { bg: "var(--violet-050)", color: "var(--accent-ink)", dot: "var(--violet-500)" },
};
const BLOOD: Record<string, string> = {
  "A+": "var(--blue-500)",
  "A-": "var(--blue-600)",
  "B+": "var(--violet-500)",
  "B-": "var(--coral-500)",
  "AB+": "var(--amber-500)",
  "AB-": "var(--coral-500)",
  "O+": "var(--green-600)",
  "O-": "var(--green-600)",
};
const AVATAR_BG: Record<string, string> = {
  male: "var(--blue-600)",
  female: "var(--coral-600)",
  other: "var(--accent-ink)",
};

function fmtDate(d?: string | null, withTime = false) {
  if (!d) return "—";
  try {
    return format(new Date(d), withTime ? "dd MMM yyyy, HH:mm" : "dd MMM yyyy");
  } catch {
    return d;
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-8 h-8 rounded-[var(--r-xs)] bg-[var(--surface-sunken)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-medium text-[var(--text-secondary)] mt-0.5 break-words">
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 bg-[var(--surface-sunken)] rounded-[var(--r-lg)] animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 bg-[var(--surface-sunken)] rounded-[var(--r-lg)] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function AdminPatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params?.id as string;
  const { user } = useAuthStore();
  const isSuperAdmin = !(user as any)?.institutionId;
  // Super admins get a read-only, platform-wide overview. Hospital admins
  // manage their own institution's patients and can edit/deactivate them.
  const canEdit = !isSuperAdmin;

  const [patient, setPatient] = useState<any>(null);
  const [guardians, setGuardians] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [visitsErr, setVisitsErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<"overview" | "visits" | "guardians">(
    "overview",
  );
  const [toggling, setToggling] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!patientId) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setNotFound(false);
      try {
        const res = await patientApi.getById(patientId);
        const data = (res as any).data?.data ?? (res as any).data;
        if (!data) {
          setNotFound(true);
          return;
        }
        setPatient(data);

        // Super admins only see the Overview tab, so skip fetching visits and
        // guardians entirely for them — hospital admins need both.
        if (!isSuperAdmin) {
          if (data.isMinor) {
            try {
              const g = await api.get(`/api/guardians/patient/${patientId}`);
              setGuardians(g.data?.data?.guardians ?? g.data?.data ?? []);
            } catch {
              setGuardians([]);
            }
          }

          // Visit history — endpoint name may differ; fails gracefully if not found
          try {
            const v = await api.get(`/api/visits/patient/${patientId}`);
            setVisits(v.data?.data?.visits ?? v.data?.data ?? []);
            setVisitsErr(false);
          } catch {
            setVisits([]);
            setVisitsErr(true);
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 404) setNotFound(true);
        else setPatient(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [patientId, isSuperAdmin],
  );

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async () => {
    if (!patient) return;
    setToggling(true);
    try {
      await api.patch(`/api/patients/${patientId}`, {
        isActive: !patient.isActive,
      });
      setPatient((p: any) => ({ ...p, isActive: !p.isActive }));
    } catch {
      // no-op — surfaced via unchanged UI state
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div>
        <button
          onClick={() => router.push("/dashboard/admin/patients")}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] mb-4 hover:text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Patients
        </button>
        <DetailSkeleton />
      </div>
    );
  }

  if (notFound || !patient) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24"
      >
        <div
          className="w-14 h-14 rounded-[var(--r-lg)] flex items-center justify-center mb-3"
          style={{ background: "var(--coral-050)" }}
        >
          <AlertTriangle className="w-7 h-7 text-[var(--coral-100)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-secondary)]">Patient not found</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          This record may have been removed or the link is incorrect.
        </p>
        <button
          onClick={() => router.push("/dashboard/admin/patients")}
          className="mt-4 px-4 py-2 rounded-[var(--r-sm)] text-xs font-semibold text-[var(--white)]"
          style={{ background: "var(--brand)" }}
        >
          Back to Patients
        </button>
      </div>
    );
  }

  const gc = GENDER[patient.gender] ?? {
    bg: "var(--surface-sunken)",
    color: "var(--text-secondary)",
    dot: "var(--text-muted)",
  };
  const age = patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : null;

  return (
    <div>
      {/* ── Back + actions ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.push("/dashboard/admin/patients")}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Patients
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-card)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Header card ── */}
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-6 mb-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-16 h-16 rounded-[var(--r-lg)] flex items-center justify-center text-lg font-bold text-[var(--white)] flex-shrink-0"
            style={{
              background:
                AVATAR_BG[patient.gender] ??
                "var(--brand)",
            }}
          >
            {patient.firstName?.[0]}
            {patient.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
                {patient.firstName} {patient.lastName}
              </h1>
              {patient.isMinor && <MinorBadge />}
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={
                  patient.isActive
                    ? {
                        background: "var(--brand-tint)",
                        color: "var(--green-800)",
                        border: "1px solid var(--green-100)",
                      }
                    : {
                        background: "var(--surface-sunken)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--hc-border)",
                      }
                }
              >
                {patient.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-mono mt-1">
              {patient.temporaryPatientId ?? patient.nationalId ?? patient.id}
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                style={{ background: gc.bg, color: gc.color }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: gc.dot }}
                />
                {patient.gender ?? "—"}
              </span>
              {age !== null && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
                  {age} yrs
                </span>
              )}
              {patient.bloodType && patient.bloodType !== "unknown" && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full text-[var(--white)]"
                  style={{ background: BLOOD[patient.bloodType] ?? "var(--text-secondary)" }}
                >
                  {patient.bloodType}
                </span>
              )}
              {isSuperAdmin && patient.institutionName && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
                  {patient.institutionName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs — super admins get a read-only Overview only ── */}
      {canEdit && (
        <div className="flex items-center gap-1.5 mb-4 border-b border-[var(--border-faint)]">
          {[
            { key: "overview", label: "Overview", icon: ClipboardList },

            ...(patient.isMinor
              ? [
                  {
                    key: "guardians",
                    label: `Guardians${guardians.length ? ` (${guardians.length})` : ""}`,
                    icon: Users,
                  },
                ]
              : []),
          ].map((t: any) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors relative"
              style={{ color: tab === t.key ? "var(--green-800)" : "var(--text-muted)" }}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {tab === t.key && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: "var(--green-800)" }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Overview tab (always visible — super admins are locked to this) ── */}
      {(!canEdit || tab === "overview") && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-5">
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Personal Details
            </p>
            <div className="divide-y divide-[var(--border-faint)]">
              <InfoRow
                icon={Calendar}
                label="Date of Birth"
                value={fmtDate(patient.dateOfBirth)}
              />
              <InfoRow
                icon={IdCard}
                label="National ID"
                value={patient.nationalId ?? "Not yet issued (minor)"}
              />
              <InfoRow
                icon={Droplet}
                label="Blood Type"
                value={
                  patient.bloodType && patient.bloodType !== "unknown"
                    ? patient.bloodType
                    : "Unknown"
                }
              />
            </div>
          </div>

          <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-5">
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Contact
            </p>
            <div className="divide-y divide-[var(--border-faint)]">
              <InfoRow icon={Phone} label="Phone" value={patient.phone} />
              <InfoRow icon={Mail} label="Email" value={patient.email} />
              <InfoRow icon={MapPin} label="Address" value={patient.address} />
            </div>
          </div>

          <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-5">
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Emergency Contact
            </p>
            <div className="divide-y divide-[var(--border-faint)]">
              <InfoRow
                icon={Users}
                label="Name"
                value={patient.emergencyContactName}
              />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={patient.emergencyContactPhone}
              />
              <InfoRow
                icon={Calendar}
                label="Registered"
                value={fmtDate(patient.createdAt)}
              />
            </div>
          </div>

          {patient.allergies && (
            <div className="md:col-span-3 bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-[var(--amber-500)]" />
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Known Allergies
                </p>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                {Array.isArray(patient.allergies)
                  ? patient.allergies.join(", ")
                  : patient.allergies}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Guardians tab — hospital admins only, minors only ── */}
      {canEdit && tab === "guardians" && patient.isMinor && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {guardians.length === 0 ? (
            <div className="md:col-span-2 bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] py-16 text-center">
              <div
                className="w-14 h-14 rounded-[var(--r-lg)] flex items-center justify-center mx-auto mb-3"
                style={{
                  background: "var(--coral-050)",
                }}
              >
                <AlertTriangle className="w-7 h-7 text-[var(--coral-100)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--text-secondary)]">
                No guardian on record
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                This minor patient has no linked guardian. Consent must be
                handled via emergency override.
              </p>
            </div>
          ) : (
            guardians.map((g) => (
              <div
                key={g.id}
                className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-[var(--r-sm)] flex items-center justify-center text-xs font-bold text-[var(--white)] flex-shrink-0"
                      style={{
                        background: "var(--brand)",
                      }}
                    >
                      {g.guardian?.firstName?.[0]}
                      {g.guardian?.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {g.guardian?.firstName} {g.guardian?.lastName}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] capitalize mt-0.5">
                        {g.relationship ?? "guardian"}
                      </p>
                    </div>
                  </div>
                  {g.isPrimary && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[var(--amber-050)] text-[var(--urgent-ink)]">
                      PRIMARY
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {g.canConsent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--green-700)]">
                      <ShieldCheck className="w-3.5 h-3.5" /> Can consent
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                      <Shield className="w-3.5 h-3.5" /> Cannot consent
                    </span>
                  )}
                </div>
                <div className="text-xs text-[var(--text-secondary)] space-y-1 pt-2 border-t border-[var(--border-faint)]">
                  <p>
                    National ID:{" "}
                    <span className="font-medium text-[var(--text-secondary)]">
                      {g.guardian?.nationalId ?? "—"}
                    </span>
                  </p>
                  <p>
                    Phone:{" "}
                    <span className="font-medium text-[var(--text-secondary)]">
                      {g.guardian?.phone ?? "—"}
                    </span>
                  </p>
                  {g.endsAt && (
                    <p>
                      Guardianship ends:{" "}
                      <span className="font-medium text-[var(--text-secondary)]">
                        {fmtDate(g.endsAt)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
