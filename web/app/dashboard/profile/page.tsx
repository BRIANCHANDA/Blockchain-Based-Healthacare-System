"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api, authApi } from "@/lib/api";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Key,
  Building2,
  BadgeCheck,
  Stethoscope,
  FlaskConical,
  ScanLine,
  Pill,
  ClipboardList,
  UserCog,
  Lock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Activity,
  Hash,
  GraduationCap,
  Award,
  Clock,
  ChevronRight,
  Fingerprint,
  Link2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; Icon: any }
> = {
  practitioner: {
    label: "Practitioner",
    color: "#7c3aed",
    bg: "#faf5ff",
    border: "#ddd6fe",
    Icon: Stethoscope,
  },
  nurse: {
    label: "Nurse",
    color: "#0e7490",
    bg: "#ecfeff",
    border: "#a5f3fc",
    Icon: Activity,
  },
  lab_technician: {
    label: "Lab Technician",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    Icon: FlaskConical,
  },
  radiologist: {
    label: "Radiologist",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    Icon: ScanLine,
  },
  pharmacist: {
    label: "Pharmacist",
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    Icon: Pill,
  },
  receptionist: {
    label: "Receptionist",
    color: "#be185d",
    bg: "#fdf2f8",
    border: "#fbcfe8",
    Icon: ClipboardList,
  },
  admin: {
    label: "Administrator",
    color: "#374151",
    bg: "#f9fafb",
    border: "#e5e7eb",
    Icon: UserCog,
  },
  patient: {
    label: "Patient",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
    Icon: User,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({
  initials,
  size = "lg",
}: {
  initials: string;
  size?: "sm" | "lg";
}) {
  const s = size === "lg" ? "w-20 h-20 text-2xl" : "w-10 h-10 text-sm";
  return (
    <div
      className={`${s} rounded-2xl flex items-center justify-center font-black text-white flex-shrink-0`}
      style={{
        background:
          "linear-gradient(135deg, #052e16 0%, #166534 50%, #15803d 100%)",
      }}
    >
      {initials}
    </div>
  );
}

function SectionCard({ title, icon: Icon, color = "#166534", children }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-50"
        style={{ background: "linear-gradient(90deg, #f8faf8, #fff)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <p className="text-sm font-bold text-gray-800">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon, mono = false }: any) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm font-semibold text-gray-800 break-all ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function Toast({
  message,
  type,
  onDone,
}: {
  message: string;
  type: "success" | "error";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-semibold animate-in slide-in-from-bottom-4"
      style={
        type === "success"
          ? { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }
          : { background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" }
      }
    >
      {type === "success" ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <AlertCircle className="w-4 h-4" />
      )}
      {message}
    </div>
  );
}

// ── Password change form ──────────────────────────────────────────────────────
function PasswordSection({
  userType,
  onToast,
}: {
  userType: string;
  onToast: (m: string, t: "success" | "error") => void;
}) {
  const [form, setForm] = useState({ old: "", next: "", confirm: "" });
  const [show, setShow] = useState({ old: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const { clearAuth } = useAuthStore();
  const router = useRouter();

  const isPatient = userType === "patient";
  const endpoint = isPatient
    ? "/api/auth/change-password/patient"
    : "/api/auth/change-password/staff";

  const strength = (() => {
    const p = form.next;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#3b82f6", "#16a34a"][
    strength
  ];

  async function handleSubmit() {
    if (!form.old || !form.next || !form.confirm)
      return onToast("Fill in all fields", "error");
    if (form.next !== form.confirm)
      return onToast("Passwords do not match", "error");
    if (form.next.length < 8) return onToast("Minimum 8 characters", "error");
    setLoading(true);
    try {
      await api.post(endpoint, {
        oldPassword: form.old,
        newPassword: form.next,
      });
      onToast("Password changed — please sign in again", "success");
      setTimeout(() => {
        clearAuth();
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      onToast(
        err?.response?.data?.error?.message ?? "Failed to change password",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  function Field({ id, label, show: s, toggle }: any) {
    return (
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
          {label}
        </label>
        <div className="relative">
          <input
            type={s ? "text" : "password"}
            value={(form as any)[id]}
            onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 focus:bg-white transition-colors"
          />
          <button
            type="button"
            onClick={() => toggle((p: any) => ({ ...p, [id]: !p[id] }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {s ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field
        id="old"
        label="Current Password"
        show={show.old}
        toggle={setShow}
      />
      <div>
        <Field
          id="next"
          label="New Password"
          show={show.next}
          toggle={setShow}
        />
        {form.next && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full transition-all duration-300"
                  style={{
                    background: i <= strength ? strengthColor : "#e5e7eb",
                  }}
                />
              ))}
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: strengthColor }}
            >
              {strengthLabel}
            </span>
          </div>
        )}
      </div>
      <Field
        id="confirm"
        label="Confirm New Password"
        show={show.confirm}
        toggle={setShow}
      />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, #052e16, #166534)" }}
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {loading ? "Saving…" : "Update Password"}
      </button>
    </div>
  );
}

// ── Main Profile Page ─────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const userType = (user as any)?.type ?? (user as any)?.role ?? "patient";
  const isPatient = userType === "patient";
  const roleConf = ROLE_CONFIG[userType] ?? ROLE_CONFIG.patient;
  const RoleIcon = roleConf.Icon;

  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
    },
    [],
  );

  // Fetch full profile details from backend
  useEffect(() => {
    async function load() {
      try {
        if (!isPatient) {
          const res = await api.get("/api/practitioners/me");
          setProfile(res.data?.data ?? res.data);
        }
      } catch {
        // graceful degradation — use auth store data
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isPatient]);

  const p = profile ?? {};

  // Derived display values
  const email = p.email ?? (user as any)?.email ?? null;
  const phone = p.phoneNumber ?? (user as any)?.phoneNumber ?? null;
  const licenseNumber = p.licenseNumber ?? (user as any)?.licenseNumber ?? null;
  const specialization =
    p.specialization ?? (user as any)?.specialization ?? null;
  const department = p.department ?? (user as any)?.department ?? null;
  const qualifications = p.qualifications ?? null;
  const blockchainAddress =
    (user as any)?.blockchainAddress ?? p.blockchainAddress ?? null;
  const institutionName =
    (user as any)?.institutionName ?? p.institutionName ?? null;
  const institutionId = (user as any)?.institutionId ?? p.institutionId ?? null;
  const isVerified = p.isVerified ?? true;
  const lastSeen = p.lastSeenAt ?? null;
  const createdAt = p.createdAt ?? null;
  const mustChangePassword =
    p.mustChangePassword ?? (user as any)?.mustChangePassword ?? false;

  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="max-w-3xl mx-auto space-y-5"
    >
      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #052e16 0%, #166534 55%, #15803d 100%)",
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -right-10 -top-10 w-48 h-48 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #bbf7d0, transparent)",
          }}
        />
        <div
          className="absolute right-20 -bottom-6 w-32 h-32 rounded-full opacity-5"
          style={{
            background: "radial-gradient(circle, #dcfce7, transparent)",
          }}
        />

        <div className="relative px-7 py-7 flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar initials={initials} size="lg" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1
                className="text-white text-2xl font-bold leading-tight"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {isPatient ? "" : userType === "practitioner" ? "Dr. " : ""}
                {user?.firstName} {user?.lastName}
              </h1>
              {isVerified && (
                <BadgeCheck className="w-5 h-5 text-green-300 flex-shrink-0" />
              )}
            </div>

            {/* Role pill */}
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#bbf7d0",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <RoleIcon className="w-3 h-3" />
              {roleConf.label}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-green-300/60 text-xs">
              {institutionName && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {institutionName}
                </span>
              )}
              {lastSeen && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Active{" "}
                  {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}
                </span>
              )}
              {createdAt && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" /> Joined{" "}
                  {format(new Date(createdAt), "MMM yyyy")}
                </span>
              )}
            </div>
          </div>

          {/* Status chips */}
          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
              style={{
                background: isVerified
                  ? "rgba(134,239,172,0.15)"
                  : "rgba(239,68,68,0.15)",
                color: isVerified ? "#86efac" : "#fca5a5",
                border: `1px solid ${isVerified ? "rgba(134,239,172,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isVerified ? "bg-green-300" : "bg-red-400"}`}
              />
              {isVerified ? "Verified" : "Unverified"}
            </div>
            {mustChangePassword && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                style={{
                  background: "rgba(251,191,36,0.15)",
                  color: "#fcd34d",
                  border: "1px solid rgba(251,191,36,0.2)",
                }}
              >
                <AlertCircle className="w-3 h-3" />
                Change password
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Must-change-password banner ───────────────────────────────────── */}
      {mustChangePassword && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              Password change required
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Please update your password below before continuing.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── Contact info ─────────────────────────────────────────────────── */}
        <SectionCard title="Contact Information" icon={User} color="#166534">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-lg bg-gray-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-16 bg-gray-100 rounded" />
                    <div className="h-3.5 w-36 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <InfoRow icon={Mail} label="Email" value={email} />
              <InfoRow icon={Phone} label="Phone" value={phone} />
              <InfoRow
                icon={Building2}
                label="Institution"
                value={institutionName}
              />
              {institutionId && !institutionName && (
                <InfoRow
                  icon={Hash}
                  label="Institution ID"
                  value={institutionId}
                  mono
                />
              )}
            </div>
          )}
        </SectionCard>

        {/* ── Professional info (staff only) ───────────────────────────────── */}
        {!isPatient && (
          <SectionCard
            title="Professional Details"
            icon={Award}
            color="#7c3aed"
          >
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-7 h-7 rounded-lg bg-gray-100" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-16 bg-gray-100 rounded" />
                      <div className="h-3.5 w-36 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <InfoRow
                  icon={Hash}
                  label="License Number"
                  value={licenseNumber}
                  mono
                />
                <InfoRow
                  icon={Stethoscope}
                  label="Specialization"
                  value={specialization}
                />
                <InfoRow icon={MapPin} label="Department" value={department} />
                <InfoRow
                  icon={GraduationCap}
                  label="Qualifications"
                  value={qualifications}
                />
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Blockchain identity ───────────────────────────────────────────── */}
        <SectionCard
          title="Blockchain Identity"
          icon={Fingerprint}
          color="#0e7490"
        >
          <div>
            <InfoRow
              icon={Link2}
              label="Blockchain Address"
              value={blockchainAddress}
              mono
            />
            <InfoRow
              icon={Shield}
              label="Access Model"
              value="Patient-controlled consent via Hyperledger Fabric"
            />
            <div className="mt-3 p-3 rounded-xl bg-cyan-50 border border-cyan-100">
              <p className="text-xs text-cyan-700 leading-relaxed">
                Your blockchain address is used to cryptographically sign all
                clinical record access events. All actions are permanently
                logged and tamper-proof.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── Account security ─────────────────────────────────────────────── */}
        <SectionCard title="Account Security" icon={Lock} color="#dc2626">
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700">
                    2FA via Email OTP
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Active on every login
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                Enabled
              </span>
            </div>

            {createdAt && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-700">
                      Account Created
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {format(new Date(createdAt), "dd MMM yyyy")}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── Change password ───────────────────────────────────────────────── */}
      <SectionCard title="Change Password" icon={Key} color="#166534">
        <PasswordSection userType={userType} onToast={showToast} />
      </SectionCard>

      {/* ── Danger zone ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-red-50 bg-red-50/50">
          <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          </div>
          <p className="text-sm font-bold text-red-700">Sign Out</p>
        </div>
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-700">
              End your current session
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              You will be redirected to the login page.
            </p>
          </div>
          <button
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}

// Tiny inline calendar icon to avoid an extra import
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
