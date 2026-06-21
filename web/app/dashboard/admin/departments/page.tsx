"use client";
import { useEffect, useState, useCallback } from "react";
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
  clinical:       { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  diagnostic:     { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe" },
  support:        { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  administrative: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  pharmacy:       { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc" },
  nursing:        { bg: "#fdf2f8", text: "#db2777", border: "#fbcfe8" },
};

function typeBadge(t: string | null) {
  const c = TYPE_COLOR[t?.toLowerCase() ?? ""] ?? { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" };
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
      background: ok ? "#f0fdf4" : "#fef2f2",
      border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
      boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
    }}>
      {ok
        ? <CheckCircle2 style={{ width: 17, color: "#16a34a", flexShrink: 0 }} />
        : <AlertCircle style={{ width: 17, color: "#dc2626", flexShrink: 0 }} />}
      <span style={{ fontSize: 13, fontWeight: 600, color: ok ? "#15803d" : "#dc2626" }}>{msg}</span>
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
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );

  const inp = {
    width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13,
    border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
        padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
            {editing ? "Edit Department" : "New Department"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
            <X style={{ width: 18 }} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Code *">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. CARD" style={inp} />
            </Field>
            <Field label="Type">
              <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, background: "#fff" }}>
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
          <p style={{ marginTop: 12, fontSize: 12, color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle style={{ width: 13 }} />{err}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 9, border: "1px solid #e5e7eb",
            background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
          }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{
            padding: "9px 20px", borderRadius: 9, border: "none",
            background: saving ? "#86efac" : "#16a34a", color: "#fff",
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
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 14, width: "100%", maxWidth: 380,
        padding: 26, boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: "#fef2f2",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Trash2 style={{ width: 17, color: "#dc2626" }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Deactivate Department</p>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 5 }}>
              <strong>{dept.departmentName}</strong> will be hidden from lists and cannot be assigned to new wards. Existing wards are unaffected.
            </p>
          </div>
        </div>
        {err && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 10 }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb",
            background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
          }}>Cancel</button>
          <button onClick={go} disabled={busy} style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: busy ? "#fca5a5" : "#dc2626", color: "#fff",
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

  const load = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
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
        <p style={{ color: "#9ca3af", fontSize: 14 }}>No institution assigned to your account.</p>
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
              width: 36, height: 36, borderRadius: 10, background: "#eff6ff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Layers style={{ width: 18, color: "#2563eb" }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Departments</h1>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Manage clinical and support departments for your institution.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={load} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff",
            fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
          }}>
            <RefreshCw style={{ width: 13 }} />Refresh
          </button>
          <button onClick={() => { setEditTarget(null); setModal("create"); }} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderRadius: 9, border: "none", background: "#16a34a", color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            <Plus style={{ width: 14 }} />Add Department
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Active", value: active.length, color: "#2563eb" },
          { label: "Clinical", value: typeCounts["clinical"] ?? 0, color: "#7c3aed" },
          { label: "Diagnostic", value: typeCounts["diagnostic"] ?? 0, color: "#0e7490" },
          { label: "Support", value: typeCounts["support"] ?? 0, color: "#16a34a" },
          { label: "Other", value: active.length - (typeCounts["clinical"] ?? 0) - (typeCounts["diagnostic"] ?? 0) - (typeCounts["support"] ?? 0), color: "#d97706" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12,
            padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, margin: "4px 0 0" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12,
        padding: "14px 18px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, code or type…"
          style={{
            flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8,
            border: "1px solid #e5e7eb", fontSize: 13, outline: "none",
          }}
        />
        <button
          onClick={() => setShowInactive(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            borderRadius: 8, border: `1px solid ${showInactive ? "#7c3aed" : "#e5e7eb"}`,
            background: showInactive ? "#f5f3ff" : "#fff",
            color: showInactive ? "#7c3aed" : "#374151",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {showInactive ? <Eye style={{ width: 13 }} /> : <EyeOff style={{ width: 13 }} />}
          {showInactive ? "Hiding Inactive" : "Show Inactive"}
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{
        background: "#fff", border: "1px solid #f0f0f0", borderRadius: 14,
        overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>Loading departments…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Layers style={{ width: 36, color: "#d1d5db", marginBottom: 10 }} />
            <p style={{ color: "#9ca3af", fontSize: 14 }}>
              {search ? "No departments match your search." : "No departments yet. Add one to get started."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #f0f0f0" }}>
                {["Code", "Department", "Type", "Location", "Phone", "Status", ""].map(h => (
                  <th key={h} style={{
                    padding: "11px 16px", textAlign: "left", fontSize: 11,
                    fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id} style={{
                  borderBottom: i < filtered.length - 1 ? "1px solid #f9fafb" : "none",
                  opacity: d.isActive ? 1 : 0.55,
                  background: d.isActive ? "transparent" : "#fafafa",
                }}>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: "#374151",
                      background: "#f3f4f6", padding: "2px 8px", borderRadius: 6,
                      fontFamily: "monospace",
                    }}>{d.departmentCode}</span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{d.departmentName}</p>
                  </td>
                  <td style={{ padding: "13px 16px" }}>{typeBadge(d.departmentType)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    {d.location ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}>
                        <MapPin style={{ width: 11, flexShrink: 0 }} />{d.location}
                      </span>
                    ) : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {d.phone ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}>
                        <Phone style={{ width: 11, flexShrink: 0 }} />{d.phone}
                      </span>
                    ) : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                      background: d.isActive ? "#f0fdf4" : "#fef2f2",
                      color: d.isActive ? "#16a34a" : "#dc2626",
                      border: `1px solid ${d.isActive ? "#bbf7d0" : "#fecaca"}`,
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
                              border: "1px solid #e5e7eb", background: "#fff",
                              fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer",
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
                              border: "1px solid #fecaca", background: "#fef2f2",
                              fontSize: 12, fontWeight: 600, color: "#dc2626", cursor: "pointer",
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
                            border: "1px solid #bbf7d0", background: "#f0fdf4",
                            fontSize: 12, fontWeight: 600, color: "#16a34a", cursor: "pointer",
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
