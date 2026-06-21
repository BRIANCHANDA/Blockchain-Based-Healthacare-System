"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Plus, X, ShieldAlert, Trash2, ChevronDown,
  AlertTriangle, Heart, Users, Lock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Allergy {
  id: string;
  allergen: string;
  allergyType: string;
  severity: string;
  reaction: string;
  onsetDate: string | null;
  notes: string | null;
}

interface Condition {
  id: string;
  condition: string;
  status: string;
  diagnosedDate: string | null;
  notes: string | null;
}

interface FamilyEntry {
  id: string;
  relationship: string;
  condition: string;
  ageAtDiagnosis: number | null;
  isDeceased: boolean;
  notes: string | null;
}

interface SensitiveRecord {
  id: string;
  category: string;
  condition: string;
  status: string;
  diagnosedDate: string | null;
  notes: string | null;
}

type Section = "allergies" | "conditions" | "family" | "sensitive";

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  mild:            { bg: "#f0fdf4", text: "#15803d", border: "#86efac" },
  moderate:        { bg: "#fffbeb", text: "#d97706", border: "#fcd34d" },
  severe:          { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5" },
  life_threatening:{ bg: "#fdf4ff", text: "#7c3aed", border: "#d8b4fe" },
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  active:    { bg: "#fef2f2", text: "#dc2626" },
  resolved:  { bg: "#f0fdf4", text: "#15803d" },
  managed:   { bg: "#eff6ff", text: "#1d4ed8" },
  monitoring:{ bg: "#fffbeb", text: "#d97706" },
  positive:  { bg: "#fef2f2", text: "#dc2626" },
  negative:  { bg: "#f0fdf4", text: "#15803d" },
  carrier:   { bg: "#fffbeb", text: "#d97706" },
  unknown:   { bg: "#f3f4f6", text: "#6b7280" },
};

const CATEGORY_LABEL: Record<string, string> = {
  infectious_disease: "Infectious Disease",
  mental_health:      "Mental Health",
  reproductive:       "Reproductive Health",
  genetic:            "Genetic",
  substance_use:      "Substance Use",
  other:              "Other",
};

const CATEGORY_COLOR: Record<string, string> = {
  infectious_disease: "#dc2626",
  mental_health:      "#7c3aed",
  reproductive:       "#db2777",
  genetic:            "#0e7490",
  substance_use:      "#d97706",
  other:              "#6b7280",
};

