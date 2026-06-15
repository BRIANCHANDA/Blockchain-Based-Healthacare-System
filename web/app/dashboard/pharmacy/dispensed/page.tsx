"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { visitApi } from "@/lib/api";
import {
  Package,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  Clock,
  Pill,
  ChevronRight,
  Calendar,
  History,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

function normalize(p: any) {
  return {
    id: p.id ?? p.prescription_id,
    prescriptionNumber: p.prescriptionNumber ?? p.prescription_number ?? "—",
    visitNumber: p.visitNumber ?? p.visit_number ?? "—",
    patientName: p.patientName ?? p.patient_name ?? "Unknown Patient",
    itemCount: p.itemCount ?? p.item_count ?? 0,
    dispensedAt: p.dispensedAt ?? p.dispensed_at ?? null,
    dispensedBy: p.dispensedBy ?? p.dispensed_by_name ?? null,
    status: p.status ?? "dispensed",
  };
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse border-b border-gray-50">
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 bg-gray-100 rounded" />
        <div className="h-3 w-56 bg-gray-100 rounded" />
      </div>
      <div className="w-20 h-6 bg-gray-100 rounded-full" />
    </div>
  );
}

export default function PharmacyDispensedPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await (visitApi as any).getDispensedPrescriptions();
      const raw: any[] = res.data.data?.prescriptions ?? res.data.data ?? [];
      const normalized = raw
        .map(normalize)
        .sort(
          (a, b) =>
            new Date(b.dispensedAt ?? 0).getTime() -
            new Date(a.dispensedAt ?? 0).getTime(),
        );
      setItems(normalized);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      [p.patientName, p.prescriptionNumber, p.visitNumber].some((f) =>
        f?.toLowerCase().includes(q),
      )
    );
  });

  // Group by date
  const grouped = filtered.reduce((acc: Record<string, any[]>, p) => {
    const key = p.dispensedAt
      ? format(new Date(p.dispensedAt), "dd MMM yyyy")
      : "Unknown date";
    (acc[key] = acc[key] ?? []).push(p);
    return acc;
  }, {});

  const todayCount = items.filter(
    (p) =>
      p.dispensedAt &&
      format(new Date(p.dispensedAt), "yyyy-MM-dd") ===
        format(new Date(), "yyyy-MM-dd"),
  ).length;

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display',serif" }}
          >
            Dispense History
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading
              ? "Loading…"
              : `${items.length} dispensed · ${todayCount} today`}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          {
            label: "Total Dispensed",
            value: items.length,
            color: "#166534",
            bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
            border: "#bbf7d0",
            icon: Package,
          },
          {
            label: "Dispensed Today",
            value: todayCount,
            color: "#1d4ed8",
            bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
            border: "#bfdbfe",
            icon: CheckCircle2,
          },
        ].map(({ label, value, color, bg, border, icon: Icon }) => (
          <div
            key={label}
            className="relative rounded-2xl border overflow-hidden p-4"
            style={{ background: bg, borderColor: border }}
          >
            <div
              className="absolute -right-2 -bottom-2 w-14 h-14 rounded-full opacity-10"
              style={{ background: color }}
            />
            <Icon className="w-4 h-4 mb-2" style={{ color }} />
            <p
              className="text-2xl font-extrabold leading-none"
              style={{ color }}
            >
              {loading ? (
                <span
                  className="inline-block w-6 h-6 rounded animate-pulse"
                  style={{ background: `${color}20` }}
                />
              ) : (
                value
              )}
            </p>
            <p
              className="text-xs font-semibold mt-1"
              style={{ color, opacity: 0.65 }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient, prescription, visit…"
          className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <History className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-500">
            {items.length === 0
              ? "No dispensed prescriptions yet"
              : "No results match your search"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {items.length === 0
              ? "Dispensed prescriptions will appear here"
              : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, group]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {date}
                </p>
                <span className="text-xs text-gray-300">· {group.length}</span>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {group.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      router.push(`/dashboard/pharmacy/queue/${p.id}`)
                    }
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0 group"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-50">
                      <Package className="w-4.5 h-4.5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">
                          {p.patientName}
                        </p>
                        <span className="font-mono text-xs text-gray-400">
                          {p.prescriptionNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Pill className="w-3 h-3" /> {p.itemCount} item
                          {p.itemCount !== 1 ? "s" : ""}
                        </span>
                        {p.dispensedAt && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{" "}
                            {formatDistanceToNow(new Date(p.dispensedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Dispensed
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-green-600 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
