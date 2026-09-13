"use client";
import { useEffect, useState, useCallback } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
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
  icu:        { bg: "var(--violet-050)", text: "var(--accent-ink)", border: "var(--violet-100)" },
  general:    { bg: "var(--info-tint)", text: "var(--blue-600)", border: "var(--blue-100)" },
  maternity:  { bg: "var(--coral-050)", text: "var(--critical-ink)", border: "var(--coral-100)" },
  paediatric: { bg: "var(--info-tint)", text: "var(--info-ink)", border: "var(--blue-100)" },
  surgical:   { bg: "var(--amber-050)", text: "var(--urgent-ink)", border: "var(--amber-100)" },
  isolation:  { bg: "var(--coral-050)", text: "var(--critical-ink)", border: "var(--coral-100)" },
  psychiatric:{ bg: "var(--brand-tint)", text: "var(--green-600)", border: "var(--green-100)" },
  oncology:   { bg: "var(--coral-050)", text: "var(--critical-ink)", border: "var(--coral-100)" },
};

function typeBadge(t: string) {
  const c = TYPE_COLOR[t?.toLowerCase()] ?? { bg: "var(--surface-sunken)", text: "var(--text-secondary)", border: "var(--hc-border)" };
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 14px", background: `color-mix(in srgb, ${color} 6%, transparent)`, borderRadius: 8 }}>
      <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>{label}</span>
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
    <div style={{ position: "fixed", inset: 0, background: "var(--scrim)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--white)", borderRadius: 20, padding: 28, width: 520, boxShadow: "var(--elev-3)", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BedDouble size={17} style={{ color: "var(--blue-600)" }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              {isEdit ? "Edit Ward" : "Add New Ward"}
            </h3>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--hc-border)", background: "var(--surface-sunken)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {!isEdit && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Department *</label>
              {departments.length === 0 ? (
                <div style={{
                  padding: "10px 14px", borderRadius: 10, background: "var(--amber-050)",
                  border: "1px solid var(--amber-100)", fontSize: 12, color: "var(--urgent-ink)",
                }}>
                  No departments found. <a href="/dashboard/admin/departments" style={{ color: "var(--urgent-ink)", fontWeight: 700, textDecoration: "underline" }}>Create a department first</a>, then return here to add a ward.
                </div>
              ) : (
                <select
                  value={form.departmentId}
                  onChange={e => set("departmentId", e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--hc-border)", fontSize: 13, background: "var(--white)", outline: "none" }}
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
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>
                Ward Name *
              </label>
              <input
                value={form.wardName}
                onChange={e => set("wardName", e.target.value)}
                placeholder="e.g. Male General Ward"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--hc-border)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {!isEdit && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>
                  Ward Code *
                </label>
                <input
                  value={form.wardCode}
                  onChange={e => set("wardCode", e.target.value.toUpperCase())}
                  placeholder="e.g. WARD-M1"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--hc-border)", fontSize: 13, outline: "none", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                />
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Ward Type *</label>
              <select
                value={form.wardType}
                onChange={e => set("wardType", e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--hc-border)", fontSize: 13, background: "var(--white)", outline: "none" }}
              >
                {WARD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Total Bed Capacity *</label>
              <input
                type="number"
                min={1}
                value={form.bedCount}
                onChange={e => set("bedCount", parseInt(e.target.value) || 1)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--hc-border)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {isEdit && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div
                onClick={() => set("isActive", !form.isActive)}
                style={{ width: 40, height: 22, borderRadius: 11, background: form.isActive ? "var(--green-600)" : "var(--text-disabled)", position: "relative", transition: "background 0.2s", cursor: "pointer" }}
              >
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--white)", position: "absolute", top: 2, left: form.isActive ? 20 : 2, transition: "left 0.2s", boxShadow: "var(--elev-2)" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Ward Active</span>
            </label>
          )}
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "var(--coral-050)", border: "1px solid var(--coral-100)" }}>
            <AlertCircle size={14} style={{ color: "var(--critical-ink)", flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: "var(--critical-ink)" }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--hc-border)", background: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: "var(--brand)", color: "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
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
    <div style={{ position: "fixed", inset: 0, background: "var(--scrim)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--white)", borderRadius: 20, padding: 28, width: 420, boxShadow: "var(--elev-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--coral-050)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={16} style={{ color: "var(--critical-ink)" }} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Deactivate Ward?</h3>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
          <strong>{ward.wardName}</strong> ({ward.wardCode}) will be hidden from all views.
        </p>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 18 }}>
          This action cannot be taken if any beds are currently occupied. You can re-activate the ward later by editing it.
        </p>
        {error && <p style={{ fontSize: 12.5, color: "var(--critical-ink)", marginBottom: 10 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--hc-border)", background: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={confirm} disabled={deleting}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "var(--critical-ink)", color: "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: deleting ? 0.7 : 1 }}>
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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
  useLiveRefresh(() => load(true));

  const visible = wards.filter(w => showInactive ? true : w.isActive);
  const totalBeds     = visible.reduce((s, w) => s + w.bedsTracked, 0);
  const totalOccupied = visible.reduce((s, w) => s + w.bedsOccupied, 0);
  const totalAvail    = visible.reduce((s, w) => s + w.bedsAvailable, 0);

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BedDouble size={18} style={{ color: "var(--blue-600)" }} />
            </div>
            <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
              Ward Management
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Configure wards and bed capacity for your institution
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => load()} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--hc-border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setAddOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: "var(--brand)", color: "var(--white)", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            <Plus size={14} /> Add Ward
          </button>
        </div>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total Wards",     value: wards.filter(w => w.isActive).length, color: "var(--blue-600)", icon: Building2  },
            { label: "Tracked Beds",    value: totalBeds,                             color: "var(--accent-ink)", icon: BedDouble  },
            { label: "Occupied",        value: totalOccupied,                         color: "var(--critical-ink)", icon: Users      },
            { label: "Available",       value: totalAvail,                            color: "var(--success-ink)", icon: CheckCircle2 },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ background: "var(--white)", border: "1px solid var(--hc-border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `color-mix(in srgb, ${color} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
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
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--hc-border)", background: showInactive ? "var(--brand-tint)" : "var(--white)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: showInactive ? "var(--green-800)" : "var(--text-secondary)" }}
        >
          {showInactive ? <CheckCircle2 size={12} /> : null}
          {showInactive ? "Showing all (incl. inactive)" : "Show inactive wards"}
        </button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{visible.length} ward{visible.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ height: 200, background: "var(--surface-sunken)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RefreshCw size={20} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ background: "var(--surface-sunken)", border: "2px dashed var(--hc-border)", borderRadius: 16, padding: "60px 30px", textAlign: "center" }}>
          <BedDouble size={40} style={{ color: "var(--text-disabled)", marginBottom: 14 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>No wards configured yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            Add wards to let nurses assign patients to beds.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10, background: "var(--brand)", color: "var(--white)", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            <Plus size={14} /> Add First Ward
          </button>
        </div>
      ) : (
        /* ── Ward table ─────────────────────────────────────────────────── */
        <div style={{ background: "var(--white)", border: "1px solid var(--hc-border)", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--surface-sunken)" }}>
                {["Ward", "Type", "Department", "Capacity", "Tracked Beds", "Occupancy", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
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
                    style={{ borderBottom: "1px solid var(--surface-sunken)", background: i % 2 === 0 ? "var(--white)" : "var(--surface-app)", opacity: ward.isActive ? 1 : 0.55 }}
                  >
                    {/* Ward name + code */}
                    <td style={{ padding: "14px 16px" }}>
                      <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>{ward.wardName}</p>
                      <p style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{ward.wardCode}</p>
                    </td>

                    {/* Type badge */}
                    <td style={{ padding: "14px 16px" }}>
                      {typeBadge(ward.wardType)}
                    </td>

                    {/* Department */}
                    <td style={{ padding: "14px 16px", color: "var(--text-secondary)" }}>
                      {ward.departmentName ?? "—"}
                    </td>

                    {/* Bed capacity */}
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {ward.bedCount}
                    </td>

                    {/* Tracked beds breakdown */}
                    <td style={{ padding: "14px 16px" }}>
                      {ward.bedsTracked > 0 ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <StatPill label="occ"   value={ward.bedsOccupied}  color="var(--critical-ink)" />
                          <StatPill label="free"  value={ward.bedsAvailable} color="var(--green-600)" />
                          {ward.bedsMaint > 0 && <StatPill label="maint" value={ward.bedsMaint}     color="var(--urgent-ink)" />}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-disabled)", fontStyle: "italic" }}>No beds added</span>
                      )}
                    </td>

                    {/* Occupancy bar */}
                    <td style={{ padding: "14px 16px", minWidth: 120 }}>
                      {occupancy !== null ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Occupancy</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: occupancy > 85 ? "var(--critical-ink)" : occupancy > 60 ? "var(--urgent-ink)" : "var(--green-600)" }}>
                              {occupancy}%
                            </span>
                          </div>
                          <div style={{ height: 5, background: "var(--surface-sunken)", borderRadius: 999 }}>
                            <div style={{ height: "100%", width: `${occupancy}%`, borderRadius: 999, background: occupancy > 85 ? "var(--critical-ink)" : occupancy > 60 ? "var(--urgent-ink)" : "var(--green-600)" }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-disabled)", fontStyle: "italic" }}>—</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: "14px 16px" }}>
                      {ward.isActive ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--success-ink)", background: "var(--brand-tint)", padding: "3px 10px", borderRadius: 999, border: "1px solid var(--green-100)" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green-600)" }} />
                          Active
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", background: "var(--surface-sunken)", padding: "3px 10px", borderRadius: 999, border: "1px solid var(--hc-border)" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)" }} />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => setEditing(ward)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--hc-border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setDeleting(ward)}
                          disabled={!ward.isActive}
                          style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--coral-100)", background: "var(--coral-050)", cursor: ward.isActive ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--critical-ink)", opacity: ward.isActive ? 1 : 0.35 }}
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
