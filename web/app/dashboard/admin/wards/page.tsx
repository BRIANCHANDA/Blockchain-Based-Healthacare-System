"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  BedDouble, Plus, Pencil, Trash2, X, RefreshCw,
  CheckCircle2, AlertCircle, ChevronDown, Users,
  Wrench, Building2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Department {
  id: string;
  departmentCode: string;
  departmentName: string;
  departmentType: string;
}

interface Ward {
  id: string;
  wardCode: string;
  wardName: string;
  wardType: string;
  bedCount: number;
  availableBeds: number;
  isActive: boolean;
  departmentName: string;
  bedsTracked: number;
  bedsOccupied: number;
  bedsAvailable: number;
  bedsMaint: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const WARD_TYPES = [
  { value: "general",    label: "General" },
  { value: "icu",        label: "Intensive Care (ICU)" },
  { value: "maternity",  label: "Maternity" },
  { value: "paediatric", label: "Paediatric" },
  { value: "surgical",   label: "Surgical" },
  { value: "isolation",  label: "Isolation" },
  { value: "psychiatric",label: "Psychiatric" },
  { value: "oncology",   label: "Oncology" },
];

const TYPE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  icu:        { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe" },
  general:    { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  maternity:  { bg: "#fdf2f8", text: "#db2777", border: "#fbcfe8" },
  paediatric: { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc" },
  surgical:   { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  isolation:  { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  psychiatric:{ bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  oncology:   { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
};

function typeBadge(t: string) {
  const c = TYPE_COLOR[t?.toLowerCase()] ?? { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" };
  const label = WARD_TYPES.find(w => w.value === t)?.label ?? t;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 14px", background: `${color}10`, borderRadius: 8 }}>
      <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginTop: 2 }}>{label}</span>
    </div>
  );
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────
function WardModal({
  departments, editing, onClose, onSaved,
}: {
  departments: Department[];
  editing: Ward | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editing;

  const [form, setForm] = useState({
    departmentId: editing ? "" : "",
    wardCode:     editing?.wardCode  ?? "",
    wardName:     editing?.wardName  ?? "",
    wardType:     editing?.wardType  ?? "general",
    bedCount:     editing?.bedCount  ?? 10,
    isActive:     editing?.isActive  ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.wardName.trim()) { setError("Ward name is required"); return; }
    if (!isEdit && !form.wardCode.trim()) { setError("Ward code is required"); return; }
    if (!isEdit && !form.departmentId) { setError("Department is required"); return; }
    if (form.bedCount < 1) { setError("Bed count must be at least 1"); return; }

    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await api.patch(`/api/wards/admin/${editing!.id}`, {
          wardName: form.wardName,
          wardType: form.wardType,
          bedCount: form.bedCount,
          isActive: form.isActive,
        });
      } else {
        await api.post("/api/wards/admin", {
          departmentId: form.departmentId,
          wardCode:     form.wardCode.toUpperCase(),
          wardName:     form.wardName,
          wardType:     form.wardType,
          bedCount:     form.bedCount,
        });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BedDouble size={17} style={{ color: "#2563eb" }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>
              {isEdit ? "Edit Ward" : "Add New Ward"}
            </h3>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {!isEdit && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>Department *</label>
              {departments.length === 0 ? (
                <div style={{
                  padding: "10px 14px", borderRadius: 10, background: "#fffbeb",
                  border: "1px solid #fde68a", fontSize: 12, color: "#92400e",
                }}>
                  No departments found. <a href="/dashboard/admin/departments" style={{ color: "#d97706", fontWeight: 700, textDecoration: "underline" }}>Create a department first</a>, then return here to add a ward.
                </div>
              ) : (
                <select
                  value={form.departmentId}
                  onChange={e => set("departmentId", e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, background: "#fff", outline: "none" }}
                >
                  <option value="">Select a department…</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.departmentName} ({d.departmentCode})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>
                Ward Name *
              </label>
              <input
                value={form.wardName}
                onChange={e => set("wardName", e.target.value)}
                placeholder="e.g. Male General Ward"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {!isEdit && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>
                  Ward Code *
                </label>
                <input
                  value={form.wardCode}
                  onChange={e => set("wardCode", e.target.value.toUpperCase())}
                  placeholder="e.g. WARD-M1"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
                />
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>Ward Type *</label>
              <select
                value={form.wardType}
                onChange={e => set("wardType", e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, background: "#fff", outline: "none" }}
              >
                {WARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>Total Bed Capacity *</label>
              <input
                type="number"
                min={1}
                value={form.bedCount}
                onChange={e => set("bedCount", parseInt(e.target.value) || 1)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {isEdit && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div
                onClick={() => set("isActive", !form.isActive)}
                style={{ width: 40, height: 22, borderRadius: 11, background: form.isActive ? "#16a34a" : "#d1d5db", position: "relative", transition: "background 0.2s", cursor: "pointer" }}
              >
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: form.isActive ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Ward Active</span>
            </label>
          )}
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
            <AlertCircle size={14} style={{ color: "#dc2626", flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: "#dc2626" }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#166534,#15803d)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Ward"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ ward, onClose, onDone }: { ward: Ward; onClose: () => void; onDone: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState("");

  async function confirm() {
    setDeleting(true);
    try {
      await api.delete(`/api/wards/admin/${ward.id}`);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Failed to deactivate");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={16} style={{ color: "#dc2626" }} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>Deactivate Ward?</h3>
        </div>
        <p style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>
          <strong>{ward.wardName}</strong> ({ward.wardCode}) will be hidden from all views.
        </p>
        <p style={{ fontSize: 12.5, color: "#9ca3af", marginBottom: 18 }}>
          This action cannot be taken if any beds are currently occupied. You can re-activate the ward later by editing it.
        </p>
        {error && <p style={{ fontSize: 12.5, color: "#dc2626", marginBottom: 10 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
            Cancel
          </button>
          <button onClick={confirm} disabled={deleting}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: deleting ? 0.7 : 1 }}>
            {deleting ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminWardsPage() {
  const [wards,       setWards]       = useState<Ward[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [addOpen,  setAddOpen]  = useState(false);
  const [editing,  setEditing]  = useState<Ward | null>(null);
  const [deleting, setDeleting] = useState<Ward | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wardsRes, deptsRes] = await Promise.all([
        api.get("/api/wards"),
        api.get("/api/wards/admin/departments"),
      ]);
      setWards(wardsRes.data?.data ?? []);
      setDepartments(deptsRes.data?.data ?? []);
    } catch (e: any) {
      console.error("Ward page load error:", e?.response?.data ?? e?.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const visible = wards.filter(w => showInactive ? true : w.isActive);
  const totalBeds     = visible.reduce((s, w) => s + w.bedsTracked, 0);
  const totalOccupied = visible.reduce((s, w) => s + w.bedsOccupied, 0);
  const totalAvail    = visible.reduce((s, w) => s + w.bedsAvailable, 0);

  return (
    <div style={{ maxWidth: 1100, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BedDouble size={18} style={{ color: "#2563eb" }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", fontFamily: "'Playfair Display', serif" }}>
              Ward Management
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            Configure wards and bed capacity for your institution
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => load()} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setAddOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: "linear-gradient(135deg,#166534,#15803d)", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            <Plus size={14} /> Add Ward
          </button>
        </div>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total Wards",     value: wards.filter(w => w.isActive).length, color: "#2563eb", icon: Building2  },
            { label: "Tracked Beds",    value: totalBeds,                             color: "#7c3aed", icon: BedDouble  },
            { label: "Occupied",        value: totalOccupied,                         color: "#dc2626", icon: Users      },
            { label: "Available",       value: totalAvail,                            color: "#16a34a", icon: CheckCircle2 },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ background: "#fff", border: "1px solid #eaecf0", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter toggle ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setShowInactive(s => !s)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: showInactive ? "#f0fdf4" : "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: showInactive ? "#166534" : "#6b7280" }}
        >
          {showInactive ? <CheckCircle2 size={12} /> : null}
          {showInactive ? "Showing all (incl. inactive)" : "Show inactive wards"}
        </button>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{visible.length} ward{visible.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ height: 200, background: "#f8fafc", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RefreshCw size={20} style={{ color: "#9ca3af", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ background: "#f8fafc", border: "2px dashed #e5e7eb", borderRadius: 16, padding: "60px 30px", textAlign: "center" }}>
          <BedDouble size={40} style={{ color: "#d1d5db", marginBottom: 14 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>No wards configured yet</p>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>
            Add wards to let nurses assign patients to beds.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#166534,#15803d)", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            <Plus size={14} /> Add First Ward
          </button>
        </div>
      ) : (
        /* ── Ward table ─────────────────────────────────────────────────── */
        <div style={{ background: "#fff", border: "1px solid #eaecf0", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                {["Ward", "Type", "Department", "Capacity", "Tracked Beds", "Occupancy", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((ward, i) => {
                const occupancy = ward.bedsTracked > 0
                  ? Math.round(ward.bedsOccupied / ward.bedsTracked * 100)
                  : null;
                return (
                  <tr
                    key={ward.id}
                    style={{ borderBottom: "1px solid #f9fafb", background: i % 2 === 0 ? "#fff" : "#fafafa", opacity: ward.isActive ? 1 : 0.55 }}
                  >
                    {/* Ward name + code */}
                    <td style={{ padding: "14px 16px" }}>
                      <p style={{ fontWeight: 700, color: "#111" }}>{ward.wardName}</p>
                      <p style={{ fontSize: 11.5, color: "#9ca3af", fontFamily: "monospace", marginTop: 2 }}>{ward.wardCode}</p>
                    </td>

                    {/* Type badge */}
                    <td style={{ padding: "14px 16px" }}>
                      {typeBadge(ward.wardType)}
                    </td>

                    {/* Department */}
                    <td style={{ padding: "14px 16px", color: "#374151" }}>
                      {ward.departmentName ?? "—"}
                    </td>

                    {/* Bed capacity */}
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#111" }}>
                      {ward.bedCount}
                    </td>

                    {/* Tracked beds breakdown */}
                    <td style={{ padding: "14px 16px" }}>
                      {ward.bedsTracked > 0 ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <StatPill label="occ"   value={ward.bedsOccupied}  color="#dc2626" />
                          <StatPill label="free"  value={ward.bedsAvailable} color="#16a34a" />
                          {ward.bedsMaint > 0 && <StatPill label="maint" value={ward.bedsMaint}     color="#d97706" />}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>No beds added</span>
                      )}
                    </td>

                    {/* Occupancy bar */}
                    <td style={{ padding: "14px 16px", minWidth: 120 }}>
                      {occupancy !== null ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>Occupancy</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: occupancy > 85 ? "#dc2626" : occupancy > 60 ? "#d97706" : "#16a34a" }}>
                              {occupancy}%
                            </span>
                          </div>
                          <div style={{ height: 5, background: "#f3f4f6", borderRadius: 999 }}>
                            <div style={{ height: "100%", width: `${occupancy}%`, borderRadius: 999, background: occupancy > 85 ? "#dc2626" : occupancy > 60 ? "#d97706" : "#16a34a" }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>—</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: "14px 16px" }}>
                      {ward.isActive ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", padding: "3px 10px", borderRadius: 999, border: "1px solid #bbf7d0" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
                          Active
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", padding: "3px 10px", borderRadius: 999, border: "1px solid #e5e7eb" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9ca3af" }} />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => setEditing(ward)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setDeleting(ward)}
                          disabled={!ward.isActive}
                          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", cursor: ward.isActive ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", opacity: ward.isActive ? 1 : 0.35 }}
                          title="Deactivate"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {(addOpen || editing) && (
        <WardModal
          departments={departments}
          editing={editing}
          onClose={() => { setAddOpen(false); setEditing(null); }}
          onSaved={() => { setAddOpen(false); setEditing(null); load(); }}
        />
      )}
      {deleting && (
        <DeleteConfirm
          ward={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => { setDeleting(null); load(); }}
        />
      )}
    </div>
  );
}
