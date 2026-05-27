"use client";
import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { SelectField } from "../shared/SelectField";
import { SubmitBtn } from "../shared/SubmitBtn";
import { useState, useCallback } from "react";
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

// ── Dosage form colour ────────────────────────────────────────────────────────
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

// ── Prescription status style ─────────────────────────────────────────────────
const RX_STATUS: Record<
  string,
  { bg: string; text: string; icon: React.ElementType }
> = {
  prescribed: { bg: "#fffbeb", text: "#d97706", icon: Clock },
  dispensing: { bg: "#eff6ff", text: "#2563eb", icon: Clock },
  dispensed: { bg: "#f0fdf4", text: "#15803d", icon: CheckCircle2 },
  cancelled: { bg: "#f9fafb", text: "#6b7280", icon: AlertCircle },
};

// ── Medication item row (inside expanded prescription) ────────────────────────
function MedicationItem({ item }: { item: any }) {
  const fc = FORM_COLOR[item.dosageForm] ?? { color: "#6b7280", bg: "#f9fafb" };

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      {/* Dosage form chip */}
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
          {/* Dispensed status */}
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

        {/* Dosing chip chain */}
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

        {/* Quantity + refills */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Package className="w-3 h-3" />
            Qty: {item.quantity}
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
// Items are lazy-loaded when the card is first expanded.
function PrescriptionRecord({ rx, index }: { rx: any; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const [items, setItems] = useState<any[] | null>(rx.items ?? null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  const sc = RX_STATUS[rx.status] ?? RX_STATUS.prescribed;
  const StatusIcon = sc.icon;

  // ── Lazy-fetch items on first open ─────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    const willOpen = !open;
    setOpen(willOpen);

    // Only fetch if we don't have items yet and we're opening
    if (willOpen && items === null && !fetching) {
      setFetching(true);
      setFetchErr(null);
      try {
        const res = await visitApi.getPrescriptionDetail(rx.id);
        // Response shape: { success, data: { prescription, items } }
        const data = res.data?.data ?? res.data;
        const fetched =
          data?.items ?? // { data: { items: [] } }
          data?.prescription?.items ?? // nested
          [];
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
      {/* Header */}
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

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100">
          {fetching ? (
            <div className="flex items-center gap-2 px-4 py-5 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading prescription items…
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
              No medication items found for this prescription.
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
      {/* Row header — live preview */}
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
        {/* Name + strength */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <FieldGroup label="Drug Name *">
              <InputField
                value={med.medicationName}
                onChange={(v: string) => onChange("medicationName", v)}
                placeholder="e.g. Amoxicillin"
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

        {/* Dosing group */}
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

  const addMed = () => setMeds((p) => [...p, { ...BLANK_MED }]);
  const removeMed = (i: number) =>
    setMeds((p) => p.filter((_, idx) => idx !== i));
  const updateMed = (i: number, field: keyof Medication, v: string) =>
    setMeds((p) => p.map((m, idx) => (idx === i ? { ...m, [field]: v } : m)));

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

  return (
    <div
      className="p-5 space-y-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Past prescriptions ─────────────────────────────────────────────── */}
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

      {/* ── New prescription form ──────────────────────────────────────────── */}
      {!isCompleted &&
        (!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400 hover:border-cyan-300 hover:text-cyan-600 hover:bg-cyan-50/40 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            New Prescription
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
                    : "Add one or more medications below"}
                </p>
              </div>
              {prescriptions.length > 0 && (
                <button
                  onClick={() => {
                    setShowForm(false);
                    setMeds([{ ...BLANK_MED }]);
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
                <PlusCircle className="w-4 h-4" />
                Add another medication
              </button>

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

      {/* ── Empty state ────────────────────────────────────────────────────── */}
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
