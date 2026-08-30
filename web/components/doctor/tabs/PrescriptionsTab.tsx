"use client";
import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { SelectField } from "../shared/SelectField";
import { SubmitBtn } from "../shared/SubmitBtn";
import { useState, useCallback, useRef, useEffect } from "react";
import { visitApi } from "@/lib/api";
import { safeFormatDate } from "../utils/dateHelpers";
import {
  Pill,
  PlusCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Package,
  ArrowRight,
  Repeat,
  AlertCircle,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  RefreshCw,
  X,
} from "lucide-react";
import {
  Card,
  CardHeader,
  Pill as Badge,
  Button,
  Banner,
  EmptyState,
  SectionLabel,
  hoverRow,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Prescriptions tab.

   One prescription holds many medications, so the form builds a list of
   rows. DRUG_FORMULARY drives autocomplete; picking an entry pre-fills the
   strength, form and route so the common case is a few taps.

   Interaction checking calls OpenFDA directly from the browser and is
   strictly advisory — it never blocks prescribing, and a failed pair is
   skipped silently rather than surfacing a network error mid-consultation.
   ========================================================================== */

// ── Types ─────────────────────────────────────────────────────────────────────
type Medication = {
  medicationName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: string;
  instructions: string;
  refillsAllowed: string;
};

type Interaction = {
  drugs: string[];
  description: string;
  severity: "major" | "moderate" | "minor" | "unknown";
};

const BLANK_MED: Medication = {
  medicationName: "",
  genericName: "",
  strength: "",
  dosageForm: "tablet",
  dose: "",
  frequency: "once_daily",
  route: "oral",
  duration: "",
  quantity: "1",
  instructions: "",
  refillsAllowed: "0",
};

// ── Zambian / common formulary ────────────────────────────────────────────────
// Covers the most commonly prescribed drugs in Zambian hospitals.
// Doctor can still type any drug not in this list.
const DRUG_FORMULARY = [
  // Antibiotics
  {
    name: "Amoxicillin",
    generic: "Amoxicillin",
    strength: "500mg",
    form: "capsule",
  },
  {
    name: "Amoxicillin/Clavulanate",
    generic: "Co-amoxiclav",
    strength: "625mg",
    form: "tablet",
  },
  {
    name: "Ampicillin",
    generic: "Ampicillin",
    strength: "250mg",
    form: "capsule",
  },
  {
    name: "Azithromycin",
    generic: "Azithromycin",
    strength: "500mg",
    form: "tablet",
  },
  {
    name: "Ciprofloxacin",
    generic: "Ciprofloxacin",
    strength: "500mg",
    form: "tablet",
  },
  {
    name: "Cloxacillin",
    generic: "Cloxacillin",
    strength: "500mg",
    form: "capsule",
  },
  {
    name: "Doxycycline",
    generic: "Doxycycline",
    strength: "100mg",
    form: "tablet",
  },
  {
    name: "Erythromycin",
    generic: "Erythromycin",
    strength: "500mg",
    form: "tablet",
  },
  {
    name: "Metronidazole",
    generic: "Metronidazole",
    strength: "400mg",
    form: "tablet",
  },
  {
    name: "Trimethoprim/Sulfamethoxazole",
    generic: "Co-trimoxazole",
    strength: "480mg",
    form: "tablet",
  },
  {
    name: "Gentamicin",
    generic: "Gentamicin",
    strength: "80mg/2ml",
    form: "injection",
  },
  {
    name: "Ceftriaxone",
    generic: "Ceftriaxone",
    strength: "1g",
    form: "injection",
  },
  {
    name: "Benzylpenicillin",
    generic: "Penicillin G",
    strength: "1MU",
    form: "injection",
  },
  // Antimalarials
  {
    name: "Artemether/Lumefantrine",
    generic: "AL",
    strength: "20/120mg",
    form: "tablet",
  },
  {
    name: "Artesunate",
    generic: "Artesunate",
    strength: "60mg",
    form: "injection",
  },
  {
    name: "Quinine",
    generic: "Quinine sulfate",
    strength: "300mg",
    form: "tablet",
  },
  {
    name: "Chloroquine",
    generic: "Chloroquine",
    strength: "250mg",
    form: "tablet",
  },
  // Antiretrovirals
  {
    name: "Tenofovir/Lamivudine/Efavirenz",
    generic: "TLE",
    strength: "300/300/600mg",
    form: "tablet",
  },
  {
    name: "Tenofovir/Lamivudine/Dolutegravir",
    generic: "TLD",
    strength: "300/300/50mg",
    form: "tablet",
  },
  {
    name: "Nevirapine",
    generic: "Nevirapine",
    strength: "200mg",
    form: "tablet",
  },
  // Analgesics
  {
    name: "Paracetamol",
    generic: "Acetaminophen",
    strength: "500mg",
    form: "tablet",
  },
  {
    name: "Ibuprofen",
    generic: "Ibuprofen",
    strength: "400mg",
    form: "tablet",
  },
  {
    name: "Diclofenac",
    generic: "Diclofenac sodium",
    strength: "50mg",
    form: "tablet",
  },
  {
    name: "Morphine",
    generic: "Morphine sulfate",
    strength: "10mg",
    form: "tablet",
  },
  { name: "Tramadol", generic: "Tramadol", strength: "50mg", form: "capsule" },
  {
    name: "Aspirin",
    generic: "Acetylsalicylic acid",
    strength: "75mg",
    form: "tablet",
  },
  // Cardiovascular
  {
    name: "Amlodipine",
    generic: "Amlodipine",
    strength: "5mg",
    form: "tablet",
  },
  { name: "Atenolol", generic: "Atenolol", strength: "50mg", form: "tablet" },
  { name: "Enalapril", generic: "Enalapril", strength: "5mg", form: "tablet" },
  {
    name: "Furosemide",
    generic: "Frusemide",
    strength: "40mg",
    form: "tablet",
  },
  {
    name: "Hydrochlorothiazide",
    generic: "HCTZ",
    strength: "25mg",
    form: "tablet",
  },
  { name: "Digoxin", generic: "Digoxin", strength: "0.25mg", form: "tablet" },
  { name: "Warfarin", generic: "Warfarin", strength: "5mg", form: "tablet" },
  {
    name: "Spironolactone",
    generic: "Spironolactone",
    strength: "25mg",
    form: "tablet",
  },
  {
    name: "Nifedipine",
    generic: "Nifedipine",
    strength: "10mg",
    form: "tablet",
  },
  // Diabetes
  {
    name: "Metformin",
    generic: "Metformin",
    strength: "500mg",
    form: "tablet",
  },
  {
    name: "Glibenclamide",
    generic: "Glyburide",
    strength: "5mg",
    form: "tablet",
  },
  {
    name: "Insulin (Regular)",
    generic: "Insulin",
    strength: "100IU/ml",
    form: "injection",
  },
  // Respiratory
  {
    name: "Salbutamol",
    generic: "Albuterol",
    strength: "100mcg",
    form: "inhaler",
  },
  {
    name: "Prednisolone",
    generic: "Prednisolone",
    strength: "5mg",
    form: "tablet",
  },
  {
    name: "Hydrocortisone",
    generic: "Hydrocortisone",
    strength: "100mg",
    form: "injection",
  },
  {
    name: "Theophylline",
    generic: "Theophylline",
    strength: "200mg",
    form: "tablet",
  },
  // GI
  {
    name: "Omeprazole",
    generic: "Omeprazole",
    strength: "20mg",
    form: "capsule",
  },
  {
    name: "Ranitidine",
    generic: "Ranitidine",
    strength: "150mg",
    form: "tablet",
  },
  {
    name: "Oral Rehydration Salts",
    generic: "ORS",
    strength: "1 sachet",
    form: "syrup",
  },
  { name: "Zinc Sulfate", generic: "Zinc", strength: "20mg", form: "tablet" },
  {
    name: "Mebendazole",
    generic: "Mebendazole",
    strength: "100mg",
    form: "tablet",
  },
  // Vitamins / Supplements
  {
    name: "Ferrous Sulfate",
    generic: "Iron",
    strength: "200mg",
    form: "tablet",
  },
  {
    name: "Folic Acid",
    generic: "Folic acid",
    strength: "5mg",
    form: "tablet",
  },
  {
    name: "Vitamin A",
    generic: "Retinol",
    strength: "200,000IU",
    form: "capsule",
  },
  // Antifungals
  {
    name: "Fluconazole",
    generic: "Fluconazole",
    strength: "150mg",
    form: "capsule",
  },
  {
    name: "Cotrimoxazole",
    generic: "Co-trimoxazole",
    strength: "960mg",
    form: "tablet",
  },
  // Anticonvulsants
  {
    name: "Phenobarbital",
    generic: "Phenobarbitone",
    strength: "30mg",
    form: "tablet",
  },
  {
    name: "Phenytoin",
    generic: "Phenytoin",
    strength: "100mg",
    form: "capsule",
  },
  { name: "Diazepam", generic: "Diazepam", strength: "5mg", form: "tablet" },
  {
    name: "Carbamazepine",
    generic: "Carbamazepine",
    strength: "200mg",
    form: "tablet",
  },
  // TB
  {
    name: "Rifampicin/Isoniazid/Pyrazinamide/Ethambutol",
    generic: "RHZE",
    strength: "150/75/400/275mg",
    form: "tablet",
  },
  {
    name: "Rifampicin/Isoniazid",
    generic: "RH",
    strength: "150/75mg",
    form: "tablet",
  },
];

// ── Option lists ──────────────────────────────────────────────────────────────
const DOSAGE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "cream",
  "ointment",
  "drops",
  "inhaler",
  "suppository",
] as const;
const FREQUENCIES = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "3× daily" },
  { value: "four_times_daily", label: "4× daily" },
  { value: "every_4_hours", label: "Every 4 h" },
  { value: "every_6_hours", label: "Every 6 h" },
  { value: "every_8_hours", label: "Every 8 h" },
  { value: "as_needed", label: "As needed (PRN)" },
  { value: "stat", label: "Stat (immediately)" },
];
const ROUTES = [
  { value: "oral", label: "Oral" },
  { value: "intravenous", label: "Intravenous" },
  { value: "intramuscular", label: "Intramuscular" },
  { value: "subcutaneous", label: "Subcutaneous" },
  { value: "topical", label: "Topical" },
  { value: "inhalation", label: "Inhalation" },
  { value: "rectal", label: "Rectal" },
  { value: "sublingual", label: "Sublingual" },
];

