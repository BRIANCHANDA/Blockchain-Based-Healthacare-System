"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  AlertTriangle,
  Users,
  Monitor,
  Ban,
  RefreshCw,
  LogOut,
  UserCheck,
  Zap,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Overview {
  emergencyOverridesLast30d: number;
  blockedAccounts: number;
  activeSessions: number;
  highVolumeUsers: number;
}

interface Flag {
  id: string;
  type: "emergency_override" | "high_volume";
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
  title: string;
  detail: string;
  actor: {
    id: string;
    name: string;
    role: string;
    department: string | null;
    isActive: boolean;
    institution: string | null;
  };
  patientId: string | null;
  accessReason: string | null;
  ipAddress: string | null;
  accessCount?: number;
}

interface Session {
  id: string;
  userId: string;
  userType: string;
  userName: string;
  userRole: string;
  institution: string | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  twoFaVerified: boolean;
}

interface BlockedAccount {
  id: string;
  name: string;
  role: string;
  department: string | null;
  institution: string | null;
  isVerified: boolean;
  blockedSince: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  practitioner: "Doctor",
  nurse: "Nurse",
  lab_technician: "Lab Tech",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
  admin: "Admin",
  receptionist: "Receptionist",
  patient: "Patient",
};

const SEVERITY_META = {
  critical: { color: "var(--critical-ink)", bg: "var(--coral-050)", border: "var(--coral-100)", label: "Critical" },
  high:     { color: "var(--urgent-ink)", bg: "var(--amber-050)", border: "var(--amber-100)", label: "High"     },
  medium:   { color: "var(--blue-600)", bg: "var(--info-tint)", border: "var(--blue-100)", label: "Medium"   },
  low:      { color: "var(--text-secondary)", bg: "var(--surface-sunken)", border: "var(--hc-border)", label: "Low"      },
};

