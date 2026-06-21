"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import {
  BedDouble, RefreshCw, Search, AlertCircle,
  Clock, User, Stethoscope, ChevronRight,
} from "lucide-react";

interface Inpatient {
  id: string;
  visitNumber: string;
  patientId: string;
  patientName: string;
  gender: string;
  bloodType: string | null;
  priority: string;
  admissionDate: string;
  admittingDiagnosis: string | null;
  wardName: string | null;
  bedCode: string | null;
  doctorName: string | null;
}

const PRIORITY: Record<string, { bg: string; text: string; border: string }> = {
  routine:   { bg: "#f0fdf4", text: "#16a34a", border: "#86efac" },
  urgent:    { bg: "#fffbeb", text: "#d97706", border: "#fcd34d" },
  emergency: { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5" },
  critical:  { bg: "#fdf4ff", text: "#7c3aed", border: "#d8b4fe" },
};

function PriorityBadge({ p }: { p: string }) {
  const c = PRIORITY[p] ?? PRIORITY.routine;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>{p}</span>
  );
}

function StayBadge({ admissionDate }: { admissionDate: string }) {
  const hours = differenceInHours(new Date(), new Date(admissionDate));
  const days  = Math.floor(hours / 24);
  const label = days >= 1 ? `${days}d ${hours % 24}h` : `${hours}h`;
  const color = hours > 72 ? "#dc2626" : hours > 24 ? "#d97706" : "#374151";
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
      {label}
    </span>
  );
}

export default function AdmittedPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Inpatient[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<"all" | "mine">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/visits/inpatients");
      setPatients(res.data?.data?.patients ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.patientName.toLowerCase().includes(q) ||
      p.visitNumber.toLowerCase().includes(q) ||
      (p.admittingDiagnosis ?? "").toLowerCase().includes(q) ||
      (p.wardName ?? "").toLowerCase().includes(q);
    return matchSearch;
  });

  const critical  = patients.filter(p => p.priority === "critical" || p.priority === "emergency").length;
  const noBed     = patients.filter(p => !p.bedCode).length;

  return (
    <div style={{ maxWidth: 1100, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BedDouble size={18} style={{ color: "#2563eb" }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Admitted Patients</h1>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            All current inpatients at your institution
          </p>
        </div>
        <button
          onClick={load}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff",
            fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Admitted", value: patients.length, color: "#2563eb" },
          { label: "Critical / Emergency", value: critical, color: "#dc2626" },
          { label: "Awaiting Bed", value: noBed, color: "#d97706" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12,
            padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, margin: "4px 0 0" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{
        background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12,
        padding: "12px 16px", marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Search size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, visit no., diagnosis or ward…"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111827", background: "transparent" }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>
            Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{
        background: "#fff", border: "1px solid #f0f0f0", borderRadius: 14,
        overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>
            <RefreshCw size={22} style={{ animation: "spin 1s linear infinite", marginBottom: 10 }} />
            <p style={{ fontSize: 13 }}>Loading admitted patients…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <BedDouble size={38} style={{ color: "#d1d5db", marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
              {search ? "No patients match your search." : "No admitted patients right now."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #f0f0f0" }}>
                {["Patient", "Visit", "Priority", "Admitting Diagnosis", "Ward / Bed", "Length of Stay", "Doctor", ""].map(h => (
                  <th key={h} style={{
                    padding: "10px 16px", textAlign: "left", fontSize: 11,
                    fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/dashboard/doctor/visit/${p.id}`)}
                  style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid #f9fafb" : "none",
                    cursor: "pointer",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8faff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Patient */}
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg,#dbeafe,#eff6ff)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <User size={14} style={{ color: "#2563eb" }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{p.patientName}</p>
                        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{p.gender}{p.bloodType ? ` · ${p.bloodType}` : ""}</p>
                      </div>
                    </div>
                  </td>

                  {/* Visit number */}
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "#374151", fontWeight: 600 }}>
                      {p.visitNumber}
                    </span>
                  </td>

                  {/* Priority */}
                  <td style={{ padding: "13px 16px" }}>
                    <PriorityBadge p={p.priority} />
                  </td>

                  {/* Admitting diagnosis */}
                  <td style={{ padding: "13px 16px", maxWidth: 220 }}>
                    {p.admittingDiagnosis ? (
                      <p style={{ fontSize: 12.5, color: "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.admittingDiagnosis}
                      </p>
                    ) : (
                      <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>
                    )}
                  </td>

                  {/* Ward / Bed */}
                  <td style={{ padding: "13px 16px" }}>
                    {p.wardName || p.bedCode ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <BedDouble size={12} style={{ color: "#2563eb", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
                          {p.wardName ?? ""}
                          {p.bedCode ? ` · Bed ${p.bedCode}` : ""}
                        </span>
                      </div>
                    ) : (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                        background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a",
                      }}>
                        Awaiting bed
                      </span>
                    )}
                  </td>

                  {/* Length of stay */}
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={11} style={{ color: "#9ca3af" }} />
                      <StayBadge admissionDate={p.admissionDate} />
                    </div>
                  </td>

                  {/* Doctor */}
                  <td style={{ padding: "13px 16px" }}>
                    {p.doctorName ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Stethoscope size={11} style={{ color: "#9ca3af" }} />
                        <span style={{ fontSize: 12, color: "#6b7280" }}>Dr. {p.doctorName}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "#d1d5db" }}>Unassigned</span>
                    )}
                  </td>

                  {/* Arrow */}
                  <td style={{ padding: "13px 16px" }}>
                    <ChevronRight size={15} style={{ color: "#d1d5db" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
