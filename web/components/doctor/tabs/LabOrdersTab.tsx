// ── LabOrdersTab.tsx ──────────────────────────────────────────────────────────
import { visitApi, practitionersApi } from "@/lib/api";
import {
  FlaskConical,
  ChevronDown as ChevronDownLab,
  ChevronUp as ChevronUpLab,
  AlertCircle as AlertCircleLab,
  CheckCircle2 as CheckCircle2Lab,
  PlusCircle as PlusCircleLab,
  Trash2,
  Zap,
  Clock,
  Stethoscope,
} from "lucide-react";
import { useState, useEffect } from "react";
import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { SelectField } from "../shared/SelectField";
import StaffDropdown from "../shared/StaffDropdown";
import { SubmitBtn } from "../shared/SubmitBtn";
import { safeFormatDate } from "../utils/dateHelpers";
import {
  Card,
  CardHeader,
  Pill as Badge,
  MonoTag,
  Button,
  Banner,
  EmptyState,
  SectionLabel,
  hoverRow,
  TONES,
} from "@/components/dashboard/ui";
import { getPriority } from "@/app/dashboard/doctor/vocab";

/* ==========================================================================
   Lab orders tab.

   Several tests are usually ordered together, so the form builds a list of
   rows rather than one test at a time — quick-add chips fill the first empty
   row, or append a new one.

   While a visit is open this polls getLabResults every 5s: results come back
   from the lab asynchronously and a doctor should not have to reload to see
   them.
   ========================================================================== */

const COMMON_TESTS = [
  { name: "Full Blood Count", code: "FBC", specimen: "blood" },
  { name: "Urea & Electrolytes", code: "UE", specimen: "blood" },
  { name: "Liver Function", code: "LFT", specimen: "blood" },
  { name: "Troponin I", code: "TROP-I", specimen: "blood" },
  { name: "Blood Glucose", code: "BGL", specimen: "blood" },
  { name: "HbA1c", code: "HBA1C", specimen: "blood" },
  { name: "Malaria RDT", code: "MAL-RDT", specimen: "blood" },
  { name: "Lipid Profile", code: "LIPID", specimen: "blood" },
  { name: "Urinalysis", code: "UA", specimen: "urine" },
  { name: "Blood Culture", code: "BC", specimen: "blood" },
];

const SPECIMEN_TYPES = [
  "blood",
  "urine",
  "stool",
  "sputum",
  "csf",
  "tissue",
  "swab",
  "other",
];

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

const EMPTY_TEST = {
  testName: "",
  testCode: "",
  specimenType: "blood",
  urgency: "routine",
  clinicalNotes: "",
  assignedTo: "",
};

type QuantitativeResult = {
  parameter: string;
  value: string;
  referenceRange?: string;
};

