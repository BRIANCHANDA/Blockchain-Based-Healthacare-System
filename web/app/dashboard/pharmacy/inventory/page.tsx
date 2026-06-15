"use client";
import { useEffect, useState, useCallback } from "react";
import { stockApi } from "@/lib/api";
import {
  Package,
  Search,
  X,
  Plus,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  Calendar,
  Pencil,
  Trash2,
  PackagePlus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

const FORM_OPTIONS = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "cream",
  "ointment",
  "drops",
  "inhaler",
  "suppository",
];
const UNIT_OPTIONS = [
  "units",
  "ml",
  "mg",
  "boxes",
  "strips",
  "vials",
  "bottles",
];

const emptyForm = {
  medicationName: "",
  genericName: "",
  strength: "",
  dosageForm: "tablet",
  unit: "units",
  quantity: 0,
  reorderLevel: 10,
  batchNumber: "",
  expiryDate: "",
  supplier: "",
};

function StatCard({ label, value, color, bg, border, icon: Icon }: any) {
  return (
    <div
      className="relative rounded-2xl border overflow-hidden p-4"
      style={{ background: bg, borderColor: border }}
    >
      <div
        className="absolute -right-2 -bottom-2 w-14 h-14 rounded-full opacity-10"
        style={{ background: color }}
      />
      <Icon className="w-4 h-4 mb-2" style={{ color }} />
      <p className="text-2xl font-extrabold leading-none" style={{ color }}>
        {value}
      </p>
      <p
        className="text-xs font-semibold mt-1"
        style={{ color, opacity: 0.65 }}
      >
        {label}
      </p>
    </div>
  );
}

