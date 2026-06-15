// web/src/app/dashboard/admin/blockchain/page.tsx

"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Server,
  Database,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Search,
  TrendingUp,
  Box,
  Link2,
  Users,
  Building2,
  Stethoscope,
  ChevronDown,
  Trash2,
  AlertOctagon,
  Clock,
  WifiOff,
  Lock,
  Copy as CopyIcon,
  Activity,
  History,
  GitCommit,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface NetworkOverview {
  health: {
    status: "healthy" | "degraded" | "down";
    onlinePeers: number;
    totalPeers: number;
    blockHeight: number;
  };
  channel: { name: string; chaincode: string; height: number };
  peers: Array<{
    key: string;
    label: string;
    endpoint: string;
    mspId: string;
    status: "online" | "offline";
    latencyMs: number;
    error: string | null;
  }>;
}
interface Block {
  blockNumber: number;
  sizeBytes: number;
  dataHash: string;
}
interface Transaction {
  id: string;
  userId: string;
  userType: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  blockchainTxId: string;
  ipAddress: string | null;
  createdAt: string;
}
interface Stats {
  patients: number;
  practitioners: number;
  institutions: number;
  anchoredTxs: number;
}
interface SearchableRecord {
  recordId: string;
  recordType: string;
  anchoredAt: string | null;
  txId: string;
}
interface Failure {
  recordId: string;
  recordType: string;
  category: string;
  message: string;
  timestamp: string;
}
interface HistoryEntry {
  txId: string;
  timestamp: string | null;
  isDelete: boolean;
  value: any;
}

const STATUS_COLOR = {
  healthy: {
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#86efac",
    dot: "#16a34a",
    label: "Healthy",
  },
  degraded: {
    bg: "#fffbeb",
    text: "#d97706",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Degraded",
  },
  down: {
    bg: "#fef2f2",
    text: "#dc2626",
    border: "#fca5a5",
    dot: "#ef4444",
    label: "Down",
  },
};

const FAILURE_CONFIG: Record<
  string,
  {
    label: string;
    icon: any;
    color: string;
    bg: string;
    border: string;
    reason: string;
    fix: string;
  }
> = {
  duplicate: {
    label: "Duplicate",
    icon: CopyIcon,
    color: "#9333ea",
    bg: "#faf5ff",
    border: "#e9d5ff",
    reason: "A record with this ID already exists.",
    fix: "Use a unique recordId per event.",
  },
  timeout: {
    label: "Timeout",
    icon: Clock,
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    reason: "Fabric did not respond within 12 seconds.",
    fix: "Retry or check peer load.",
  },
  peer_unreachable: {
    label: "Peer Unreachable",
    icon: WifiOff,
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    reason: "Could not connect to the peer.",
    fix: "Check Fabric network is running.",
  },
  peer_timeout: {
    label: "Peer Timeout",
    icon: Clock,
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    reason: "Peer exceeded gRPC deadline.",
    fix: "Check peer logs.",
  },
  unauthorized: {
    label: "Unauthorized",
    icon: Lock,
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    reason: "MSP not permitted.",
    fix: "Check identity MSP.",
  },
  endorsement_failed: {
    label: "Endorsement Failed",
    icon: AlertOctagon,
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    reason: "Endorsement policy not met.",
    fix: "Check required peers running.",
  },
  unknown: {
    label: "Unknown",
    icon: AlertTriangle,
    color: "#6b7280",
    bg: "#f9fafb",
    border: "#e5e7eb",
    reason: "Unclassified error.",
    fix: "Check backend logs.",
  },
};

