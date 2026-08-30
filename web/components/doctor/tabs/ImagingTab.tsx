// ── ImagingTab.tsx ────────────────────────────────────────────────────────────
import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { TextArea } from "../shared/TextArea";
import { SelectField } from "../shared/SelectField";
import { StaffDropdown } from "../shared/StaffDropdown";
import { SubmitBtn } from "../shared/SubmitBtn";
import { useState, useEffect } from "react";
import { practitionersApi, visitApi } from "@/lib/api";
import { safeFormatDate, safeDistanceToNow } from "../utils/dateHelpers";
import {
  Scan,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Radio,
  ExternalLink,
} from "lucide-react";
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
  type Tone,
} from "@/components/dashboard/ui";
import { getModality } from "@/app/dashboard/radiology/vocab";

/* ==========================================================================
   Imaging tab.

   Orders an imaging study and reads back the radiologist's report.

   Reports are fetched lazily — expanding a card triggers the load — but an
   order may already carry an embedded `report`, in which case it is seeded
   into state up front and no request is made. `undefined` means "not fetched
   yet"; `null` means "fetched, and there is no report".
   ========================================================================== */

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

/* Keys mirror imagingModalityEnum in backend/src/db/schema.ts. */
const MODALITIES = [
  "x-ray",
  "ct_scan",
  "mri",
  "ultrasound",
  "pet_scan",
  "mammogram",
  "fluoroscopy",
] as const;

const STATUS_STYLE: Record<string, { tone: Tone; icon: React.ElementType }> = {
  ordered: { tone: "urgent", icon: Clock },
  scheduled: { tone: "info", icon: Clock },
  in_progress: { tone: "info", icon: Clock },
  pending: { tone: "info", icon: Clock },
  completed: { tone: "success", icon: CheckCircle2 },
  reported: { tone: "success", icon: CheckCircle2 },
  cancelled: { tone: "neutral", icon: AlertCircle },
};
const getStatusStyle = (s: string) =>
  STATUS_STYLE[s] ?? { tone: "neutral" as Tone, icon: Clock };