function Badge({ label, bg, text, border }: { label: string; bg: string; text: string; border?: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
      background: bg, color: text,
      border: border ? `1px solid ${border}` : `1px solid ${bg}`,
      textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

// ── Add-form modals ───────────────────────────────────────────────────────────
function AllergyForm({ patientId, onSaved, onClose }: { patientId: string; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ allergen: "", allergyType: "drug", severity: "mild", reaction: "", onsetDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!form.allergen || !form.reaction) { setErr("Allergen and reaction are required"); return; }
    setSaving(true); setErr("");
    try {
      await api.post(`/api/medical/patients/${patientId}/allergies`, {
        allergen: form.allergen, allergyType: form.allergyType,
        severity: form.severity, reaction: form.reaction,
        onsetDate: form.onsetDate || undefined, notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.error?.message ?? "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <FormShell title="Add Allergy" onClose={onClose}>
      <label style={lbl}>Allergen *</label>
      <input style={inp} value={form.allergen} onChange={e => setForm(f => ({ ...f, allergen: e.target.value }))} placeholder="e.g., Penicillin, Peanuts" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>Type</label>
          <select style={inp} value={form.allergyType} onChange={e => setForm(f => ({ ...f, allergyType: e.target.value }))}>
            {["drug","food","environmental","other"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Severity</label>
          <select style={inp} value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
            {["mild","moderate","severe","life_threatening"].map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
          </select>
        </div>
      </div>
      <label style={lbl}>Reaction *</label>
      <input style={inp} value={form.reaction} onChange={e => setForm(f => ({ ...f, reaction: e.target.value }))} placeholder="Describe the allergic reaction" />
      <label style={lbl}>Onset Date</label>
      <input style={inp} type="date" value={form.onsetDate} onChange={e => setForm(f => ({ ...f, onsetDate: e.target.value }))} />
      <label style={lbl}>Notes</label>
      <textarea style={{ ...inp, height: 64, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" />
      {err && <p style={{ fontSize: 12, color: "#dc2626" }}>{err}</p>}
      <FormActions onClose={onClose} onSave={save} saving={saving} />
    </FormShell>
  );
}

function ConditionForm({ patientId, onSaved, onClose }: { patientId: string; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ condition: "", status: "active", diagnosedDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!form.condition) { setErr("Condition name is required"); return; }
    setSaving(true); setErr("");
    try {
      await api.post(`/api/medical/patients/${patientId}/conditions`, {
        condition: form.condition, status: form.status,
        diagnosedDate: form.diagnosedDate || undefined, notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.error?.message ?? "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <FormShell title="Add Medical Condition" onClose={onClose}>
      <label style={lbl}>Condition *</label>
      <input style={inp} value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} placeholder="e.g., Type 2 Diabetes, Hypertension" />
      <label style={lbl}>Status</label>
      <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
        {["active","resolved","managed","monitoring"].map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <label style={lbl}>Date Diagnosed</label>
      <input style={inp} type="date" value={form.diagnosedDate} onChange={e => setForm(f => ({ ...f, diagnosedDate: e.target.value }))} />
      <label style={lbl}>Notes</label>
      <textarea style={{ ...inp, height: 64, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      {err && <p style={{ fontSize: 12, color: "#dc2626" }}>{err}</p>}
      <FormActions onClose={onClose} onSave={save} saving={saving} />
    </FormShell>
  );
}

function FamilyForm({ patientId, onSaved, onClose }: { patientId: string; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ relationship: "father", condition: "", ageAtDiagnosis: "", isDeceased: false, notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const RELATIONSHIPS = ["father","mother","sibling","paternal grandfather","paternal grandmother","maternal grandfather","maternal grandmother","uncle","aunt","cousin","other"];

  async function save() {
    if (!form.condition) { setErr("Condition is required"); return; }
    setSaving(true); setErr("");
    try {
      await api.post(`/api/medical/patients/${patientId}/family-history`, {
        relationship: form.relationship, condition: form.condition,
        ageAtDiagnosis: form.ageAtDiagnosis ? Number(form.ageAtDiagnosis) : undefined,
        isDeceased: form.isDeceased, notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.error?.message ?? "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <FormShell title="Add Family History" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>Relationship *</label>
          <select style={inp} value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}>
            {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Age at Diagnosis</label>
          <input style={inp} type="number" min={0} max={120} value={form.ageAtDiagnosis} onChange={e => setForm(f => ({ ...f, ageAtDiagnosis: e.target.value }))} placeholder="e.g., 55" />
        </div>
      </div>
      <label style={lbl}>Condition *</label>
      <input style={inp} value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} placeholder="e.g., Type 2 Diabetes, Cancer" />
      <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={form.isDeceased} onChange={e => setForm(f => ({ ...f, isDeceased: e.target.checked }))} />
        Deceased
      </label>
      <label style={lbl}>Notes</label>
      <textarea style={{ ...inp, height: 64, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      {err && <p style={{ fontSize: 12, color: "#dc2626" }}>{err}</p>}
      <FormActions onClose={onClose} onSave={save} saving={saving} />
    </FormShell>
  );
}

function SensitiveForm({ patientId, onSaved, onClose }: { patientId: string; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ category: "infectious_disease", condition: "", status: "positive", diagnosedDate: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const PRESETS: Record<string, string[]> = {
    infectious_disease: ["HIV/AIDS", "Hepatitis B", "Hepatitis C", "Tuberculosis (TB)", "Syphilis", "Gonorrhoea", "Chlamydia", "Other STI"],
    mental_health:      ["Bipolar Disorder", "Schizophrenia", "Major Depressive Disorder", "Anxiety Disorder", "PTSD", "Borderline PD"],
    reproductive:       ["Infertility", "Endometriosis", "Polycystic Ovary Syndrome", "Recurrent Miscarriage"],
    genetic:            ["Sickle Cell Disease", "Haemophilia", "Cystic Fibrosis", "Down Syndrome", "BRCA Mutation"],
    substance_use:      ["Alcohol Use Disorder", "Opioid Use Disorder", "Cannabis Use", "Stimulant Use"],
    other:              [],
  };

  async function save() {
    if (!form.condition) { setErr("Condition is required"); return; }
    setSaving(true); setErr("");
    try {
      await api.post(`/api/medical/patients/${patientId}/sensitive`, {
        category: form.category, condition: form.condition, status: form.status,
        diagnosedDate: form.diagnosedDate || undefined, notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.error?.message ?? "Failed to save"); }
    finally { setSaving(false); }
  }

  const presets = PRESETS[form.category] ?? [];

  return (
    <FormShell title="Add Sensitive Record" onClose={onClose} warning="This record is strictly confidential and visible to doctors only.">
      <label style={lbl}>Category *</label>
      <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, condition: "" }))}>
        {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>

      <label style={lbl}>Condition *</label>
      {presets.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {presets.map(p => (
            <button key={p} type="button"
              onClick={() => setForm(f => ({ ...f, condition: p }))}
              style={{
                fontSize: 11.5, padding: "3px 10px", borderRadius: 8, cursor: "pointer",
                border: form.condition === p ? "1.5px solid #166534" : "1.5px solid #e5e7eb",
                background: form.condition === p ? "#f0fdf4" : "#f9fafb",
                color: form.condition === p ? "#166534" : "#6b7280", fontWeight: 600,
              }}
            >{p}</button>
          ))}
        </div>
      )}
      <input style={inp} value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} placeholder="Or type custom condition" />

      <label style={lbl}>Status</label>
      <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
        {["positive","negative","carrier","active","resolved","unknown"].map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <label style={lbl}>Date Diagnosed</label>
      <input style={inp} type="date" value={form.diagnosedDate} onChange={e => setForm(f => ({ ...f, diagnosedDate: e.target.value }))} />

      <label style={lbl}>Notes</label>
      <textarea style={{ ...inp, height: 64, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional clinical notes…" />

      {err && <p style={{ fontSize: 12, color: "#dc2626" }}>{err}</p>}
      <FormActions onClose={onClose} onSave={save} saving={saving} />
    </FormShell>
  );
}

// ── Shared form shell ─────────────────────────────────────────────────────────
function FormShell({ title, children, onClose, warning }: {
  title: string; children: React.ReactNode; onClose: () => void; warning?: string;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 26, width: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={13} />
          </button>
        </div>
        {warning && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 7, alignItems: "center" }}>
            <Lock size={12} style={{ color: "#dc2626", flexShrink: 0 }} />
            <p style={{ fontSize: 11.5, color: "#dc2626", margin: 0 }}>{warning}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function FormActions({ onClose, onSave, saving }: { onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
      <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Cancel</button>
      <button onClick={onSave} disabled={saving} style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#166534,#15803d)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 3, display: "block" };
const inp: React.CSSProperties = { width: "100%", padding: "8px 11px", borderRadius: 9, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fafafa" };

// ── Section tab ───────────────────────────────────────────────────────────────
function SectionTab({ active, label, icon: Icon, count, color, onClick }: {
  active: boolean; label: string; icon: any; count: number; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
        border: active ? `1.5px solid ${color}` : "1.5px solid #e5e7eb",
        background: active ? `${color}12` : "#fff",
        color: active ? color : "#6b7280",
        display: "flex", alignItems: "center", gap: 6,
      }}
    >
      <Icon size={13} />
      {label}
      {count > 0 && (
        <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: active ? color : "#e5e7eb", color: active ? "#fff" : "#6b7280" }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function MedicalProfileTab({ patientId }: { patientId: string }) {
  const [section, setSection] = useState<Section>("allergies");
  const [allergiesList,  setAllergies]  = useState<Allergy[]>([]);
  const [conditions,     setConditions] = useState<Condition[]>([]);
  const [familyHistory,  setFamily]     = useState<FamilyEntry[]>([]);
  const [sensitive,      setSensitive]  = useState<SensitiveRecord[]>([]);
  const [loading,        setLoading]    = useState(true);

  // Add-form visibility
  const [addAllergy,    setAddAllergy]    = useState(false);
  const [addCondition,  setAddCondition]  = useState(false);
  const [addFamily,     setAddFamily]     = useState(false);
  const [addSensitive,  setAddSensitive]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/medical/patients/${patientId}`);
      const d = res.data?.data;
      setAllergies(d?.allergies ?? []);
      setConditions(d?.conditions ?? []);
      setFamily(d?.familyHistory ?? []);
      setSensitive(d?.sensitiveRecords ?? []);
    } catch {}
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  async function removeAllergy(id: string) {
    await api.patch(`/api/medical/patients/${patientId}/allergies/${id}`, { isActive: false });
    load();
  }

  async function removeSensitive(id: string) {
    await api.patch(`/api/medical/patients/${patientId}/sensitive/${id}`, { isActive: false });
    load();
  }

  async function removeFamilyEntry(id: string) {
    await api.delete(`/api/medical/patients/${patientId}/family-history/${id}`);
    load();
  }

  function saved() { load(); setAddAllergy(false); setAddCondition(false); setAddFamily(false); setAddSensitive(false); }

  const SECTIONS: { key: Section; label: string; icon: any; color: string; count: number }[] = [
    { key: "allergies",  label: "Allergies",        icon: AlertTriangle, color: "#dc2626", count: allergiesList.length },
    { key: "conditions", label: "Conditions",        icon: Heart,         color: "#2563eb", count: conditions.length   },
    { key: "family",     label: "Family History",    icon: Users,         color: "#7c3aed", count: familyHistory.length},
    { key: "sensitive",  label: "Sensitive Records", icon: ShieldAlert,   color: "#d97706", count: sensitive.length    },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Section tabs ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {SECTIONS.map(s => (
          <SectionTab key={s.key} active={section === s.key} label={s.label} icon={s.icon} count={s.count} color={s.color} onClick={() => setSection(s.key)} />
        ))}
      </div>

      {loading ? (
        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          {/* ── ALLERGIES ── */}
          {section === "allergies" && (
            <Section label="Allergies" color="#dc2626" onAdd={() => setAddAllergy(true)}>
              {allergiesList.length === 0 ? <Empty label="No known allergies recorded" /> : allergiesList.map(a => {
                const sc = SEVERITY_COLOR[a.severity] ?? SEVERITY_COLOR.mild;
                return (
                  <Card key={a.id} onRemove={() => removeAllergy(a.id)}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{a.allergen}</span>
                          <Badge label={a.severity} bg={sc.bg} text={sc.text} border={sc.border} />
                          <Badge label={a.allergyType} bg="#f3f4f6" text="#374151" />
                        </div>
                        <p style={{ fontSize: 12.5, color: "#374151", margin: "5px 0 0", fontStyle: "italic" }}>Reaction: {a.reaction}</p>
                        {a.onsetDate && <p style={{ fontSize: 11.5, color: "#9ca3af", margin: "3px 0 0" }}>Onset: {a.onsetDate}</p>}
                        {a.notes && <p style={{ fontSize: 11.5, color: "#6b7280", margin: "3px 0 0" }}>{a.notes}</p>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </Section>
          )}

          {/* ── CONDITIONS ── */}
          {section === "conditions" && (
            <Section label="Medical Conditions" color="#2563eb" onAdd={() => setAddCondition(true)}>
              {conditions.length === 0 ? <Empty label="No medical conditions recorded" /> : conditions.map(c => {
                const sc = STATUS_COLOR[c.status] ?? STATUS_COLOR.unknown;
                return (
                  <Card key={c.id}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{c.condition}</span>
                          <Badge label={c.status} bg={sc.bg} text={sc.text} />
                        </div>
                        {c.diagnosedDate && <p style={{ fontSize: 11.5, color: "#9ca3af", margin: "5px 0 0" }}>Diagnosed: {c.diagnosedDate}</p>}
                        {c.notes && <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{c.notes}</p>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </Section>
          )}

          {/* ── FAMILY HISTORY ── */}
          {section === "family" && (
            <Section label="Family Medical History" color="#7c3aed" onAdd={() => setAddFamily(true)}>
              {familyHistory.length === 0 ? <Empty label="No family history recorded" /> : familyHistory.map(f => (
                <Card key={f.id} onRemove={() => removeFamilyEntry(f.id)}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{f.condition}</span>
                        <Badge label={f.relationship} bg="#faf5ff" text="#7c3aed" />
                        {f.isDeceased && <Badge label="Deceased" bg="#f3f4f6" text="#6b7280" />}
                      </div>
                      {f.ageAtDiagnosis != null && <p style={{ fontSize: 11.5, color: "#9ca3af", margin: "5px 0 0" }}>Age at diagnosis: {f.ageAtDiagnosis}</p>}
                      {f.notes && <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{f.notes}</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </Section>
          )}

          {/* ── SENSITIVE RECORDS ── */}
          {section === "sensitive" && (
            <>
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Lock size={13} style={{ color: "#dc2626", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>
                  Strictly confidential. These records are <strong>visible to doctors only</strong> and are not shared with nurses, lab staff, or other roles.
                </p>
              </div>
              <Section label="Sensitive Records" color="#d97706" onAdd={() => setAddSensitive(true)}>
                {sensitive.length === 0 ? <Empty label="No sensitive records on file" /> : sensitive.map(s => {
                  const sc = STATUS_COLOR[s.status] ?? STATUS_COLOR.unknown;
                  const catColor = CATEGORY_COLOR[s.category] ?? "#6b7280";
                  return (
                    <Card key={s.id} onRemove={() => removeSensitive(s.id)}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{s.condition}</span>
                            <Badge label={s.status} bg={sc.bg} text={sc.text} />
                            <Badge label={CATEGORY_LABEL[s.category] ?? s.category} bg={`${catColor}12`} text={catColor} />
                          </div>
                          {s.diagnosedDate && <p style={{ fontSize: 11.5, color: "#9ca3af", margin: "5px 0 0" }}>Diagnosed: {s.diagnosedDate}</p>}
                          {s.notes && <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{s.notes}</p>}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </Section>
            </>
          )}
        </>
      )}

      {/* ── Forms ── */}
      {addAllergy   && <AllergyForm   patientId={patientId} onSaved={saved} onClose={() => setAddAllergy(false)}   />}
      {addCondition && <ConditionForm patientId={patientId} onSaved={saved} onClose={() => setAddCondition(false)} />}
      {addFamily    && <FamilyForm    patientId={patientId} onSaved={saved} onClose={() => setAddFamily(false)}    />}
      {addSensitive && <SensitiveForm patientId={patientId} onSaved={saved} onClose={() => setAddSensitive(false)} />}
    </div>
  );
}

// ── Tiny layout helpers ───────────────────────────────────────────────────────
function Section({ label, color, onAdd, children }: { label: string; color: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{label}</p>
        <button
          onClick={onAdd}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 8, border: `1.5px solid ${color}`, background: `${color}0d`, color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={12} /> Add
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Card({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", position: "relative" }}>
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 7, border: "1px solid #fecaca", background: "#fef2f2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Trash2 size={11} style={{ color: "#dc2626" }} />
        </button>
      )}
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af" }}>
      <p style={{ fontSize: 13, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 12 }}>Click "Add" to record one.</p>
    </div>
  );
}
