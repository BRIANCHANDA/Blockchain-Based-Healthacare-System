"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useEffect, useState, useCallback, useRef } from "react";
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
import {
  Page,
  PageHeader,
  Card,
  KpiCard,
  KpiGrid,
  Field,
  Input,
  Select,
  Button,
  Pill as Badge,
  Banner,
  EmptyState,
  SkeletonRow,
  SearchInput,
  SectionLabel,
  Modal,
  hoverRow,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Pharmacy inventory.

   Filtering happens server-side (stockApi.list takes search + lowOnly), so
   the stats returned alongside the rows describe the WHOLE stock, not the
   filtered view — which is what the KPI row wants.
   ========================================================================== */

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
const UNIT_OPTIONS = ["units", "ml", "mg", "boxes", "strips", "vials", "bottles"];

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

/* Shared column template for the header row and every body row. */
const GRID = "minmax(200px, 2.2fr) 110px 110px 140px 120px 108px";

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Search is server-side, so debounce it — otherwise every keystroke fires
   * its own request against stockApi.list.
   */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await stockApi.list({
          search: debouncedSearch.trim() || undefined,
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
    [debouncedSearch, lowOnly],
  );

  useLiveRefresh(() => load(true));

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
        // Empty strings would be stored as empty, not absent.
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

  /* Out of stock outranks low stock; both outrank healthy. */
  const stockStatus = (item: any): { tone: Tone; label: string } => {
    if (item.quantity === 0) return { tone: "critical", label: "Out of stock" };
    if (item.quantity <= item.reorderLevel)
      return { tone: "urgent", label: "Low stock" };
    return { tone: "success", label: "In stock" };
  };

  const isExpiringSoon = (d?: string) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 90;
  };
  const isExpired = (d?: string) =>
    d ? new Date(d).getTime() < Date.now() : false;

  const isFiltered = !!search || lowOnly;

  return (
    <Page maxWidth={1200}>
      <PageHeader
        eyebrow="Pharmacy"
        title="Inventory"
        subtitle={
          loading ? "Loading…" : `${stats.totalItems ?? 0} medications in stock`
        }
        actions={
          <>
            <Button variant="primary" icon={Plus} onClick={openAdd}>
              Add medication
            </Button>
            <Button
              icon={RefreshCw}
              onClick={() => load(true)}
              disabled={refreshing || loading}
              style={{ padding: 0, width: 38 }}
            />
          </>
        }
      />

      <KpiGrid>
        <KpiCard
          label="Total items"
          value={stats.totalItems ?? 0}
          sub="Distinct medications"
          icon={Package}
          tone="success"
          loading={loading}
        />
        <KpiCard
          label="Low stock"
          value={stats.lowStock ?? 0}
          sub="At or below reorder level"
          icon={TrendingDown}
          tone="urgent"
          loading={loading}
        />
        <KpiCard
          label="Out of stock"
          value={stats.outOfStock ?? 0}
          sub="Zero on hand"
          icon={AlertTriangle}
          tone="critical"
          loading={loading}
        />
        <KpiCard
          label="Expiring soon"
          value={stats.expiringSoon ?? 0}
          sub="Within 90 days"
          icon={Calendar}
          tone="accent"
          loading={loading}
        />
      </KpiGrid>

      {/* Search + filter */}
      <div className="flex items-center flex-wrap" style={{ gap: 12 }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search medication or generic name…"
          icon={Search}
          clearIcon={X}
          style={{ flex: "1 1 240px", maxWidth: 380 }}
        />
        <Button
          icon={TrendingDown}
          onClick={() => setLowOnly((v) => !v)}
          style={
            lowOnly
              ? {
                  background: "var(--urgent-tint)",
                  borderColor: "var(--amber-100)",
                  color: "var(--urgent-ink)",
                }
              : undefined
          }
        >
          Low stock only
        </Button>
      </div>

      {/* Table */}
      <Card>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 860 }}>
            <div
              className="grid items-center"
              style={{
                gridTemplateColumns: GRID,
                gap: 14,
                padding: "9px 20px",
                background: "var(--surface-sunken)",
                borderBottom: "1px solid var(--border-faint)",
              }}
            >
              <SectionLabel>Medication</SectionLabel>
              <SectionLabel>Stock</SectionLabel>
              <SectionLabel>Status</SectionLabel>
              <SectionLabel>Batch / expiry</SectionLabel>
              <SectionLabel>Supplier</SectionLabel>
              <SectionLabel style={{ textAlign: "right" }}>Actions</SectionLabel>
            </div>

            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : stock.length === 0 ? (
              <EmptyState
                icon={Package}
                title={
                  isFiltered ? "No medications match" : "No medications in stock yet"
                }
                message={
                  isFiltered
                    ? "Try a different search, or clear the low-stock filter."
                    : "Add your first medication to start tracking stock."
                }
                tone="neutral"
                pad={64}
                action={
                  isFiltered ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setLowOnly(false);
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>
                      Add medication
                    </Button>
                  )
                }
              />
            ) : (
              stock.map((item) => {
                const st = stockStatus(item);
                const expired = isExpired(item.expiryDate);
                const expSoon = isExpiringSoon(item.expiryDate);

                return (
                  <div
                    key={item.id}
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: GRID,
                      gap: 14,
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--border-faint)",
                      transition: "background var(--dur-fast) var(--ease-standard)",
                    }}
                    {...hoverRow}
                  >
                    <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                      <span
                        className="truncate"
                        style={{
                          font: "600 13.5px/1.2 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.medicationName}{" "}
                        <span
                          style={{ fontWeight: 400, color: "var(--text-secondary)" }}
                        >
                          {item.strength}
                        </span>
                      </span>
                      <span
                        className="truncate"
                        style={{
                          font: "400 11.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                          textTransform: "capitalize",
                        }}
                      >
                        {item.dosageForm}
                        {item.genericName ? ` · ${item.genericName}` : ""}
                      </span>
                    </div>

                    <div className="flex flex-col" style={{ gap: 4 }}>
                      <span
                        style={{
                          font: "700 13.5px/1 var(--font-sans)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.quantity}{" "}
                        <span
                          style={{
                            font: "400 11px/1 var(--font-sans)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {item.unit}
                        </span>
                      </span>
                      <span
                        style={{
                          font: "400 11px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        reorder at {item.reorderLevel}
                      </span>
                    </div>

                    <Badge tone={st.tone} style={{ justifySelf: "start" }}>
                      {st.label}
                    </Badge>

                    <div className="min-w-0 flex flex-col" style={{ gap: 4 }}>
                      {item.batchNumber && (
                        <span
                          className="truncate"
                          style={{
                            font: "500 11.5px/1 var(--font-mono)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {item.batchNumber}
                        </span>
                      )}
                      {item.expiryDate ? (
                        <span
                          style={{
                            font: `${expired || expSoon ? 600 : 400} 11.5px/1 var(--font-sans)`,
                            color: expired
                              ? "var(--critical-ink)"
                              : expSoon
                                ? "var(--urgent-ink)"
                                : "var(--text-muted)",
                          }}
                        >
                          {expired ? "Expired " : expSoon ? "Expires " : ""}
                          {format(new Date(item.expiryDate), "dd MMM yyyy")}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-disabled)" }}>—</span>
                      )}
                    </div>

                    <span
                      className="truncate"
                      style={{
                        font: "400 12.5px/1 var(--font-sans)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {item.supplier ?? "—"}
                    </span>

                    <div className="flex items-center justify-end" style={{ gap: 4 }}>
                      {restockId === item.id ? (
                        /* Inline restock — quantity to ADD, not the new total. */
                        <>
                          <Input
                            type="number"
                            value={restockQty}
                            onChange={(e) => setRestockQty(Number(e.target.value))}
                            placeholder="Qty"
                            autoFocus
                            style={{ width: 60, height: 30, padding: "0 8px", fontSize: 12 }}
                          />
                          <Button
                            size="sm"
                            icon={CheckCircle2}
                            onClick={() => handleRestock(item.id)}
                            style={{
                              width: 30,
                              background: "var(--brand-tint)",
                              borderColor: "var(--green-100)",
                              color: "var(--green-700)",
                            }}
                          />
                          <Button
                            size="sm"
                            icon={X}
                            variant="ghost"
                            onClick={() => {
                              setRestockId(null);
                              setRestockQty(0);
                            }}
                            style={{ width: 26 }}
                          />
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={PackagePlus}
                            onClick={() => {
                              setRestockId(item.id);
                              setRestockQty(0);
                            }}
                            style={{ width: 28 }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Pencil}
                            onClick={() => openEdit(item)}
                            style={{ width: 28 }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => handleDelete(item.id)}
                            style={{ width: 28, color: "var(--critical-ink)" }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {/* Add / edit modal */}
      {modalOpen && (
        <Modal
          title={editing ? "Edit medication" : "Add medication"}
          subtitle={editing ? editing.medicationName : "New stock item"}
          icon={editing ? Pencil : Plus}
          width={560}
          scroll
          closeOnBackdrop
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <Button full onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" full loading={saving} onClick={handleSave}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add medication"}
              </Button>
            </>
          }
        >
          <Field label="Medication name" required>
            <Input
              value={form.medicationName}
              onChange={(e) => setForm({ ...form, medicationName: e.target.value })}
              placeholder="e.g. Amoxicillin"
            />
          </Field>

          <Field label="Generic name" hint="Optional">
            <Input
              value={form.genericName}
              onChange={(e) => setForm({ ...form, genericName: e.target.value })}
            />
          </Field>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 14,
            }}
          >
            <Field label="Strength" required>
              <Input
                value={form.strength}
                onChange={(e) => setForm({ ...form, strength: e.target.value })}
                placeholder="e.g. 500mg"
              />
            </Field>
            <Field label="Form">
              <Select
                value={form.dosageForm}
                onChange={(e) => setForm({ ...form, dosageForm: e.target.value })}
                style={{ textTransform: "capitalize" }}
              >
                {FORM_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity">
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field label="Unit">
              <Select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reorder level" hint="Flags as low stock at or below this.">
              <Input
                type="number"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
              />
            </Field>
            <Field label="Batch number" hint="Optional">
              <Input
                value={form.batchNumber}
                onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
              />
            </Field>
            <Field label="Expiry date" hint="Optional">
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </Field>
            <Field label="Supplier" hint="Optional">
              <Input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </Field>
          </div>

          {formError && (
            <Banner tone="critical" icon={AlertCircle}>
              {formError}
            </Banner>
          )}
        </Modal>
      )}
    </Page>
  );
}
