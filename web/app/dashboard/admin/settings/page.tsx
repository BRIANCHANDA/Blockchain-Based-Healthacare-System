"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  Shield, Bell, Database, Check, Loader2,
  User, Lock, Eye, EyeOff, AlertCircle, Info,
  Building2, Clock, FileText,
} from "lucide-react";

// ── Sidebar sections ──────────────────────────────────────────────────────────
const SECTIONS = [
  { key: "profile",       label: "Profile",        icon: User     },
  { key: "security",      label: "Security",       icon: Shield   },
  { key: "notifications", label: "Notifications",  icon: Bell     },
  { key: "system",        label: "System",         icon: Database },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-[var(--border-faint)]">
        <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function InputField({ value, onChange, placeholder, type = "text", readOnly = false }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3.5 py-2.5 rounded-[var(--r-sm)] border text-sm outline-none transition-all ${
        readOnly
          ? "border-[var(--border-faint)] bg-[var(--surface-sunken)] text-[var(--text-secondary)] cursor-default"
          : "border-[var(--hc-border)] bg-[var(--surface-sunken)] focus:border-[var(--green-600)] focus:ring-2 focus:ring-[var(--green-600)] focus:bg-[var(--surface-card)]"
      }`}
    />
  );
}

function InfoRow({ icon: Icon, label, value, mono = false }: {
  icon: any; label: string; value: string | null | undefined; mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border-faint)] last:border-0">
      <div className="w-7 h-7 rounded-[var(--r-xs)] bg-[var(--surface-sunken)] border border-[var(--border-faint)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-semibold text-[var(--text-primary)] mt-0.5 truncate ${mono ? "font-mono text-xs" : ""}`}>
          {value ?? <span className="text-[var(--text-muted)] font-normal">—</span>}
        </p>
      </div>
    </div>
  );
}

