"use client";
import { useEffect, useState, useCallback } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  Layers, Plus, Pencil, Trash2, X, RefreshCw,
  CheckCircle2, AlertCircle, MapPin, Phone,
  RotateCcw, Eye, EyeOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Department {
  id: string;
  institutionId: string;
  departmentCode: string;
  departmentName: string;
  departmentType: string | null;
  location: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DEPT_TYPES = [
  { value: "clinical",    label: "Clinical" },
  { value: "diagnostic",  label: "Diagnostic" },
  { value: "support",     label: "Support" },
  { value: "administrative", label: "Administrative" },
  { value: "pharmacy",    label: "Pharmacy" },
  { value: "nursing",     label: "Nursing" },
];

const TYPE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  clinical:       { bg: "var(--info-tint)", text: "var(--blue-600)", border: "var(--blue-100)" },
  diagnostic:     { bg: "var(--violet-050)", text: "var(--accent-ink)", border: "var(--violet-100)" },
  support:        { bg: "var(--brand-tint)", text: "var(--green-600)", border: "var(--green-100)" },
  administrative: { bg: "var(--amber-050)", text: "var(--urgent-ink)", border: "var(--amber-100)" },
  pharmacy:       { bg: "var(--info-tint)", text: "var(--info-ink)", border: "var(--blue-100)" },
  nursing:        { bg: "var(--coral-050)", text: "var(--critical-ink)", border: "var(--coral-100)" },
};

