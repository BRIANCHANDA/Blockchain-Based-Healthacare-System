"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  Scan,
  Clock,
  ChevronRight,
  TriangleAlert,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Search,
  Shield,
  Mail,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  Field,
  Textarea,
  Button,
  Pill as Badge,
  Banner,
  EmptyState,
  SearchInput,
  SegmentedControl,
  SectionLabel,
  Modal,
  TONES,
} from "@/components/dashboard/ui";
import { getUrgency, getModality, getStatus } from "../vocab";

/* ==========================================================================
   Radiology worklist.

   Opening a study is gated on blockchain permission: handleOrderClick checks
   before navigating, and offers the patient-consent request flow instead of
   letting the report page 403.

   Labels come from ../vocab, which is keyed to the Postgres enums — the maps
   previously declared here used different keys and never matched.
   ========================================================================== */

const safeDateDistance = (date?: string | null) => {
  if (!date) return "unknown";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "unknown";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Permission request modal component
// ─────────────────────────────────────────────────────────────────────────────
function RequestAccessModal({
  onClose,
  patientId,
  visitId,
  patientName,
  onSuccess,
}: {
  onClose: () => void;
  patientId: string;
  visitId: string;
  patientName: string;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "pending" | "approved" | "rejected" | "expired" | null
  >(null);
  const [error, setError] = useState("");

  /*
   * Approval happens on the patient's device, so there is nothing to await —
   * poll until the request resolves, then hand control back to the parent.
   */
  useEffect(() => {
    if (!requestId) return;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/permissions/requests/${requestId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await res.json();
        if (data.success) {
          const newStatus = data.data.status;
          setStatus(newStatus);
          if (newStatus === "approved") {
            clearInterval(pollInterval);
            onSuccess(); // triggers redirect in parent
          } else if (newStatus === "rejected" || newStatus === "expired") {
            clearInterval(pollInterval);
            setError(`Request was ${newStatus}.`);
          }
        }
      } catch (err) {
        console.error("Poll error", err);
      }
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [requestId, onSuccess]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for access.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/permissions/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          patientId,
          visitId,
          reason,
          requestedPermissions: ["imaging_report"],
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Request failed");
      }
      setRequestId(data.data.requestId);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Access required"
      subtitle={patientName}
      icon={Shield}
      tone="accent"
      onClose={onClose}
      footer={
        // Once the request is out, the only action left is to walk away.
        requestId ? (
          <Button full onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button full onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              full
              icon={Shield}
              loading={isSubmitting}
              onClick={handleSubmit}
            >
              Request access
            </Button>
          </>
        )
      }
    >
      {!requestId ? (
        <>
          <p
            style={{
              margin: 0,
              font: "400 13px/1.5 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            You do not have blockchain permission to report imaging for{" "}
            <strong style={{ color: "var(--text-primary)" }}>{patientName}</strong>.
            The patient must grant access before you can submit a report.
          </p>

          <Field label="Reason for access" required>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. I need to review the MRI and provide a report for your ongoing treatment."
            />
          </Field>

          {error && (
            <Banner tone="critical" icon={TriangleAlert}>
              {error}
            </Banner>
          )}
        </>
      ) : (
        <div
          className="flex flex-col items-center text-center"
          style={{ padding: "16px 0", gap: 12 }}
        >
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--r-sm)",
              background: "var(--urgent-tint)",
              color: "var(--urgent-ink)",
            }}
          >
            <Mail className="w-5 h-5" />
          </span>
          <p
            style={{
              margin: 0,
              font: "600 14px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            Request sent
          </p>
          <p
            style={{
              margin: 0,
              maxWidth: 320,
              font: "400 12.5px/1.5 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            The patient has been notified. Once they approve, you will be redirected
            to the report page automatically.
          </p>

          {status === "rejected" || status === "expired" ? (
            <Banner tone="critical" icon={TriangleAlert}>
              {status === "rejected"
                ? "Request was rejected. You can try again."
                : "Request expired. Please submit a new request."}
            </Banner>
          ) : (
            <span
              className="inline-flex items-center"
              style={{
                gap: 7,
                font: "400 11.5px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Waiting for approval…
            </span>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Radiology Queue Page
// ─────────────────────────────────────────────────────────────────────────────
type UrgencyFilter = "all" | "critical" | "emergency" | "urgent" | "routine";

export default function RadiologyQueuePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UrgencyFilter>("all");
  const [modalityFilter, setModalityFilter] = useState("all");

  // Permission request modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [patientInfo, setPatientInfo] = useState<{ id: string; name: string }>({
    id: "",
    name: "",
  });
  const [checkingPermission, setCheckingPermission] = useState(false);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await (visitApi as any).getPendingImagingOrders();
      setOrders(res.data.data?.orders ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useLiveRefresh(() => fetchOrders(true));

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Permission check before redirect ─────────────────────────────────────
  const handleOrderClick = async (order: any) => {
    setSelectedOrder(order);
    setCheckingPermission(true);
    try {
      // First get visit basic info (patient name)
      const visitInfoRes = await fetch(`/api/visits/${order.visit_id}/info`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const visitInfo = await visitInfoRes.json();
      if (!visitInfo.success) throw new Error("Could not fetch visit info");

      const patientId = visitInfo.data.patientId;
      const patientName = visitInfo.data.patientName;

      // Check blockchain permission
      const permRes = await fetch(`/api/visits/${order.visit_id}/my-permission`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const permData = await permRes.json();
      const hasPermission = permData.success && permData.data.hasPermission;

      if (hasPermission) {
        router.push(`/dashboard/radiology/queue/${order.id}`);
      } else {
        setPatientInfo({ id: patientId, name: patientName });
        setModalOpen(true);
      }
    } catch (err) {
      console.error("Permission check failed", err);
      // Fallback: try the report page anyway — it enforces access server-side.
      router.push(`/dashboard/radiology/queue/${order.id}`);
    } finally {
      setCheckingPermission(false);
    }
  };

  const handleAccessGranted = () => {
    setModalOpen(false);
    if (selectedOrder) {
      router.push(`/dashboard/radiology/queue/${selectedOrder.id}`);
    }
  };

  // Only offer modality filters that actually appear in the current worklist.
  const modalities = [...new Set(orders.map((o) => o.modality))];

  const filtered = orders
    .filter((o) => filter === "all" || o.urgency === filter)
    .filter((o) => modalityFilter === "all" || o.modality === modalityFilter)
    .filter(
      (o) =>
        !search ||
        o.body_part?.toLowerCase().includes(search.toLowerCase()) ||
        o.visit_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.modality?.toLowerCase().includes(search.toLowerCase()) ||
        o.indication?.toLowerCase().includes(search.toLowerCase()) ||
        o.order_number?.toLowerCase().includes(search.toLowerCase()),
    );

  const criticalCount = orders.filter(
    (o) => o.urgency === "critical" || o.urgency === "emergency",
  ).length;

  const countFor = (f: UrgencyFilter) =>
    f === "all" ? orders.length : orders.filter((o) => o.urgency === f).length;

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
          Loading worklist…
        </p>
      </div>
    );
  }

  return (
    <>
      <Page maxWidth={1000}>
        <PageHeader
          eyebrow="Radiology"
          title="Worklist"
          subtitle={`${orders.length} pending stud${
            orders.length !== 1 ? "ies" : "y"
          } · auto-refreshes every 60 seconds`}
          actions={
            <Button
              icon={RefreshCw}
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
            >
              Refresh
            </Button>
          }
        />

        {criticalCount > 0 && (
          <Banner tone="critical" icon={TriangleAlert}>
            {criticalCount} critical or emergency stud
            {criticalCount > 1 ? "ies" : "y"} — report immediately.
          </Banner>
        )}

        {/* Search + filters */}
        <div className="flex flex-col" style={{ gap: 12 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search modality, body part, visit number, indication…"
            icon={Search}
            clearIcon={X}
          />

          <SegmentedControl<UrgencyFilter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: countFor("all") },
              { value: "critical", label: "Critical", count: countFor("critical") },
              { value: "emergency", label: "Emergency", count: countFor("emergency") },
              { value: "urgent", label: "Urgent", count: countFor("urgent") },
              { value: "routine", label: "Routine", count: countFor("routine") },
            ]}
          />

          {/* Modality filter — pointless with only one modality in the list. */}
          {modalities.length > 1 && (
            <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
              <SectionLabel style={{ marginRight: 2 }}>Modality</SectionLabel>
              {["all", ...modalities].map((m) => {
                const on = modalityFilter === m;
                const cfg = m === "all" ? null : getModality(m);
                const t = cfg ? TONES[cfg.tone] : null;
                return (
                  <button
                    key={m}
                    onClick={() => setModalityFilter(m)}
                    style={{
                      height: 26,
                      padding: "0 11px",
                      borderRadius: "var(--r-pill)",
                      border: `1px solid ${on ? (t ? t.ink : "var(--brand)") : "var(--hc-border)"}`,
                      background: on
                        ? t
                          ? t.tint
                          : "var(--brand-tint)"
                        : "var(--surface-card)",
                      color: on
                        ? t
                          ? t.ink
                          : "var(--green-700)"
                        : "var(--text-secondary)",
                      font: `${on ? 700 : 500} 11.5px/1 var(--font-sans)`,
                      cursor: "pointer",
                      transition: "all var(--dur-fast) var(--ease-standard)",
                    }}
                  >
                    {m === "all" ? "All" : cfg!.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Orders list */}
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={CheckCircle2}
              title="No studies found"
              message={
                search || filter !== "all" || modalityFilter !== "all"
                  ? "No studies match the current filters."
                  : "All studies have been reported."
              }
              pad={64}
            />
          </Card>
        ) : (
          <div className="flex flex-col" style={{ gap: 12 }}>
            {filtered.map((order) => {
              const urgency = getUrgency(order.urgency);
              const status = getStatus(order.status);
              const modality = getModality(order.modality);
              const uTone = TONES[urgency.tone];
              const mTone = TONES[modality.tone];
              const busy = checkingPermission && selectedOrder?.id === order.id;

              return (
                <button
                  key={order.id}
                  onClick={() => handleOrderClick(order)}
                  disabled={busy}
                  className="w-full text-left"
                  style={{
                    background: "var(--surface-card)",
                    border: "1px solid var(--hc-border)",
                    // The left edge carries urgency at a glance.
                    borderLeft: `4px solid ${uTone.dot}`,
                    borderRadius: "var(--r-md)",
                    boxShadow: "var(--elev-1)",
                    overflow: "hidden",
                    cursor: busy ? "wait" : "pointer",
                    opacity: busy ? 0.6 : 1,
                    transition: "box-shadow var(--dur-base) var(--ease-standard)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.boxShadow = "var(--elev-2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.boxShadow = "var(--elev-1)")
                  }
                >
                  <div className="flex items-center" style={{ gap: 14, padding: 16 }}>
                    <span
                      className="inline-flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--r-sm)",
                        background: mTone.tint,
                        color: mTone.ink,
                      }}
                    >
                      {busy ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Scan className="w-5 h-5" />
                      )}
                    </span>

                    <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
                      <span className="flex items-center flex-wrap" style={{ gap: 8 }}>
                        <span
                          style={{
                            font: "700 13.5px/1 var(--font-sans)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {modality.label}
                          {order.body_part ? ` — ${order.body_part}` : ""}
                        </span>
                        <Badge tone={urgency.tone} style={{ height: 18, fontSize: 10 }}>
                          {urgency.label}
                        </Badge>
                      </span>

                      <span
                        style={{
                          font: "400 11.5px/1 var(--font-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {order.visit_number} · {order.order_number}
                      </span>

                      {order.patientName && (
                        <span
                          className="truncate"
                          style={{
                            font: "500 12.5px/1 var(--font-sans)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {order.patientName}
                        </span>
                      )}

                      {order.indication && (
                        <span
                          className="truncate"
                          style={{
                            font: "400 12px/1.3 var(--font-sans)",
                            color: "var(--text-muted)",
                            fontStyle: "italic",
                          }}
                        >
                          “{order.indication}”
                        </span>
                      )}
                    </span>

                    <span
                      className="flex flex-col items-end flex-shrink-0"
                      style={{ gap: 7 }}
                    >
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span
                        className="inline-flex items-center"
                        style={{
                          gap: 5,
                          font: "500 11.5px/1 var(--font-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <Clock className="w-3 h-3" />
                        {safeDateDistance(order.ordered_at)}
                      </span>
                    </span>

                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "var(--text-disabled)" }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Page>

      {/* Permission Request Modal */}
      {modalOpen && selectedOrder && (
        <RequestAccessModal
          onClose={() => setModalOpen(false)}
          patientId={patientInfo.id}
          visitId={selectedOrder.visit_id}
          patientName={patientInfo.name}
          onSuccess={handleAccessGranted}
        />
      )}
    </>
  );
}