function Toggle({ label, description, value, onChange, disabled = false }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50"
        style={{ background: value ? "var(--green-800)" : "var(--hc-border)" }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 bg-[var(--surface-card)] rounded-full shadow transition-transform duration-200"
          style={{ transform: value ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${ok ? "bg-[var(--brand-tint)] text-[var(--green-700)]" : "bg-[var(--coral-050)] text-[var(--critical-ink)]"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-[var(--brand)]" : "bg-[var(--coral-500)]"}`} />
      {label}
    </span>
  );
}

function SaveBar({ onSave, saving, saved, error }: {
  onSave: () => void; saving: boolean; saved: boolean; error: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 mt-2">
      {error && (
        <div className="flex items-center gap-2 text-sm text-[var(--critical-ink)]">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {!error && <div />}
      <button
        onClick={onSave}
        disabled={saving || saved}
        className="flex items-center gap-2 px-6 py-2.5 rounded-[var(--r-sm)] text-sm font-semibold text-[var(--white)] transition-all hover:shadow-[var(--elev-2)] disabled:opacity-60"
        style={{ background: saved ? "var(--green-700)" : "var(--brand)" }}
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          : saved ? <><Check className="w-4 h-4" /> Saved!</>
          : "Save Changes"}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = !(user as any)?.institutionId;
  const [activeSection, setActiveSection] = useState("profile");

  // ── Profile state ─────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phoneNumber: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await api.get("/api/practitioners/me");
      const p = res.data.data;
      setProfile(p);
      setForm({
        firstName:   p.firstName   ?? "",
        lastName:    p.lastName    ?? "",
        email:       p.email       ?? "",
        phoneNumber: p.phoneNumber ?? "",
      });
    } catch {
      setProfileError("Failed to load profile.");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileError("");
    try {
      await api.patch("/api/practitioners/me", {
        firstName:   form.firstName   || undefined,
        lastName:    form.lastName    || undefined,
        email:       form.email       || undefined,
        phoneNumber: form.phoneNumber || undefined,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
      await loadProfile();
    } catch (e: any) {
      setProfileError(e?.response?.data?.error?.message ?? "Update failed.");
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Security state ────────────────────────────────────────────────────────
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const changePassword = async () => {
    setPwdError("");
    if (pwd.next.length < 8) { setPwdError("New password must be at least 8 characters."); return; }
    if (pwd.next !== pwd.confirm) { setPwdError("Passwords do not match."); return; }
    setPwdSaving(true);
    try {
      await api.post("/api/auth/change-password/staff", {
        oldPassword: pwd.current,
        newPassword: pwd.next,
      });
      setPwdSaved(true);
      setPwd({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwdSaved(false), 3000);
    } catch (e: any) {
      setPwdError(e?.response?.data?.error?.message ?? "Password change failed.");
    } finally {
      setPwdSaving(false);
    }
  };

  // ── Notifications state ───────────────────────────────────────────────────
  const [notifs, setNotifs] = useState({
    newPatient:          true,
    permissionRequests:  true,
    emergencyOverrides:  true,
    criticalVisits:      true,
    auditAlerts:         false,
    staffVerification:   isSuperAdmin,
    systemAlerts:        true,
  });
  const [notifSaved, setNotifSaved] = useState(false);
  const saveNotifs = () => { setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2500); };

  // ── System state ──────────────────────────────────────────────────────────
  const [institution, setInstitution] = useState<any>(null);
  const [instLoading, setInstLoading] = useState(false);
  const [platformStats, setPlatformStats] = useState<any>(null);

  useEffect(() => {
    if (activeSection !== "system") return;
    if (!isSuperAdmin && (user as any)?.institutionId) {
      setInstLoading(true);
      api.get(`/api/institutions/${(user as any).institutionId}`)
        .then(r => setInstitution(r.data.data))
        .catch(() => {})
        .finally(() => setInstLoading(false));
    }
    if (isSuperAdmin) {
      Promise.all([
        api.get("/api/institutions"),
        api.get("/api/practitioners?limit=1"),
      ]).then(([instRes, practRes]) => {
        setPlatformStats({
          institutions: instRes.data.data?.total ?? instRes.data.data?.institutions?.length ?? 0,
          staff: practRes.data.data?.total ?? 0,
        });
      }).catch(() => {});
    }
  }, [activeSection, isSuperAdmin, user]);

  // ── Render ────────────────────────────────────────────────────────────────
  const roleLabel = (user as any)?.type === "admin"
    ? (isSuperAdmin ? "Super Administrator" : "Hospital Administrator")
    : (user as any)?.type ?? "Admin";

  return (
    <div style={{ maxWidth: 840 }}>
      <div className="mb-6">
        <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
          Settings
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Manage your account and system preferences</p>
      </div>

      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-44 flex-shrink-0">
          <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] p-2 sticky top-6">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--r-sm)] text-sm font-medium transition-all"
                style={
                  activeSection === key
                    ? { background: "var(--brand-tint)", color: "var(--green-900)", fontWeight: 700 }
                    : { color: "var(--text-secondary)" }
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ── PROFILE ─────────────────────────────────────────────────── */}
          {activeSection === "profile" && (
            <>
              <Card title="Account Details">
                {profileLoading ? (
                  <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading profile…
                  </div>
                ) : (
                  <>
                    {/* Avatar row */}
                    <div className="flex items-center gap-4 pb-4 mb-2 border-b border-[var(--border-faint)]">
                      <div
                        className="w-14 h-14 rounded-[var(--r-lg)] flex items-center justify-center text-lg font-bold text-[var(--white)] flex-shrink-0"
                        style={{ background: "var(--brand)" }}
                      >
                        {form.firstName?.[0]}{form.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-bold text-[var(--text-primary)]">{form.firstName} {form.lastName}</p>
                        <p className="text-sm text-[var(--text-muted)] mt-0.5">{roleLabel}</p>
                        <div className="flex gap-2 mt-1.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--brand-tint)] text-[var(--green-700)]">
                            {isSuperAdmin ? "Super Admin" : "Hospital Admin"}
                          </span>
                          {profile?.isVerified && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--info-tint)] text-[var(--info-ink)]">
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Editable fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="First Name">
                        <InputField value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} />
                      </Field>
                      <Field label="Last Name">
                        <InputField value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
                      </Field>
                      <Field label="Email Address">
                        <InputField value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
                      </Field>
                      <Field label="Phone Number">
                        <InputField value={form.phoneNumber} onChange={v => setForm(f => ({ ...f, phoneNumber: v }))} type="tel" />
                      </Field>
                    </div>
                  </>
                )}
              </Card>

              <Card title="Account Information">
                <InfoRow icon={User}     label="Role"            value={roleLabel} />
                <InfoRow icon={Building2} label="Institution"    value={profile?.institutionName ?? (isSuperAdmin ? "All Institutions" : "—")} />
                <InfoRow icon={FileText}  label="License Number" value={profile?.licenseNumber ?? "—"} />
                <InfoRow icon={Clock}     label="Last Active"    value={profile?.lastSeenAt ? new Date(profile.lastSeenAt).toLocaleString() : "—"} />
                <InfoRow icon={Clock}     label="Account Created" value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
              </Card>

              <SaveBar onSave={saveProfile} saving={profileSaving} saved={profileSaved} error={profileError} />
            </>
          )}

          {/* ── SECURITY ────────────────────────────────────────────────── */}
          {activeSection === "security" && (
            <>
              <Card title="Change Password">
                <div
                  className="flex items-start gap-2.5 text-xs text-[var(--urgent-ink)] bg-[var(--amber-050)] border border-[var(--amber-100)] rounded-[var(--r-sm)] px-4 py-3 mb-2"
                >
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  Changing your password will immediately invalidate all active sessions and require you to log in again.
                </div>
                {(["current", "next", "confirm"] as const).map((field) => {
                  const labels = { current: "Current Password", next: "New Password", confirm: "Confirm New Password" };
                  return (
                    <Field key={field} label={labels[field]}>
                      <div className="relative">
                        <input
                          type={showPwd[field] ? "text" : "password"}
                          value={pwd[field]}
                          onChange={e => setPwd(p => ({ ...p, [field]: e.target.value }))}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-[var(--r-sm)] border border-[var(--hc-border)] bg-[var(--surface-sunken)] text-sm outline-none focus:border-[var(--green-600)] focus:ring-2 focus:ring-[var(--green-600)] focus:bg-[var(--surface-card)] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd(s => ({ ...s, [field]: !s[field] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        >
                          {showPwd[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>
                  );
                })}
                {pwdError && (
                  <div className="flex items-center gap-2 text-sm text-[var(--critical-ink)]">
                    <AlertCircle className="w-4 h-4" /> {pwdError}
                  </div>
                )}
                {pwdSaved && (
                  <div className="flex items-center gap-2 text-sm text-[var(--green-700)]">
                    <Check className="w-4 h-4" /> Password changed successfully. Please log in again.
                  </div>
                )}
              </Card>

              <Card title="Authentication & Access">
                <div className="space-y-3">
                  <InfoRow icon={Shield} label="Two-Factor Authentication" value="Enabled — required at login for all staff accounts" />
                  <InfoRow icon={Clock}  label="Session Duration"          value="8 hours — sessions expire automatically after inactivity" />
                  <InfoRow icon={Lock}   label="Password Policy"           value="Minimum 8 characters · Changed passwords invalidate all sessions" />
                  <InfoRow icon={FileText} label="Audit Trail"             value="All authentication events are logged to the blockchain audit ledger" />
                </div>
              </Card>

              <div className="flex justify-end mt-2">
                <button
                  onClick={changePassword}
                  disabled={pwdSaving || pwdSaved || !pwd.current || !pwd.next || !pwd.confirm}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-[var(--r-sm)] text-sm font-semibold text-[var(--white)] transition-all hover:shadow-[var(--elev-2)] disabled:opacity-50"
                  style={{ background: pwdSaved ? "var(--green-700)" : "var(--brand)" }}
                >
                  {pwdSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Changing…</>
                    : pwdSaved ? <><Check className="w-4 h-4" /> Changed!</>
                    : "Change Password"}
                </button>
              </div>
            </>
          )}

          {/* ── NOTIFICATIONS ───────────────────────────────────────────── */}
          {activeSection === "notifications" && (
            <>
              <Card title="Alert Preferences">
                <div
                  className="flex items-start gap-2.5 text-xs text-[var(--info-ink)] bg-[var(--info-tint)] border border-[var(--blue-100)] rounded-[var(--r-sm)] px-4 py-3"
                >
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  Critical alerts (emergency overrides, critical-priority visits) are always delivered regardless of preferences.
                </div>
                <Toggle
                  label="New Patient Registrations"
                  description="Notify when a patient is registered at your institution"
                  value={notifs.newPatient}
                  onChange={v => setNotifs(n => ({ ...n, newPatient: v }))}
                />
                <Toggle
                  label="Access Permission Requests"
                  description="Alert when clinical staff request access to a patient's records"
                  value={notifs.permissionRequests}
                  onChange={v => setNotifs(n => ({ ...n, permissionRequests: v }))}
                />
                <Toggle
                  label="Emergency Override Alerts"
                  description="Notify when an emergency override is used to access patient records"
                  value={notifs.emergencyOverrides}
                  onChange={v => setNotifs(n => ({ ...n, emergencyOverrides: v }))}
                  disabled
                />
                <Toggle
                  label="Critical-Priority Visits"
                  description="Immediate notification for patients flagged as critical on arrival"
                  value={notifs.criticalVisits}
                  onChange={v => setNotifs(n => ({ ...n, criticalVisits: v }))}
                  disabled
                />
                <Toggle
                  label="Suspicious Audit Activity"
                  description="Alert when the audit log flags unusual access patterns"
                  value={notifs.auditAlerts}
                  onChange={v => setNotifs(n => ({ ...n, auditAlerts: v }))}
                />
                {isSuperAdmin && (
                  <Toggle
                    label="New Institution Registrations"
                    description="Notify when a new hospital or clinic joins the network"
                    value={notifs.staffVerification}
                    onChange={v => setNotifs(n => ({ ...n, staffVerification: v }))}
                  />
                )}
                <Toggle
                  label="System & Maintenance Notices"
                  description="Platform updates, scheduled maintenance windows"
                  value={notifs.systemAlerts}
                  onChange={v => setNotifs(n => ({ ...n, systemAlerts: v }))}
                />
              </Card>
              <div className="flex justify-end mt-2">
                <button
                  onClick={saveNotifs}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-[var(--r-sm)] text-sm font-semibold text-[var(--white)] transition-all hover:shadow-[var(--elev-2)]"
                  style={{ background: notifSaved ? "var(--green-700)" : "var(--brand)" }}
                >
                  {notifSaved ? <><Check className="w-4 h-4" /> Saved!</> : "Save Preferences"}
                </button>
              </div>
            </>
          )}

          {/* ── SYSTEM ──────────────────────────────────────────────────── */}
          {activeSection === "system" && (
            <>
              {/* Hospital Admin — Institution Info */}
              {!isSuperAdmin && (
                <Card title="Institution">
                  {instLoading ? (
                    <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] py-4">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading institution details…
                    </div>
                  ) : institution ? (
                    <>
                      <InfoRow icon={Building2} label="Name"               value={institution.institutionName} />
                      <InfoRow icon={FileText}  label="Type"               value={institution.institutionType?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} />
                      <InfoRow icon={FileText}  label="Licence Number"     value={institution.licenseNumber} />
                      <InfoRow icon={FileText}  label="Accreditation"      value={`${institution.accreditationStatus ?? "N/A"}${institution.accreditationExpiry ? ` · Expires ${new Date(institution.accreditationExpiry).toLocaleDateString("en-GB")}` : ""}`} />
                      <InfoRow icon={Database}  label="Bed Capacity"  value={institution.bedCapacity ? `${institution.bedCapacity} beds` : "—"} />
                    </>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">Institution details unavailable.</p>
                  )}
                </Card>
              )}

              {/* SuperAdmin — Platform Overview */}
              {isSuperAdmin && (
                <Card title="Platform Overview">
                  {platformStats ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Institutions", value: platformStats.institutions },
                        { label: "Staff Accounts", value: platformStats.staff > 0 ? platformStats.staff : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-[var(--surface-sunken)] rounded-[var(--r-sm)] p-4 border border-[var(--border-faint)]">
                          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
                          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                  )}
                </Card>
              )}

              {/* Blockchain Network */}
              <Card title="Distributed Ledger">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">Network Status</p>
                  <StatusBadge ok label="Connected" />
                </div>
                <InfoRow icon={Database} label="Network"          value="Healthcare Permissioned Network" />
                <InfoRow icon={Shield}   label="Consensus"        value="Fault-tolerant, multi-node ordering" />
                <InfoRow icon={FileText} label="Participation"    value="Multi-organisation — hospitals, pharmacies, ordering nodes" />
                <InfoRow icon={Lock}     label="Data in Transit"  value="All communications are encrypted end-to-end" />
              </Card>

              {/* Security Policies */}
              <Card title="Security Policies">
                <InfoRow icon={Clock}     label="Session Management"  value="Sessions expire automatically after a period of inactivity" />
                <InfoRow icon={Shield}    label="Two-Factor Auth"     value="Required for all staff and administrator accounts" />
                <InfoRow icon={Lock}      label="Data Protection"     value="All patient information is encrypted at rest and in transit" />
                <InfoRow icon={FileText}  label="Audit Trail"         value="All access events are permanently recorded and tamper-evident" />
                <InfoRow icon={Database}  label="Record Integrity"    value="Records are cryptographically verified on the distributed ledger" />
                {!isSuperAdmin && (
                  <InfoRow icon={Building2} label="Access Scope"      value="Staff access is restricted to their institution unless explicitly authorised" />
                )}
                {isSuperAdmin && (
                  <InfoRow icon={Building2} label="Administrative Access" value="Cross-institution oversight · Patient record access requires explicit authorisation" />
                )}
              </Card>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