function shortHash(h: string, n = 10) {
  if (!h) return "—";
  return h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-6)}` : h;
}

function StatCard({ icon: Icon, label, value, color, bg }: any) {
  return (
    <div
      className="rounded-2xl border px-4 py-4"
      style={{ background: bg, borderColor: `${color}33` }}
    >
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color, opacity: 0.7 }}
        >
          {label}
        </p>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-3xl font-extrabold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HistoryModal — shows the version timeline of a record from the ledger
// ══════════════════════════════════════════════════════════════════════════════
function HistoryModal({
  open,
  onClose,
  loading,
  error,
  data,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: {
    recordId: string;
    totalVersions: number;
    history: HistoryEntry[];
  } | null;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,14,26,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#dcfce7,#bbf7d0)" }}
            >
              <History className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Record Version History
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Every change to this record from the ledger's key history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-green-600" />
              <p className="text-sm text-gray-400">Querying ledger history…</p>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && data && data.history.length === 0 && (
            <div className="p-12 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-700">
                No history found
              </p>
              <p className="text-xs text-gray-400 mt-1">
                This record may not exist on the ledger.
              </p>
            </div>
          )}

          {!loading && !error && data && data.history.length > 0 && (
            <div className="px-6 py-5">
              <div className="flex items-center gap-4 mb-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                    Record ID
                  </p>
                  <p className="text-xs font-mono text-gray-700 break-all">
                    {data.recordId}
                  </p>
                </div>
                <div className="text-center px-3 border-l border-gray-200 flex-shrink-0">
                  <p className="text-2xl font-extrabold text-green-700 tabular-nums">
                    {data.totalVersions}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Versions
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-green-200 via-green-100 to-transparent" />

                {data.history.map((entry, i) => {
                  const isLatest = i === 0;
                  const versionNum = data.history.length - i;
                  return (
                    <div
                      key={entry.txId + i}
                      className="relative pl-10 pb-5 last:pb-0"
                    >
                      <div
                        className="absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2"
                        style={{
                          background: isLatest ? "#16a34a" : "#fff",
                          borderColor: isLatest ? "#16a34a" : "#86efac",
                        }}
                      >
                        {entry.isDelete ? (
                          <XCircle
                            className="w-4 h-4"
                            style={{ color: isLatest ? "#fff" : "#dc2626" }}
                          />
                        ) : (
                          <GitCommit
                            className="w-4 h-4"
                            style={{ color: isLatest ? "#fff" : "#15803d" }}
                          />
                        )}
                      </div>

                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{
                                background: isLatest ? "#dcfce7" : "#f3f4f6",
                                color: isLatest ? "#15803d" : "#6b7280",
                              }}
                            >
                              {isLatest ? "Latest" : `Version ${versionNum}`}
                            </span>
                            {entry.isDelete && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                                Deleted
                              </span>
                            )}
                          </div>
                          {entry.timestamp && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              <span>
                                {format(
                                  new Date(entry.timestamp),
                                  "dd MMM yyyy, HH:mm:ss",
                                )}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="px-4 py-3 space-y-2">
                          {entry.value && typeof entry.value === "object" && (
                            <>
                              {entry.value.recordType && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-20 flex-shrink-0">
                                    Type
                                  </span>
                                  <span className="text-xs text-gray-700">
                                    {entry.value.recordType}
                                  </span>
                                </div>
                              )}
                              {entry.value.creatorMSP && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-20 flex-shrink-0">
                                    By MSP
                                  </span>
                                  <span className="text-xs text-gray-700">
                                    {entry.value.creatorMSP}
                                  </span>
                                </div>
                              )}
                              {entry.value.sha256Hash && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-20 flex-shrink-0">
                                    Hash
                                  </span>
                                  <span className="text-xs font-mono text-gray-600 break-all">
                                    {entry.value.sha256Hash}
                                  </span>
                                </div>
                              )}
                              {entry.value.version && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-20 flex-shrink-0">
                                    Version
                                  </span>
                                  <span className="text-xs text-gray-700 font-mono">
                                    v{entry.value.version}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex items-baseline gap-2 pt-1 border-t border-gray-50">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 w-20 flex-shrink-0">
                              Tx ID
                            </span>
                            <span className="text-[10px] font-mono text-gray-500 break-all">
                              {entry.txId}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 p-3 rounded-xl bg-green-50 border border-green-100 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-green-700 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-800 leading-relaxed">
                  This timeline comes directly from Hyperledger Fabric's
                  built-in key history. Every entry is signed by the original
                  writer's MSP and cannot be modified retroactively.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BlockchainDashboard() {
  const [overview, setOverview] = useState<NetworkOverview | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [failureStats, setFailureStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<
    "overview" | "blocks" | "transactions" | "verify" | "failures"
  >("overview");

  const [searchableRecords, setSearchableRecords] = useState<
    SearchableRecord[]
  >([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("");
  const [verifyRecordId, setVerifyRecordId] = useState("");
  const [verifyHash, setVerifyHash] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  // History modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [failureFilter, setFailureFilter] = useState<string>("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [ovRes, blkRes, txRes, stRes, failRes] = await Promise.all([
        api.get("/api/admin/blockchain/overview"),
        api.get("/api/admin/blockchain/blocks?limit=15"),
        api.get("/api/admin/blockchain/transactions?limit=50"),
        api.get("/api/admin/blockchain/stats"),
        api.get("/api/admin/blockchain/failures"),
      ]);
      setOverview(ovRes.data?.data ?? null);
      setBlocks(blkRes.data?.data?.blocks ?? []);
      setTxs(txRes.data?.data?.transactions ?? []);
      setStats(stRes.data?.data ?? null);
      setFailures(failRes.data?.data?.failures ?? []);
      setFailureStats(failRes.data?.data?.byCategory ?? {});
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to load blockchain data",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadSearchableRecords = useCallback(async (type: string = "") => {
    setLoadingRecords(true);
    try {
      const url = type
        ? `/api/admin/blockchain/searchable-records?type=${type}&limit=100`
        : `/api/admin/blockchain/searchable-records?limit=100`;
      const res = await api.get(url);
      setSearchableRecords(res.data?.data?.records ?? []);
    } catch {
      setSearchableRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  const clearFailures = async () => {
    if (!confirm("Clear all failure log entries?")) return;
    try {
      await api.delete("/api/admin/blockchain/failures");
      setFailures([]);
      setFailureStats({});
    } catch (err: any) {
      alert(err.response?.data?.error?.message ?? "Failed to clear log");
    }
  };

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (tab === "verify") loadSearchableRecords(recordTypeFilter);
  }, [tab, recordTypeFilter, loadSearchableRecords]);
  useEffect(() => {
    const iv = setInterval(() => load(true), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleVerify = async (id?: string) => {
    const targetId = (id ?? verifyRecordId).trim();
    if (!targetId) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.post("/api/admin/blockchain/verify", {
        recordId: targetId,
        sha256Hash: verifyHash.trim() || undefined,
      });
      setVerifyResult(res.data?.data);
    } catch (err: any) {
      setVerifyResult({
        error: err.response?.data?.error?.message ?? "Verification failed",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleViewHistory = async () => {
    const targetId = verifyRecordId.trim();
    if (!targetId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryData(null);
    setHistoryOpen(true);
    try {
      const res = await api.get(
        `/api/admin/blockchain/history/${encodeURIComponent(targetId)}`,
      );
      setHistoryData(res.data?.data ?? null);
    } catch (err: any) {
      setHistoryError(
        err.response?.data?.error?.message ?? "Failed to load history",
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const pickRecord = (r: SearchableRecord) => {
    setVerifyRecordId(r.recordId);
    setVerifyHash("");
    setVerifyResult(null);
  };

  const health = overview?.health.status ?? "down";
  const healthCfg = STATUS_COLOR[health];
  const recordTypes = Array.from(
    new Set(searchableRecords.map((r) => r.recordType)),
  ).sort();
  const filteredFailures = failureFilter
    ? failures.filter((f) => f.category === failureFilter)
    : failures;
  const totalFailures = failures.length;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Blockchain Network
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Hyperledger Fabric · {overview?.channel.name ?? "channel"} ·{" "}
            {overview?.channel.chaincode ?? "chaincode"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {overview && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{
                background: healthCfg.bg,
                borderColor: healthCfg.border,
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: healthCfg.dot }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: healthCfg.dot }}
                />
              </span>
              <span
                className="text-xs font-bold"
                style={{ color: healthCfg.text }}
              >
                Network {healthCfg.label}
              </span>
            </div>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-white disabled:opacity-40"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon={Box}
          label="Block Height"
          value={
            loading ? "…" : (overview?.health.blockHeight ?? 0).toLocaleString()
          }
          color="#166534"
          bg="linear-gradient(135deg,#f0fdf4,#dcfce7)"
        />
        <StatCard
          icon={Link2}
          label="On-Chain Txs"
          value={loading ? "…" : (stats?.anchoredTxs ?? 0).toLocaleString()}
          color="#1d4ed8"
          bg="linear-gradient(135deg,#eff6ff,#dbeafe)"
        />
        <StatCard
          icon={Server}
          label="Peers Online"
          value={
            loading
              ? "…"
              : `${overview?.health.onlinePeers ?? 0}/${overview?.health.totalPeers ?? 0}`
          }
          color="#7c3aed"
          bg="linear-gradient(135deg,#faf5ff,#ede9fe)"
        />
        <StatCard
          icon={Users}
          label="Active Users"
          value={
            loading
              ? "…"
              : (
                  (stats?.patients ?? 0) + (stats?.practitioners ?? 0)
                ).toLocaleString()
          }
          color="#d97706"
          bg="linear-gradient(135deg,#fffbeb,#fef3c7)"
        />
        <StatCard
          icon={AlertOctagon}
          label="Anchor Failures"
          value={loading ? "…" : totalFailures.toLocaleString()}
          color={totalFailures > 0 ? "#dc2626" : "#6b7280"}
          bg={
            totalFailures > 0
              ? "linear-gradient(135deg,#fef2f2,#fee2e2)"
              : "linear-gradient(135deg,#f9fafb,#f3f4f6)"
          }
        />
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 w-fit">
        {(
          [
            { key: "overview", label: "Network" },
            { key: "blocks", label: "Blocks" },
            { key: "transactions", label: "Transactions" },
            { key: "verify", label: "Verify Record" },
            {
              key: "failures",
              label: `Failures${totalFailures > 0 ? ` (${totalFailures})` : ""}`,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all relative"
            style={
              tab === t.key
                ? {
                    background: "#fff",
                    color:
                      t.key === "failures" && totalFailures > 0
                        ? "#dc2626"
                        : "#166534",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }
                : {
                    color:
                      t.key === "failures" && totalFailures > 0
                        ? "#dc2626"
                        : "#6b7280",
                  }
            }
          >
            {t.label}
            {t.key === "failures" &&
              totalFailures > 0 &&
              tab !== "failures" && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
          </button>
        ))}
      </div>

      {/* Network tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-bold text-gray-700">Peer Status</p>
            </div>
            <div className="divide-y divide-gray-50">
              {loading
                ? [...Array(3)].map((_, i) => (
                    <div key={i} className="px-5 py-4 animate-pulse">
                      <div className="h-3 w-32 bg-gray-100 rounded mb-2" />
                      <div className="h-2 w-56 bg-gray-100 rounded" />
                    </div>
                  ))
                : overview?.peers.map((p) => {
                    const isOnline = p.status === "online";
                    return (
                      <div key={p.key} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{
                                background: isOnline ? "#16a34a" : "#ef4444",
                              }}
                            />
                            <p className="text-sm font-bold text-gray-800">
                              {p.label}
                            </p>
                          </div>
                          <span className="text-xs font-mono text-gray-400">
                            {isOnline ? `${p.latencyMs}ms` : "offline"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-mono">
                          {p.endpoint}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          MSP: {p.mspId}
                        </p>
                        {p.error && (
                          <p
                            className="text-[10px] text-red-500 mt-1 truncate"
                            title={p.error}
                          >
                            ⚠ {p.error}
                          </p>
                        )}
                      </div>
                    );
                  })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-bold text-gray-700">Channel</p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                    Name
                  </p>
                  <p className="text-sm font-mono font-semibold text-gray-800">
                    {overview?.channel.name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                    Chaincode
                  </p>
                  <p className="text-sm font-mono font-semibold text-gray-800">
                    {overview?.channel.chaincode ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                    Current Height
                  </p>
                  <p className="text-2xl font-extrabold text-green-700 tabular-nums">
                    {overview?.channel.height.toLocaleString() ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-bold text-gray-700">System</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <Users className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-extrabold text-gray-800">
                    {stats?.patients ?? 0}
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold">
                    Patients
                  </p>
                </div>
                <div className="text-center">
                  <Stethoscope className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-extrabold text-gray-800">
                    {stats?.practitioners ?? 0}
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold">
                    Staff
                  </p>
                </div>
                <div className="text-center">
                  <Building2 className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-extrabold text-gray-800">
                    {stats?.institutions ?? 0}
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold">
                    Hospitals
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocks tab */}
      {tab === "blocks" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-bold text-gray-700">Recent Blocks</p>
            </div>
            <span className="text-xs text-gray-400">
              Latest {blocks.length} blocks
            </span>
          </div>
          {loading ? (
            <div className="p-5 text-sm text-gray-400">Loading blocks…</div>
          ) : blocks.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              No blocks queryable.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">
                    Block #
                  </th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">
                    Data Hash
                  </th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">
                    Size
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {blocks.map((b) => (
                  <tr key={b.blockNumber} className="hover:bg-gray-50/40">
                    <td className="px-5 py-3 font-mono font-bold text-gray-800">
                      #{b.blockNumber}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">
                      {shortHash(b.dataHash, 16)}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500">
                      {(b.sizeBytes / 1024).toFixed(2)} KB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Transactions tab */}
      {tab === "transactions" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-bold text-gray-700">
                On-Chain Transactions
              </p>
            </div>
            <span className="text-xs text-gray-400">Last {txs.length}</span>
          </div>
          {loading ? (
            <div className="p-5 text-sm text-gray-400">Loading…</div>
          ) : txs.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              No anchored transactions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/60">
                  <tr>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">
                      Time
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">
                      Action
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">
                      Resource
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">
                      Actor
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 px-5 py-3">
                      Tx ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {txs.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/40">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-xs font-semibold text-gray-700">
                          {format(new Date(t.createdAt), "HH:mm:ss")}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {formatDistanceToNow(new Date(t.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full capitalize"
                          style={{ background: "#eff6ff", color: "#1d4ed8" }}
                        >
                          {t.actionType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600 font-mono">
                        {t.resourceType}
                        <p className="text-[10px] text-gray-400 truncate max-w-[160px]">
                          {t.resourceId}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 capitalize">
                        {t.userType}
                      </td>
                      <td className="px-5 py-3 font-mono text-[10px] text-gray-400">
                        {shortHash(t.blockchainTxId, 8)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Verify tab */}
      {tab === "verify" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  Anchored Records
                </p>
                <div className="relative">
                  <select
                    value={recordTypeFilter}
                    onChange={(e) => setRecordTypeFilter(e.target.value)}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-green-500"
                  >
                    <option value="">All types</option>
                    {recordTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {loadingRecords ? (
                  <div className="p-5 text-sm text-gray-400 text-center">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />{" "}
                    Loading…
                  </div>
                ) : searchableRecords.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">
                    No records anchored yet.
                  </div>
                ) : (
                  searchableRecords.map((r) => (
                    <button
                      key={r.recordId + r.txId}
                      onClick={() => pickRecord(r)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-green-50/40 transition-colors ${verifyRecordId === r.recordId ? "bg-green-50" : ""}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ background: "#dbeafe", color: "#1d4ed8" }}
                        >
                          {r.recordType}
                        </span>
                        {r.anchoredAt && (
                          <span className="text-[10px] text-gray-400">
                            {formatDistanceToNow(new Date(r.anchoredAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-gray-700 break-all leading-tight">
                        {r.recordId}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <h2 className="text-base font-bold text-gray-800">
                Verify Record Integrity
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Click a record on the left to verify it. Records are identified by
              their UUID — not by national ID or visit number.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  Record ID *
                </label>
                <input
                  value={verifyRecordId}
                  onChange={(e) => setVerifyRecordId(e.target.value)}
                  placeholder="Click a record on the left, or paste a UUID"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono text-gray-900 outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  SHA-256 Hash{" "}
                  <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  value={verifyHash}
                  onChange={(e) => setVerifyHash(e.target.value)}
                  placeholder="64-char hex hash"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono text-gray-900 outline-none focus:border-green-500"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleVerify()}
                  disabled={verifying || !verifyRecordId.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg,#166534,#15803d)",
                  }}
                >
                  {verifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {verifying ? "Verifying…" : "Verify on Ledger"}
                </button>
                {verifyResult?.found && (
                  <button
                    onClick={handleViewHistory}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <History className="w-4 h-4" />
                    View History
                  </button>
                )}
              </div>

              {verifyResult && (
                <div
                  className="mt-4 rounded-xl border overflow-hidden"
                  style={{
                    borderColor: verifyResult.error
                      ? "#fecaca"
                      : !verifyResult.found
                        ? "#fde68a"
                        : verifyResult.matches === false
                          ? "#fecaca"
                          : "#bbf7d0",
                  }}
                >
                  <div
                    className="px-4 py-3 border-b"
                    style={{
                      background: verifyResult.error
                        ? "#fef2f2"
                        : !verifyResult.found
                          ? "#fffbeb"
                          : verifyResult.matches === false
                            ? "#fef2f2"
                            : "#f0fdf4",
                      borderColor: "transparent",
                    }}
                  >
                    {verifyResult.error ? (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <p className="text-sm font-bold text-red-800">
                          Error: {verifyResult.error}
                        </p>
                      </div>
                    ) : !verifyResult.found ? (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <p className="text-sm font-bold text-amber-800">
                          Record not found on ledger
                        </p>
                      </div>
                    ) : verifyResult.matches === false ? (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <p className="text-sm font-bold text-red-800">
                          Hash mismatch — record may be tampered
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <p className="text-sm font-bold text-green-800">
                          {verifyResult.matches === true
                            ? "Record verified — hash matches"
                            : "Record found on ledger"}
                        </p>
                      </div>
                    )}
                  </div>
                  {verifyResult.record && (
                    <div className="px-4 py-3 bg-white space-y-2 text-xs font-mono">
                      <div>
                        <span className="text-gray-400">Patient ID: </span>
                        <span className="text-gray-700">
                          {verifyResult.record.patientId}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Type: </span>
                        <span className="text-gray-700">
                          {verifyResult.record.recordType}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Created: </span>
                        <span className="text-gray-700">
                          {verifyResult.record.timestamp}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">By MSP: </span>
                        <span className="text-gray-700">
                          {verifyResult.record.creatorMSP}
                        </span>
                      </div>
                      {verifyResult.record.version && (
                        <div>
                          <span className="text-gray-400">Version: </span>
                          <span className="text-gray-700">
                            v{verifyResult.record.version}
                          </span>
                        </div>
                      )}
                      <div className="break-all">
                        <span className="text-gray-400">On-chain hash: </span>
                        <span className="text-gray-700">
                          {verifyResult.record.sha256Hash}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Failures tab */}
      {tab === "failures" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Anchor Failures
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Records that failed to be written to the ledger, with the
                reason.
              </p>
            </div>
            {failures.length > 0 && (
              <button
                onClick={clearFailures}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Log
              </button>
            )}
          </div>

          {Object.keys(failureStats).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => setFailureFilter("")}
                className="px-3 py-2.5 rounded-xl border text-left transition-all"
                style={
                  !failureFilter
                    ? {
                        background: "#0a0e1a",
                        borderColor: "#0a0e1a",
                        color: "#fff",
                      }
                    : {
                        background: "#fff",
                        borderColor: "#e5e7eb",
                        color: "#374151",
                      }
                }
              >
                <p className="text-xs font-bold">All</p>
                <p className="text-lg font-extrabold mt-0.5">{totalFailures}</p>
              </button>
              {Object.entries(failureStats).map(([cat, count]) => {
                const cfg = FAILURE_CONFIG[cat] ?? FAILURE_CONFIG.unknown;
                const Icon = cfg.icon;
                const isSelected = failureFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFailureFilter(cat)}
                    className="px-3 py-2.5 rounded-xl border text-left transition-all"
                    style={
                      isSelected
                        ? {
                            background: cfg.color,
                            borderColor: cfg.color,
                            color: "#fff",
                          }
                        : {
                            background: cfg.bg,
                            borderColor: cfg.border,
                            color: cfg.color,
                          }
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3" />
                      <p className="text-[10px] font-bold uppercase tracking-wide">
                        {cfg.label}
                      </p>
                    </div>
                    <p className="text-lg font-extrabold mt-0.5">{count}</p>
                  </button>
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {failures.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-500">
                  No failures — all writes successful
                </p>
              </div>
            ) : filteredFailures.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">
                No failures matching this filter.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredFailures.map((f, i) => {
                  const cfg =
                    FAILURE_CONFIG[f.category] ?? FAILURE_CONFIG.unknown;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{
                                background: cfg.bg,
                                color: cfg.color,
                                border: `1px solid ${cfg.border}`,
                              }}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              {f.recordType}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatDistanceToNow(new Date(f.timestamp), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-gray-700 break-all mb-1.5">
                            {f.recordId}
                          </p>
                          <p className="text-xs text-gray-600 mb-1.5">
                            <span className="font-semibold text-gray-800">
                              Why:{" "}
                            </span>
                            {cfg.reason}
                          </p>
                          <p className="text-xs text-gray-600 mb-2">
                            <span className="font-semibold text-gray-800">
                              Fix:{" "}
                            </span>
                            {cfg.fix}
                          </p>
                          <details className="cursor-pointer">
                            <summary className="text-[10px] text-gray-400 hover:text-gray-600 select-none">
                              Show raw error
                            </summary>
                            <p className="mt-1.5 text-[10px] font-mono text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 break-all">
                              {f.message}
                            </p>
                          </details>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <HistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        loading={historyLoading}
        error={historyError}
        data={historyData}
      />
    </div>
  );
}
