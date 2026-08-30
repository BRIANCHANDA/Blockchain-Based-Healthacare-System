"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { patientApi, labApi } from "@/lib/api";
import PatientBanner from "@/components/PatientBanner";
import {
  Scan,
  ArrowLeft,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import {
  Page,
  Card,
  CardHeader,
  Pill as Badge,
  Button,
  Banner,
  EmptyState,
  SectionLabel,
  hoverRow,
  TONES,
} from "@/components/dashboard/ui";
import { getStatus, getModality } from "../../vocab";

/* ==========================================================================
   Patient imaging history (radiology view).

   Two independent loads: the patient record + visit history, and the shared
   clinical-context banner. They fail separately on purpose — a missing
   context banner should not hide the imaging history, and vice versa.
   ========================================================================== */

export default function RadiologyPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Patient context for the shared banner (allergies, conditions, diagnoses)
  const [context, setContext] = useState<any>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pRes, hRes] = await Promise.all([
          patientApi.getById(id),
          patientApi.getHistory(id),
        ]);
        setPatient(pRes.data.data);
        setHistory(hRes.data.data);
      } catch {
        setError("Could not load patient data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Load the clinical context banner (reuses /api/lab/patient-context —
  // the endpoint already permits radiologists)
  useEffect(() => {
    labApi
      .getPatientContext(id)
      .then((res) => setContext(res.data?.data ?? null))
      .catch((err: any) =>
        setCtxError(
          err.response?.data?.error?.message ?? "Failed to load patient details",
        ),
      )
      .finally(() => setCtxLoading(false));
  }, [id]);

  /* History is nested per visit; imaging orders are what this page is about,
     so flatten them out and carry the visit identity onto each one. */
  const allImagingOrders =
    history?.ownVisits?.flatMap((v: any) =>
      (v.imagingOrders ?? []).map((o: any) => ({
        ...o,
        visitNumber: v.visit?.visitNumber,
        visitDate: v.visit?.admissionDate,
      })),
    ) ?? [];

  if (loading)
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 256, gap: 12 }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--brand)" }} />
        <p
          style={{
            margin: 0,
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading patient data…
        </p>
      </div>
    );

  if (error)
    return (
      <Page maxWidth={900}>
        <Button
          variant="ghost"
          icon={ArrowLeft}
          onClick={() => router.back()}
          style={{ alignSelf: "flex-start" }}
        >
          Back to patients
        </Button>
        <Banner tone="critical" icon={AlertCircle}>
          {error}
        </Banner>
      </Page>
    );

  return (
    <Page maxWidth={900}>
      <Button
        variant="ghost"
        icon={ArrowLeft}
        onClick={() => router.back()}
        style={{ alignSelf: "flex-start" }}
      >
        Back to patients
      </Button>

      {/* ── Patient banner — name, age, allergies, conditions, diagnoses ── */}
      <PatientBanner context={context} loading={ctxLoading} error={ctxError} />

      {/* Imaging orders */}
      <Card>
        <CardHeader
          icon={Scan}
          title="Imaging history"
          subtitle="All studies across this patient's visits"
          right={
            <Badge tone="accent">
              {allImagingOrders.length} order
              {allImagingOrders.length !== 1 ? "s" : ""}
            </Badge>
          }
        />

        {allImagingOrders.length === 0 ? (
          <EmptyState
            icon={Scan}
            title="No imaging orders"
            message="This patient has no imaging studies on record."
            tone="neutral"
            pad={64}
          />
        ) : (
          allImagingOrders.map((order: any, i: number) => {
            const key = order.id ?? i.toString();
            const st = getStatus(order.status);
            const stTone = TONES[st.tone];
            const isOpen = expanded === key;

            return (
              <div
                key={key}
                style={{ borderBottom: "1px solid var(--border-faint)" }}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full flex items-center text-left"
                  style={{
                    gap: 14,
                    padding: "14px 20px",
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
                      width: 36,
                      height: 36,
                      borderRadius: "var(--r-sm)",
                      background: stTone.tint,
                      color: stTone.ink,
                    }}
                  >
                    <Scan className="w-4 h-4" />
                  </span>

                  <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                    <span
                      className="truncate"
                      style={{
                        font: "600 13.5px/1 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {order.imagingType ||
                        order.imaging_type ||
                        (order.modality ? getModality(order.modality).label : "") ||
                        "Imaging study"}
                    </span>
                    <span
                      style={{
                        font: "400 11.5px/1 var(--font-mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {order.visitNumber} ·{" "}
                      {order.visitDate
                        ? format(new Date(order.visitDate), "dd MMM yyyy")
                        : "—"}
                    </span>
                  </span>

                  <Badge tone={st.tone}>{st.label}</Badge>

                  {isOpen ? (
                    <ChevronUp
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    />
                  ) : (
                    <ChevronDown
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    />
                  )}
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: "0 20px 16px",
                      background: "var(--surface-sunken)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                        paddingTop: 14,
                        marginBottom: order.report ? 12 : 0,
                      }}
                    >
                      {[
                        {
                          label: "Body part",
                          value: order.bodyPart || order.body_part || "—",
                        },
                        {
                          label: "Modality",
                          value: order.modality
                            ? getModality(order.modality).label
                            : "—",
                        },
                        {
                          label: "Ordered at",
                          value:
                            order.orderedAt || order.ordered_at
                              ? format(
                                  new Date(order.orderedAt || order.ordered_at),
                                  "dd MMM yyyy HH:mm",
                                )
                              : "—",
                        },
                        {
                          label: "Clinical notes",
                          value: order.clinicalNotes || order.clinical_notes || "—",
                        },
                      ].map((f) => (
                        <div
                          key={f.label}
                          style={{
                            padding: 12,
                            borderRadius: "var(--r-sm)",
                            background: "var(--surface-card)",
                            border: "1px solid var(--border-faint)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                          }}
                        >
                          <SectionLabel>{f.label}</SectionLabel>
                          <span
                            style={{
                              font: "500 13px/1.4 var(--font-sans)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {f.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* The report is the payload — it gets its own surface. */}
                    {order.report && (
                      <div
                        style={{
                          padding: 16,
                          borderRadius: "var(--r-sm)",
                          background: "var(--accent-tint)",
                          border: "1px solid var(--violet-100)",
                        }}
                      >
                        <div
                          className="flex items-center"
                          style={{ gap: 8, marginBottom: 12 }}
                        >
                          <FileText
                            className="w-4 h-4"
                            style={{ color: "var(--accent-ink)" }}
                          />
                          <p
                            style={{
                              margin: 0,
                              font: "700 13.5px/1 var(--font-sans)",
                              color: "var(--accent-ink)",
                            }}
                          >
                            Radiology report
                          </p>
                        </div>

                        {order.report.findings && (
                          <div
                            className="flex flex-col"
                            style={{ gap: 5, marginBottom: 10 }}
                          >
                            <SectionLabel style={{ color: "var(--accent-ink)" }}>
                              Findings
                            </SectionLabel>
                            <p
                              style={{
                                margin: 0,
                                font: "400 13px/1.6 var(--font-sans)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {order.report.findings}
                            </p>
                          </div>
                        )}

                        {order.report.impression && (
                          <div
                            className="flex flex-col"
                            style={{ gap: 5, marginBottom: 10 }}
                          >
                            <SectionLabel style={{ color: "var(--accent-ink)" }}>
                              Impression
                            </SectionLabel>
                            <p
                              style={{
                                margin: 0,
                                font: "400 13px/1.6 var(--font-sans)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {order.report.impression}
                            </p>
                          </div>
                        )}

                        {order.report.reportedAt && (
                          <p
                            style={{
                              margin: 0,
                              font: "400 11.5px/1 var(--font-mono)",
                              color: "var(--text-muted)",
                            }}
                          >
                            Reported{" "}
                            {format(
                              new Date(order.report.reportedAt),
                              "dd MMM yyyy HH:mm",
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>
    </Page>
  );
}
