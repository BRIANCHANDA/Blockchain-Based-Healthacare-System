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
const FORM_COLOR: Record<string, { color: string; bg: string }> = {
  tablet: { color: "#2563eb", bg: "#eff6ff" },
  capsule: { color: "#7c3aed", bg: "#fdf4ff" },
  syrup: { color: "#0891b2", bg: "#ecfeff" },
  injection: { color: "#dc2626", bg: "#fef2f2" },
  cream: { color: "#d97706", bg: "#fffbeb" },
  ointment: { color: "#92400e", bg: "#fef3c7" },
  drops: { color: "#0ea5e9", bg: "#f0f9ff" },
  inhaler: { color: "#059669", bg: "#ecfdf5" },
  suppository: { color: "#6b7280", bg: "#f9fafb" },
};

const SEVERITY_CONFIG = {
  major: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    label: "Major",
    icon: ShieldAlert,
  },
  moderate: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    label: "Moderate",
    icon: TriangleAlert,
  },
  minor: {
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    label: "Minor",
    icon: AlertCircle,
  },
  unknown: {
    color: "#6b7280",
    bg: "#f9fafb",
    border: "#e5e7eb",
    label: "Unknown",
    icon: AlertCircle,
  },
};

const RX_STATUS: Record<
  string,
  { bg: string; text: string; icon: React.ElementType }