// Results entered in the laboratory form are an array of rows, whereas older
// records are a parameter-to-value object. Normalise both shapes before
// rendering so a row object is never coerced to "[object Object]".
function displayResultValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map(displayResultValue).join(", ");
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key}: ${displayResultValue(item)}`)
    .join(", ");
}

function normaliseQuantitativeResults(
  resultsData: unknown,
  referenceRanges?: Record<string, unknown>,
): QuantitativeResult[] {
  if (Array.isArray(resultsData)) {
    return resultsData.map((row: any, index) => {
      const parameter = displayResultValue(row?.parameter ?? row?.name ?? `Result ${index + 1}`);
      const value = `${displayResultValue(row?.value ?? row?.result ?? row?.reading)}${row?.unit ? ` ${displayResultValue(row.unit)}` : ""}`;
      return {
        parameter,
        value,
        referenceRange: displayResultValue(row?.referenceRange ?? referenceRanges?.[parameter]),
      };
    });
  }

  if (resultsData && typeof resultsData === "object") {
    return Object.entries(resultsData as Record<string, unknown>).map(([parameter, value]) => ({
      parameter,
      value: displayResultValue(value),
      referenceRange: displayResultValue(referenceRanges?.[parameter]),
    }));
  }

  return [];
}

// ── Lab order card ────────────────────────────────────────────────────────────
function LabOrderCard({ order }: { order: any }) {
  const [open, setOpen] = useState(false);
  const resulted = order.status === "resulted";
  const quantitativeResults = normaliseQuantitativeResults(
    order.result?.resultsData,
    order.result?.referenceRanges,
  );
  /* A resulted test is done regardless of how urgently it was ordered, so
     "resulted" wins over the urgency tone. */
  const tone = resulted ? "success" : getPriority(order.urgency).tone;
  const t = TONES[tone];

  return (
    <div
      style={{
        border: `1px solid ${resulted ? "var(--green-100)" : "var(--hc-border)"}`,
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
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
            background: t.tint,
            color: t.ink,
          }}
        >
          <FlaskConical className="w-4 h-4" />
        </span>

        <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
          <span
            className="truncate"
            style={{
              font: "700 13.5px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {order.testName}
          </span>
          <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
            <MonoTag style={{ height: 17, fontSize: 10 }}>
              {order.orderNumber}
            </MonoTag>
            <span
              style={{
                font: "400 11.5px/1 var(--font-sans)",
                color: "var(--text-muted)",
                textTransform: "capitalize",
              }}
            >
              {order.specimenType}
            </span>
            {order.assignedToName && (
              <>
                <span style={{ color: "var(--text-disabled)" }}>·</span>
                <span
                  style={{
                    font: "400 11.5px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                  }}
                >
                  {order.assignedToName}
                </span>
              </>
            )}
          </span>
        </span>

        <span className="flex items-center flex-shrink-0" style={{ gap: 9 }}>
          <span className="hidden sm:inline-flex">
            <Badge tone={tone} icon={resulted ? CheckCircle2Lab : Clock}>
              {order.status}
            </Badge>
          </span>
          {open ? (
            <ChevronUpLab className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronDownLab className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          )}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: 16,
            borderTop: "1px solid var(--border-faint)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {order.result?.abnormalFindings && (
            <Banner tone="critical" icon={AlertCircleLab} title="Abnormal findings">
              {order.result.abnormalFindings}
            </Banner>
          )}

          {order.result?.interpretation && (
            <Banner tone="info" icon={Stethoscope} title="Interpretation">
              {order.result.interpretation}
            </Banner>
          )}

          {/* Quantitative results, with reference ranges where the lab sent them. */}
          {quantitativeResults.length > 0 && (
              <div
                style={{
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--hc-border)",
                  overflow: "hidden",
                }}
              >
                <SectionLabel
                  style={{
                    padding: "9px 16px",
                    background: "var(--surface-sunken)",
                    borderBottom: "1px solid var(--border-faint)",
                  }}
                >
                  Quantitative results
                </SectionLabel>

                {quantitativeResults.map(({ parameter, value, referenceRange }, index) => (
                  <div
                    key={`${parameter}-${index}`}
                    className="flex items-center justify-between"
                    style={{
                      gap: 12,
                      padding: "10px 16px",
                      borderBottom: "1px solid var(--border-faint)",
                    }}
                  >
                    <span
                      style={{
                        font: "500 13px/1 var(--font-sans)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {parameter}
                    </span>
                    <span className="flex items-center" style={{ gap: 12 }}>
                      <span
                        style={{
                          font: "700 13px/1 var(--font-mono)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {value}
                      </span>
                      {referenceRange && referenceRange !== "—" && (
                        <span
                          style={{
                            font: "400 11px/1 var(--font-mono)",
                            color: "var(--text-muted)",
                          }}
                        >
                          ref {referenceRange}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

          {!order.result && (
            <Banner tone="urgent" icon={Clock}>
              Awaiting lab result.
            </Banner>
          )}

          {order.result?.performedAt && (
            <p
              className="text-right"
              style={{
                margin: 0,
                font: "400 11px/1 var(--font-mono)",
                color: "var(--text-muted)",
              }}
            >
              Resulted {safeFormatDate(order.result.performedAt, "dd MMM yyyy, HH:mm")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main LabOrdersTab ─────────────────────────────────────────────────────────
export function LabOrdersTab({
  visitId,
  labOrders: initialOrders,
  onSaved,
  onError,
  isCompleted,
  readOnly = false,
}: {
  visitId: string;
  labOrders: any[];
  onSaved: () => void;
  onError: (m: string) => void;
  isCompleted: boolean;
  readOnly?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [labTechs, setLabTechs] = useState<StaffMember[]>([]);
  const [techsLoading, setTechsLoading] = useState(true);
  const [liveOrders, setLiveOrders] = useState(initialOrders);
  const [tests, setTests] = useState([{ ...EMPTY_TEST }]);

  useEffect(() => {
    setLiveOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    if (!visitId || isCompleted) return;
    const iv = setInterval(async () => {
      try {
        const res = await visitApi.getLabResults(visitId);
        if (res.data.success) setLiveOrders(res.data.data.labOrders);
      } catch {}
    }, 5000);
    return () => clearInterval(iv);
  }, [visitId, isCompleted]);

  useEffect(() => {
    practitionersApi
      .getOnlineStaff("lab_technician")
      .then((res) => setLabTechs(res.data.data?.staff ?? []))
      .catch(() => setLabTechs([]))
      .finally(() => setTechsLoading(false));
  }, []);

  const addTest = () => setTests((p) => [...p, { ...EMPTY_TEST }]);
  const removeTest = (i: number) =>
    setTests((p) => p.filter((_, idx) => idx !== i));
  const updateTest = (i: number, field: string, value: string) =>
    setTests((p) =>
      p.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)),
    );

  const quickAdd = (test: { name: string; code: string; specimen: string }) => {
    const emptyIdx = tests.findIndex((t) => !t.testName);
    if (emptyIdx >= 0) {
      updateTest(emptyIdx, "testName", test.name);
      updateTest(emptyIdx, "testCode", test.code);
      updateTest(emptyIdx, "specimenType", test.specimen);
    } else {
      setTests((p) => [
        ...p,
        {
          ...EMPTY_TEST,
          testName: test.name,
          testCode: test.code,
          specimenType: test.specimen,
        },
      ]);
    }
  };

  const handleSubmit = async () => {
    const valid = tests.filter((t) => t.testName.trim() && t.testCode.trim());
    if (!valid.length) {
      onError("Add at least one test with name and code.");
      return;
    }
    setSubmitting(true);
    try {
      // An empty selection deliberately becomes an unassigned order. The API
      // publishes those orders to every lab technician at this hospital.
      await visitApi.orderLabs(visitId, {
        tests: valid.map((test) => ({
          ...test,
          assignedTo: test.assignedTo || undefined,
        })),
      });
      setTests([{ ...EMPTY_TEST }]);
      setShowForm(false);
      onSaved();
      const res = await visitApi.getLabResults(visitId);
      if (res.data.success) setLiveOrders(res.data.data.labOrders);
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Failed to order tests.");
    } finally {
      setSubmitting(false);
    }
  };

  const namedCount = tests.filter((t) => t.testName).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {liveOrders.length > 0 && (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <SectionLabel>Lab orders ({liveOrders.length})</SectionLabel>
          {liveOrders.map((order: any) => (
            <LabOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {!isCompleted && !readOnly &&
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
              e.currentTarget.style.borderColor = "var(--amber-500)";
              e.currentTarget.style.color = "var(--urgent-ink)";
              e.currentTarget.style.background = "var(--amber-050)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--hc-border)";
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <PlusCircleLab className="w-4 h-4" />
            Order lab tests
          </button>
        ) : (
          <Card>
            <CardHeader
              icon={FlaskConical}
              title="Order lab tests"
              subtitle="Assign an online technician, or share the order with the hospital laboratory"
              tone="urgent"
              right={
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              }
            />

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Quick add — fills the first empty row, or appends one. */}
              <div className="flex flex-col" style={{ gap: 8 }}>
                <span className="inline-flex items-center" style={{ gap: 7 }}>
                  <Zap className="w-3.5 h-3.5" style={{ color: "var(--amber-500)" }} />
                  <SectionLabel>Quick add</SectionLabel>
                </span>
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {COMMON_TESTS.map((t) => (
                    <button
                      key={t.code}
                      onClick={() => quickAdd(t)}
                      style={{
                        height: 26,
                        padding: "0 11px",
                        borderRadius: "var(--r-pill)",
                        border: "1px solid var(--hc-border)",
                        background: "var(--surface-card)",
                        color: "var(--text-secondary)",
                        font: "600 11.5px/1 var(--font-sans)",
                        cursor: "pointer",
                        transition: "all var(--dur-fast) var(--ease-standard)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--amber-500)";
                        e.currentTarget.style.color = "var(--urgent-ink)";
                        e.currentTarget.style.background = "var(--amber-050)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--hc-border)";
                        e.currentTarget.style.color = "var(--text-secondary)";
                        e.currentTarget.style.background = "var(--surface-card)";
                      }}
                    >
                      + {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test rows */}
              <div className="flex flex-col" style={{ gap: 12 }}>
                {tests.map((test, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 16,
                      borderRadius: "var(--r-sm)",
                      border: "1px solid var(--hc-border)",
                      background: "var(--surface-sunken)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ gap: 10 }}>
                      <SectionLabel>Test {idx + 1}</SectionLabel>
                      {tests.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => removeTest(idx)}
                          style={{ width: 26, color: "var(--critical-ink)" }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: 14,
                      }}
                    >
                      <FieldGroup label="Test name *">
                        <InputField
                          value={test.testName}
                          onChange={(v: string) => updateTest(idx, "testName", v)}
                          placeholder="e.g. Full Blood Count"
                        />
                      </FieldGroup>
                      <FieldGroup label="Test code *">
                        <InputField
                          value={test.testCode}
                          onChange={(v: string) => updateTest(idx, "testCode", v)}
                          placeholder="e.g. FBC"
                        />
                      </FieldGroup>
                      <FieldGroup label="Specimen">
                        <SelectField
                          value={test.specimenType}
                          onChange={(v: string) => updateTest(idx, "specimenType", v)}
                          options={SPECIMEN_TYPES.map((sp) => ({
                            value: sp,
                            label: sp.charAt(0).toUpperCase() + sp.slice(1),
                          }))}
                        />
                      </FieldGroup>
                      <FieldGroup label="Urgency">
                        <SelectField
                          value={test.urgency}
                          onChange={(v: string) => updateTest(idx, "urgency", v)}
                          options={[
                            { value: "routine", label: "Routine" },
                            { value: "urgent", label: "Urgent" },
                            { value: "emergency", label: "Emergency" },
                            { value: "critical", label: "Critical" },
                          ]}
                        />
                      </FieldGroup>
                    </div>

                    <FieldGroup label="Clinical notes">
                      <InputField
                        value={test.clinicalNotes}
                        onChange={(v: string) => updateTest(idx, "clinicalNotes", v)}
                        placeholder="Reason for test"
                      />
                    </FieldGroup>

                    <FieldGroup label="Assign lab technician">
                      <StaffDropdown
                        value={test.assignedTo}
                        onChange={(v) => updateTest(idx, "assignedTo", v)}
                        staff={labTechs}
                        loading={techsLoading}
                        placeholder={labTechs.length ? "Select a technician…" : "No technician online — shared with hospital laboratory"}
                      />
                      {!techsLoading && labTechs.length === 0 && (
                        <p
                          style={{ margin: "6px 0 0", font: "400 12px/1.4 var(--font-sans)", color: "var(--text-muted)" }}
                        >
                          This order will appear in the queue of every laboratory technician at this hospital.
                        </p>
                      )}
                    </FieldGroup>
                  </div>
                ))}
              </div>

              <button
                onClick={addTest}
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
                <PlusCircleLab className="w-4 h-4" />
                Add another test
              </button>

              <div
                className="flex justify-end"
                style={{ paddingTop: 14, borderTop: "1px solid var(--border-faint)" }}
              >
                <SubmitBtn
                  onClick={handleSubmit}
                  loading={submitting}
                  label={`Order ${namedCount || 1} test${namedCount !== 1 ? "s" : ""}`}
                />
              </div>
            </div>
          </Card>
        ))}

      {liveOrders.length === 0 && isCompleted && (
        <div
          style={{
            borderRadius: "var(--r-md)",
            border: "1.5px dashed var(--hc-border)",
            background: "var(--surface-sunken)",
          }}
        >
          <EmptyState
            icon={FlaskConical}
            title="No lab orders"
            message="No tests were ordered during this visit."
            tone="neutral"
            pad={32}
          />
        </div>
      )}
    </div>
  );
}
