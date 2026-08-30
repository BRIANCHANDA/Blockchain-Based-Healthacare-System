"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Plus,
  ShieldAlert,
  Trash2,
  AlertTriangle,
  Heart,
  Users,
  Lock,
} from "lucide-react";
import {
  Card as Surface,
  Field,
  Input,
  Select,
  Textarea,
  Button,
  Banner,
  EmptyState,
  Modal,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Medical profile tab.

   Four independent registers on one patient: allergies, chronic conditions,
   family history, and sensitive records.

   Sensitive records are doctor-only — nurses, lab and pharmacy staff never
   see them — which is why both the section and its form carry an explicit
   confidentiality notice rather than relying on the API to be the only guard.
   ========================================================================== */

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
/* Severity and status climb the same tone ladder used everywhere else, so a
   "severe" allergy here reads the same as a "severe" one on the patient page. */
const SEVERITY_TONE: Record<string, Tone> = {
  mild: "success",
  moderate: "urgent",
  severe: "critical",
  life_threatening: "accent",
};

const STATUS_TONE: Record<string, Tone> = {
  active: "critical",
  resolved: "success",
  managed: "info",
  monitoring: "urgent",
  positive: "critical",
  negative: "success",
  carrier: "urgent",
  unknown: "neutral",
};

const CATEGORY_LABEL: Record<string, string> = {
  infectious_disease: "Infectious disease",
  mental_health: "Mental health",
  reproductive: "Reproductive health",
  genetic: "Genetic",
  substance_use: "Substance use",
  other: "Other",
};

const CATEGORY_TONE: Record<string, Tone> = {
  infectious_disease: "critical",
  mental_health: "accent",
  reproductive: "critical",
  genetic: "info",
  substance_use: "urgent",
  other: "neutral",
};

const toneOf = (map: Record<string, Tone>, key: string): Tone =>
  map[key] ?? "neutral";

/** Small uppercase tag. Underscores read as spaces. */
function Tag({ label, tone }: { label: string; tone: Tone }) {
  const t = TONES[tone];
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        height: 18,
        padding: "0 8px",
        borderRadius: "var(--r-pill)",
        background: t.tint,
        color: t.ink,
        font: "700 10px/1 var(--font-sans)",
        letterSpacing: "var(--ls-wide)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

// ── Add-form modals ───────────────────────────────────────────────────────────
function AllergyForm({
  patientId,
  onSaved,
  onClose,
}: {
  patientId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    allergen: "",
    allergyType: "drug",
    severity: "mild",
    reaction: "",
    onsetDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!form.allergen || !form.reaction) {
      setErr("Allergen and reaction are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.post(`/api/medical/patients/${patientId}/allergies`, {
        allergen: form.allergen,
        allergyType: form.allergyType,
        severity: form.severity,
        reaction: form.reaction,
        onsetDate: form.onsetDate || undefined,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormShell title="Add allergy" onClose={onClose} onSave={save} saving={saving}>
      <Field label="Allergen" required>
        <Input
          value={form.allergen}
          onChange={(e) => setForm((f) => ({ ...f, allergen: e.target.value }))}
          placeholder="e.g. Penicillin, peanuts"
        />
      </Field>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <Field label="Type">
          <Select
            value={form.allergyType}
            onChange={(e) => setForm((f) => ({ ...f, allergyType: e.target.value }))}
            style={{ textTransform: "capitalize" }}
          >
            {["drug", "food", "environmental", "other"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Severity">
          <Select
            value={form.severity}
            onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
            style={{ textTransform: "capitalize" }}
          >
            {["mild", "moderate", "severe", "life_threatening"].map((sv) => (
              <option key={sv} value={sv}>
                {sv.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Reaction" required>
        <Input
          value={form.reaction}
          onChange={(e) => setForm((f) => ({ ...f, reaction: e.target.value }))}
          placeholder="Describe the allergic reaction"
        />
      </Field>

      <Field label="Onset date" hint="Optional">
        <Input
          type="date"
          value={form.onsetDate}
          onChange={(e) => setForm((f) => ({ ...f, onsetDate: e.target.value }))}
        />
      </Field>

      <Field label="Notes" hint="Optional">
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Additional notes…"
          style={{ minHeight: 68 }}
        />
      </Field>

      {err && (
        <Banner tone="critical" icon={AlertTriangle}>
          {err}
        </Banner>
      )}
    </FormShell>
  );
}

function ConditionForm({
  patientId,
  onSaved,
  onClose,
}: {
  patientId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    condition: "",
    status: "active",
    diagnosedDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!form.condition) {
      setErr("Condition name is required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.post(`/api/medical/patients/${patientId}/conditions`, {
        condition: form.condition,
        status: form.status,
        diagnosedDate: form.diagnosedDate || undefined,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormShell
      title="Add medical condition"
      onClose={onClose}
      onSave={save}
      saving={saving}
    >
      <Field label="Condition" required>
        <Input
          value={form.condition}
          onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
          placeholder="e.g. Type 2 diabetes, hypertension"
        />
      </Field>

      <Field label="Status">
        <Select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          style={{ textTransform: "capitalize" }}
        >
          {["active", "resolved", "managed", "monitoring"].map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Date diagnosed" hint="Optional">
        <Input
          type="date"
          value={form.diagnosedDate}
          onChange={(e) => setForm((f) => ({ ...f, diagnosedDate: e.target.value }))}
        />
      </Field>

      <Field label="Notes" hint="Optional">
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          style={{ minHeight: 68 }}
        />
      </Field>

      {err && (
        <Banner tone="critical" icon={AlertTriangle}>
          {err}
        </Banner>
      )}
    </FormShell>
  );
}

function FamilyForm({
  patientId,
  onSaved,
  onClose,
}: {
  patientId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    relationship: "father",
    condition: "",
    ageAtDiagnosis: "",
    isDeceased: false,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const RELATIONSHIPS = [
    "father",
    "mother",
    "sibling",
    "paternal grandfather",
    "paternal grandmother",
    "maternal grandfather",
    "maternal grandmother",
    "uncle",
    "aunt",
    "cousin",
    "other",
  ];

  async function save() {
    if (!form.condition) {
      setErr("Condition is required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.post(`/api/medical/patients/${patientId}/family-history`, {
        relationship: form.relationship,
        condition: form.condition,
        ageAtDiagnosis: form.ageAtDiagnosis ? Number(form.ageAtDiagnosis) : undefined,
        isDeceased: form.isDeceased,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormShell
      title="Add family history"
      onClose={onClose}
      onSave={save}
      saving={saving}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <Field label="Relationship" required>
          <Select
            value={form.relationship}
            onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
            style={{ textTransform: "capitalize" }}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Age at diagnosis" hint="Optional">
          <Input
            type="number"
            min={0}
            max={120}
            value={form.ageAtDiagnosis}
            onChange={(e) =>
              setForm((f) => ({ ...f, ageAtDiagnosis: e.target.value }))
            }
            placeholder="e.g. 55"
          />
        </Field>
      </div>

      <Field label="Condition" required>
        <Input
          value={form.condition}
          onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
          placeholder="e.g. Type 2 diabetes, cancer"
        />
      </Field>

      <label
        className="inline-flex items-center"
        style={{
          gap: 9,
          font: "600 12px/1 var(--font-sans)",
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={form.isDeceased}
          onChange={(e) => setForm((f) => ({ ...f, isDeceased: e.target.checked }))}
          style={{ accentColor: "var(--brand)", width: 15, height: 15 }}
        />
        Deceased
      </label>

      <Field label="Notes" hint="Optional">
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          style={{ minHeight: 68 }}
        />
      </Field>

      {err && (
        <Banner tone="critical" icon={AlertTriangle}>
          {err}
        </Banner>
      )}
    </FormShell>
  );
}

function SensitiveForm({
  patientId,
  onSaved,
  onClose,
}: {
  patientId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    category: "infectious_disease",
    condition: "",
    status: "positive",
    diagnosedDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  /* Common conditions per category — one tap beats typing a long name, and
     keeps the wording consistent across records. */
  const PRESETS: Record<string, string[]> = {
    infectious_disease: [
      "HIV/AIDS",
      "Hepatitis B",
      "Hepatitis C",
      "Tuberculosis (TB)",
      "Syphilis",
      "Gonorrhoea",
      "Chlamydia",
      "Other STI",
    ],
    mental_health: [
      "Bipolar Disorder",
      "Schizophrenia",
      "Major Depressive Disorder",
      "Anxiety Disorder",
      "PTSD",
      "Borderline PD",
    ],
    reproductive: [
      "Infertility",
      "Endometriosis",
      "Polycystic Ovary Syndrome",
      "Recurrent Miscarriage",
    ],
    genetic: [
      "Sickle Cell Disease",
      "Haemophilia",
      "Cystic Fibrosis",
      "Down Syndrome",
      "BRCA Mutation",
    ],
    substance_use: [
      "Alcohol Use Disorder",
      "Opioid Use Disorder",
      "Cannabis Use",
      "Stimulant Use",
    ],
    other: [],
  };

  async function save() {
    if (!form.condition) {
      setErr("Condition is required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.post(`/api/medical/patients/${patientId}/sensitive`, {
        category: form.category,
        condition: form.condition,
        status: form.status,
        diagnosedDate: form.diagnosedDate || undefined,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const presets = PRESETS[form.category] ?? [];

  return (
    <FormShell
      title="Add sensitive record"
      onClose={onClose}
      onSave={save}
      saving={saving}
      warning="This record is strictly confidential and visible to doctors only."
    >
      <Field label="Category" required>
        <Select
          value={form.category}
          /* Changing category invalidates the chosen preset. */
          onChange={(e) =>
            setForm((f) => ({ ...f, category: e.target.value, condition: "" }))
          }
        >
          {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Condition" required hint="Pick a common one, or type your own.">
        {presets.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
            {presets.map((preset) => {
              const on = form.condition === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, condition: preset }))}
                  style={{
                    height: 26,
                    padding: "0 11px",
                    borderRadius: "var(--r-xs)",
                    border: `1px solid ${on ? "var(--brand)" : "var(--hc-border)"}`,
                    background: on ? "var(--brand-tint)" : "var(--surface-sunken)",
                    color: on ? "var(--green-800)" : "var(--text-secondary)",
                    font: `${on ? 700 : 500} 11.5px/1 var(--font-sans)`,
                    cursor: "pointer",
                    transition: "all var(--dur-fast) var(--ease-standard)",
                  }}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        )}
        <Input
          value={form.condition}
          onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
          placeholder="Or type a custom condition"
        />
      </Field>

      <Field label="Status">
        <Select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          style={{ textTransform: "capitalize" }}
        >
          {["positive", "negative", "carrier", "active", "resolved", "unknown"].map(
            (st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ),
          )}
        </Select>
      </Field>

      <Field label="Date diagnosed" hint="Optional">
        <Input
          type="date"
          value={form.diagnosedDate}
          onChange={(e) => setForm((f) => ({ ...f, diagnosedDate: e.target.value }))}
        />
      </Field>

      <Field label="Notes" hint="Optional">
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Additional clinical notes…"
          style={{ minHeight: 68 }}
        />
      </Field>

      {err && (
        <Banner tone="critical" icon={AlertTriangle}>
          {err}
        </Banner>
      )}
    </FormShell>
  );
}

// ── Shared form shell ─────────────────────────────────────────────────────────
function FormShell({
  title,
  children,
  onClose,
  warning,
  onSave,
  saving,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  warning?: string;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Modal
      title={title}
      icon={warning ? Lock : Plus}
      tone={warning ? "critical" : "brand"}
      width={520}
      scroll
      onClose={onClose}
      footer={
        <>
          <Button full onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" full loading={saving} onClick={onSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {warning && (
        <Banner tone="critical" icon={Lock}>
          {warning}
        </Banner>
      )}
      {children}
    </Modal>
  );
}

// ── Section tab ───────────────────────────────────────────────────────────────
function SectionTab({
  active,
  label,
  icon: Icon,
  count,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: any;
  count: number;
  tone: Tone;
  onClick: () => void;
}) {
  const t = TONES[tone];
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center"
      style={{
        gap: 7,
        height: 34,
        padding: "0 14px",
        borderRadius: "var(--r-sm)",
        border: `1px solid ${active ? t.ink : "var(--hc-border)"}`,
        background: active ? t.tint : "var(--surface-card)",
        color: active ? t.ink : "var(--text-secondary)",
        font: `${active ? 700 : 500} 12.5px/1 var(--font-sans)`,
        cursor: "pointer",
        transition: "all var(--dur-fast) var(--ease-standard)",
      }}
    >
      <Icon size={13} />
      {label}
      {count > 0 && (
        <span
          className="inline-flex items-center justify-center"
          style={{
            minWidth: 18,
            height: 17,
            padding: "0 5px",
            borderRadius: "var(--r-pill)",
            background: active ? t.ink : "var(--surface-sunken)",
            color: active ? "var(--white)" : "var(--text-muted)",
            font: "700 10px/1 var(--font-sans)",
          }}
        >
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

  const SECTIONS: {
    key: Section;
    label: string;
    icon: any;
    tone: Tone;
    count: number;
  }[] = [
    { key: "allergies", label: "Allergies", icon: AlertTriangle, tone: "critical", count: allergiesList.length },
    { key: "conditions", label: "Conditions", icon: Heart, tone: "info", count: conditions.length },
    { key: "family", label: "Family history", icon: Users, tone: "accent", count: familyHistory.length },
    { key: "sensitive", label: "Sensitive records", icon: ShieldAlert, tone: "urgent", count: sensitive.length },
  ];

  /** Row of chips shared by every record card. */
  const Line = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
      {children}
    </div>
  );

  const Title = ({ children }: { children: React.ReactNode }) => (
    <span
      style={{
        font: "700 13.5px/1 var(--font-sans)",
        color: "var(--text-primary)",
      }}
    >
      {children}
    </span>
  );

  const Meta = ({ children }: { children: React.ReactNode }) => (
    <p
      style={{
        margin: 0,
        font: "400 11.5px/1.4 var(--font-sans)",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Section tabs ── */}
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        {SECTIONS.map((sec) => (
          <SectionTab
            key={sec.key}
            active={section === sec.key}
            label={sec.label}
            icon={sec.icon}
            count={sec.count}
            tone={sec.tone}
            onClick={() => setSection(sec.key)}
          />
        ))}
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center"
          style={{
            height: 120,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading…
        </div>
      ) : (
        <>
          {/* ── ALLERGIES ── */}
          {section === "allergies" && (
            <Section label="Allergies" tone="critical" onAdd={() => setAddAllergy(true)}>
              {allergiesList.length === 0 ? (
                <Empty label="No known allergies recorded" />
              ) : (
                allergiesList.map((a) => (
                  <RecordCard key={a.id} onRemove={() => removeAllergy(a.id)}>
                    <div className="flex flex-col" style={{ gap: 6, paddingRight: 30 }}>
                      <Line>
                        <Title>{a.allergen}</Title>
                        <Tag label={a.severity} tone={toneOf(SEVERITY_TONE, a.severity)} />
                        <Tag label={a.allergyType} tone="neutral" />
                      </Line>
                      <p
                        style={{
                          margin: 0,
                          font: "400 12.5px/1.5 var(--font-sans)",
                          color: "var(--text-secondary)",
                          fontStyle: "italic",
                        }}
                      >
                        Reaction: {a.reaction}
                      </p>
                      {a.onsetDate && <Meta>Onset {a.onsetDate}</Meta>}
                      {a.notes && <Meta>{a.notes}</Meta>}
                    </div>
                  </RecordCard>
                ))
              )}
            </Section>
          )}

          {/* ── CONDITIONS ── */}
          {section === "conditions" && (
            <Section
              label="Medical conditions"
              tone="info"
              onAdd={() => setAddCondition(true)}
            >
              {conditions.length === 0 ? (
                <Empty label="No medical conditions recorded" />
              ) : (
                conditions.map((c) => (
                  <RecordCard key={c.id}>
                    <div className="flex flex-col" style={{ gap: 6 }}>
                      <Line>
                        <Title>{c.condition}</Title>
                        <Tag label={c.status} tone={toneOf(STATUS_TONE, c.status)} />
                      </Line>
                      {c.diagnosedDate && <Meta>Diagnosed {c.diagnosedDate}</Meta>}
                      {c.notes && <Meta>{c.notes}</Meta>}
                    </div>
                  </RecordCard>
                ))
              )}
            </Section>
          )}

          {/* ── FAMILY HISTORY ── */}
          {section === "family" && (
            <Section
              label="Family medical history"
              tone="accent"
              onAdd={() => setAddFamily(true)}
            >
              {familyHistory.length === 0 ? (
                <Empty label="No family history recorded" />
              ) : (
                familyHistory.map((f) => (
                  <RecordCard key={f.id} onRemove={() => removeFamilyEntry(f.id)}>
                    <div className="flex flex-col" style={{ gap: 6, paddingRight: 30 }}>
                      <Line>
                        <Title>{f.condition}</Title>
                        <Tag label={f.relationship} tone="accent" />
                        {f.isDeceased && <Tag label="Deceased" tone="neutral" />}
                      </Line>
                      {f.ageAtDiagnosis != null && (
                        <Meta>Age at diagnosis {f.ageAtDiagnosis}</Meta>
                      )}
                      {f.notes && <Meta>{f.notes}</Meta>}
                    </div>
                  </RecordCard>
                ))
              )}
            </Section>
          )}

          {/* ── SENSITIVE RECORDS ── */}
          {section === "sensitive" && (
            <>
              <Banner tone="critical" icon={Lock}>
                Strictly confidential. These records are{" "}
                <strong>visible to doctors only</strong> and are not shared with
                nurses, lab staff, or other roles.
              </Banner>

              <Section
                label="Sensitive records"
                tone="urgent"
                onAdd={() => setAddSensitive(true)}
              >
                {sensitive.length === 0 ? (
                  <Empty label="No sensitive records on file" />
                ) : (
                  sensitive.map((sr) => (
                    <RecordCard key={sr.id} onRemove={() => removeSensitive(sr.id)}>
                      <div
                        className="flex flex-col"
                        style={{ gap: 6, paddingRight: 30 }}
                      >
                        <Line>
                          <Title>{sr.condition}</Title>
                          <Tag label={sr.status} tone={toneOf(STATUS_TONE, sr.status)} />
                          <Tag
                            label={CATEGORY_LABEL[sr.category] ?? sr.category}
                            tone={toneOf(CATEGORY_TONE, sr.category)}
                          />
                        </Line>
                        {sr.diagnosedDate && <Meta>Diagnosed {sr.diagnosedDate}</Meta>}
                        {sr.notes && <Meta>{sr.notes}</Meta>}
                      </div>
                    </RecordCard>
                  ))
                )}
              </Section>
            </>
          )}
        </>
      )}

      {/* ── Forms ── */}
      {addAllergy && (
        <AllergyForm
          patientId={patientId}
          onSaved={saved}
          onClose={() => setAddAllergy(false)}
        />
      )}
      {addCondition && (
        <ConditionForm
          patientId={patientId}
          onSaved={saved}
          onClose={() => setAddCondition(false)}
        />
      )}
      {addFamily && (
        <FamilyForm
          patientId={patientId}
          onSaved={saved}
          onClose={() => setAddFamily(false)}
        />
      )}
      {addSensitive && (
        <SensitiveForm
          patientId={patientId}
          onSaved={saved}
          onClose={() => setAddSensitive(false)}
        />
      )}
    </div>
  );
}

// ── Tiny layout helpers ───────────────────────────────────────────────────────
function Section({
  label,
  tone,
  onAdd,
  children,
}: {
  label: string;
  tone: Tone;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div>
      <div
        className="flex items-center justify-between"
        style={{ gap: 12, marginBottom: 12 }}
      >
        <p
          style={{
            margin: 0,
            font: "700 13px/1 var(--font-sans)",
            color: "var(--text-primary)",
          }}
        >
          {label}
        </p>
        <Button
          size="sm"
          icon={Plus}
          onClick={onAdd}
          style={{
            background: t.tint,
            borderColor: t.ink,
            color: t.ink,
            boxShadow: "none",
          }}
        >
          Add
        </Button>
      </div>
      <div className="flex flex-col" style={{ gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function RecordCard({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <div className="relative">
      <Surface pad={16}>
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute inline-flex items-center justify-center"
            style={{
              top: 10,
              right: 10,
              width: 26,
              height: 26,
              borderRadius: "var(--r-xs)",
              border: "1px solid var(--coral-100)",
              background: "var(--coral-050)",
              color: "var(--critical-ink)",
              cursor: "pointer",
            }}
          >
            <Trash2 size={11} />
          </button>
        )}
        {children}
      </Surface>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <EmptyState
      icon={Heart}
      title={label}
      message="Use Add to record one."
      tone="neutral"
      pad={32}
    />
  );
}
