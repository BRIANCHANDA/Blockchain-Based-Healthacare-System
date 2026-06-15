"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  X,
  Mail,
  Phone,
  Building2,
  Shield,
  Key,
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
  Hash,
  GraduationCap,
  Award,
  Clock,
  Activity,
  User,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
type ToastState = { message: string; type: "success" | "error" } | null;

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

// ── Small sub-components ──────────────────────────────────────────────────────
function InfoRow({
  label,
  value,
  icon: Icon,
  mono = false,
}: {
  label: string;
  value?: string | null;
  icon: any;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 leading-none mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm font-semibold text-gray-800 break-all leading-snug ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 mt-5 first:mt-0">
      {children}
    </p>
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
      className="absolute bottom-5 left-5 right-5 z-10 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold"
      style={
        type === "success"
          ? { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }
          : { background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" }
      }
    >
      {type === "success" ? (
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      <span className="flex-1">{message}</span>
    </div>
  );
}

// ── Password section ──────────────────────────────────────────────────────────
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

  const endpoint =
    userType === "patient"
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
  const strengthColor = ["", "#ef4444", "#f59e0b", "#3b82f6", "#16a34a"][
    strength
  ];
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];

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
      onToast("Password changed — signing you out…", "success");
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

  function PwField({
    id,
    label,
  }: {
    id: "old" | "next" | "confirm";
    label: string;
  }) {
    return (
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
          {label}
        </label>
        <div className="relative">
          <input
            type={show[id] ? "text" : "password"}
            value={form[id]}
            onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 pr-9 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 focus:bg-white transition-colors"
          />
          <button
            type="button"
            onClick={() => setShow((s) => ({ ...s, [id]: !s[id] }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show[id] ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PwField id="old" label="Current Password" />
      <div>
        <PwField id="next" label="New Password" />
        {form.next && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 flex gap-0.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-1 rounded-full transition-all"
                  style={{
                    background: i <= strength ? strengthColor : "#e5e7eb",
                  }}
                />
              ))}
            </div>
            <span
              className="text-[10px] font-bold"
              style={{ color: strengthColor }}
            >
              {strengthLabel}
            </span>
          </div>
        )}
      </div>
      <PwField id="confirm" label="Confirm New Password" />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 mt-1"
        style={{ background: "linear-gradient(135deg,#052e16,#166534)" }}
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

// ── Main drawer ───────────────────────────────────────────────────────────────
export function ProfileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "security">("info");
  const [toast, setToast] = useState<ToastState>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const userType = (user as any)?.type ?? (user as any)?.role ?? "patient";
  const isPatient = userType === "patient";
  const roleConf = ROLE_CONFIG[userType] ?? ROLE_CONFIG.patient;
  const RoleIcon = roleConf.Icon;
  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();
  const mustChangePassword =
    (user as any)?.mustChangePassword ?? profile?.mustChangePassword ?? false;

  // Load full profile when drawer opens
  useEffect(() => {
    if (!open || isPatient || profile) return;
    setLoading(true);
    api
      .get("/api/practitioners/me")
      .then((res) => setProfile(res.data?.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, isPatient, profile]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
    },
    [],
  );

  const p = profile ?? {};
  const email = p.email ?? (user as any)?.email ?? null;
  const phone = p.phoneNumber ?? (user as any)?.phoneNumber ?? null;
  const licenseNumber = p.licenseNumber ?? null;
  const specialization = p.specialization ?? null;
  const department = p.department ?? null;
  const qualifications = p.qualifications ?? null;
  const institutionName =
    (user as any)?.institutionName ?? p.institutionName ?? null;
  const isVerified = p.isVerified ?? true;
  const lastSeen = p.lastSeenAt ?? null;
  const createdAt = p.createdAt ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="relative flex-shrink-0 px-5 pt-5 pb-5"
          style={{
            background:
              "linear-gradient(135deg,#052e16 0%,#166534 60%,#15803d 100%)",
          }}
        >
          {/* Decorative blob */}
          <div
            className="absolute -right-8 -top-8 w-36 h-36 rounded-full opacity-10"
            style={{
              background: "radial-gradient(circle,#bbf7d0,transparent)",
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Avatar + name */}
          <div className="flex items-center gap-4 relative">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className="text-white font-bold text-base leading-tight truncate"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {!isPatient && userType === "practitioner" ? "Dr. " : ""}
                  {user?.firstName} {user?.lastName}
                </p>
                {isVerified && (
                  <BadgeCheck className="w-4 h-4 text-green-300 flex-shrink-0" />
                )}
              </div>

              {/* Role pill */}
              <div
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  color: "#bbf7d0",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <RoleIcon className="w-2.5 h-2.5" />
                {roleConf.label}
              </div>

              {/* Institution */}
              {institutionName && (
                <p className="flex items-center gap-1 text-[11px] text-green-300/60 mt-1 truncate">
                  <Building2 className="w-3 h-3 flex-shrink-0" />
                  {institutionName}
                </p>
              )}
            </div>
          </div>

          {/* Status row */}
          <div className="flex items-center gap-2 mt-3 relative">
            <span
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{
                background: isVerified
                  ? "rgba(134,239,172,0.15)"
                  : "rgba(239,68,68,0.15)",
                color: isVerified ? "#86efac" : "#fca5a5",
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isVerified ? "bg-green-300" : "bg-red-400"}`}
              />
              {isVerified ? "Verified" : "Unverified"}
            </span>
            {lastSeen && (
              <span className="text-[10px] text-green-300/50 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}
              </span>
            )}
            {mustChangePassword && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ml-auto"
                style={{
                  background: "rgba(251,191,36,0.15)",
                  color: "#fcd34d",
                }}
              >
                <AlertCircle className="w-2.5 h-2.5" />
                Change pwd
              </span>
            )}
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex border-b border-gray-100 bg-white">
          {(["info", "security"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors relative"
              style={{ color: activeTab === tab ? "#166534" : "#9ca3af" }}
            >
              {tab === "info" ? "Profile" : "Security"}
              {activeTab === tab && (
                <span
                  className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                  style={{ background: "#166534" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-20">
          {/* Must-change-password banner */}
          {mustChangePassword && activeTab === "info" && (
            <button
              onClick={() => setActiveTab("security")}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4 text-left"
            >
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-800">
                  Password change required
                </p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  Tap to update your password
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </button>
          )}

          {/* ── INFO TAB ─────────────────────────────────────────────────── */}
          {activeTab === "info" && (
            <div>
              {/* Contact */}
              <SectionTitle>Contact</SectionTitle>
              <div className="bg-gray-50/60 rounded-2xl border border-gray-100 px-4 py-1 mb-1">
                {loading ? (
                  <div className="space-y-3 py-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="w-6 h-6 rounded-md bg-gray-200" />
                        <div className="flex-1 space-y-1">
                          <div className="h-2 w-14 bg-gray-200 rounded" />
                          <div className="h-3 w-32 bg-gray-200 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <InfoRow icon={Mail} label="Email" value={email} />
                    <InfoRow icon={Phone} label="Phone" value={phone} />
                    <InfoRow
                      icon={Building2}
                      label="Institution"
                      value={institutionName}
                    />
                  </>
                )}
              </div>

              {/* Professional (staff only) */}
              {!isPatient && (
                <>
                  <SectionTitle>Professional</SectionTitle>
                  <div className="bg-gray-50/60 rounded-2xl border border-gray-100 px-4 py-1 mb-1">
                    {loading ? (
                      <div className="space-y-3 py-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex gap-3 animate-pulse">
                            <div className="w-6 h-6 rounded-md bg-gray-200" />
                            <div className="flex-1 space-y-1">
                              <div className="h-2 w-14 bg-gray-200 rounded" />
                              <div className="h-3 w-32 bg-gray-200 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
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
                        <InfoRow
                          icon={MapPin}
                          label="Department"
                          value={department}
                        />
                        <InfoRow
                          icon={GraduationCap}
                          label="Qualifications"
                          value={qualifications}
                        />
                      </>
                    )}
                  </div>
                </>
              )}

              {/* MedLink Security */}
              <SectionTitle>MedLink Security</SectionTitle>
              <div className="bg-gray-50/60 rounded-2xl border border-gray-100 px-4 py-1 mb-1">
                <InfoRow
                  icon={Shield}
                  label="Record Security"
                  value="End-to-end encrypted"
                />
                <InfoRow
                  icon={CheckCircle2}
                  label="Audit Trail"
                  value="All access events permanently logged"
                />
              </div>
              <div className="mt-2 p-3 rounded-xl bg-green-50 border border-green-100">
                <p className="text-[11px] text-green-700 leading-relaxed">
                  MedLink protects all patient records with enterprise-grade
                  encryption. Every access event is logged and fully auditable.
                </p>
              </div>

              {/* Account meta */}
              {createdAt && (
                <>
                  <SectionTitle>Account</SectionTitle>
                  <div className="bg-gray-50/60 rounded-2xl border border-gray-100 px-4 py-1">
                    <InfoRow
                      icon={Clock}
                      label="Member Since"
                      value={format(new Date(createdAt), "dd MMM yyyy")}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── SECURITY TAB ─────────────────────────────────────────────── */}
          {activeTab === "security" && (
            <div>
              {/* 2FA status */}
              <SectionTitle>Two-Factor Authentication</SectionTitle>
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-green-50 border border-green-100 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-800">
                      Email OTP
                    </p>
                    <p className="text-[10px] text-green-600">
                      Active on every login
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  Enabled
                </span>
              </div>

              {/* Change password */}
              <SectionTitle>Change Password</SectionTitle>
              <div className="bg-gray-50/60 rounded-2xl border border-gray-100 p-4">
                <PasswordSection userType={userType} onToast={showToast} />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer: sign out ────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
          <button
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
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
    </>
  );
}