// ── Imaging order card ────────────────────────────────────────────────────────
function ImagingOrderCard({
  order,
  onOpen,
  report,
  isLoading,
}: {
  order: any;
  onOpen: () => void;
  report: any;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const m = getModality(order.modality);
  const mTone = TONES[m.tone];
  const sc = getStatusStyle(order.status);
  const StatusIcon = sc.icon;
  const hasReport = report != null;

  const handleToggle = () => {
    // Only fetch on the opening edge — collapsing must not re-request.
    if (!open) onOpen();
    setOpen((v) => !v);
  };

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
            background: mTone.tint,
            color: mTone.ink,
          }}
        >
          <Radio className="w-4 h-4" />
        </span>

        <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
          <span
            className="truncate"
            style={{
              font: "700 13.5px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {m.label}
            {order.bodyPart ? ` — ${order.bodyPart}` : ""}
          </span>
          <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
            <MonoTag style={{ height: 17, fontSize: 10 }}>
              {order.orderNumber}
            </MonoTag>
            {order.assignedToName && (
              <span
                style={{
                  font: "400 11.5px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                }}
              >
                {order.assignedToName}
              </span>
            )}
          </span>
        </span>

        <span className="flex items-center flex-shrink-0" style={{ gap: 9 }}>
          <span className="hidden sm:inline-flex">
            <Badge tone={sc.tone} icon={StatusIcon}>
              {order.status?.replace(/_/g, " ")}
            </Badge>
          </span>
          {open ? (
            <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
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
            gap: 16,
          }}
        >
          <div className="flex flex-col" style={{ gap: 5 }}>
            <SectionLabel>Clinical indication</SectionLabel>
            <p
              style={{
                margin: 0,
                font: "400 13px/1.6 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              {order.indication}
            </p>
          </div>

          {isLoading ? (
            <span
              className="inline-flex items-center"
              style={{
                gap: 8,
                font: "400 13px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading report…
            </span>
          ) : hasReport ? (
            <div
              style={{
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--violet-100)",
                background: "var(--accent-tint)",
                overflow: "hidden",
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{
                  gap: 10,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--violet-100)",
                }}
              >
                <span className="inline-flex items-center" style={{ gap: 8 }}>
                  <FileText
                    className="w-4 h-4"
                    style={{ color: "var(--accent-ink)" }}
                  />
                  <span
                    style={{
                      font: "700 11px/1 var(--font-sans)",
                      letterSpacing: "var(--ls-caps)",
                      textTransform: "uppercase",
                      color: "var(--accent-ink)",
                    }}
                  >
                    Radiology report
                  </span>
                </span>
                {report.reportedAt && (
                  <span
                    style={{
                      font: "400 11px/1 var(--font-mono)",
                      color: "var(--accent-ink)",
                      opacity: 0.75,
                    }}
                  >
                    {safeFormatDate(report.reportedAt, "dd MMM yyyy")}
                  </span>
                )}
              </div>

              <div
                style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}
              >
                {report.findings && (
                  <div className="flex flex-col" style={{ gap: 5 }}>
                    <SectionLabel style={{ color: "var(--accent-ink)" }}>
                      Findings
                    </SectionLabel>
                    <p
                      style={{
                        margin: 0,
                        font: "400 13px/1.6 var(--font-sans)",
                        color: "var(--text-primary)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {report.findings}
                    </p>
                  </div>
                )}

                {/* The impression is the conclusion — it gets its own surface. */}
                {report.impression && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: "var(--r-xs)",
                      background: "var(--surface-card)",
                      border: "1px solid var(--violet-100)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                    }}
                  >
                    <SectionLabel style={{ color: "var(--accent-ink)" }}>
                      Impression
                    </SectionLabel>
                    <p
                      style={{
                        margin: 0,
                        font: "600 13.5px/1.5 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {report.impression}
                    </p>
                  </div>
                )}

                {report.recommendations && (
                  <div className="flex flex-col" style={{ gap: 5 }}>
                    <SectionLabel style={{ color: "var(--accent-ink)" }}>
                      Recommendations
                    </SectionLabel>
                    <p
                      style={{
                        margin: 0,
                        font: "400 13px/1.6 var(--font-sans)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {report.recommendations}
                    </p>
                  </div>
                )}

                {report.imageUrls?.length > 0 && (
                  <div className="flex flex-col" style={{ gap: 8 }}>
                    <SectionLabel style={{ color: "var(--accent-ink)" }}>
                      Images ({report.imageUrls.length})
                    </SectionLabel>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                        gap: 8,
                      }}
                    >
                      {report.imageUrls.map((url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block"
                          style={{
                            borderRadius: "var(--r-xs)",
                            border: "1px solid var(--violet-100)",
                            overflow: "hidden",
                          }}
                        >
                          <img
                            src={url}
                            alt={`Image ${i + 1}`}
                            style={{
                              width: "100%",
                              height: 108,
                              objectFit: "cover",
                              background: "var(--surface-sunken)",
                              display: "block",
                            }}
                          />
                          <span
                            className="absolute inline-flex items-center justify-center"
                            style={{
                              right: 6,
                              bottom: 6,
                              width: 22,
                              height: 22,
                              borderRadius: "var(--r-xs)",
                              background: "var(--scrim)",
                              color: "var(--white)",
                            }}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : order.status === "reported" ? (
            <Banner tone="neutral" icon={AlertCircle}>
              Report data unavailable.
            </Banner>
          ) : (
            <Banner tone="urgent" icon={Clock}>
              Awaiting radiologist report.
            </Banner>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ImagingTab ───────────────────────────────────────────────────────────
export function ImagingTab({
  visitId,
  imagingOrders,
  onSaved,
  onError,
  isCompleted,
}: {
  visitId: string;
  imagingOrders: any[];
  onSaved: () => void;
  onError: (m: string) => void;
  isCompleted: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [radiologists, setRadiologists] = useState<StaffMember[]>([]);
  const [radiosLoading, setRadiosLoading] = useState(true);
  const [form, setForm] = useState({
    modality: "x-ray",
    bodyPart: "",
    indication: "",
    urgency: "routine",
    assignedTo: "",
  });
  const [reports, setReports] = useState<Record<string, any>>({});
  const [loadingReports, setLoadingReports] = useState<Record<string, boolean>>({});

  useEffect(() => {
    practitionersApi
      .getOnlineStaff("radiologist")
      .then((res) => setRadiologists(res.data.data?.staff ?? []))
      .catch(() => setRadiologists([]))
      .finally(() => setRadiosLoading(false));
  }, []);

  // Seed any report already embedded in the order props, so expanding those
  // cards costs nothing. `null` is a real value here — "no report yet".
  useEffect(() => {
    const preloaded: Record<string, any> = {};
    for (const order of imagingOrders) {
      if (order.report !== undefined) {
        preloaded[order.id] = order.report;
      }
    }
    if (Object.keys(preloaded).length > 0) {
      setReports((prev) => ({ ...preloaded, ...prev }));
    }
  }, [imagingOrders]);

  const f = (field: keyof typeof form) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const fetchReport = async (orderId: string) => {
    if (reports[orderId] !== undefined || loadingReports[orderId]) return;
    setLoadingReports((p) => ({ ...p, [orderId]: true }));
    try {
      const res = await visitApi.getImagingReport(orderId);
      setReports((p) => ({
        ...p,
        [orderId]: res.data.success ? res.data.data : null,
      }));
    } catch {
      setReports((p) => ({ ...p, [orderId]: null }));
    } finally {
      setLoadingReports((p) => ({ ...p, [orderId]: false }));
    }
  };

  const handleSubmit = async () => {
    if (!form.bodyPart.trim() || !form.indication.trim()) {
      onError("Body part and indication are required.");
      return;
    }
    if (!form.assignedTo) {
      onError("Please assign a radiologist.");
      return;
    }
    setSubmitting(true);
    try {
      await visitApi.orderImaging(visitId, form);
      setForm({
        modality: "x-ray",
        bodyPart: "",
        indication: "",
        urgency: "routine",
        assignedTo: "",
      });
      setShowForm(false);
      onSaved();
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Failed to order imaging.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRadio = radiologists.find((r) => r.id === form.assignedTo);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {imagingOrders.length > 0 && (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <SectionLabel>Imaging orders ({imagingOrders.length})</SectionLabel>
          {imagingOrders.map((order: any) => (
            <ImagingOrderCard
              key={order.id}
              order={order}
              onOpen={() => fetchReport(order.id)}
              report={reports[order.id]}
              isLoading={!!loadingReports[order.id]}
            />
          ))}
        </div>
      )}

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
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent-ink)";
              e.currentTarget.style.background = "var(--violet-050)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--hc-border)";
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <PlusCircle className="w-4 h-4" />
            Order imaging study
          </button>
        ) : (
          <Card>
            <CardHeader
              icon={Scan}
              title="Order imaging study"
              subtitle="Select modality and assign a radiologist"
              tone="accent"
              right={
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              }
            />

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Seven modalities — shown as chips rather than a dropdown so
                  the choice is one tap. */}
              <div className="flex flex-col" style={{ gap: 8 }}>
                <SectionLabel>Modality *</SectionLabel>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                    gap: 8,
                  }}
                >
                  {MODALITIES.map((mKey) => {
                    const cfg = getModality(mKey);
                    const t = TONES[cfg.tone];
                    const selected = form.modality === mKey;
                    return (
                      <button
                        key={mKey}
                        onClick={() => f("modality")(mKey)}
                        style={{
                          height: 38,
                          padding: "0 10px",
                          borderRadius: "var(--r-sm)",
                          border: `1px solid ${selected ? t.ink : "var(--hc-border)"}`,
                          background: selected ? t.tint : "var(--surface-sunken)",
                          color: selected ? t.ink : "var(--text-secondary)",
                          font: `${selected ? 700 : 500} 12px/1 var(--font-sans)`,
                          cursor: "pointer",
                          transition: "all var(--dur-fast) var(--ease-standard)",
                        }}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 14,
                }}
              >
                <FieldGroup label="Body part *">
                  <InputField
                    value={form.bodyPart}
                    onChange={f("bodyPart")}
                    placeholder="e.g. Chest"
                  />
                </FieldGroup>
                <FieldGroup label="Urgency">
                  <SelectField
                    value={form.urgency}
                    onChange={f("urgency")}
                    options={[
                      { value: "routine", label: "Routine" },
                      { value: "urgent", label: "Urgent" },
                      { value: "emergency", label: "Emergency" },
                      { value: "critical", label: "Critical" },
                    ]}
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Clinical indication *">
                <TextArea
                  value={form.indication}
                  onChange={f("indication")}
                  placeholder="Clinical history and reason for imaging…"
                  rows={3}
                />
              </FieldGroup>

              <FieldGroup label="Assign radiologist *">
                <StaffDropdown
                  value={form.assignedTo}
                  onChange={f("assignedTo")}
                  staff={radiologists}
                  loading={radiosLoading}
                  placeholder="Select a radiologist…"
                />
                {selectedRadio?.lastSeenAt && (
                  <p
                    className="inline-flex items-center"
                    style={{
                      margin: "6px 0 0",
                      gap: 6,
                      font: "500 11.5px/1 var(--font-sans)",
                      color: "var(--green-800)",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--green-600)",
                      }}
                    />
                    Online {safeDistanceToNow(selectedRadio.lastSeenAt)}
                    {selectedRadio.specialization
                      ? ` · ${selectedRadio.specialization}`
                      : ""}
                  </p>
                )}
              </FieldGroup>

              <div
                className="flex justify-end"
                style={{ paddingTop: 14, borderTop: "1px solid var(--border-faint)" }}
              >
                <SubmitBtn
                  onClick={handleSubmit}
                  loading={submitting}
                  label="Submit imaging order"
                />
              </div>
            </div>
          </Card>
        ))}

      {imagingOrders.length === 0 && isCompleted && (
        <div
          style={{
            borderRadius: "var(--r-md)",
            border: "1.5px dashed var(--hc-border)",
            background: "var(--surface-sunken)",
          }}
        >
          <EmptyState
            icon={Scan}
            title="No imaging orders"
            message="No imaging was ordered during this visit."
            tone="neutral"
            pad={32}
          />
        </div>
      )}
    </div>
  );
}