function typeBadge(t: string | null) {
  const c = TYPE_COLOR[t?.toLowerCase() ?? ""] ?? { bg: "var(--surface-sunken)", text: "var(--text-secondary)", border: "var(--hc-border)" };
  const label = DEPT_TYPES.find(d => d.value === t)?.label ?? (t || "—");
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {label}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 18px", borderRadius: 12, maxWidth: 360,
      background: ok ? "var(--brand-tint)" : "var(--coral-050)",
      border: `1px solid ${ok ? "var(--green-100)" : "var(--coral-100)"}`,
      boxShadow: "var(--elev-3)",
    }}>
      {ok
        ? <CheckCircle2 style={{ width: 17, color: "var(--success-ink)", flexShrink: 0 }} />
        : <AlertCircle style={{ width: 17, color: "var(--critical-ink)", flexShrink: 0 }} />}
      <span style={{ fontSize: 13, fontWeight: 600, color: ok ? "var(--green-700)" : "var(--critical-ink)" }}>{msg}</span>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function DeptModal({
  editing,
  institutionId,
  onClose,
  onSaved,
}: {
  editing: Department | null;
  institutionId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(editing?.departmentCode ?? "");
  const [name, setName] = useState(editing?.departmentName ?? "");
  const [type, setType] = useState(editing?.departmentType ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!code.trim()) { setErr("Department code is required."); return; }
    if (!name.trim()) { setErr("Department name is required."); return; }
    setSaving(true); setErr("");
    try {
      if (editing) {
        await api.patch(`/api/institutions/departments/${editing.id}`, {
          departmentCode: code.trim(),
          departmentName: name.trim(),
          departmentType: type || undefined,
          location: location.trim() || undefined,
          phone: phone.trim() || undefined,
        });
      } else {
        await api.post(`/api/institutions/${institutionId}/departments`, {
          departmentCode: code.trim(),
          departmentName: name.trim(),
          departmentType: type || undefined,
          location: location.trim() || undefined,
          phone: phone.trim() || undefined,
        });
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );

  const inp = {
    width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
    border: "1px solid var(--text-disabled)", outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--scrim)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "var(--white)", borderRadius: 16, width: "100%", maxWidth: 480,
        padding: 28, boxShadow: "var(--elev-3)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {editing ? "Edit Department" : "New Department"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X style={{ width: 18 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Code *">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. CARD" style={inp} />
            </Field>
            <Field label="Type">
              <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, background: "var(--white)" }}>
                <option value="">— Select type —</option>
                {DEPT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Department Name *">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cardiology" style={inp} />
          </Field>

          <Field label="Location / Building">
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Block B, Floor 2" style={{ ...inp, paddingLeft: 34, position: "relative" }} />
          </Field>

          <Field label="Phone">
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +260 211 000000" style={inp} />
          </Field>
        </div>

        {err && (
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--critical-ink)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle style={{ width: 13 }} />{err}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 9, border: "1px solid var(--hc-border)",
            background: "var(--white)", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
          }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{
            padding: "9px 20px", borderRadius: 9, border: "none",
            background: saving ? "var(--green-300)" : "var(--green-600)", color: "var(--white)",
            fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
          }}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Department"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deactivate confirm ─────────────────────────────────────────────────────────
function DeactivateConfirm({
  dept,
  onClose,
  onDone,
}: {
  dept: Department;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const go = async () => {
    setBusy(true); setErr("");
    try {
      await api.delete(`/api/institutions/departments/${dept.id}`);
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? e.message ?? "Failed");
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--scrim)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "var(--white)", borderRadius: 14, width: "100%", maxWidth: 380,
        padding: 26, boxShadow: "var(--elev-3)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: "var(--coral-050)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Trash2 style={{ width: 17, color: "var(--critical-ink)" }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Deactivate Department</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 5 }}>
              <strong>{dept.departmentName}</strong> will be hidden from lists and cannot be assigned to new wards. Existing wards are unaffected.
            </p>
          </div>
        </div>
        {err && <p style={{ fontSize: 12, color: "var(--critical-ink)", marginTop: 10 }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid var(--hc-border)",
            background: "var(--white)", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
          }}>Cancel</button>
          <button onClick={go} disabled={busy} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: busy ? "var(--coral-100)" : "var(--critical-ink)", color: "var(--white)",
            fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
          }}>
            {busy ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DepartmentsPage() {
  const { user } = useAuthStore();
  const institutionId = (user as any)?.institutionId as string | undefined;

  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Department | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (silent = false) => {
    if (!institutionId) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(
        `/api/institutions/${institutionId}/departments?includeInactive=${showInactive}`
      );
      setDepts(res.data?.data?.departments ?? []);
    } finally {
      setLoading(false);
    }
  }, [institutionId, showInactive]);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(() => load(true));

  const handleSaved = (msg: string) => {
    setModal(null);
    setEditTarget(null);
    showToast(msg);
    load();
  };

  const handleDeactivated = () => {
    setDeactivateTarget(null);
    showToast("Department deactivated.");
    load();
  };

  const handleReactivate = async (dept: Department) => {
    try {
      await api.patch(`/api/institutions/departments/${dept.id}`, { isActive: true });
      showToast("Department reactivated.");
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? e.message ?? "Failed", false);
    }
  };

  const filtered = depts.filter(d =>
    d.departmentName.toLowerCase().includes(search.toLowerCase()) ||
    d.departmentCode.toLowerCase().includes(search.toLowerCase()) ||
    (d.departmentType ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const active = depts.filter(d => d.isActive);
  const typeCounts = active.reduce<Record<string, number>>((acc, d) => {
    const t = d.departmentType ?? "other";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  if (!institutionId) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No institution assigned to your account.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "var(--info-tint)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Layers style={{ width: 18, color: "var(--blue-600)" }} />
            </div>
            <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>Departments</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Manage clinical and support departments for your institution.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => load()} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            borderRadius: 9, border: "1px solid var(--hc-border)", background: "var(--white)",
            fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
          }}>
            <RefreshCw style={{ width: 13 }} />Refresh
          </button>
          <button onClick={() => { setEditTarget(null); setModal("create"); }} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderRadius: 9, border: "none", background: "var(--brand)", color: "var(--on-brand)",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            <Plus style={{ width: 14 }} />Add Department
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Active", value: active.length, color: "var(--blue-600)" },
          { label: "Clinical", value: typeCounts["clinical"] ?? 0, color: "var(--accent-ink)" },
          { label: "Diagnostic", value: typeCounts["diagnostic"] ?? 0, color: "var(--info-ink)" },
          { label: "Support", value: typeCounts["support"] ?? 0, color: "var(--success-ink)" },
          { label: "Other", value: active.length - (typeCounts["clinical"] ?? 0) - (typeCounts["diagnostic"] ?? 0) - (typeCounts["support"] ?? 0), color: "var(--urgent-ink)" },
        ].map(s => (
          <div key={s.label} style={{
            background: "var(--white)", border: "1px solid var(--border-faint)", borderRadius: 12,
            padding: "14px 16px", boxShadow: "var(--elev-1)",
          }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, margin: "4px 0 0" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: "var(--white)", border: "1px solid var(--border-faint)", borderRadius: 12,
        padding: "14px 18px", marginBottom: 16, boxShadow: "var(--elev-1)",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, code or type…"
          style={{
            flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8,
            border: "1px solid var(--hc-border)", fontSize: 13, outline: "none",
          }}
        />
        <button
          onClick={() => setShowInactive(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            borderRadius: 8, border: `1px solid ${showInactive ? "var(--accent-ink)" : "var(--hc-border)"}`,
            background: showInactive ? "var(--violet-050)" : "var(--white)",
            color: showInactive ? "var(--accent-ink)" : "var(--text-secondary)",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {showInactive ? <Eye style={{ width: 13 }} /> : <EyeOff style={{ width: 13 }} />}
          {showInactive ? "Hiding Inactive" : "Show Inactive"}
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{
        background: "var(--white)", border: "1px solid var(--border-faint)", borderRadius: 14,
        overflow: "hidden", boxShadow: "var(--elev-1)",
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading departments…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Layers style={{ width: 36, color: "var(--text-disabled)", marginBottom: 10 }} />
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              {search ? "No departments match your search." : "No departments yet. Add one to get started."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border-faint)" }}>
                {["Code", "Department", "Type", "Location", "Phone", "Status", ""].map(h => (
                  <th key={h} style={{
                    padding: "11px 16px", textAlign: "left", fontSize: 11,
                    fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id} style={{
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--surface-sunken)" : "none",
                  opacity: d.isActive ? 1 : 0.55,
                  background: d.isActive ? "transparent" : "var(--surface-app)",
                }}>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: "var(--text-secondary)",
                      background: "var(--surface-sunken)", padding: "2px 8px", borderRadius: 6,
                      fontFamily: "var(--font-mono)",
                    }}>{d.departmentCode}</span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{d.departmentName}</p>
                  </td>
                  <td style={{ padding: "13px 16px" }}>{typeBadge(d.departmentType)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    {d.location ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                        <MapPin style={{ width: 11, flexShrink: 0 }} />{d.location}
                      </span>
                    ) : <span style={{ color: "var(--text-disabled)", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {d.phone ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)" }}>
                        <Phone style={{ width: 11, flexShrink: 0 }} />{d.phone}
                      </span>
                    ) : <span style={{ color: "var(--text-disabled)", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                      background: d.isActive ? "var(--brand-tint)" : "var(--coral-050)",
                      color: d.isActive ? "var(--green-600)" : "var(--critical-ink)",
                      border: `1px solid ${d.isActive ? "var(--green-100)" : "var(--coral-100)"}`,
                    }}>
                      {d.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {d.isActive ? (
                        <>
                          <button
                            onClick={() => { setEditTarget(d); setModal("edit"); }}
                            title="Edit"
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "5px 10px", borderRadius: 7,
                              border: "1px solid var(--hc-border)", background: "var(--white)",
                              fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
                            }}
                          >
                            <Pencil style={{ width: 11 }} />Edit
                          </button>
                          <button
                            onClick={() => setDeactivateTarget(d)}
                            title="Deactivate"
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "5px 10px", borderRadius: 7,
                              border: "1px solid var(--coral-100)", background: "var(--coral-050)",
                              fontSize: 12, fontWeight: 600, color: "var(--critical-ink)", cursor: "pointer",
                            }}
                          >
                            <Trash2 style={{ width: 11 }} />Deactivate
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleReactivate(d)}
                          title="Reactivate"
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "5px 10px", borderRadius: 7,
                            border: "1px solid var(--green-100)", background: "var(--brand-tint)",
                            fontSize: 12, fontWeight: 600, color: "var(--success-ink)", cursor: "pointer",
                          }}
                        >
                          <RotateCcw style={{ width: 11 }} />Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {(modal === "create" || modal === "edit") && (
        <DeptModal
          editing={modal === "edit" ? editTarget : null}
          institutionId={institutionId}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSaved={() => handleSaved(modal === "edit" ? "Department updated." : "Department created.")}
        />
      )}

      {deactivateTarget && (
        <DeactivateConfirm
          dept={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onDone={handleDeactivated}
        />
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
