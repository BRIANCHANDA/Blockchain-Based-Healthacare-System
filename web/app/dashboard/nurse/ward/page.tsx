"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  BedDouble, Users, Wrench, RefreshCw, X,
  AlertTriangle, Search,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ward {
  id: string;
  wardCode: string;
  wardName: string;
  wardType: string;
  bedCount: number;
  availableBeds: number;
  bedsTracked: number;
  bedsOccupied: number;
  bedsAvailable: number;
  bedsMaint: number;
  departmentName: string;
}

interface Bed {
  id: string;
  bedCode: string;
  bedType: string;
  status: "available" | "occupied" | "maintenance";
  notes: string | null;
  currentVisitId: string | null;
  updatedAt: string;
  visit: {
    visitId: string;
    visitNumber: string;
    admissionDate: string;
    priority: string;
    visitStatus: string;
    chiefComplaint: string | null;
    patientName: string;
    gender: string;
    doctorName: string | null;
  } | null;
}

interface UnassignedVisit {
  visitId: string;
  visitNumber: string;
  admissionDate: string;
  priority: string;
  chiefComplaint: string | null;
  admittingDiagnosis: string | null;
  visitType: string;
  patientName: string;
  gender: string;
  hasBed: boolean;
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<string, string> = {
  critical:  "var(--critical-ink)",
  emergency: "var(--critical-ink)",
  urgent:    "var(--urgent-ink)",
  routine:   "var(--green-600)",
};
const PRIORITY_BG: Record<string, string> = {
  critical:  "var(--coral-050)",
  emergency: "var(--coral-050)",
  urgent:    "var(--amber-050)",
  routine:   "var(--brand-tint)",
};
const WARD_TYPE_COLOR: Record<string, string> = {
  icu:        "var(--accent-ink)",
  general:    "var(--blue-600)",
  maternity:  "var(--critical-ink)",
  paediatric: "var(--info-ink)",
  surgical:   "var(--urgent-ink)",
  isolation:  "var(--critical-ink)",
};

function wardTypeColor(t: string) {
  return WARD_TYPE_COLOR[t?.toLowerCase()] ?? "var(--text-secondary)";
}

// ── Bed card ──────────────────────────────────────────────────────────────────
function BedCard({ bed, onAssign, onRelease, onMaintenance }: {
  bed: Bed;
  onAssign: (bed: Bed) => void;
  onRelease: (bed: Bed) => void;
  onMaintenance: (bed: Bed) => void;
}) {
  const bg =
    bed.status === "occupied"    ? "var(--coral-050)" :
    bed.status === "maintenance" ? "var(--amber-050)" : "var(--brand-tint)";
  const border =
    bed.status === "occupied"    ? "var(--coral-100)" :
    bed.status === "maintenance" ? "var(--amber-100)" : "var(--green-100)";
  const dot =
    bed.status === "occupied"    ? "var(--critical-ink)" :
    bed.status === "maintenance" ? "var(--urgent-ink)" : "var(--green-600)";

  return (
    <div style={{
      background: bg, border: `1.5px solid ${border}`, borderRadius: 14,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8,
      position: "relative", minHeight: 140,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, display: "inline-block" }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>Bed {bed.bedCode}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--surface-sunken)", padding: "1px 6px", borderRadius: 999 }}>
            {bed.bedType}
          </span>
        </div>
        {/* Maintenance toggle — always accessible */}
        {bed.status !== "occupied" && (
          <button
            onClick={() => onMaintenance(bed)}
            title={bed.status === "maintenance" ? "Mark available" : "Set maintenance"}
            style={{
              width: 26, height: 26, borderRadius: 6,
              border: `1px solid ${bed.status === "maintenance" ? "var(--green-100)" : "var(--hc-border)"}`,
              background: bed.status === "maintenance" ? "var(--brand-tint)" : "var(--white)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: bed.status === "maintenance" ? "var(--green-600)" : "var(--text-muted)",
            }}
          >
            <Wrench size={11} />
          </button>
        )}
      </div>

      {/* Content */}
      {bed.status === "occupied" && bed.visit ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>{bed.visit.patientName}</p>
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{bed.visit.visitNumber}</p>
            {bed.visit.chiefComplaint && (
              <p style={{ fontSize: 11.5, color: "var(--text-secondary)", fontStyle: "italic" }}>"{bed.visit.chiefComplaint}"</p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: PRIORITY_BG[bed.visit.priority] ?? "var(--surface-sunken)", color: PRIORITY_COLOR[bed.visit.priority] ?? "var(--text-secondary)" }}>
                {bed.visit.priority}
              </span>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                {formatDistanceToNow(new Date(bed.visit.admissionDate), { addSuffix: true })}
              </span>
            </div>
            {bed.visit.doctorName && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{bed.visit.doctorName}</p>
            )}
          </div>
          {/* Release button */}
          <button
            onClick={() => onRelease(bed)}
            style={{
              width: "100%", padding: "7px 0", borderRadius: 8,
              border: "1px solid var(--coral-100)", background: "var(--coral-050)",
              fontSize: 12, fontWeight: 700, color: "var(--critical-ink)", cursor: "pointer",
            }}
          >
            Release Bed
          </button>
        </>
      ) : bed.status === "maintenance" ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 4 }}>
            <Wrench size={18} style={{ color: "var(--urgent-ink)" }} />
            <p style={{ fontSize: 12, color: "var(--urgent-ink)", fontWeight: 600 }}>Under Maintenance</p>
            {bed.notes && <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>{bed.notes}</p>}
          </div>
          <button
            onClick={() => onMaintenance(bed)}
            style={{
              width: "100%", padding: "7px 0", borderRadius: 8,
              border: "1px solid var(--green-100)", background: "var(--brand-tint)",
              fontSize: 12, fontWeight: 700, color: "var(--success-ink)", cursor: "pointer",
            }}
          >
            Mark Available
          </button>
        </>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 4 }}>
            <CheckCircle2 size={18} style={{ color: "var(--success-ink)" }} />
            <p style={{ fontSize: 12, color: "var(--success-ink)", fontWeight: 600 }}>Available</p>
          </div>
          {/* Primary assign button */}
          <button
            onClick={() => onAssign(bed)}
            style={{
              width: "100%", padding: "8px 0", borderRadius: 8,
              border: "none", background: "var(--brand)",
              fontSize: 12, fontWeight: 700, color: "var(--white)", cursor: "pointer",
            }}
          >
            Assign Patient
          </button>
        </>
      )}
    </div>
  );
}

