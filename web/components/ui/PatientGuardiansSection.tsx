"use client";
import { useState, useEffect, useRef } from "react";
import { guardiansApi, patientApi } from "@/lib/api";
import { Baby, Trash2, PlusCircle, Loader2, CheckCircle, X } from "lucide-react";

type Guardian = {
  id: string;
  guardianPatientId: string;
  guardianName: string | null;
  guardianPhone: string | null;
  relationship: string;
  isPrimary: boolean;
  canConsent: boolean;
  endsAt: string | null;
  documentReference: string | null;
};

const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "legal_guardian", label: "Legal Guardian" },
  { value: "grandparent", label: "Grandparent" },
  { value: "other", label: "Other" },
];

type Props = {
  patientId: string;
  canManage: boolean; // receptionist or admin
};

export function PatientGuardiansSection({ patientId, canManage }: Props) {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Add guardian form state
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [relationship, setRelationship] = useState<string>("mother");
  const [isPrimary, setIsPrimary] = useState(false);
  const [docRef, setDocRef] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await guardiansApi.listForPatient(patientId);
      setGuardians((res as any).data?.data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [patientId]);

  // Debounced: typing a name used to fire one /patients/search per keystroke.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const searchGuardian = (q: string) => {
    setSearchQ(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await patientApi.search(q);
        const all: any[] = (res as any)?.data?.data?.patients ?? [];
        // A minor cannot be someone else's guardian.
        setSearchResults(all.filter((p: any) => !p.isMinor).slice(0, 6));
      } catch { } finally { setSearching(false); }
    }, 400);
  };

  const handleAdd = async () => {
    if (!selectedPatient) { setError("Select a guardian patient"); return; }
    setSaving(true); setError("");
    try {
      await guardiansApi.create({
        patientId, guardianPatientId: selectedPatient.id,
        relationship, isPrimary, canConsent: true, documentReference: docRef || undefined,
      });
      setShowModal(false);
      setSelectedPatient(null); setSearchQ(""); setDocRef(""); setIsPrimary(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Failed to add guardian");
    } finally { setSaving(false); }
  };

  const handleRemove = async (linkId: string) => {
    if (!confirm("Remove this guardian link?")) return;
    try { await guardiansApi.remove(linkId); await load(); } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? "Cannot remove guardian");
    }
  };

  const handleMakePrimary = async (linkId: string) => {
    try { await guardiansApi.update(linkId, { isPrimary: true }); await load(); } catch { }
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-4"><Loader2 size={14} className="animate-spin" /> Loading guardians…</div>;

  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--urgent-tint)] bg-[var(--amber-050)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--urgent-ink)] flex items-center gap-2">
          <Baby size={16} /> Guardians
        </h3>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--urgent-ink)] px-3 py-1.5 rounded-[var(--r-xs)] border border-[var(--urgent)] hover:bg-[var(--urgent-tint)]">
            <PlusCircle size={13} /> Add Guardian
          </button>
        )}
      </div>

      {guardians.length === 0 ? (
        <p className="text-sm text-[var(--urgent-ink)] italic">No guardians linked.</p>
      ) : (
        <div className="space-y-2">
          {guardians.map((g) => (
            <div key={g.id} className="flex items-center justify-between bg-[var(--surface-card)] rounded-[var(--r-sm)] border border-[var(--urgent-tint)] px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[var(--text-primary)]">{g.guardianName ?? "Unknown"}</span>
                  {g.isPrimary && <span className="text-[10px] font-bold bg-[var(--urgent-tint)] text-[var(--urgent-ink)] px-2 py-0.5 rounded-full">Primary</span>}
                  {g.canConsent && <span className="text-[10px] font-bold bg-[var(--success-tint)] text-[var(--success-ink)] px-2 py-0.5 rounded-full">Can consent</span>}
                </div>
                <p className="text-xs text-[var(--text-secondary)] capitalize">{g.relationship} · {g.guardianPhone ?? "—"}</p>
                {g.documentReference && <p className="text-xs text-[var(--text-muted)]">Ref: {g.documentReference}</p>}
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  {!g.isPrimary && (
                    <button onClick={() => handleMakePrimary(g.id)} title="Make primary" className="text-[var(--urgent)] hover:text-[var(--urgent-ink)]">
                      <CheckCircle size={16} />
                    </button>
                  )}
                  <button onClick={() => handleRemove(g.id)} title="Remove" className="text-[var(--critical)] hover:text-[var(--critical-ink)]">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Guardian Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--scrim)" }}>
          <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] shadow-[var(--elev-3)] w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[var(--text-primary)]">Add Guardian</h4>
              <button onClick={() => setShowModal(false)}><X size={18} style={{ color: "var(--text-muted)" }} /></button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Search Adult Patient</label>
              <div className="relative">
                <input
                  className="w-full rounded-[var(--r-sm)] border border-[var(--hc-border)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--brand)]"
                  placeholder="Type name or NRC…"
                  value={searchQ}
                  onChange={(e) => searchGuardian(e.target.value)}
                />
                {searching && <Loader2 size={14} className="absolute right-3 top-3 animate-spin text-[var(--text-muted)]" />}
              </div>
              {searchResults.length > 0 && (
                <div className="border border-[var(--hc-border)] rounded-[var(--r-sm)] overflow-hidden mt-1">
                  {searchResults.map((p) => (
                    <button key={p.id} type="button" onClick={() => {
                      // Cancel any in-flight debounce, or a pending keystroke
                      // would repopulate the list right after the pick.
                      if (searchTimer.current) clearTimeout(searchTimer.current);
                      setSearching(false);
                      setSelectedPatient(p); setSearchQ(`${p.firstName} ${p.lastName}`); setSearchResults([]);
                    }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--surface-inset)] border-b border-[var(--border-faint)] last:border-0">
                      <p className="font-semibold text-sm text-[var(--text-primary)]">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{p.nationalId ?? "—"}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedPatient && <p className="text-xs text-[var(--success-ink)] font-semibold">✓ Selected: {selectedPatient.firstName} {selectedPatient.lastName}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Relationship</label>
              <select className="w-full rounded-[var(--r-sm)] border border-[var(--hc-border)] px-3 py-2.5 text-sm" value={relationship} onChange={e => setRelationship(e.target.value)}>
                {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Document Reference (optional)</label>
              <input className="w-full rounded-[var(--r-sm)] border border-[var(--hc-border)] px-3 py-2.5 text-sm" placeholder="Birth cert #, court order…" value={docRef} onChange={e => setDocRef(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="rounded" />
              Set as primary guardian
            </label>

            {error && <p className="text-xs text-[var(--critical-ink)]">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-[var(--r-sm)] border border-[var(--hc-border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-inset)]">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="flex-1 py-2.5 rounded-[var(--r-sm)] bg-[var(--brand)] text-[var(--on-brand)] text-sm font-semibold hover:bg-[var(--brand-deep)] disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Add Guardian"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
