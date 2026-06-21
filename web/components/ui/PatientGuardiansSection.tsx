"use client";
import { useState, useEffect } from "react";
import { guardiansApi, patientApi } from "@/lib/api";
import { Baby, UserCheck, Trash2, Edit2, PlusCircle, Loader2, CheckCircle, X } from "lucide-react";

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

  const searchGuardian = async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await patientApi.search(q);
      const all: any[] = (res as any)?.data?.data?.patients ?? [];
      setSearchResults(all.filter((p: any) => !p.isMinor).slice(0, 6));
    } catch { } finally { setSearching(false); }
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

  if (loading) return <div className="flex items-center gap-2 text-sm text-gray-400 py-4"><Loader2 size={14} className="animate-spin" /> Loading guardians…</div>;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-amber-800 flex items-center gap-2">
          <Baby size={16} /> Guardians
        </h3>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 px-3 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-100">
            <PlusCircle size={13} /> Add Guardian
          </button>
        )}
      </div>

      {guardians.length === 0 ? (
        <p className="text-sm text-amber-600 italic">No guardians linked.</p>
      ) : (
        <div className="space-y-2">
          {guardians.map((g) => (
            <div key={g.id} className="flex items-center justify-between bg-white rounded-xl border border-amber-200 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{g.guardianName ?? "Unknown"}</span>
                  {g.isPrimary && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Primary</span>}
                  {g.canConsent && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Can consent</span>}
                </div>
                <p className="text-xs text-gray-500 capitalize">{g.relationship} · {g.guardianPhone ?? "—"}</p>
                {g.documentReference && <p className="text-xs text-gray-400">Ref: {g.documentReference}</p>}
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  {!g.isPrimary && (
                    <button onClick={() => handleMakePrimary(g.id)} title="Make primary" className="text-amber-500 hover:text-amber-700">
                      <CheckCircle size={16} />
                    </button>
                  )}
                  <button onClick={() => handleRemove(g.id)} title="Remove" className="text-red-400 hover:text-red-600">
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-900">Add Guardian</h4>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Search Adult Patient</label>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Type name or NRC…"
                  value={searchQ}
                  onChange={(e) => searchGuardian(e.target.value)}
                />
                {searching && <Loader2 size={14} className="absolute right-3 top-3 animate-spin text-gray-400" />}
              </div>
              {searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden mt-1">
                  {searchResults.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSelectedPatient(p); setSearchQ(`${p.firstName} ${p.lastName}`); setSearchResults([]); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                      <p className="font-semibold text-sm text-gray-900">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-gray-400">{p.nationalId ?? "—"}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedPatient && <p className="text-xs text-emerald-600 font-semibold">✓ Selected: {selectedPatient.firstName} {selectedPatient.lastName}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Relationship</label>
              <select className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" value={relationship} onChange={e => setRelationship(e.target.value)}>
                {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Document Reference (optional)</label>
              <input className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm" placeholder="Birth cert #, court order…" value={docRef} onChange={e => setDocRef(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="rounded" />
              Set as primary guardian
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Add Guardian"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