// ── Style maps ────────────────────────────────────────────────────────────────
/* Dosage form → tone. Purely a visual grouping; the form itself carries no
   clinical severity. */
const FORM_TONE: Record<string, Tone> = {
  tablet: "info",
  capsule: "accent",
  syrup: "info",
  injection: "critical",
  cream: "urgent",
  ointment: "urgent",
  drops: "info",
  inhaler: "success",
  suppository: "neutral",
};
const formTone = (f: string): Tone => FORM_TONE[f] ?? "neutral";

/* Interaction severity, inferred from the OpenFDA label text below. */
const SEVERITY_CONFIG: Record<
  string,
  { tone: Tone; label: string; icon: React.ElementType }
> = {
  major: { tone: "critical", label: "Major", icon: ShieldAlert },
  moderate: { tone: "urgent", label: "Moderate", icon: TriangleAlert },
  minor: { tone: "info", label: "Minor", icon: AlertCircle },
  unknown: { tone: "neutral", label: "Unknown", icon: AlertCircle },
};

/* Keys mirror prescriptionStatusEnum in backend/src/db/schema.ts. */
const RX_STATUS: Record<string, { tone: Tone; icon: React.ElementType }> = {
  prescribed: { tone: "urgent", icon: Clock },
  dispensing: { tone: "info", icon: Clock },
  dispensed: { tone: "success", icon: CheckCircle2 },
  administered: { tone: "success", icon: CheckCircle2 },
  cancelled: { tone: "neutral", icon: AlertCircle },
};
const rxStatus = (st: string) =>
  RX_STATUS[st] ?? { tone: "neutral" as Tone, icon: AlertCircle };