// ── Add beds modal ─────────────────────────────────────────────────────────────
function AddBedsModal({ wardId, onClose, onDone }: { wardId: string; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState([{ bedCode: "", bedType: "general" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const BED_TYPES = ["general", "icu", "isolation", "maternity", "paediatric", "surgical"];

  function addRow() { setRows(r => [...r, { bedCode: "", bedType: "general" }]); }
  function removeRow(i: number) { setRows(r => r.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, key: string, val: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [key]: val } : row));
  }

  async function save() {
    const valid = rows.filter(r => r.bedCode.trim());
    if (!valid.length) { setError("Enter at least one bed code"); return; }
    setSaving(true);
    try {
      await api.post(`/api/wards/${wardId}/beds`, { beds: valid });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Failed to add beds");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--scrim)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--white)", borderRadius: 20, padding: 28, width: 500, maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 16, boxShadow: "var(--elev-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add Beds</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--hc-border)", background: "var(--surface-sunken)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                placeholder="Bed code e.g. A1"
                value={row.bedCode}
                onChange={e => updateRow(i, "bedCode", e.target.value)}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--hc-border)", fontSize: 13, outline: "none" }}
              />
              <select
                value={row.bedType}
                onChange={e => updateRow(i, "bedType", e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--hc-border)", fontSize: 13, background: "var(--white)", outline: "none" }}
              >
                {BED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {rows.length > 1 && (
                <button onClick={() => removeRow(i)} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--coral-100)", background: "var(--coral-050)", cursor: "pointer", color: "var(--critical-ink)", fontSize: 12 }}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addRow} style={{ padding: "8px 14px", borderRadius: 9, border: "1.5px dashed var(--text-disabled)", background: "var(--surface-sunken)", cursor: "pointer", fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 600 }}>
            + Add another bed
          </button>
        </div>

        {error && <p style={{ fontSize: 12.5, color: "var(--critical-ink)" }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--hc-border)", background: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "var(--brand)", color: "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Add Beds"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign patient modal ───────────────────────────────────────────────────────
function AssignModal({ bed, wardName, onClose, onDone }: {
  bed: Bed; wardName: string; onClose: () => void; onDone: () => void;
}) {
  const [visits, setVisits]   = useState<UnassignedVisit[]>([]);
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    api.get("/api/wards/unassigned-visits").then(r => setVisits(r.data.data ?? []));
  }, []);

  const filtered = visits.filter(v =>
    v.patientName.toLowerCase().includes(search.toLowerCase()) ||
    v.visitNumber.toLowerCase().includes(search.toLowerCase())
  );

  async function assign() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/api/wards/beds/${bed.id}/assign`, { visitId: selected });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Failed to assign");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--scrim)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--white)", borderRadius: 20, padding: 28, width: 540, maxHeight: "85vh", display: "flex", flexDirection: "column", gap: 16, boxShadow: "var(--elev-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Assign Patient</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{wardName} · Bed {bed.bedCode}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--hc-border)", background: "var(--surface-sunken)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            placeholder="Search by patient name or visit no."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 10, border: "1px solid var(--hc-border)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "30px 0" }}>No active unassigned patients</p>
          )}
          {filtered.map(v => (
            <button
              key={v.visitId}
              onClick={() => setSelected(v.visitId)}
              style={{
                textAlign: "left", padding: "12px 14px", borderRadius: 12,
                border: `1.5px solid ${selected === v.visitId ? "var(--green-800)" : "var(--hc-border)"}`,
                background: selected === v.visitId ? "var(--brand-tint)" : "var(--white)",
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{v.patientName}</span>
                <div style={{ display: "flex", gap: 5 }}>
                  {v.hasBed && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "var(--amber-050)", color: "var(--urgent-ink)", border: "1px solid var(--amber-100)" }}>Has bed</span>
                  )}
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: PRIORITY_BG[v.priority] ?? "var(--surface-sunken)", color: PRIORITY_COLOR[v.priority] ?? "var(--text-secondary)" }}>
                    {v.priority}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 11.5, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{v.visitNumber}</span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Admitted {formatDistanceToNow(new Date(v.admissionDate), { addSuffix: true })}
                </span>
              </div>
              {v.chiefComplaint && (
                <p style={{ fontSize: 11.5, color: "var(--text-secondary)", fontStyle: "italic" }}>"{v.chiefComplaint}"</p>
              )}
            </button>
          ))}
        </div>

        {error && <p style={{ fontSize: 12.5, color: "var(--critical-ink)" }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--hc-border)", background: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={assign} disabled={!selected || saving}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: selected ? "var(--brand)" : "var(--hc-border)", color: selected ? "var(--white)" : "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: selected ? "pointer" : "default", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Assigning…" : "Assign to Bed"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pick-bed modal (patient → bed direction) ───────────────────────────────────
function PickBedModal({ visit, wards, onClose, onDone }: {
  visit: UnassignedVisit;
  wards: Ward[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selectedWardId, setSelectedWardId] = useState<string | null>(
    wards.length > 0 ? wards[0].id : null
  );
  const [modalBeds, setModalBeds] = useState<Bed[]>([]);
  const [bedsLoading, setBedsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedWardId) return;
    setBedsLoading(true);
    api.get(`/api/wards/${selectedWardId}/beds`)
      .then(r => setModalBeds(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setBedsLoading(false));
  }, [selectedWardId]);

  const availableBeds = modalBeds.filter(b => b.status === "available");
  const selectedWard  = wards.find(w => w.id === selectedWardId);

  async function assign(bedId: string) {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/api/wards/beds/${bedId}/assign`, { visitId: visit.visitId });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Failed to assign bed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--scrim)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--white)", borderRadius: 20, padding: 28, width: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", gap: 16, boxShadow: "var(--elev-3)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Assign a Bed</h3>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Pick an available bed for this patient</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--hc-border)", background: "var(--surface-sunken)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        {/* Patient info */}
        <div style={{ background: "var(--amber-050)", border: "1.5px solid var(--amber-100)", borderRadius: 12, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--amber-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Users size={16} style={{ color: "var(--urgent-ink)" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{visit.patientName}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                  background: PRIORITY_BG[visit.priority] ?? "var(--surface-sunken)",
                  color: PRIORITY_COLOR[visit.priority] ?? "var(--text-secondary)",
                }}>{visit.priority.toUpperCase()}</span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{visit.visitNumber}</span>
              </div>
              {visit.admittingDiagnosis && (
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "3px 0 0", fontStyle: "italic" }}>{visit.admittingDiagnosis}</p>
              )}
            </div>
          </div>
        </div>

        {/* Ward selector tabs */}
        {wards.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {wards.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWardId(w.id)}
                style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: selectedWardId === w.id ? "1.5px solid var(--green-800)" : "1.5px solid var(--hc-border)",
                  background: selectedWardId === w.id ? "var(--brand-tint)" : "var(--white)",
                  color: selectedWardId === w.id ? "var(--green-800)" : "var(--text-secondary)",
                }}
              >
                {w.wardName}
                {w.bedsTracked > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 10, color: "var(--success-ink)" }}>
                    ({w.bedsAvailable} free)
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Available beds grid */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {bedsLoading ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <RefreshCw size={18} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
            </div>
          ) : availableBeds.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <BedDouble size={32} style={{ color: "var(--text-disabled)", marginBottom: 10 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                No available beds in {selectedWard?.wardName ?? "this ward"}
              </p>
              {wards.length > 1 && (
                <p style={{ fontSize: 12, color: "var(--text-disabled)" }}>Try selecting a different ward above</p>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
              {availableBeds.map(b => (
                <button
                  key={b.id}
                  onClick={() => assign(b.id)}
                  disabled={saving}
                  style={{
                    padding: "14px 10px", borderRadius: 12,
                    border: "1.5px solid var(--green-100)", background: "var(--brand-tint)",
                    cursor: saving ? "default" : "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    opacity: saving ? 0.7 : 1, transition: "background 0.12s, border-color 0.12s",
                  }}
                  onMouseEnter={e => { if (!saving) { (e.currentTarget as HTMLButtonElement).style.background = "var(--green-100)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--green-300)"; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--brand-tint)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--green-100)"; }}
                >
                  <BedDouble size={18} style={{ color: "var(--success-ink)" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green-800)" }}>Bed {b.bedCode}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize" }}>{b.bedType}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p style={{ fontSize: 12.5, color: "var(--critical-ink)" }}>{error}</p>}

        <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--hc-border)", background: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)", alignSelf: "flex-end" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NurseWardPage() {
  const [wards,      setWards]      = useState<Ward[]>([]);
  const [activeWard, setActiveWard] = useState<string | null>(null);
  const [beds,       setBeds]       = useState<Bed[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [bedsLoading, setBedsLoading] = useState(false);
  const [awaitingBed,   setAwaitingBed]   = useState<UnassignedVisit[]>([]);
  const [pendingPatient, setPendingPatient] = useState<UnassignedVisit | null>(null);

  // Modals
  const [assignBed,    setAssignBed]    = useState<Bed | null>(null);
  const [releaseBed,   setReleaseBed]   = useState<Bed | null>(null);
  const [releasing,    setReleasing]    = useState(false);

  // Load wards
  const loadWards = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/api/wards");
      const data: Ward[] = res.data.data ?? [];
      setWards(data);
      if (!activeWard && data.length > 0) setActiveWard(data[0].id);
    } catch {} finally { setLoading(false); }
  }, [activeWard]);

  // Load beds for selected ward
  const loadBeds = useCallback(async (silent = false) => {
    if (!activeWard) return;
    if (!silent) setBedsLoading(true);
    try {
      const res = await api.get(`/api/wards/${activeWard}/beds`);
      setBeds(res.data.data ?? []);
    } catch {} finally { setBedsLoading(false); }
  }, [activeWard]);

  // Load admitted inpatients awaiting bed assignment
  const loadAwaitingBed = useCallback(async () => {
    try {
      const res = await api.get("/api/wards/unassigned-visits");
      const all: UnassignedVisit[] = res.data.data ?? [];
      setAwaitingBed(all.filter(v => v.visitType === "inpatient" && !v.hasBed));
    } catch {}
  }, []);

  useEffect(() => { loadWards(); loadAwaitingBed(); }, []);
  useEffect(() => { loadBeds(); }, [activeWard]);

  useLiveRefresh(() => Promise.all([loadWards(true), loadBeds(true), loadAwaitingBed()]));

  async function handleRelease(bed: Bed) {
    setReleasing(true);
    try {
      await api.patch(`/api/wards/beds/${bed.id}/release`);
      setReleaseBed(null);
      await loadBeds();
      await loadWards();
    } finally { setReleasing(false); }
  }

  async function handleMaintenance(bed: Bed) {
    const toMaint = bed.status !== "maintenance";
    await api.patch(`/api/wards/beds/${bed.id}/maintenance`, { maintenance: toMaint });
    await loadBeds();
    await loadWards();
  }

  const selectedWard = wards.find(w => w.id === activeWard);
  const totalBeds    = beds.length;
  const occupied     = beds.filter(b => b.status === "occupied").length;
  const available    = beds.filter(b => b.status === "available").length;
  const maint        = beds.filter(b => b.status === "maintenance").length;
  const occupancyPct = totalBeds > 0 ? Math.round(occupied / totalBeds * 100) : 0;

  return (
    <div style={{ maxWidth: 1200, }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--info-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BedDouble size={18} style={{ color: "var(--blue-600)" }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", }}>Ward Management</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Bed assignment and occupancy overview</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { loadBeds(); loadWards(); loadAwaitingBed(); }}
            style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--hc-border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Patients awaiting bed assignment ──────────────────────────────────── */}
      {awaitingBed.length > 0 && (
        <div style={{
          background: "var(--amber-050)", border: "1.5px solid var(--amber-100)", borderRadius: 14,
          padding: "14px 18px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={15} style={{ color: "var(--urgent-ink)", flexShrink: 0 }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--urgent-ink)", margin: 0 }}>
              {awaitingBed.length} patient{awaitingBed.length > 1 ? "s" : ""} admitted — awaiting bed assignment
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {awaitingBed.map(v => (
              <button
                key={v.visitId}
                onClick={() => setPendingPatient(v)}
                style={{
                  background: "var(--white)", border: "1px solid var(--amber-100)", borderRadius: 10,
                  padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
                  flexWrap: "wrap", cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "background 0.12s, border-color 0.12s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--amber-050)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--amber-500)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--white)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--amber-100)"; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{v.patientName}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                      background: PRIORITY_BG[v.priority] ?? "var(--surface-sunken)",
                      color: PRIORITY_COLOR[v.priority] ?? "var(--text-secondary)",
                    }}>{v.priority.toUpperCase()}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{v.visitNumber}</span>
                  </div>
                  {v.admittingDiagnosis && (
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "3px 0 0", fontStyle: "italic" }}>
                      {v.admittingDiagnosis}
                    </p>
                  )}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                  borderRadius: 8, background: "var(--green-800)", color: "var(--white)", flexShrink: 0,
                  fontSize: 12, fontWeight: 700,
                }}>
                  <BedDouble size={12} />
                  Assign Bed
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ height: 200, background: "var(--surface-sunken)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RefreshCw size={20} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : wards.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
          <BedDouble size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>No wards configured</p>
          <p style={{ fontSize: 13 }}>Ask an administrator to add wards to your institution.</p>
        </div>
      ) : (
        <>
          {/* ── Ward tabs ──────────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
            {wards.map(w => {
              const isActive = w.id === activeWard;
              const col = wardTypeColor(w.wardType);
              return (
                <button
                  key={w.id}
                  onClick={() => setActiveWard(w.id)}
                  style={{
                    flexShrink: 0, padding: "8px 16px", borderRadius: 10,
                    border: isActive ? `2px solid ${col}` : "1.5px solid var(--hc-border)",
                    background: isActive ? `color-mix(in srgb, ${col} 6%, transparent)` : "var(--white)",
                    cursor: "pointer", display: "flex", flexDirection: "column", gap: 2, textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: isActive ? col : "var(--text-secondary)" }}>{w.wardName}</span>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                    {w.bedsTracked > 0
                      ? `${w.bedsOccupied}/${w.bedsTracked} occupied`
                      : `${w.bedCount} beds total`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Ward stats bar ─────────────────────────────────────────────── */}
          {selectedWard && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
              {[
                { label: "Total Beds",  value: totalBeds,   color: "var(--blue-600)", icon: BedDouble  },
                { label: "Occupied",    value: occupied,     color: "var(--critical-ink)", icon: Users      },
                { label: "Available",   value: available,    color: "var(--success-ink)", icon: CheckCircle2 },
                { label: "Maintenance", value: maint,        color: "var(--urgent-ink)", icon: Wrench     },
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

          {/* ── Occupancy bar ──────────────────────────────────────────────── */}
          {totalBeds > 0 && (
            <div style={{ background: "var(--white)", border: "1px solid var(--hc-border)", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)" }}>Occupancy Rate</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: occupancyPct > 85 ? "var(--critical-ink)" : occupancyPct > 60 ? "var(--urgent-ink)" : "var(--green-600)" }}>
                  {occupancyPct}%
                </p>
              </div>
              <div style={{ height: 8, background: "var(--surface-sunken)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${occupancyPct}%`, borderRadius: 999, background: occupancyPct > 85 ? "var(--critical-ink)" : occupancyPct > 60 ? "var(--urgent-ink)" : "var(--green-600)", transition: "width 0.4s ease" }} />
              </div>
              {occupancyPct > 85 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <AlertTriangle size={12} style={{ color: "var(--critical-ink)" }} />
                  <p style={{ fontSize: 11.5, color: "var(--critical-ink)", fontWeight: 600 }}>High occupancy — consider capacity management</p>
                </div>
              )}
            </div>
          )}

          {/* ── No beds yet ────────────────────────────────────────────────── */}
          {bedsLoading ? (
            <div style={{ height: 150, background: "var(--surface-sunken)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={18} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
            </div>
          ) : beds.length === 0 ? (
            <div style={{ background: "var(--surface-sunken)", border: "2px dashed var(--hc-border)", borderRadius: 14, padding: "50px 30px", textAlign: "center" }}>
              <BedDouble size={36} style={{ color: "var(--text-disabled)", marginBottom: 12 }} />
              <p style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-secondary)" }}>No beds in this ward yet</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Beds are created automatically when a ward is set up. Contact your administrator.</p>
            </div>
          ) : (
            /* ── Bed grid ──────────────────────────────────────────────────── */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {beds.map(bed => (
                <BedCard
                  key={bed.id}
                  bed={bed}
                  onAssign={b => setAssignBed(b)}
                  onRelease={b => setReleaseBed(b)}
                  onMaintenance={handleMaintenance}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Assign patient modal (bed → patient) ──────────────────────────── */}
      {assignBed && selectedWard && (
        <AssignModal
          bed={assignBed}
          wardName={selectedWard.wardName}
          onClose={() => setAssignBed(null)}
          onDone={async () => { setAssignBed(null); await loadBeds(); await loadWards(); await loadAwaitingBed(); }}
        />
      )}

      {/* ── Pick-bed modal (patient → bed) ────────────────────────────────── */}
      {pendingPatient && (
        <PickBedModal
          visit={pendingPatient}
          wards={wards}
          onClose={() => setPendingPatient(null)}
          onDone={async () => { setPendingPatient(null); await loadBeds(); await loadWards(); await loadAwaitingBed(); }}
        />
      )}

      {/* ── Release confirm ────────────────────────────────────────────────── */}
      {releaseBed && (
        <div style={{ position: "fixed", inset: 0, background: "var(--scrim)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--white)", borderRadius: 20, padding: 28, width: 400, boxShadow: "var(--elev-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--coral-050)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={18} style={{ color: "var(--critical-ink)" }} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Release Bed {releaseBed.bedCode}?</h3>
            </div>
            {releaseBed.visit && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                This will remove <strong>{releaseBed.visit.patientName}</strong> ({releaseBed.visit.visitNumber}) from this bed.
                The patient's visit will remain active.
              </p>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setReleaseBed(null)} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--hc-border)", background: "var(--white)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={() => handleRelease(releaseBed)} disabled={releasing}
                style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "var(--critical-ink)", color: "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: releasing ? 0.7 : 1 }}>
                {releasing ? "Releasing…" : "Release Bed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