export default function PharmacyInventoryPage() {
  const [stock, setStock] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalItems: 0,
    lowStock: 0,
    outOfStock: 0,
    expiringSoon: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(0);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await stockApi.list({
          search: search.trim() || undefined,
          lowOnly,
        });
        setStock(res.data.data?.stock ?? []);
        setStats(res.data.data?.stats ?? {});
      } catch {
        setStock([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, lowOnly],
  );

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };
  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      medicationName: item.medicationName,
      genericName: item.genericName ?? "",
      strength: item.strength,
      dosageForm: item.dosageForm,
      unit: item.unit,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
      batchNumber: item.batchNumber ?? "",
      expiryDate: item.expiryDate ?? "",
      supplier: item.supplier ?? "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.medicationName.trim() || !form.strength.trim()) {
      setFormError("Medication name and strength are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        reorderLevel: Number(form.reorderLevel),
        expiryDate: form.expiryDate || undefined,
        genericName: form.genericName || undefined,
        batchNumber: form.batchNumber || undefined,
        supplier: form.supplier || undefined,
      };
      if (editing) await stockApi.update(editing.id, payload);
      else await stockApi.add(payload);
      setModalOpen(false);
      load(true);
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this stock item? This cannot be undone.")) return;
    try {
      await stockApi.remove(id);
      load(true);
    } catch {}
  };

  const handleRestock = async (id: string) => {
    if (restockQty <= 0) return;
    try {
      await stockApi.restock(id, { quantity: restockQty });
      setRestockId(null);
      setRestockQty(0);
      load(true);
    } catch {}
  };

  const stockStatus = (item: any) => {
    if (item.quantity === 0)
      return { label: "Out of Stock", color: "#dc2626", bg: "#fef2f2" };
    if (item.quantity <= item.reorderLevel)
      return { label: "Low Stock", color: "#d97706", bg: "#fffbeb" };
    return { label: "In Stock", color: "#16a34a", bg: "#f0fdf4" };
  };

  const isExpiringSoon = (d?: string) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 90;
  };
  const isExpired = (d?: string) =>
    d ? new Date(d).getTime() < Date.now() : false;

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Playfair Display',serif" }}
          >
            Inventory
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? "Loading…" : `${stats.totalItems} medications in stock`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
            style={{ background: "linear-gradient(135deg,#166534,#15803d)" }}
          >
            <Plus className="w-4 h-4" /> Add Medication
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Total Items"
          value={loading ? "—" : stats.totalItems}
          color="#166534"
          bg="linear-gradient(135deg,#f0fdf4,#dcfce7)"
          border="#bbf7d0"
          icon={Package}
        />
        <StatCard
          label="Low Stock"
          value={loading ? "—" : stats.lowStock}
          color="#d97706"
          bg="linear-gradient(135deg,#fffbeb,#fef3c7)"
          border="#fde68a"
          icon={TrendingDown}
        />
        <StatCard
          label="Out of Stock"
          value={loading ? "—" : stats.outOfStock}
          color="#dc2626"
          bg="linear-gradient(135deg,#fef2f2,#fee2e2)"
          border="#fecaca"
          icon={AlertTriangle}
        />
        <StatCard
          label="Expiring Soon"
          value={loading ? "—" : stats.expiringSoon}
          color="#7c3aed"
          bg="linear-gradient(135deg,#faf5ff,#ede9fe)"
          border="#ddd6fe"
          icon={Calendar}
        />
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medication or generic name…"
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
        <button
          onClick={() => setLowOnly((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all"
          style={
            lowOnly
              ? {
                  background: "#fffbeb",
                  borderColor: "#fde68a",
                  color: "#d97706",
                }
              : { background: "#fff", borderColor: "#e5e7eb", color: "#6b7280" }
          }
        >
          <TrendingDown className="w-3.5 h-3.5" /> Low stock only
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {[
                  "Medication",
                  "Stock",
                  "Status",
                  "Batch / Expiry",
                  "Supplier",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 0 ? "pl-5 pr-3" : i === 5 ? "pl-3 pr-5" : "px-3"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {[1, 2, 3, 4, 5, 6].map((j) => (
                      <td key={j} className="py-4 px-4">
                        <div
                          className="h-4 bg-gray-100 rounded animate-pulse"
                          style={{ width: j === 1 ? "70%" : "50%" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : stock.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">
                      {search || lowOnly
                        ? "No medications match"
                        : "No medications in stock yet"}
                    </p>
                    {!search && !lowOnly && (
                      <button
                        onClick={openAdd}
                        className="mt-3 text-sm font-semibold text-green-700 hover:underline"
                      >
                        + Add your first medication
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                stock.map((item) => {
                  const st = stockStatus(item);
                  const expired = isExpired(item.expiryDate);
                  const expSoon = isExpiringSoon(item.expiryDate);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-3">
                        <p className="text-sm font-semibold text-gray-800">
                          {item.medicationName}{" "}
                          <span className="text-gray-400 font-normal">
                            {item.strength}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">
                          {item.dosageForm}
                          {item.genericName ? ` · ${item.genericName}` : ""}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-sm font-bold text-gray-900">
                          {item.quantity}{" "}
                          <span className="text-xs font-normal text-gray-400">
                            {item.unit}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          reorder at {item.reorderLevel}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ background: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {item.batchNumber && (
                          <p className="text-xs font-mono text-gray-600">
                            {item.batchNumber}
                          </p>
                        )}
                        {item.expiryDate ? (
                          <p
                            className={`text-xs ${expired ? "text-red-600 font-semibold" : expSoon ? "text-amber-600 font-semibold" : "text-gray-400"}`}
                          >
                            {expired ? "Expired " : expSoon ? "Expires " : ""}
                            {format(new Date(item.expiryDate), "dd MMM yyyy")}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-300">—</p>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-sm text-gray-500">
                        {item.supplier ?? "—"}
                      </td>
                      <td className="py-3.5 pl-3 pr-5">
                        <div className="flex items-center gap-1 justify-end">
                          {restockId === item.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={restockQty}
                                onChange={(e) =>
                                  setRestockQty(Number(e.target.value))
                                }
                                className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-green-500"
                                placeholder="Qty"
                                autoFocus
                              />
                              <button
                                onClick={() => handleRestock(item.id)}
                                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setRestockId(null);
                                  setRestockQty(0);
                                }}
                                className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setRestockId(item.id);
                                  setRestockQty(0);
                                }}
                                title="Restock"
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                              >
                                <PackagePlus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEdit(item)}
                                title="Edit"
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                title="Delete"
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "'Playfair Display',serif" }}
              >
                {editing ? "Edit Medication" : "Add Medication"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Medication Name *
                  </label>
                  <input
                    value={form.medicationName}
                    onChange={(e) =>
                      setForm({ ...form, medicationName: e.target.value })
                    }
                    placeholder="e.g. Amoxicillin"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Generic Name
                  </label>
                  <input
                    value={form.genericName}
                    onChange={(e) =>
                      setForm({ ...form, genericName: e.target.value })
                    }
                    placeholder="optional"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Strength *
                  </label>
                  <input
                    value={form.strength}
                    onChange={(e) =>
                      setForm({ ...form, strength: e.target.value })
                    }
                    placeholder="e.g. 500mg"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Form
                  </label>
                  <select
                    value={form.dosageForm}
                    onChange={(e) =>
                      setForm({ ...form, dosageForm: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white capitalize"
                  >
                    {FORM_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Unit
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={form.reorderLevel}
                    onChange={(e) =>
                      setForm({ ...form, reorderLevel: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Batch Number
                  </label>
                  <input
                    value={form.batchNumber}
                    onChange={(e) =>
                      setForm({ ...form, batchNumber: e.target.value })
                    }
                    placeholder="optional"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) =>
                      setForm({ ...form, expiryDate: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Supplier
                  </label>
                  <input
                    value={form.supplier}
                    onChange={(e) =>
                      setForm({ ...form, supplier: e.target.value })
                    }
                    placeholder="optional"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:bg-white"
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg,#166534,#15803d)",
                }}
              >
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save Changes"
                    : "Add Medication"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