// ── OpenFDA interaction checker ───────────────────────────────────────────────
async function checkInteractionsOpenFDA(
  drugNames: string[],
): Promise<Interaction[]> {
  if (drugNames.length < 2) return [];

  const interactions: Interaction[] = [];

  // Check each pair
  for (let i = 0; i < drugNames.length; i++) {
    for (let j = i + 1; j < drugNames.length; j++) {
      const drugA = drugNames[i].toLowerCase().split("/")[0].trim(); // handle combo drugs
      const drugB = drugNames[j].toLowerCase().split("/")[0].trim();

      try {
        // OpenFDA drug label search — look for interactions mentioning both drugs
        const query = encodeURIComponent(`drug_interactions:"${drugB}"`);
        const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(drugA)}"+(${query})&limit=1`;

        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        const label = data.results?.[0];
        if (!label) continue;

        const interactionText: string = label.drug_interactions?.[0] ?? "";
        if (!interactionText) continue;

        // Look for the other drug mentioned in interaction text
        if (interactionText.toLowerCase().includes(drugB)) {
          // Extract a relevant snippet (first sentence mentioning the drug)
          const sentences = interactionText
            .split(/[.!?]/)
            .filter((s) => s.toLowerCase().includes(drugB));
          const snippet = sentences[0]?.trim() ?? interactionText.slice(0, 200);

          // Infer severity from keywords
          let severity: Interaction["severity"] = "unknown";
          const lc = snippet.toLowerCase();
          if (
            lc.includes("contraindicated") ||
            lc.includes("fatal") ||
            lc.includes("serious") ||
            lc.includes("avoid")
          )
            severity = "major";
          else if (
            lc.includes("caution") ||
            lc.includes("monitor") ||
            lc.includes("increase") ||
            lc.includes("decrease")
          )
            severity = "moderate";
          else if (
            lc.includes("may") ||
            lc.includes("slight") ||
            lc.includes("minor")
          )
            severity = "minor";

          interactions.push({
            drugs: [drugNames[i], drugNames[j]],
            description:
              snippet.length > 300 ? snippet.slice(0, 300) + "…" : snippet,
            severity,
          });
        }
      } catch {
        // silently skip failed pair — don't block prescribing
      }
    }
  }

  return interactions;
}

