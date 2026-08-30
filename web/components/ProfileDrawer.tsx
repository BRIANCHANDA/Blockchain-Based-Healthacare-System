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
  Clock,
  Activity,
  User,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { Tone } from "@/components/dashboard/ui";

// ── Types ─────────────────────────────────────────────────────────────────────
type ToastState = { message: string; type: "success" | "error" } | null;

// ── Role config ───────────────────────────────────────────────────────────────
// Roles take their tone from the same mapping the admin portal uses
// (app/dashboard/admin/vocab.ts), so a role badge is the same colour wherever
// it appears. The design system has six semantic tones, not eight hues.
const ROLE_CONFIG: Record<
  string,
  { label: string; tone: Tone; Icon: any }
> = {
  practitioner:   { label: "Practitioner",   tone: "info",     Icon: Stethoscope },
  nurse:          { label: "Nurse",          tone: "success",  Icon: Activity },
  lab_technician: { label: "Lab Technician", tone: "urgent",   Icon: FlaskConical },
  radiologist:    { label: "Radiologist",    tone: "accent",   Icon: ScanLine },
  pharmacist:     { label: "Pharmacist",     tone: "brand",    Icon: Pill },
  receptionist:   { label: "Receptionist",   tone: "info",     Icon: ClipboardList },
  admin:          { label: "Administrator",  tone: "critical", Icon: UserCog },
  patient:        { label: "Patient",        tone: "neutral",  Icon: User },
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
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border-faint)] last:border-0">
      <div className="w-6 h-6 rounded-[var(--r-xs)] bg-[var(--surface-inset)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-[var(--text-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--text-muted)] leading-none mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm font-semibold text-[var(--text-primary)] break-all leading-snug ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--text-muted)] mb-2 mt-5 first:mt-0">
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
      className="absolute bottom-5 left-5 right-5 z-10 flex items-center gap-3 px-4 py-3 rounded-[var(--r-sm)] shadow-[var(--elev-3)] border text-sm font-semibold"
      style={
        type === "success"
          ? { background: "var(--brand-tint)", borderColor: "var(--green-200)", color: "var(--success-ink)" }
          : { background: "var(--coral-050)", borderColor: "var(--coral-100)", color: "var(--critical-ink)" }
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
  const strengthColor = ["", "var(--critical)", "var(--urgent)", "var(--info)", "var(--brand)"][
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
        <label className="text-[10px] font-bold uppercase tracking-[var(--ls-caps)] text-[var(--text-muted)] block mb-1">
          {label}
        </label>
        <div className="relative">
          <input
            type={show[id] ? "text" : "password"}
            value={form[id]}
            onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 pr-9 rounded-[var(--r-sm)] border border-[var(--hc-border)] text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-inset)] focus:outline-none focus:border-[var(--brand)] focus:bg-[var(--surface-card)] transition-colors"
          />
          <button
            type="button"
            onClick={() => setShow((s) => ({ ...s, [id]: !s[id] }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
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
                    background: i <= strength ? strengthColor : "var(--hc-border)",
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
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--r-sm)] text-sm font-bold text-[var(--white)] transition-all disabled:opacity-50 mt-1"
        style={{ background: "var(--brand)", color: "var(--on-brand)" }}
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
        className={`fixed inset-0 z-40 bg-[var(--scrim)] backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm flex flex-col bg-[var(--surface-card)] shadow-[var(--elev-3)] transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="relative flex-shrink-0 px-5 pt-5 pb-5"
          style={{
            background:
              "var(--sidebar-bg)",
          }}
        >
          {/* Decorative blob */}
          <div
            className="absolute -right-8 -top-8 w-36 h-36 rounded-full opacity-10"
            style={{
              background: "var(--on-dark-raise)",
            }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-[var(--r-xs)] flex items-center justify-center transition-colors"
            style={{
              background: "var(--on-dark-raise)",
              color: "var(--on-dark-text)",
            }}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Avatar + name */}
          <div className="flex items-center gap-4 relative">
            <div
              className="w-14 h-14 rounded-[var(--r-lg)] flex items-center justify-center text-lg font-black text-[var(--white)] flex-shrink-0"
              style={{
                background: "var(--on-dark-raise)",
                border: "1px solid var(--on-dark-line)",
              }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className="text-[var(--white)] font-bold text-base leading-tight truncate"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {!isPatient && userType === "practitioner" ? "Dr. " : ""}
                  {user?.firstName} {user?.lastName}
                </p>
                {isVerified && (
                  <BadgeCheck className="w-4 h-4 text-[var(--green-300)] flex-shrink-0" />
                )}
              </div>

              {/* Role pill */}
              <div
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1"
                style={{
                  background: "var(--on-dark-raise)",
                  color: "var(--green-200)",
                  border: "1px solid var(--on-dark-line)",
                }}
              >
                <RoleIcon className="w-2.5 h-2.5" />
                {roleConf.label}
              </div>

              {/* Institution */}
              {institutionName && (
                <p className="flex items-center gap-1 text-[11px] text-[var(--green-300)] opacity-60 mt-1 truncate">
                  <Building2 className="w-3 h-3 flex-shrink-0" />
                  {institutionName}
                </p>
              )}
            </div>
          </div>

          {/* Status row */}
          <div className="flex items-center gap-2 mt-3 relative">
            <span
              className="flex items-center gap-1 px-2 py-1 rounded-[var(--r-xs)] text-[10px] font-bold"
              style={{
                background: isVerified
                  ? "color-mix(in srgb, var(--green-300) 16%, transparent)"
                  : "color-mix(in srgb, var(--critical) 16%, transparent)",
                color: isVerified ? "var(--green-300)" : "var(--coral-100)",
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isVerified ? "bg-[var(--green-300)]" : "bg-[var(--critical)]"}`}
              />
              {isVerified ? "Verified" : "Unverified"}
            </span>
            {lastSeen && (
              <span className="text-[10px] text-[var(--green-300)] opacity-50 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}
              </span>
            )}
            {mustChangePassword && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-[var(--r-xs)] text-[10px] font-bold ml-auto"
                style={{
                  background: "color-mix(in srgb, var(--urgent) 16%, transparent)",
                  color: "var(--urgent-tint)",
                }}
              >
                <AlertCircle className="w-2.5 h-2.5" />
                Change pwd
              </span>
            )}
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex border-b border-[var(--border-faint)] bg-[var(--surface-card)]">
          {(["info", "security"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-3 text-xs font-bold uppercase tracking-[var(--ls-caps)] transition-colors relative"
              style={{ color: activeTab === tab ? "var(--success-ink)" : "var(--text-muted)" }}
            >
              {tab === "info" ? "Profile" : "Security"}
              {activeTab === tab && (
                <span
                  className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                  style={{ background: "var(--brand)" }}
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
              className="w-full flex items-center gap-3 p-3 rounded-[var(--r-sm)] bg-[var(--amber-050)] border border-[var(--urgent-tint)] mb-4 text-left"
            >
              <AlertCircle className="w-4 h-4 text-[var(--urgent)] flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-[var(--urgent-ink)]">
                  Password change required
                </p>
                <p className="text-[10px] text-[var(--urgent-ink)] mt-0.5">
                  Tap to update your password
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--urgent)]" />
            </button>
          )}

          {/* ── INFO TAB ─────────────────────────────────────────────────── */}
          {activeTab === "info" && (
            <div>
              {/* Contact */}
              <SectionTitle>Contact</SectionTitle>
              <div className="bg-[var(--surface-inset)] rounded-[var(--r-lg)] border border-[var(--border-faint)] px-4 py-1 mb-1">
                {loading ? (
                  <div className="space-y-3 py-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="w-6 h-6 rounded-[var(--r-xs)] bg-[var(--hc-border)]" />
                        <div className="flex-1 space-y-1">
                          <div className="h-2 w-14 bg-[var(--hc-border)] rounded" />
                          <div className="h-3 w-32 bg-[var(--hc-border)] rounded" />
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
                  <div className="bg-[var(--surface-inset)] rounded-[var(--r-lg)] border border-[var(--border-faint)] px-4 py-1 mb-1">
                    {loading ? (
                      <div className="space-y-3 py-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex gap-3 animate-pulse">
                            <div className="w-6 h-6 rounded-[var(--r-xs)] bg-[var(--hc-border)]" />
                            <div className="flex-1 space-y-1">
                              <div className="h-2 w-14 bg-[var(--hc-border)] rounded" />
                              <div className="h-3 w-32 bg-[var(--hc-border)] rounded" />
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
              <div className="bg-[var(--surface-inset)] rounded-[var(--r-lg)] border border-[var(--border-faint)] px-4 py-1 mb-1">
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
              <div className="mt-2 p-3 rounded-[var(--r-sm)] bg-[var(--brand-tint)] border border-[var(--green-100)]">
                <p className="text-[11px] text-[var(--success-ink)] leading-relaxed">
                  MedLink protects all patient records with enterprise-grade
                  encryption. Every access event is logged and fully auditable.
                </p>
              </div>

              {/* Account meta */}
              {createdAt && (
                <>
                  <SectionTitle>Account</SectionTitle>
                  <div className="bg-[var(--surface-inset)] rounded-[var(--r-lg)] border border-[var(--border-faint)] px-4 py-1">
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
              <div className="flex items-center justify-between p-3.5 rounded-[var(--r-lg)] bg-[var(--brand-tint)] border border-[var(--green-100)] mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[var(--r-sm)] bg-[var(--brand-fill)] flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-[var(--brand)]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--success-ink)]">
                      Email OTP
                    </p>
                    <p className="text-[10px] text-[var(--brand)]">
                      Active on every login
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[var(--success-ink)] bg-[var(--brand-fill)] px-2 py-0.5 rounded-full">
                  Enabled
                </span>
              </div>

              {/* Change password */}
              <SectionTitle>Change Password</SectionTitle>
              <div className="bg-[var(--surface-inset)] rounded-[var(--r-lg)] border border-[var(--border-faint)] p-4">
                <PasswordSection userType={userType} onToast={showToast} />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer: sign out ────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-[var(--border-faint)] bg-[var(--surface-card)]">
          <button
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--r-sm)] text-sm font-bold text-[var(--critical-ink)] border border-[var(--coral-100)] bg-[var(--coral-050)] hover:bg-[var(--critical-tint)] transition-colors"
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
