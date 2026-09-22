"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
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
import { formatDistanceToNow } from "date-fns";
import {
  Page,
  Card,
  CardHeader,
  Field,
  Textarea,
  Button,
  Pill as Badge,
  Banner,
  Toast,
  SectionLabel,
  LinkAction,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Dispense a prescription.

   Items are selected individually — a prescription can be partially
   dispensed when stock runs short, so the submit sends only the checked
   item ids rather than the whole prescription.

   Note the field names: this endpoint returns raw snake_case straight from
   SQL (medication_name, is_dispensed), unlike most of the API.
   ========================================================================== */

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

/** Meta cell in the prescription header strip. */
function MetaCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center" style={{ gap: 10 }}>
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--r-xs)",
          background: "var(--surface-sunken)",
          color: "var(--text-muted)",
        }}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
        <span
          style={{ font: "400 11.5px/1 var(--font-sans)", color: "var(--text-muted)" }}
        >
          {label}
        </span>
        <span
          className="truncate"
          style={{
            font: "600 13px/1 var(--font-sans)",
            color: "var(--text-primary)",
            textTransform: "capitalize",
          }}
        >
          {value}
        </span>
      </div>
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

  // An already-dispensed item is a receipt, not a control — no checkbox.
  if (item.is_dispensed) {
    return (
      <div
        className="flex items-center"
        style={{
          gap: 12,
          padding: 14,
          borderRadius: "var(--r-sm)",
          background: "var(--brand-tint)",
          border: "1px solid var(--green-100)",
        }}
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 38,
            height: 38,
            borderRadius: "var(--r-xs)",
            background: "var(--green-100)",
            fontSize: 17,
          }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
          <p
            className="truncate"
            style={{
              margin: 0,
              font: "600 13.5px/1 var(--font-sans)",
              color: "var(--text-secondary)",
              textDecoration: "line-through",
            }}
          >
            {item.medication_name} {item.strength}
          </p>
          <p
            style={{
              margin: 0,
              font: "600 11.5px/1 var(--font-sans)",
              color: "var(--green-800)",
            }}
          >
            Dispensed{" "}
            {item.dispensed_at
              ? formatDistanceToNow(new Date(item.dispensed_at), { addSuffix: true })
              : ""}
          </p>
        </div>
        <CheckCircle2
          className="w-5 h-5 flex-shrink-0"
          style={{ color: "var(--green-700)" }}
        />
      </div>
    );
  }

  return (
    <div
      onClick={allDispensed ? undefined : onToggle}
      style={{
        borderRadius: "var(--r-sm)",
        border: `1.5px solid ${selected ? "var(--brand)" : "var(--hc-border)"}`,
        background: selected ? "var(--brand-tint)" : "var(--surface-card)",
        overflow: "hidden",
        cursor: allDispensed ? "default" : "pointer",
        transition: "all var(--dur-fast) var(--ease-standard)",
      }}
    >
      <div className="flex items-center" style={{ gap: 12, padding: 14 }}>
        {/* Checkbox */}
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 20,
            height: 20,
            borderRadius: "var(--r-xs)",
            border: `2px solid ${selected ? "var(--brand)" : "var(--ink-300)"}`,
            background: selected ? "var(--brand)" : "var(--surface-card)",
            transition: "all var(--dur-fast) var(--ease-standard)",
          }}
        >
          {selected && (
            <svg viewBox="0 0 10 8" className="w-2.5 h-2">
              <path
                d="M1 4l2.5 2.5L9 1"
                stroke="var(--on-brand)"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>

        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 38,
            height: 38,
            borderRadius: "var(--r-xs)",
            background: selected ? "var(--green-100)" : "var(--surface-sunken)",
            fontSize: 17,
          }}
        >
          {icon}
        </span>

        <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
          <p
            className="truncate"
            style={{
              margin: 0,
              font: "700 13.5px/1.2 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {item.medication_name}
            {item.strength && (
              <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>
                {" "}
                {item.strength}
              </span>
            )}
          </p>
          <p
            className="truncate"
            style={{
              margin: 0,
              font: "400 12px/1 var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            {item.dose} · {FREQUENCY_LABEL[item.frequency] ?? item.frequency} ·{" "}
            {ROUTE_LABEL[item.route] ?? item.route}
          </p>
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: 8 }}>
          <div className="text-right flex flex-col" style={{ gap: 3 }}>
            <span
              style={{
                font: "700 17px/1 var(--font-sans)",
                letterSpacing: "var(--ls-tight)",
                color: "var(--text-primary)",
              }}
            >
              {item.quantity}
            </span>
            <span
              style={{ font: "400 11px/1 var(--font-sans)", color: "var(--text-muted)" }}
            >
              units
            </span>
          </div>
          <button
            onClick={(e) => {
              // The row itself toggles selection, so the chevron must not.
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="inline-flex items-center justify-center"
            style={{
              width: 26,
              height: 26,
              border: "none",
              borderRadius: "var(--r-xs)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            padding: "14px",
            borderTop: "1px solid var(--border-faint)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Dosage form", value: item.dosage_form },
            { label: "Duration", value: item.duration },
            { label: "Generic name", value: item.generic_name || "—" },
            { label: "Refills", value: item.refills_allowed ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col" style={{ gap: 4 }}>
              <SectionLabel>{label}</SectionLabel>
              <span
                style={{
                  font: "500 13px/1.3 var(--font-sans)",
                  color: "var(--text-primary)",
                  textTransform: "capitalize",
                }}
              >
                {String(value)}
              </span>
            </div>
          ))}
          {item.instructions && (
            <div
              className="flex flex-col"
              style={{ gap: 4, gridColumn: "1 / -1" }}
            >
              <SectionLabel>Instructions</SectionLabel>
              <span
                style={{
                  font: "400 13px/1.5 var(--font-sans)",
                  color: "var(--text-secondary)",
                  fontStyle: "italic",
                }}
              >
                “{item.instructions}”
              </span>
            </div>
          )}
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
        // Pre-select all undispensed items — dispensing everything is the
        // common case, so deselecting is the exception the pharmacist makes.
        setSelected(
          new Set(itemList.filter((i: any) => !i.is_dispensed).map((i: any) => i.id)),
        );
      })
      .catch(() => setPrescription(null))
      .finally(() => setLoading(false));
  }, [prescriptionId]);

  useLiveRefresh(async () => {
    const res = await visitApi.getPrescriptionDetail(prescriptionId);
    const itemList = res.data.data?.items ?? [];
    setPrescription(res.data.data?.prescription ?? null);
    setItems(itemList);
    // Preserve the pharmacist's choices and notes; only remove items already
    // dispensed by a colleague since this screen was opened.
    setSelected(previous => new Set([...previous].filter(id =>
      itemList.some((item: any) => item.id === id && !item.is_dispensed))));
  }, !!prescriptionId && !loading);

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
      // Let the toast land before navigating away.
      setTimeout(() => router.push("/dashboard/pharmacy/queue"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to dispense. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: 256, gap: 12 }}
      >
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--brand)" }} />
        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading prescription…
        </p>
      </div>
    );
  }

  if (!prescription) {
    return (
      <Page maxWidth={520}>
        <Card>
          <div
            className="flex flex-col items-center text-center"
            style={{ padding: 48, gap: 12 }}
          >
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--r-sm)",
                background: "var(--surface-sunken)",
                color: "var(--text-muted)",
              }}
            >
              <Pill className="w-6 h-6" />
            </span>
            <p
              style={{
                margin: 0,
                font: "600 14px/1 var(--font-sans)",
                color: "var(--text-primary)",
              }}
            >
              Prescription not found
            </p>
            <LinkAction
              arrow={false}
              onClick={() => router.push("/dashboard/pharmacy/queue")}
            >
              Back to queue
            </LinkAction>
          </div>
        </Card>
      </Page>
    );
  }

  const pendingItems = items.filter((i) => !i.is_dispensed);
  const dispensedItems = items.filter((i) => i.is_dispensed);
  const allDone = pendingItems.length === 0;

  return (
    <Page maxWidth={820}>
      {toast && (
        <Toast
          message={toast.message}
          icon={toast.type === "success" ? CheckCircle2 : AlertTriangle}
          tone={toast.type === "success" ? "success" : "critical"}
        />
      )}

      <Button
        variant="ghost"
        icon={ChevronLeft}
        onClick={() => router.push("/dashboard/pharmacy/queue")}
        style={{ alignSelf: "flex-start" }}
      >
        Back to queue
      </Button>

      {/* Prescription header */}
      <Card style={{ borderTop: "3px solid var(--brand)" }}>
        <div style={{ padding: 20 }}>
          <div className="flex items-start" style={{ gap: 16 }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 52,
                height: 52,
                borderRadius: "var(--r-md)",
                background: "var(--brand-tint)",
                color: "var(--green-700)",
              }}
            >
              <Package className="w-6 h-6" />
            </span>

            <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 7 }}>
              <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                <h1
                  style={{
                    margin: 0,
                    font: "700 20px/1.2 var(--font-mono)",
                    color: "var(--text-primary)",
                  }}
                >
                  {prescription.prescription_number}
                </h1>
                {allDone ? (
                  <Badge tone="success" icon={CheckCircle2}>
                    Fully dispensed
                  </Badge>
                ) : (
                  <Badge tone="urgent">
                    {pendingItems.length} item{pendingItems.length !== 1 ? "s" : ""}{" "}
                    pending
                  </Badge>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  font: "400 13px/1 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                {prescription.visit_number}
              </p>
              <p style={{ margin: '8px 0 0', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, overflowWrap: 'anywhere' }}>
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>Patient: </span>
                {prescription.patient_name || 'Patient name unavailable'}
              </p>
            </div>
          </div>

          {/* Meta strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 16,
              marginTop: 20,
              paddingTop: 20,
              borderTop: "1px solid var(--border-faint)",
            }}
          >
            <MetaCell
              icon={Clock}
              label="Prescribed"
              value={formatDistanceToNow(new Date(prescription.prescribed_at), {
                addSuffix: true,
              })}
            />
            <MetaCell icon={Pill} label="Total items" value={items.length} />
            <MetaCell icon={ShieldCheck} label="Status" value={prescription.status} />
          </div>

          {prescription.chief_complaint && (
            <div style={{ marginTop: 16 }}>
              <Banner tone="info" icon={ClipboardList} title="Chief complaint">
                {prescription.chief_complaint}
              </Banner>
            </div>
          )}
        </div>
      </Card>

      {/* Medication items */}
      <Card>
        <CardHeader
          icon={Pill}
          title={`Medications (${items.length})`}
          subtitle={allDone ? "All dispensed" : "Select what you are dispensing now"}
          right={
            pendingItems.length > 0 ? (
              <LinkAction arrow={false} onClick={toggleAll}>
                {selected.size === pendingItems.length ? "Deselect all" : "Select all"}
              </LinkAction>
            ) : undefined
          }
        />

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Pending first — they are what the pharmacist is here to act on. */}
          {pendingItems.map((item) => (
            <MedCard
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              onToggle={() => toggleItem(item.id)}
              allDispensed={allDone}
            />
          ))}

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
      </Card>

      {/* Dispensing notes + submit */}
      {!allDone && (
        <Card>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Dispensing notes" hint="Optional — recorded against the dispense.">
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Patient counselled on dosage. Generic substitution made for…"
                style={{ minHeight: 68 }}
              />
            </Field>

            {error && (
              <Banner tone="critical" icon={AlertTriangle}>
                {error}
              </Banner>
            )}

            {selected.size > 0 && (
              <Banner tone="success" icon={CheckCircle2}>
                {selected.size} item{selected.size > 1 ? "s" : ""} selected for dispensing.
              </Banner>
            )}

            <div
              className="flex items-center justify-between"
              style={{
                gap: 12,
                paddingTop: 16,
                borderTop: "1px solid var(--border-faint)",
              }}
            >
              <Button onClick={() => router.push("/dashboard/pharmacy/queue")}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={Package}
                loading={submitting}
                disabled={selected.size === 0}
                onClick={handleDispense}
              >
                {submitting
                  ? "Dispensing…"
                  : `Dispense ${selected.size} item${selected.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {allDone && (
        <Card>
          <div
            className="flex flex-col items-center text-center"
            style={{ padding: 40, gap: 14 }}
          >
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: "var(--r-md)",
                background: "var(--brand-tint)",
                color: "var(--green-700)",
              }}
            >
              <CheckCircle2 className="w-7 h-7" />
            </span>
            <p
              style={{
                margin: 0,
                font: "700 18px/1.2 var(--font-sans)",
                letterSpacing: "var(--ls-tight)",
                color: "var(--text-primary)",
              }}
            >
              All items dispensed
            </p>
            <p
              style={{
                margin: 0,
                maxWidth: 360,
                font: "400 13.5px/1.5 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              This prescription has been fully dispensed and recorded on the blockchain.
            </p>
            <Button
              variant="primary"
              style={{ marginTop: 4 }}
              onClick={() => router.push("/dashboard/pharmacy/queue")}
            >
              Back to queue
            </Button>
          </div>
        </Card>
      )}
    </Page>
  );
}
