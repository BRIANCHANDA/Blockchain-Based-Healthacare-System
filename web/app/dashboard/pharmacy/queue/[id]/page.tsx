"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  Pill,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Package,
  Clock,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const FREQUENCY_LABEL: Record<string, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  three_times_daily: "3× daily",
  four_times_daily: "4× daily",
  every_4_hours: "Every 4 hours",
  every_6_hours: "Every 6 hours",
  every_8_hours: "Every 8 hours",
  as_needed: "As needed (PRN)",
  stat: "STAT — immediately",
};

const ROUTE_LABEL: Record<string, string> = {
  oral: "Oral",
  intravenous: "IV",
  intramuscular: "IM",
  subcutaneous: "SC",
  topical: "Topical",
  inhalation: "Inhalation",
  rectal: "Rectal",
  sublingual: "Sublingual",
};

const FORM_ICON: Record<string, string> = {
  tablet: "💊",
  capsule: "💊",
  syrup: "🧴",
  injection: "💉",
  cream: "🧴",
  ointment: "🧴",
  drops: "💧",
  inhaler: "🌬️",
  suppository: "📦",
};

function Toast({
  message,
  type,
}: {
  message: string;
  type: "success" | "error";
}) {
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
      ${type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-100"}`}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} className="text-green-600" />
      ) : (
        <AlertTriangle size={16} className="text-red-500" />
      )}
      {message}
    </div>
  );
}