// ── Drug autocomplete input ───────────────────────────────────────────────────
function DrugAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (drug: (typeof DRUG_FORMULARY)[0]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered =
    value.length >= 2
      ? DRUG_FORMULARY.filter(
          (d) =>
            d.name.toLowerCase().includes(value.toLowerCase()) ||
            d.generic.toLowerCase().includes(value.toLowerCase()),
        ).slice(0, 8)
      : [];

  const showDropdown = focused && filtered.length > 0;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="absolute w-3.5 h-3.5 pointer-events-none"
          style={{
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        />
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          /* Delay the blur so a mousedown on a suggestion still registers. */
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder ?? "Search drug name…"}
          style={{
            width: "100%",
            height: 40,
            padding: "0 34px 0 34px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--hc-border)",
            background: "var(--surface-sunken)",
            font: "500 13.5px/1 var(--font-sans)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute inline-flex items-center justify-center"
            style={{
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              width: 24,
              height: 24,
              border: "none",
              borderRadius: "var(--r-xs)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && open && (
        <div
          className="absolute z-50 left-0 right-0"
          style={{
            top: "calc(100% + 4px)",
            background: "var(--surface-card)",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--hc-border)",
            boxShadow: "var(--elev-3)",
            overflow: "hidden",
          }}
        >
          {filtered.map((drug, i) => {
            const t = TONES[formTone(drug.form)];
            return (
              <button
                key={i}
                type="button"
                onMouseDown={() => {
                  onSelect(drug);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between text-left"
                style={{
                  gap: 10,
                  padding: "10px 14px",
                  border: "none",
                  borderBottom: "1px solid var(--border-faint)",
                  background: "transparent",
                  cursor: "pointer",
                }}
                {...hoverRow}
              >
                <span className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                  <span
                    className="truncate"
                    style={{
                      font: "600 13.5px/1 var(--font-sans)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {drug.name}
                  </span>
                  <span
                    className="truncate"
                    style={{
                      font: "400 11.5px/1 var(--font-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {drug.generic} · {drug.strength}
                  </span>
                </span>
                <span
                  className="inline-flex items-center flex-shrink-0"
                  style={{
                    height: 18,
                    padding: "0 8px",
                    borderRadius: "var(--r-pill)",
                    background: t.tint,
                    color: t.ink,
                    font: "700 10px/1 var(--font-sans)",
                    textTransform: "capitalize",
                  }}
                >
                  {drug.form}
                </span>
              </button>
            );
          })}

          {/* The formulary is a convenience, not a constraint — free text wins. */}
          {value.length >= 2 && (
            <button
              type="button"
              onMouseDown={() => {
                onSelect({ name: value, generic: "", strength: "", form: "tablet" });
                setOpen(false);
              }}
              className="w-full flex items-center text-left"
              style={{
                gap: 9,
                padding: "10px 14px",
                border: "none",
                borderTop: "1px solid var(--border-faint)",
                background: "transparent",
                cursor: "pointer",
              }}
              {...hoverRow}
            >
              <PlusCircle
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: "var(--text-muted)" }}
              />
              <span
                style={{
                  font: "400 13px/1 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                Use “
                <strong style={{ color: "var(--text-primary)" }}>{value}</strong>” as
                entered
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Interaction warning panel ─────────────────────────────────────────────────
function InteractionPanel({
  interactions,
  checking,
  onDismiss,
}: {
  interactions: Interaction[];
  checking: boolean;
  onDismiss: () => void;
}) {
  if (checking) {
    return (
      <Banner tone="info" icon={RefreshCw}>
        Checking drug interactions via OpenFDA…
      </Banner>
    );
  }

  if (!interactions.length) {
    return (
      <Banner tone="success" icon={ShieldCheck}>
        No known interactions found between these medications.
      </Banner>
    );
  }

  /* A single major interaction sets the tone for the whole panel — the worst
     finding is what the prescriber needs to register first. */
  const hasMajor = interactions.some((i) => i.severity === "major");
  const t = TONES[hasMajor ? "critical" : "urgent"];

  return (
    <div
      style={{
        borderRadius: "var(--r-md)",
        border: `1px solid ${hasMajor ? "var(--coral-100)" : "var(--amber-100)"}`,
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ gap: 10, padding: "12px 16px", background: t.tint }}
      >
        <span className="inline-flex items-center min-w-0" style={{ gap: 10 }}>
          <ShieldAlert className="w-4 h-4 flex-shrink-0" style={{ color: t.ink }} />
          <span
            style={{ font: "700 13.5px/1 var(--font-sans)", color: t.ink }}
          >
            {interactions.length} potential interaction
            {interactions.length !== 1 ? "s" : ""} found
          </span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon={X}
          onClick={onDismiss}
          style={{ width: 26, color: t.ink }}
        />
      </div>

      <div
        style={{
          background: "var(--surface-card)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {interactions.map((ix, i) => {
          const cfg = SEVERITY_CONFIG[ix.severity] ?? SEVERITY_CONFIG.unknown;
          const it = TONES[cfg.tone];
          const Icon = cfg.icon;
          return (
            <div
              key={i}
              className="flex"
              style={{
                gap: 12,
                padding: 16,
                borderBottom: "1px solid var(--border-faint)",
              }}
            >
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--r-xs)",
                  background: it.tint,
                  color: it.ink,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>

              <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 6 }}>
                <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                  <span
                    style={{
                      font: "700 13px/1 var(--font-sans)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {ix.drugs[0]} + {ix.drugs[1]}
                  </span>
                  <Badge tone={cfg.tone} style={{ height: 18, fontSize: 10 }}>
                    {cfg.label}
                  </Badge>
                </div>
                <p
                  style={{
                    margin: 0,
                    font: "400 12.5px/1.6 var(--font-sans)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {ix.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p
        style={{
          margin: 0,
          padding: "10px 16px",
          background: "var(--surface-sunken)",
          font: "400 11px/1.4 var(--font-sans)",
          color: "var(--text-muted)",
        }}
      >
        Source: OpenFDA drug labels. Advisory only — always apply your own clinical
        judgement.
      </p>
    </div>
  );
}

/**
 * One medication line inside a prescription. Field names are read both ways —
 * the detail endpoint returns snake_case, the list endpoint camelCase.
 */
function MedicationItem({ item }: { item: any }) {
  const t = TONES[formTone(item.dosageForm)];
  const dispensed = item.isDispensed ?? item.is_dispensed;
  const refills = item.refillsAllowed ?? item.refills_allowed;

  return (
    <div className="flex items-start" style={{ gap: 12, padding: "14px 16px" }}>
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 32,
          height: 32,
          marginTop: 2,
          borderRadius: "var(--r-sm)",
          background: t.tint,
          color: t.ink,
          font: "700 10px/1 var(--font-sans)",
          textTransform: "uppercase",
        }}
      >
        {item.dosageForm?.slice(0, 3)}
      </span>

      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 8 }}>
        <div className="flex items-start justify-between" style={{ gap: 10 }}>
          <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
            <p
              style={{
                margin: 0,
                font: "700 13.5px/1.3 var(--font-sans)",
                color: "var(--text-primary)",
              }}
            >
              {item.medicationName || item.medication_name}{" "}
              <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                {item.strength}
              </span>
            </p>
            {(item.genericName || item.generic_name) && (
              <p
                style={{
                  margin: 0,
                  font: "400 11.5px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                }}
              >
                {item.genericName ?? item.generic_name}
              </p>
            )}
          </div>

          <span className="flex-shrink-0">
            {dispensed ? (
              <Badge tone="success" icon={CheckCircle2} style={{ height: 18, fontSize: 10 }}>
                Dispensed
              </Badge>
            ) : (
              <Badge tone="urgent" icon={Clock} style={{ height: 18, fontSize: 10 }}>
                Pending
              </Badge>
            )}
          </span>
        </div>

        {/* Dose → frequency → route → duration, read as a sequence. */}
        <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
          {[
            item.dose,
            (item.frequency ?? "").replace(/_/g, " "),
            item.route,
            item.duration,
          ]
            .filter(Boolean)
            .map((val, i, arr) => (
              <span key={i} className="inline-flex items-center" style={{ gap: 6 }}>
                <span
                  className="inline-flex items-center"
                  style={{
                    height: 19,
                    padding: "0 8px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--surface-sunken)",
                    color: "var(--text-secondary)",
                    font: "600 11px/1 var(--font-sans)",
                    textTransform: "capitalize",
                  }}
                >
                  {val}
                </span>
                {i < arr.length - 1 && (
                  <ArrowRight
                    className="w-3 h-3"
                    style={{ color: "var(--text-disabled)" }}
                  />
                )}
              </span>
            ))}
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: 12 }}>
          <span
            className="inline-flex items-center"
            style={{
              gap: 5,
              font: "400 11.5px/1 var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            <Package className="w-3 h-3" />
            Qty {item.quantity}
          </span>
          {refills > 0 && (
            <span
              className="inline-flex items-center"
              style={{
                gap: 5,
                font: "400 11.5px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              <Repeat className="w-3 h-3" />
              {refills} refill{refills !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {item.instructions && (
          <p
            style={{
              margin: 0,
              font: "400 12px/1.5 var(--font-sans)",
              color: "var(--text-secondary)",
              fontStyle: "italic",
            }}
          >
            “{item.instructions}”
          </p>
        )}
      </div>
    </div>
  );
}

// ── Prescription record card ──────────────────────────────────────────────────
function PrescriptionRecord({ rx, index }: { rx: any; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const [items, setItems] = useState<any[] | null>(rx.items ?? null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  const sc = rxStatus(rx.status);
  const scTone = TONES[sc.tone];
  const StatusIcon = sc.icon;

  const handleToggle = useCallback(async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && items === null && !fetching) {
      setFetching(true);
      setFetchErr(null);
      try {
        const res = await visitApi.getPrescriptionDetail(rx.id);
        const data = res.data?.data ?? res.data;
        const fetched = data?.items ?? data?.prescription?.items ?? [];
        setItems(Array.isArray(fetched) ? fetched : []);
      } catch (err: any) {
        setFetchErr(
          err.response?.data?.error?.message ?? "Failed to load items.",
        );
        setItems([]);
      } finally {
        setFetching(false);
      }
    }
  }, [open, items, fetching, rx.id]);

  const dispensedCount = (items ?? []).filter(
    (i: any) => i.isDispensed ?? i.is_dispensed,
  ).length;
  const totalCount = items?.length ?? "…";

  return (
    <div
      style={{
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-center text-left"
        style={{
          gap: 12,
          padding: "12px 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          transition: "background var(--dur-fast) var(--ease-standard)",
        }}
        {...hoverRow}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--r-sm)",
            background: "var(--brand-tint)",
            color: "var(--green-700)",
          }}
        >
          <Pill className="w-4 h-4" />
        </span>

        <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
          <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
            <span
              style={{
                font: "700 13px/1 var(--font-mono)",
                color: "var(--text-primary)",
              }}
            >
              {rx.prescriptionNumber ?? rx.prescription_number}
            </span>
            <Badge tone={sc.tone} icon={StatusIcon} style={{ height: 18, fontSize: 10 }}>
              {rx.status}
            </Badge>
          </span>

          <span
            className="inline-flex items-center flex-wrap"
            style={{
              gap: 7,
              font: "400 11.5px/1 var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            <Clock className="w-3 h-3" />
            {safeFormatDate(
              rx.prescribedAt ?? rx.prescribed_at ?? rx.createdAt,
              "dd MMM yyyy, HH:mm",
            )}
            {items !== null && (
              <>
                <span style={{ color: "var(--text-disabled)" }}>·</span>
                {dispensedCount}/{totalCount} dispensed
              </>
            )}
          </span>
        </span>

        <span className="flex items-center flex-shrink-0" style={{ gap: 8 }}>
          {fetching && (
            <Loader2
              className="w-3.5 h-3.5 animate-spin"
              style={{ color: "var(--text-muted)" }}
            />
          )}
          {open ? (
            <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          )}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border-faint)" }}>
          {fetching ? (
            <span
              className="inline-flex items-center"
              style={{
                gap: 8,
                padding: "20px 16px",
                font: "400 13px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading prescription items…
            </span>
          ) : fetchErr ? (
            <div style={{ padding: 16 }}>
              <Banner tone="critical" icon={AlertCircle}>
                {fetchErr}
              </Banner>
            </div>
          ) : items && items.length > 0 ? (
            <div className="[&>*:not(:last-child)]:border-b [&>*]:border-[var(--border-faint)]">
              {items.map((item: any, i: number) => (
                <MedicationItem key={item.id ?? i} item={item} />
              ))}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                padding: "20px 16px",
                font: "400 13px/1 var(--font-sans)",
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              No medication items found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MedRow({
  med,
  index,
  total,
  onChange,
  onRemove,
}: {
  med: Medication;
  index: number;
  total: number;
  onChange: (field: keyof Medication, v: string) => void;
  onRemove: () => void;
}) {
  const t = TONES[formTone(med.dosageForm)];
  /* The form chip only takes its colour once a drug is actually named —
     an empty row should read as empty. */
  const named = !!med.medicationName;

  return (
    <div
      style={{
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 12,
          padding: "10px 16px",
          background: "var(--surface-sunken)",
          borderBottom: "1px solid var(--border-faint)",
        }}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--r-sm)",
            background: named ? t.tint : "var(--surface-card)",
            color: named ? t.ink : "var(--text-muted)",
            font: "700 10px/1 var(--font-sans)",
            textTransform: "uppercase",
            transition: "all var(--dur-fast) var(--ease-standard)",
          }}
        >
          {med.dosageForm?.slice(0, 3)}
        </span>

        <p
          className="flex-1 min-w-0 truncate"
          style={{
            margin: 0,
            font: "700 12.5px/1 var(--font-sans)",
            color: "var(--text-secondary)",
          }}
        >
          {med.medicationName || `Medication ${index + 1}`}
          {med.strength && (
            <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>
              {" "}
              {med.strength}
            </span>
          )}
        </p>

        {total > 1 && (
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={onRemove}
            style={{ width: 26, color: "var(--critical-ink)" }}
          />
        )}
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Drug name autocomplete + strength */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 14,
          }}
        >
          <div>
            <FieldGroup label="Drug name *">
              <DrugAutocomplete
                value={med.medicationName}
                onChange={(v) => onChange("medicationName", v)}
                onSelect={(drug) => {
                  onChange("medicationName", drug.name);
                  if (drug.generic) onChange("genericName", drug.generic);
                  if (drug.strength) onChange("strength", drug.strength);
                  if (drug.form) onChange("dosageForm", drug.form);
                }}
                placeholder="Search or type drug name…"
              />
            </FieldGroup>
          </div>
          <FieldGroup label="Strength *">
            <InputField
              value={med.strength}
              onChange={(v: string) => onChange("strength", v)}
              placeholder="e.g. 500mg"
            />
          </FieldGroup>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 14,
          }}
        >
          <FieldGroup label="Generic name">
            <InputField
              value={med.genericName}
              onChange={(v: string) => onChange("genericName", v)}
              placeholder="Optional"
            />
          </FieldGroup>
          <FieldGroup label="Dosage form">
            <SelectField
              value={med.dosageForm}
              onChange={(v: string) => onChange("dosageForm", v)}
              options={DOSAGE_FORMS.map((d) => ({
                value: d,
                label: d.charAt(0).toUpperCase() + d.slice(1),
              }))}
            />
          </FieldGroup>
        </div>

        {/* Dosing — grouped on its own surface; these four fields are the
            prescription proper, the rest is metadata. */}
        <div
          style={{
            padding: 14,
            borderRadius: "var(--r-sm)",
            background: "var(--surface-sunken)",
          }}
        >
          <SectionLabel style={{ marginBottom: 12 }}>Dosing</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 14,
            }}
          >
            <FieldGroup label="Dose *">
              <InputField
                value={med.dose}
                onChange={(v: string) => onChange("dose", v)}
                placeholder="e.g. 1 tablet"
              />
            </FieldGroup>
            <FieldGroup label="Frequency">
              <SelectField
                value={med.frequency}
                onChange={(v: string) => onChange("frequency", v)}
                options={FREQUENCIES}
              />
            </FieldGroup>
            <FieldGroup label="Route">
              <SelectField
                value={med.route}
                onChange={(v: string) => onChange("route", v)}
                options={ROUTES}
              />
            </FieldGroup>
            <FieldGroup label="Duration *">
              <InputField
                value={med.duration}
                onChange={(v: string) => onChange("duration", v)}
                placeholder="e.g. 7 days"
              />
            </FieldGroup>
          </div>
        </div>

        {/* Dispensing */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 14,
          }}
        >
          <FieldGroup label="Quantity">
            <InputField
              value={med.quantity}
              onChange={(v: string) => onChange("quantity", v)}
              placeholder="14"
              type="number"
            />
          </FieldGroup>
          <FieldGroup label="Refills allowed">
            <InputField
              value={med.refillsAllowed}
              onChange={(v: string) => onChange("refillsAllowed", v)}
              placeholder="0"
              type="number"
            />
          </FieldGroup>
        </div>

        <FieldGroup label="Patient instructions">
          <InputField
            value={med.instructions}
            onChange={(v: string) => onChange("instructions", v)}
            placeholder='e.g. "Take with food and plenty of water"'
          />
        </FieldGroup>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PrescriptionsTab({
  visitId,
  prescriptions,
  onSaved,
  onError,
  isCompleted,
}: any) {
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(
    prescriptions.length === 0 && !isCompleted,
  );
  const [meds, setMeds] = useState<Medication[]>([{ ...BLANK_MED }]);
  const [interactions, setInteractions] = useState<Interaction[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string[]>([]);

  const addMed = () => setMeds((p) => [...p, { ...BLANK_MED }]);
  const removeMed = (i: number) => {
    setMeds((p) => p.filter((_, idx) => idx !== i));
    setInteractions(null); // reset interactions when drug removed
  };
  const updateMed = (i: number, field: keyof Medication, v: string) => {
    setMeds((p) => p.map((m, idx) => (idx === i ? { ...m, [field]: v } : m)));
    // Auto-check on drug name change if we have 2+ filled drugs
    if (field === "medicationName") setInteractions(null);
  };

  // ── Run interaction check ──────────────────────────────────────────────────
  const runInteractionCheck = useCallback(
    async (drugNames: string[]) => {
      const names = drugNames.filter(Boolean);
      if (names.length < 2) return;
      // Skip if same list already checked
      const key = names.sort().join("|");
      if (key === lastChecked.sort().join("|") && interactions !== null) return;

      setChecking(true);
      setInteractions(null);
      try {
        const found = await checkInteractionsOpenFDA(names);
        setInteractions(found);
        setLastChecked(names);
      } catch {
        setInteractions([]);
      } finally {
        setChecking(false);
      }
    },
    [lastChecked, interactions],
  );

  // Auto-check when a new drug name is fully entered (blur-like effect via deps)
  const filledDrugNames = meds
    .map((m) => m.medicationName.trim())
    .filter(Boolean);
  useEffect(() => {
    if (filledDrugNames.length >= 2) {
      const timer = setTimeout(() => runInteractionCheck(filledDrugNames), 800);
      return () => clearTimeout(timer);
    }
  }, [filledDrugNames.join(",")]);

  const handleSubmit = async () => {
    const valid = meds.filter(
      (m) =>
        m.medicationName.trim() &&
        m.strength.trim() &&
        m.dose.trim() &&
        m.duration.trim(),
    );
    if (!valid.length) {
      onError(
        "Complete at least one medication row (name, strength, dose, duration).",
      );
      return;
    }
    setLoading(true);
    try {
      await (visitApi as any).addPrescription(visitId, {
        medications: valid.map((m) => ({
          ...m,
          quantity: parseInt(m.quantity) || 1,
          refillsAllowed: parseInt(m.refillsAllowed) || 0,
        })),
      });
      setMeds([{ ...BLANK_MED }]);
      setShowForm(false);
      setInteractions(null);
      setLastChecked([]);
      onSaved();
    } catch (err: any) {
      onError(
        err.response?.data?.error?.message ?? "Failed to save prescription.",
      );
    } finally {
      setLoading(false);
    }
  };

  const filledCount = meds.filter((m) => m.medicationName.trim()).length;
  const hasMajorInteraction =
    interactions?.some((i) => i.severity === "major") ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Past prescriptions ─────────────────────────────────────────── */}
      {prescriptions.length > 0 && (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <SectionLabel>Prescriptions ({prescriptions.length})</SectionLabel>
          {prescriptions.map((rx: any, i: number) => (
            <PrescriptionRecord key={rx.id} rx={rx} index={i} />
          ))}
        </div>
      )}

      {/* ── New prescription form ──────────────────────────────────────── */}
      {!isCompleted &&
        (!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full inline-flex items-center justify-center"
            style={{
              gap: 8,
              padding: 14,
              borderRadius: "var(--r-md)",
              border: "1.5px dashed var(--hc-border)",
              background: "transparent",
              font: "600 13.5px/1 var(--font-sans)",
              color: "var(--text-muted)",
              cursor: "pointer",
              transition: "all var(--dur-fast) var(--ease-standard)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--brand)";
              e.currentTarget.style.color = "var(--green-700)";
              e.currentTarget.style.background = "var(--green-050)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--hc-border)";
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <PlusCircle className="w-4 h-4" />
            New prescription
          </button>
        ) : (
          <Card>
            <CardHeader
              icon={Pill}
              title="New prescription"
              subtitle={
                filledCount > 0
                  ? `${filledCount} medication${filledCount !== 1 ? "s" : ""} added`
                  : "Search or type drug names below"
              }
              right={
                prescriptions.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowForm(false);
                      setMeds([{ ...BLANK_MED }]);
                      setInteractions(null);
                    }}
                  >
                    Cancel
                  </Button>
                ) : undefined
              }
            />

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {meds.map((med, i) => (
                <MedRow
                  key={i}
                  med={med}
                  index={i}
                  total={meds.length}
                  onChange={(field, v) => updateMed(i, field, v)}
                  onRemove={() => removeMed(i)}
                />
              ))}

              <button
                onClick={addMed}
                className="w-full inline-flex items-center justify-center"
                style={{
                  gap: 8,
                  padding: 11,
                  borderRadius: "var(--r-sm)",
                  border: "1.5px dashed var(--hc-border)",
                  background: "transparent",
                  font: "500 13px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <PlusCircle className="w-4 h-4" />
                Add another medication
              </button>

              {/* ── Interaction checker ──────────────────────────────────── */}
              {filledCount >= 2 && (
                <div className="flex flex-col" style={{ gap: 10 }}>
                  <Button
                    size="sm"
                    icon={checking ? RefreshCw : ShieldAlert}
                    loading={checking}
                    onClick={() => runInteractionCheck(filledDrugNames)}
                    style={{
                      alignSelf: "flex-start",
                      background: "var(--brand-tint)",
                      borderColor: "var(--green-100)",
                      color: "var(--green-800)",
                      boxShadow: "none",
                    }}
                  >
                    {checking ? "Checking…" : "Check drug interactions"}
                  </Button>

                  {(checking || interactions !== null) && (
                    <InteractionPanel
                      interactions={interactions ?? []}
                      checking={checking}
                      onDismiss={() => setInteractions(null)}
                    />
                  )}
                </div>
              )}

              {/* Advisory, never blocking — the prescriber decides. */}
              {hasMajorInteraction && (
                <Banner
                  tone="critical"
                  icon={ShieldAlert}
                  title="Major interaction detected"
                >
                  Review the interaction above before prescribing. You can still
                  proceed if clinically indicated.
                </Banner>
              )}

              <div
                className="flex justify-end"
                style={{ paddingTop: 14, borderTop: "1px solid var(--border-faint)" }}
              >
                <SubmitBtn
                  onClick={handleSubmit}
                  loading={loading}
                  label={
                    filledCount > 0
                      ? `Create prescription (${filledCount} item${filledCount !== 1 ? "s" : ""})`
                      : "Create prescription"
                  }
                />
              </div>
            </div>
          </Card>
        ))}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {prescriptions.length === 0 && isCompleted && (
        <div
          style={{
            borderRadius: "var(--r-md)",
            border: "1.5px dashed var(--hc-border)",
            background: "var(--surface-sunken)",
          }}
        >
          <EmptyState
            icon={Pill}
            title="No prescriptions recorded"
            message="Nothing was prescribed during this visit."
            tone="neutral"
            pad={32}
          />
        </div>
      )}
    </div>
  );
}