> = {
  prescribed: { bg: "#fffbeb", text: "#d97706", icon: Clock },
  dispensing: { bg: "#eff6ff", text: "#2563eb", icon: Clock },
  dispensed: { bg: "#f0fdf4", text: "#15803d", icon: CheckCircle2 },
  cancelled: { bg: "#f9fafb", text: "#6b7280", icon: AlertCircle },
};

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
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
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder ?? "Search drug name…"}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:border-cyan-400 focus:bg-white transition-colors"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
          {filtered.map((drug, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => {
                onSelect(drug);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-cyan-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {drug.name}
                </p>
                <p className="text-xs text-gray-400">
                  {drug.generic} · {drug.strength}
                </p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                style={{
                  background: FORM_COLOR[drug.form]?.bg ?? "#f3f4f6",
                  color: FORM_COLOR[drug.form]?.color ?? "#6b7280",
                }}
              >
                {drug.form}
              </span>
            </button>
          ))}
          {/* Allow free text entry */}
          {value.length >= 2 && (
            <button
              type="button"
              onMouseDown={() => {
                onSelect({
                  name: value,
                  generic: "",
                  strength: "",
                  form: "tablet",
                });
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              <PlusCircle className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-sm text-gray-500">
                Use "
                <span className="font-semibold text-gray-700">{value}</span>" as
                entered
              </p>
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
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-100">
        <RefreshCw className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
        <p className="text-sm font-semibold text-blue-700">
          Checking drug interactions via OpenFDA…
        </p>
      </div>
    );
  }

  if (!interactions.length) {
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 border border-green-100">
        <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
        <p className="text-sm font-semibold text-green-700">
          No known interactions found between these medications
        </p>
      </div>
    );
  }

  const hasMajor = interactions.some((i) => i.severity === "major");

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${hasMajor ? "border-red-200" : "border-amber-200"}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: hasMajor ? "#fef2f2" : "#fffbeb" }}
      >
        <div className="flex items-center gap-2.5">
          <ShieldAlert
            className={`w-4 h-4 flex-shrink-0 ${hasMajor ? "text-red-500" : "text-amber-500"}`}
          />
          <p
            className={`text-sm font-bold ${hasMajor ? "text-red-800" : "text-amber-800"}`}
          >
            {interactions.length} Interaction
            {interactions.length !== 1 ? "s" : ""} Found
          </p>
          {hasMajor && (
            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
              MAJOR
            </span>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Interaction list */}
      <div className="divide-y divide-gray-50 bg-white">
        {interactions.map((interaction, i) => {
          const cfg = SEVERITY_CONFIG[interaction.severity];
          const SeverityIcon = cfg.icon;
          return (
            <div key={i} className="px-4 py-3.5">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border"
                  style={{
                    color: cfg.color,
                    background: cfg.bg,
                    borderColor: cfg.border,
                  }}
                >
                  <SeverityIcon className="w-3 h-3" />
                  {cfg.label}
                </span>
                <span className="text-xs font-bold text-gray-700">
                  {interaction.drugs[0]}
                </span>
                <span className="text-xs text-gray-400">+</span>
                <span className="text-xs font-bold text-gray-700">
                  {interaction.drugs[1]}
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {interaction.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footer disclaimer */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400">
          Source: OpenFDA drug labels. Clinical judgement takes precedence.
          Always verify with current prescribing information.
        </p>
      </div>
    </div>
  );
}

// ── Medication item row (inside expanded prescription) ────────────────────────
function MedicationItem({ item }: { item: any }) {
  const fc = FORM_COLOR[item.dosageForm] ?? { color: "#6b7280", bg: "#f9fafb" };
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold uppercase"
        style={{ background: fc.bg, color: fc.color }}
      >
        {item.dosageForm?.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {item.medicationName || item.medication_name}{" "}
              <span className="font-semibold text-gray-500">
                {item.strength}
              </span>
            </p>
            {(item.genericName || item.generic_name) && (
              <p className="text-xs text-gray-400 italic">
                {item.genericName ?? item.generic_name}
              </p>
            )}
          </div>
          {(item.isDispensed ?? item.is_dispensed) ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 flex-shrink-0">
              <CheckCircle2 className="w-3 h-3" /> Dispensed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 flex-shrink-0">
              <Clock className="w-3 h-3" /> Pending
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {[
            item.dose,
            (item.frequency ?? "").replace(/_/g, " "),
            item.route,
            item.duration,
          ]
            .filter(Boolean)
            .map((val, i, arr) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                  {val}
                </span>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-gray-300" />
                )}
              </span>
            ))}
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Package className="w-3 h-3" /> Qty: {item.quantity}
          </span>
          {(item.refillsAllowed ?? item.refills_allowed) > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Repeat className="w-3 h-3" />
              {item.refillsAllowed ?? item.refills_allowed} refill
              {(item.refillsAllowed ?? item.refills_allowed) !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {item.instructions && (
          <p className="text-xs text-gray-500 mt-1.5 italic">
            "{item.instructions}"
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

  const sc = RX_STATUS[rx.status] ?? RX_STATUS.prescribed;
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
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
          <Pill className="w-4 h-4 text-cyan-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-800 font-mono">
              {rx.prescriptionNumber ?? rx.prescription_number}
            </p>
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
              style={{ background: sc.bg, color: sc.text }}
            >
              <StatusIcon className="w-3 h-3" />
              {rx.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">
              {safeFormatDate(
                rx.prescribedAt ?? rx.prescribed_at ?? rx.createdAt,
                "dd MMM yyyy, HH:mm",
              )}
            </span>
            {items !== null && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400">
                  {dispensedCount}/{totalCount} dispensed
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {fetching && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
          )}
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100">
          {fetching ? (
            <div className="flex items-center gap-2 px-4 py-5 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading prescription
              items…
            </div>
          ) : fetchErr ? (
            <div className="flex items-center gap-2 px-4 py-4 bg-red-50 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {fetchErr}
            </div>
          ) : items && items.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {items.map((item: any, i: number) => (
                <MedicationItem key={item.id ?? i} item={item} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-5 text-sm text-gray-400 italic">
              No medication items found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Medication form row ───────────────────────────────────────────────────────
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
  const fc = FORM_COLOR[med.dosageForm] ?? { color: "#6b7280", bg: "#f9fafb" };

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/60 border-b border-gray-100">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[10px] font-bold uppercase transition-all"
          style={{
            background: med.medicationName ? fc.bg : "#f3f4f6",
            color: med.medicationName ? fc.color : "#9ca3af",
          }}
        >
          {med.dosageForm?.slice(0, 3)}
        </div>
        <p className="text-xs font-bold text-gray-500 flex-1">
          {med.medicationName || `Medication ${index + 1}`}
          {med.strength && (
            <span className="font-normal text-gray-400 ml-1">
              {med.strength}
            </span>
          )}
        </p>
        {total > 1 && (
          <button
            onClick={onRemove}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3 bg-white">
        {/* Drug name autocomplete + strength */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <FieldGroup label="Drug Name *">
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

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Generic Name">
            <InputField
              value={med.genericName}
              onChange={(v: string) => onChange("genericName", v)}
              placeholder="Optional"
            />
          </FieldGroup>
          <FieldGroup label="Dosage Form">
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

        {/* Dosing */}
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
            Dosing
          </p>
          <div className="grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Quantity">
            <InputField
              value={med.quantity}
              onChange={(v: string) => onChange("quantity", v)}
              placeholder="14"
              type="number"
            />
          </FieldGroup>
          <FieldGroup label="Refills Allowed">
            <InputField
              value={med.refillsAllowed}
              onChange={(v: string) => onChange("refillsAllowed", v)}
              placeholder="0"
              type="number"
            />
          </FieldGroup>
        </div>

        <FieldGroup label="Patient Instructions">
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
    <div
      className="p-5 space-y-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Past prescriptions ─────────────────────────────────────────── */}
      {prescriptions.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 px-0.5">
            Prescriptions ({prescriptions.length})
          </p>
          <div className="space-y-2.5">
            {prescriptions.map((rx: any, i: number) => (
              <PrescriptionRecord key={rx.id} rx={rx} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── New prescription form ──────────────────────────────────────── */}
      {!isCompleted &&
        (!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50/40 transition-all"
          >
            <PlusCircle className="w-4 h-4" /> New Prescription
          </button>
        ) : (
          <div className="rounded-2xl border border-cyan-100 overflow-hidden">
            {/* Form header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-cyan-50 to-white border-b border-cyan-100">
              <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                <Pill className="w-4 h-4 text-cyan-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">
                  New Prescription
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {filledCount > 0
                    ? `${filledCount} medication${filledCount !== 1 ? "s" : ""} added`
                    : "Search or type drug names below"}
                </p>
              </div>
              {prescriptions.length > 0 && (
                <button
                  onClick={() => {
                    setShowForm(false);
                    setMeds([{ ...BLANK_MED }]);
                    setInteractions(null);
                  }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 font-medium"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="p-5 space-y-3 bg-white">
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
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-cyan-400 hover:text-cyan-600 hover:bg-cyan-50/40 transition-all"
              >
                <PlusCircle className="w-4 h-4" /> Add another medication
              </button>

              {/* ── Interaction checker ──────────────────────────────────── */}
              {filledCount >= 1 && (
                <div className="space-y-2 pt-1">
                  {/* Manual check button — always shown when 2+ drugs */}
                  {filledCount >= 2 && (
                    <button
                      onClick={() => runInteractionCheck(filledDrugNames)}
                      disabled={checking}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-50"
                      style={{
                        background: "#f0fdf4",
                        borderColor: "#bbf7d0",
                        color: "#166534",
                      }}
                    >
                      {checking ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                          Checking…
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5" /> Check Drug
                          Interactions
                        </>
                      )}
                    </button>
                  )}

                  {/* Results panel */}
                  {(checking || interactions !== null) && (
                    <InteractionPanel
                      interactions={interactions ?? []}
                      checking={checking}
                      onDismiss={() => setInteractions(null)}
                    />
                  )}
                </div>
              )}

              {/* Major interaction warning on submit */}
              {hasMajorInteraction && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
                  <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800">
                      Major interaction detected
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Review the interaction above before prescribing. You can
                      still proceed if clinically indicated.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <SubmitBtn
                  onClick={handleSubmit}
                  loading={loading}
                  label={
                    filledCount > 0
                      ? `Create Prescription (${filledCount} item${filledCount !== 1 ? "s" : ""})`
                      : "Create Prescription"
                  }
                />
              </div>
            </div>
          </div>
        ))}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {prescriptions.length === 0 && isCompleted && (
        <div className="flex flex-col items-center gap-2 py-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <Pill className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-400">
            No prescriptions recorded
          </p>
        </div>
      )}
    </div>
  );
}
