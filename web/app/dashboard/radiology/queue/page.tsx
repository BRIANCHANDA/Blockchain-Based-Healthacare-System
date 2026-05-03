"use client";
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

const URGENCY_CONFIG = {
  critical: { label: "Critical", color: "#B91C1C", bg: "#FEE2E2" },
  emergency: { label: "Emergency", color: "#B45309", bg: "#FDE68A" },
  urgent: { label: "Urgent", color: "#C2410B", bg: "#FED7AA" },
  routine: { label: "Routine", color: "#065F46", bg: "#DCFCE7" },
} as const;

const STATUS_CONFIG = {
  ordered: { label: "Ordered", color: "#047857", bg: "#D1FAE5" },
  in_progress: { label: "In Progress", color: "#0F766E", bg: "#CCFBF1" },
  completed: { label: "Completed", color: "#134E4A", bg: "#D1FAE5" },
  reported: { label: "Reported", color: "#1D4ED8", bg: "#DBEAFE" },
  cancelled: { label: "Cancelled", color: "#B91C1C", bg: "#FEE2E2" },
} as const;

const MODALITY_CONFIG = {
  CT: { label: "CT", color: "#1D4ED8", bg: "#DBEAFE" },
  MRI: { label: "MRI", color: "#7C3AED", bg: "#EDE9FE" },
  XRAY: { label: "X-Ray", color: "#0F172A", bg: "#E2E8F0" },
  US: { label: "Ultrasound", color: "#047857", bg: "#DCFCE7" },
  PET: { label: "PET", color: "#BE185D", bg: "#FCE7F3" },
} as const;

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
  isOpen,
  onClose,
  patientId,
  visitId,
  patientName,
  onSuccess,
}: {
  isOpen: boolean;
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

  // Poll for request status once we have a requestId
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
    }, 3000); // poll every 3 seconds
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Shield size={20} className="text-purple-700" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Access Required</h2>
        </div>
        <p className="text-gray-600 text-sm mb-2">
          You do not have blockchain permission to report imaging for{" "}
          <span className="font-semibold">{patientName}</span>.
        </p>
        <p className="text-gray-500 text-xs mb-4">
          The patient must grant you access before you can submit a report.
        </p>

        {!requestId ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for access
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              placeholder="e.g., I need to review the MRI and provide a report for your ongoing treatment."
            />
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-purple-700 text-white font-medium hover:bg-purple-800 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                Request Access
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <Mail size={22} className="text-amber-700" />
            </div>
            <p className="font-semibold text-gray-900">Request sent</p>
            <p className="text-sm text-gray-500 mt-1">
              The patient has been notified. Once they approve, you will be
              automatically redirected to the report page.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              Waiting for approval...
            </div>
            {status === "rejected" && (
              <p className="text-red-500 text-xs mt-3">
                Request was rejected. You can try again.
              </p>
            )}
            {status === "expired" && (
              <p className="text-red-500 text-xs mt-3">
                Request expired. Please submit a new request.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Radiology Queue Page
// ─────────────────────────────────────────────────────────────────────────────
export default function RadiologyQueuePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "critical" | "emergency" | "urgent" | "routine"
  >("all");
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

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 60_000);
    return () => clearInterval(interval);
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
      const permRes = await fetch(
        `/api/visits/${order.visit_id}/my-permission`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      const permData = await permRes.json();
      const hasPermission = permData.success && permData.data.hasPermission;

      if (hasPermission) {
        // Redirect directly to report page
        router.push(`/dashboard/radiology/queue/${order.id}`);
      } else {
        // Show request access modal
        setPatientInfo({ id: patientId, name: patientName });
        setModalOpen(true);
      }
    } catch (err) {
      console.error("Permission check failed", err);
      // Fallback: try to go to report page anyway (will likely 403)
      router.push(`/dashboard/radiology/queue/${order.id}`);
    } finally {
      setCheckingPermission(false);
    }
  };

  const handleAccessGranted = () => {
    setModalOpen(false);
    // Permission now exists, redirect to the report page
    if (selectedOrder) {
      router.push(`/dashboard/radiology/queue/${selectedOrder.id}`);
    }
  };

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 size={28} className="animate-spin text-green-700" />
        <p className="text-sm text-gray-400">Loading worklist…</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="max-w-4xl mx-auto space-y-5"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-gray-900"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Radiology Worklist
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {orders.length} pending stud{orders.length !== 1 ? "ies" : "y"} ·
              auto-refreshes every 60s
            </p>
          </div>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        </div>

        {/* Critical banner */}
        {criticalCount > 0 && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
            <TriangleAlert size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-800">
              {criticalCount} critical/emergency stud
              {criticalCount > 1 ? "ies" : "y"} — report immediately
            </p>
          </div>
        )}

        {/* Search + filters (unchanged) */}
        <div className="space-y-3">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by modality, body part, visit number, indication…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none
                focus:border-green-500 focus:ring-2 focus:ring-green-500/10 placeholder:text-gray-400"
            />
          </div>

          {/* Urgency filter */}
          <div className="flex gap-2 flex-wrap">
            {(
              ["all", "critical", "emergency", "urgent", "routine"] as const
            ).map((f) => {
              const cfg = f === "all" ? null : URGENCY_CONFIG[f];
              const count =
                f === "all"
                  ? orders.length
                  : orders.filter((o) => o.urgency === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={
                    filter === f
                      ? { background: cfg?.color ?? "#374151", color: "#fff" }
                      : {
                          background: cfg?.bg ?? "#F3F4F6",
                          color: cfg?.color ?? "#374151",
                        }
                  }
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {/* Modality filter */}
          {modalities.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setModalityFilter("all")}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={
                  modalityFilter === "all"
                    ? { background: "#374151", color: "#fff" }
                    : { background: "#F3F4F6", color: "#374151" }
                }
              >
                All Modalities
              </button>
              {modalities.map((m) => {
                const cfg = MODALITY_CONFIG[m] ?? {
                  label: m,
                  color: "#374151",
                  bg: "#F3F4F6",
                };
                return (
                  <button
                    key={m}
                    onClick={() => setModalityFilter(m)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={
                      modalityFilter === m
                        ? { background: cfg.color, color: "#fff" }
                        : { background: cfg.bg, color: cfg.color }
                    }
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Orders list */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <p className="text-gray-700 font-semibold">No studies found</p>
            <p className="text-gray-400 text-sm mt-1">
              {search
                ? "Try a different search term"
                : "All studies have been reported"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const urgency =
                URGENCY_CONFIG[order.urgency] ?? URGENCY_CONFIG.routine;
              const status =
                STATUS_CONFIG[order.status] ?? STATUS_CONFIG.ordered;
              const modality = MODALITY_CONFIG[order.modality] ?? {
                label: order.modality,
                color: "#374151",
                bg: "#F3F4F6",
              };
              return (
                <button
                  key={order.id}
                  onClick={() => handleOrderClick(order)}
                  disabled={
                    checkingPermission && selectedOrder?.id === order.id
                  }
                  className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all text-left group"
                  style={{ borderLeft: `4px solid ${urgency.color}` }}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Modality icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: modality.bg }}
                    >
                      <Scan size={22} style={{ color: modality.color }} />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-gray-900">
                          {modality.label} — {order.body_part}
                        </p>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: urgency.bg,
                            color: urgency.color,
                          }}
                        >
                          {urgency.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        {order.visit_number} · {order.order_number}
                      </p>
                      {order.patientName && (
                        <p className="text-xs text-gray-600 font-medium">
                          👤 {order.patientName}
                        </p>
                      )}
                      {order.indication && (
                        <p className="text-xs text-gray-400 italic truncate">
                          "{order.indication}"
                        </p>
                      )}
                    </div>
                    {/* Right */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: status.bg,
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={11} />
                        {safeDateDistance(order.ordered_at)}
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-gray-600 transition-colors"
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Permission Request Modal */}
      {modalOpen && selectedOrder && (
        <RequestAccessModal
          isOpen={modalOpen}
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