const TYPE_META = {
  emergency_override: { icon: Zap,           label: "Emergency Override", color: "var(--critical-ink)" },
  high_volume:        { icon: AlertTriangle,  label: "High Volume Access", color: "var(--urgent-ink)" },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const isSuperAdmin = !(user as any)?.institutionId;

  const [tab,      setTab]      = useState<"flags" | "sessions" | "blocked">("flags");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [flags,    setFlags]    = useState<Flag[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [blocked,  setBlocked]  = useState<BlockedAccount[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast,    setToast]    = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [flagType, setFlagType] = useState<"all" | "emergency_override" | "high_volume">("all");

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadOverview = useCallback(async () => {
    try {
      const res = await api.get("/api/security/overview");
      setOverview(res.data.data);
    } catch { /* non-fatal */ }
  }, []);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/security/flags", { params: { type: flagType, days: 30, limit: 100 } });
      setFlags(res.data.data.flags ?? []);
    } catch {
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, [flagType]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/security/sessions", { params: { limit: 100 } });
      setSessions(res.data.data.sessions ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/security/blocked-accounts", { params: { limit: 100 } });
      setBlocked(res.data.data.accounts ?? []);
    } catch {
      setBlocked([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) { router.replace("/dashboard/admin"); return; }
    loadOverview();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (tab === "flags")    loadFlags();
    if (tab === "sessions") loadSessions();
    if (tab === "blocked")  loadBlocked();
  }, [tab, flagType]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const toggleBlock = async (userId: string, currentlyActive: boolean) => {
    setActionId(userId);
    try {
      await api.patch(`/api/practitioners/${userId}/toggle-active`);
      showToast(currentlyActive ? "Account blocked successfully." : "Account unblocked successfully.");
      loadOverview();
      if (tab === "flags")    loadFlags();
      if (tab === "blocked")  loadBlocked();
      if (tab === "sessions") loadSessions();
    } catch {
      showToast("Action failed. Please try again.", "err");
    } finally {
      setActionId(null);
    }
  };

  const revokeSessions = async (userId: string, userName: string) => {
    setActionId(`sess-${userId}`);
    try {
      await api.delete(`/api/security/sessions/user/${userId}`);
      showToast(`Sessions revoked for ${userName}.`);
      loadSessions();
      loadOverview();
    } catch {
      showToast("Could not revoke sessions. Please try again.", "err");
    } finally {
      setActionId(null);
    }
  };

  const refresh = () => {
    loadOverview();
    if (tab === "flags")    loadFlags();
    if (tab === "sessions") loadSessions();
    if (tab === "blocked")  loadBlocked();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 999,
          padding: "12px 20px", borderRadius: 12,
          background: toast.type === "ok" ? "var(--green-800)" : "var(--critical-ink)",
          color: "var(--white)", fontSize: 13.5, fontWeight: 600,
          boxShadow: "var(--elev-3)",
          animation: "fadeUp 0.2s ease",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <ShieldAlert size={22} style={{ color: "var(--critical-ink)" }} />
            <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>Security centre</h1>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 13.5, margin: 0 }}>
            Monitor flagged activity, active sessions, and blocked accounts
          </p>
        </div>
        <button
          onClick={refresh}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 16px", borderRadius: 10,
            border: "1px solid var(--hc-border)", background: "var(--white)",
            fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Emergency Overrides", value: overview.emergencyOverridesLast30d, sub: "Last 30 days",   icon: Zap,           color: "var(--critical-ink)", bg: "var(--coral-050)", border: "var(--coral-100)" },
            { label: "High-Volume Users",   value: overview.highVolumeUsers,           sub: "Last 24 hours",  icon: AlertTriangle,  color: "var(--urgent-ink)", bg: "var(--amber-050)", border: "var(--amber-100)" },
            { label: "Active Sessions",     value: overview.activeSessions,            sub: "Right now",       icon: Monitor,        color: "var(--blue-600)", bg: "var(--info-tint)", border: "var(--blue-100)" },
            { label: "Blocked Accounts",    value: overview.blockedAccounts,           sub: "Total blocked",   icon: Ban,            color: "var(--text-secondary)", bg: "var(--surface-sunken)", border: "var(--hc-border)" },
          ].map(({ label, value, sub, icon: Icon, color, bg, border }) => (
            <div key={label} style={{
              background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)",
              padding: "18px 20px", boxShadow: "var(--elev-1)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                  {label}
                </p>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: bg, border: `1px solid ${border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={15} style={{ color }} />
                </div>
              </div>
              <p style={{ fontSize: 30, fontWeight: 800, color, margin: "0 0 2px" }}>{value}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20,
        background: "var(--surface-sunken)", borderRadius: 12, padding: 4,
        width: "fit-content",
      }}>
        {(["flags", "sessions", "blocked"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              background: tab === t ? "var(--white)" : "transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
              boxShadow: tab === t ? "var(--elev-1)" : "none",
              transition: "all 0.15s",
            }}
          >
            {t === "flags"    ? "Flagged Activity" : t === "sessions" ? "Active Sessions" : "Blocked Accounts"}
            {t === "flags" && flags.length > 0    && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "var(--coral-050)", color: "var(--critical-ink)" }}>{flags.length}</span>}
            {t === "sessions" && sessions.length > 0 && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "var(--info-tint)", color: "var(--blue-600)" }}>{sessions.length}</span>}
            {t === "blocked"  && blocked.length > 0   && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "var(--surface-sunken)", color: "var(--text-secondary)" }}>{blocked.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Flagged Activity ── */}
      {tab === "flags" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "emergency_override", "high_volume"] as const).map((f) => (
                <button key={f} onClick={() => setFlagType(f)} style={{
                  padding: "5px 14px", borderRadius: 8, border: "1px solid",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  background:   flagType === f ? "var(--text-primary)" : "var(--white)",
                  color:        flagType === f ? "var(--white)"    : "var(--text-secondary)",
                  borderColor:  flagType === f ? "var(--text-primary)" : "var(--hc-border)",
                }}>
                  {f === "all" ? "All" : f === "emergency_override" ? "Emergency Overrides" : "High Volume"}
                </button>
              ))}
            </div>
          </div>

          {loading ? <LoadingState /> : flags.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No flagged activities" sub="No suspicious activity detected in the selected period." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {flags.map((flag) => {
                const sev  = SEVERITY_META[flag.severity];
                const meta = TYPE_META[flag.type];
                const Icon = meta.icon;
                const isActing = actionId === flag.actor.id;
                return (
                  <div key={flag.id} style={{
                    background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)",
                    padding: "16px 20px", boxShadow: "var(--elev-1)",
                    borderLeft: `4px solid ${sev.color}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: sev.bg, border: `1px solid ${sev.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={16} style={{ color: sev.color }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{flag.title}</p>
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                            background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`,
                            textTransform: "uppercase", letterSpacing: "0.06em",
                          }}>{sev.label}</span>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                            background: "var(--surface-sunken)", color: "var(--text-secondary)",
                          }}>{meta.label}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px" }}>{flag.detail}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                            <Users size={11} />
                            {flag.actor.name} · {ROLE_LABEL[flag.actor.role] ?? flag.actor.role}
                            {flag.actor.institution && ` · ${flag.actor.institution}`}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={11} />
                            {formatDistanceToNow(new Date(flag.timestamp), { addSuffix: true })}
                          </span>
                          {flag.ipAddress && (
                            <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                              <Monitor size={11} /> {flag.ipAddress}
                            </span>
                          )}
                          {flag.accessReason && (
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Reason: {flag.accessReason}</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        <ActionBtn
                          label={flag.actor.isActive ? "Block Account" : "Unblock"}
                          icon={flag.actor.isActive ? Ban : UserCheck}
                          danger={flag.actor.isActive}
                          loading={isActing}
                          onClick={() => toggleBlock(flag.actor.id, flag.actor.isActive)}
                        />
                        <ActionBtn
                          label="Revoke Sessions"
                          icon={LogOut}
                          danger={false}
                          loading={actionId === `sess-${flag.actor.id}`}
                          onClick={() => revokeSessions(flag.actor.id, flag.actor.name)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Active Sessions ── */}
      {tab === "sessions" && (
        <div>
          {loading ? <LoadingState /> : sessions.length === 0 ? (
            <EmptyState icon={Monitor} title="No active sessions" sub="No users are currently logged in." />
          ) : (
            <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--border-faint)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border-faint)" }}>
                    {["User", "Role / Institution", "2FA", "IP Address", "Started", "Expires", "Actions"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: i < sessions.length - 1 ? "1px solid var(--surface-sunken)" : "none" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            background: s.isActive ? "var(--brand-tint)" : "var(--coral-050)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 800,
                            color: s.isActive ? "var(--green-800)" : "var(--critical-ink)",
                          }}>
                            {s.userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{s.userName}</p>
                            {!s.isActive && <p style={{ fontSize: 11, color: "var(--critical-ink)", margin: 0, fontWeight: 600 }}>Blocked</p>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0 }}>{ROLE_LABEL[s.userRole] ?? s.userRole}</p>
                        {s.institution && <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>{s.institution}</p>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                          background: s.twoFaVerified ? "var(--brand-tint)" : "var(--coral-050)",
                          color: s.twoFaVerified ? "var(--green-800)" : "var(--critical-ink)",
                        }}>
                          {s.twoFaVerified ? "Verified" : "Pending"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", margin: 0 }}>{s.ipAddress ?? "—"}</p>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}</p>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 12, color: new Date(s.expiresAt) < new Date() ? "var(--critical-ink)" : "var(--text-secondary)", margin: 0 }}>
                          {format(new Date(s.expiresAt), "MMM d, HH:mm")}
                        </p>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <ActionBtn
                            label={s.isActive ? "Block" : "Unblock"}
                            icon={s.isActive ? Ban : UserCheck}
                            danger={s.isActive}
                            loading={actionId === s.userId}
                            onClick={() => toggleBlock(s.userId, s.isActive)}
                            compact
                          />
                          <ActionBtn
                            label="Revoke"
                            icon={LogOut}
                            danger={false}
                            loading={actionId === `sess-${s.userId}`}
                            onClick={() => revokeSessions(s.userId, s.userName)}
                            compact
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Blocked Accounts ── */}
      {tab === "blocked" && (
        <div>
          {loading ? <LoadingState /> : blocked.length === 0 ? (
            <EmptyState icon={Ban} title="No blocked accounts" sub="All practitioner accounts are currently active." />
          ) : (
            <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--border-faint)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border-faint)" }}>
                    {["Practitioner", "Role", "Institution", "Blocked Since", "Actions"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blocked.map((acct, i) => (
                    <tr key={acct.id} style={{ borderBottom: i < blocked.length - 1 ? "1px solid var(--surface-sunken)" : "none" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            background: "var(--coral-050)", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 800, color: "var(--critical-ink)",
                          }}>
                            {acct.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{acct.name}</p>
                            {acct.department && <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>{acct.department}</p>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0 }}>{ROLE_LABEL[acct.role] ?? acct.role}</p>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0 }}>{acct.institution ?? "—"}</p>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                          {formatDistanceToNow(new Date(acct.blockedSince), { addSuffix: true })}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-disabled)", margin: 0 }}>
                          {format(new Date(acct.blockedSince), "MMM d, yyyy")}
                        </p>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <ActionBtn
                          label="Restore Access"
                          icon={UserCheck}
                          danger={false}
                          loading={actionId === acct.id}
                          onClick={() => toggleBlock(acct.id, false)}
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActionBtn({
  label, icon: Icon, danger, loading, onClick, compact = false,
}: {
  label: string;
  icon: React.ElementType;
  danger: boolean;
  loading: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      disabled={loading}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: compact ? "5px 10px" : "7px 14px",
        borderRadius: 8, border: "1px solid",
        fontSize: compact ? 11.5 : 12.5, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        background: danger ? "var(--coral-050)" : "var(--surface-sunken)",
        color:      danger ? "var(--critical-ink)" : "var(--text-secondary)",
        borderColor: danger ? "var(--coral-100)" : "var(--hc-border)",
        transition: "all 0.12s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.background = danger ? "var(--coral-100)" : "var(--surface-sunken)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = danger ? "var(--coral-050)" : "var(--surface-sunken)";
      }}
    >
      {loading
        ? <RefreshCw size={11} style={{ animation: "spin 0.8s linear infinite" }} />
        : <Icon size={11} />
      }
      {label}
    </button>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div style={{
      background: "var(--white)", borderRadius: 16, border: "1px solid var(--border-faint)",
      padding: "60px 32px", textAlign: "center",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px",
        background: "var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={22} style={{ color: "var(--text-muted)" }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>{title}</p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{sub}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{
          background: "var(--white)", borderRadius: 14, border: "1px solid var(--border-faint)",
          padding: "20px", height: 80,
          animation: "pulse 1.4s ease infinite",
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