function MedCard({
  item,
  selected,
  onToggle,
  allDispensed,
}: {
  item: any;
  selected: boolean;
  onToggle: () => void;
  allDispensed: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const icon = FORM_ICON[item.dosage_form] ?? "💊";

  if (item.is_dispensed) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-green-100 bg-green-50/50">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 text-lg">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-700 line-through truncate">
            {item.medication_name} {item.strength}
          </p>
          <p className="text-xs text-green-600 font-semibold mt-0.5">
            ✓ Dispensed{" "}
            {item.dispensed_at
              ? formatDistanceToNow(new Date(item.dispensed_at), {
                  addSuffix: true,
                })
              : ""}
          </p>
        </div>
        <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border-2 overflow-hidden transition-all cursor-pointer"
      style={{
        borderColor: selected ? "#0A6640" : "#E5E7EB",
        background: selected ? "#F0FDF4" : "#fff",
      }}
      onClick={allDispensed ? undefined : onToggle}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Checkbox */}
        <div
          className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            borderColor: selected ? "#0A6640" : "#D1D5DB",
            backgroundColor: selected ? "#0A6640" : "#fff",
          }}
        >
          {selected && (
            <svg viewBox="0 0 10 8" className="w-3 h-2.5 fill-white">
              <path
                d="M1 4l2.5 2.5L9 1"
                stroke="white"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        {/* Med icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: selected ? "#DCFCE7" : "#F9FAFB" }}
        >
          {icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">
            {item.medication_name}
            {item.strength && (
              <span className="font-normal text-gray-500 ml-1">
                {item.strength}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {item.dose} · {FREQUENCY_LABEL[item.frequency] ?? item.frequency} ·{" "}
            {ROUTE_LABEL[item.route] ?? item.route}
          </p>
        </div>

        {/* Qty */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-lg font-extrabold text-gray-900 leading-none">
              {item.quantity}
            </p>
            <p className="text-xs text-gray-400">units</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {expanded ? (
              <ChevronUp size={14} className="text-gray-400" />
            ) : (
              <ChevronDown size={14} className="text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3 pt-3">
            {[
              { label: "Dosage form", value: item.dosage_form },
              { label: "Duration", value: item.duration },
              { label: "Generic name", value: item.generic_name || "—" },
              { label: "Refills", value: item.refills_allowed ?? 0 },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">
                  {label}
                </p>
                <p className="text-sm text-gray-800 font-medium capitalize">
                  {String(value)}
                </p>
              </div>
            ))}
            {item.instructions && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">
                  Instructions
                </p>
                <p className="text-sm text-gray-800 italic">
                  "{item.instructions}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PharmacyDispensePage() {
  const { id: prescriptionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [prescription, setPrescription] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [error, setError] = useState("");

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    (visitApi as any)
      .getPrescriptionDetail(prescriptionId)
      .then((res: any) => {
        setPrescription(res.data.data?.prescription ?? null);
        const itemList = res.data.data?.items ?? [];
        setItems(itemList);
        // Pre-select all undispensed items
        setSelected(
          new Set(
            itemList.filter((i: any) => !i.is_dispensed).map((i: any) => i.id),
          ),
        );
      })
      .catch(() => setPrescription(null))
      .finally(() => setLoading(false));
  }, [prescriptionId]);

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const undispensed = items.filter((i) => !i.is_dispensed).map((i) => i.id);
    if (selected.size === undispensed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(undispensed));
    }
  };

  const handleDispense = async () => {
    if (selected.size === 0) {
      setError("Select at least one item to dispense.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await (visitApi as any).dispensePrescription(
        prescription.visit_id,
        prescriptionId,
        { itemIds: [...selected], dispensingNotes: notes.trim() || undefined },
      );
      showToast("Medications dispensed successfully.", "success");
      setTimeout(() => router.push("/dashboard/pharmacy/queue"), 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to dispense. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-green-700" />
        <p className="text-sm text-gray-400">Loading prescription…</p>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Pill size={28} className="text-gray-400" />
        </div>
        <p className="text-gray-700 font-semibold mb-1">
          Prescription not found
        </p>
        <button
          onClick={() => router.push("/dashboard/pharmacy/queue")}
          className="text-green-700 text-sm font-medium hover:underline"
        >
          ← Back to queue
        </button>
      </div>
    );
  }

  const pendingItems = items.filter((i) => !i.is_dispensed);
  const dispensedItems = items.filter((i) => i.is_dispensed);
  const allDone = pendingItems.length === 0;

  return (
    <div
      className="max-w-3xl mx-auto space-y-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Back */}
      <button
        onClick={() => router.push("/dashboard/pharmacy/queue")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft size={16} /> Back to Queue
      </button>

      {/* Prescription header */}
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        style={{ borderTop: `4px solid #0A6640` }}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-green-50">
              <Package size={26} className="text-green-700" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-gray-900 font-mono">
                  {prescription.prescription_number}
                </h1>
                {allDone ? (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                    <CheckCircle2 size={11} /> Fully Dispensed
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                    {pendingItems.length} item
                    {pendingItems.length !== 1 ? "s" : ""} pending
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {prescription.visit_number}
              </p>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <Clock size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Prescribed</p>
                <p className="text-sm font-semibold text-gray-800">
                  {formatDistanceToNow(new Date(prescription.prescribed_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <Pill size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Items</p>
                <p className="text-sm font-semibold text-gray-800">
                  {items.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                <ShieldCheck size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <p className="text-sm font-semibold text-gray-800 capitalize">
                  {prescription.status}
                </p>
              </div>
            </div>
          </div>

          {prescription.chief_complaint && (
            <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <ClipboardList
                size={14}
                className="text-blue-500 mt-0.5 flex-shrink-0"
              />
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-0.5">
                  Chief Complaint
                </p>
                <p className="text-sm text-blue-800">
                  {prescription.chief_complaint}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Medication items */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-gray-800">
            Medications ({items.length})
          </p>
          {pendingItems.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs font-semibold text-green-700 hover:underline"
            >
              {selected.size === pendingItems.length
                ? "Deselect all"
                : "Select all"}
            </button>
          )}
        </div>

        <div className="space-y-3">
          {/* Pending items */}
          {pendingItems.map((item) => (
            <MedCard
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              onToggle={() => toggleItem(item.id)}
              allDispensed={allDone}
            />
          ))}

          {/* Already dispensed */}
          {dispensedItems.map((item) => (
            <MedCard
              key={item.id}
              item={item}
              selected={false}
              onToggle={() => {}}
              allDispensed={true}
            />
          ))}
        </div>
      </div>

      {/* Dispensing notes + submit */}
      {!allDone && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Dispensing Notes{" "}
              <span className="text-gray-300 font-normal normal-case">
                (optional)
              </span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Patient counselled on dosage. Generic substitution made for…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none
                focus:border-green-500 focus:ring-2 focus:ring-green-500/10 focus:bg-white resize-none
                placeholder:text-gray-400 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Selection summary */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100">
              <CheckCircle2 size={14} className="text-green-600" />
              <p className="text-sm text-green-800 font-medium">
                {selected.size} item{selected.size > 1 ? "s" : ""} selected for
                dispensing
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button
              onClick={() => router.push("/dashboard/pharmacy/queue")}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDispense}
              disabled={submitting || selected.size === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#0A6640,#15803d)" }}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Dispensing…
                </>
              ) : (
                <>
                  <Package size={15} /> Dispense {selected.size} Item
                  {selected.size !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {allDone && (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <p className="text-lg font-bold text-gray-900 mb-1">
            All Items Dispensed
          </p>
          <p className="text-sm text-gray-500 mb-5">
            This prescription has been fully dispensed and recorded on the
            blockchain.
          </p>
          <button
            onClick={() => router.push("/dashboard/pharmacy/queue")}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#0A6640,#15803d)" }}
          >
            Back to Queue
          </button>
        </div>
      )}
    </div>
  );
}
