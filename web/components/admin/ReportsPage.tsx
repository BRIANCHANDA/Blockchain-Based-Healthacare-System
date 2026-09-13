"use client";
import { useEffect, useState, useCallback } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  FileText, Activity, Building2, Users, Download, RefreshCw,
  TrendingUp, FlaskConical, Scan, Pill, Stethoscope, ClipboardList,
  AlertTriangle, CheckCircle2, Calendar, Shield, Clock, BarChart2,
  HeartPulse, UserCheck,
} from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "clinical" | "operational" | "administrative";

// ── Colour constants ───────────────────────────────────────────────────────────
const C = {
  green:  "var(--green-800)",
  teal:   "var(--info-ink)",
  blue:   "var(--blue-600)",
  purple: "var(--accent-ink)",
  amber:  "var(--urgent-ink)",
  red:    "var(--critical-ink)",
  orange: "var(--critical-ink)",
  slate:  "var(--text-secondary)",
  gray:   "var(--text-secondary)",
  pink:   "var(--critical-ink)",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: C.red, emergency: C.orange, urgent: C.amber, routine: C.green,
};
const ROLE_COLORS: Record<string, string> = {
  practitioner: C.blue, nurse: C.teal, lab_technician: C.amber,
  radiologist: C.purple, pharmacist: C.green, receptionist: "var(--info-ink)", admin: C.red,
};
const GENDER_COLORS: Record<string, string> = { male: C.blue, female: C.pink, other: C.gray };
const CHART_COLORS = [C.green, C.blue, C.amber, C.red, C.purple, C.teal, C.orange];

// ── Reusable UI primitives ────────────────────────────────────────────────────

function StatBox({
  label, value, sub, icon: Icon, color, highlight,
}: {
  label: string; value: any; sub?: string; icon: any; color: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? `color-mix(in srgb, ${color} 3%, transparent)` : "var(--white)",
      borderRadius: 14,
      border: `1px solid ${highlight ? `color-mix(in srgb, ${color} 19%, transparent)` : "var(--hc-border)"}`,
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: `color-mix(in srgb, ${color} 8%, transparent)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={15} style={{ color }} />
        </div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>
        {value != null ? String(value) : "—"}
      </p>
      {sub && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children, action }: {
  title: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--hc-border)", overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{title}</p>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 16px" }}>
      <div style={{ height: 1, flex: 1, background: "var(--hc-border)" }} />
      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
        {title}
      </p>
      <div style={{ height: 1, flex: 1, background: "var(--hc-border)" }} />
    </div>
  );
}

function ExecSummary({ lines }: { lines: string[] }) {
  return (
    <div style={{
      background: "var(--surface-sunken)", borderLeft: "4px solid var(--green-800)",
      borderRadius: "0 12px 12px 0", padding: "16px 20px", marginBottom: 24,
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--green-800)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
        Executive Summary
      </p>
      {lines.map((line, i) => (
        <p key={i} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: i < lines.length - 1 ? 8 : 0 }}>
          {line}
        </p>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ height: 200, background: "var(--surface-sunken)", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "32px 0" }}>{message}</p>
  );
}

// ── Clinical sub-components ───────────────────────────────────────────────────

function TopDiagnosesTable({ diagnoses, totalVisits }: { diagnoses: any[]; totalVisits: number }) {
  if (!diagnoses?.length) return <EmptyState message="No diagnosis records for this period" />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--surface-sunken)" }}>
            {["#", "ICD Code", "Diagnosis", "Cases", "% of Visits"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {diagnoses.map((diag: any, i: number) => {
            const pct = totalVisits > 0 ? ((diag.count / totalVisits) * 100).toFixed(1) : "0.0";
            const barPct = diagnoses[0]?.count > 0 ? Math.round((diag.count / diagnoses[0].count) * 100) : 0;
            return (
              <tr key={i} style={{ borderBottom: i < diagnoses.length - 1 ? "1px solid var(--surface-sunken)" : "none", background: i % 2 === 0 ? "var(--white)" : "var(--surface-app)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-disabled)", fontSize: 12, width: 36 }}>
                  {i + 1}
                </td>
                <td style={{ padding: "10px 12px", width: 100 }}>
                  {diag.icdCode
                    ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 700, color: C.green, background: "var(--brand-tint)", padding: "2px 7px", borderRadius: 4 }}>{diag.icdCode}</span>
                    : <span style={{ color: "var(--text-disabled)" }}>—</span>}
                </td>
                <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)" }}>{diag.name}</td>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: C.green, minWidth: 60 }}>
                  {Number(diag.count).toLocaleString()}
                </td>
                <td style={{ padding: "10px 12px", minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "var(--surface-sunken)", borderRadius: 999, minWidth: 70 }}>
                      <div style={{ height: "100%", width: `${barPct}%`, background: C.green, borderRadius: 999 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.slate, minWidth: 42, textAlign: "right" }}>{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PatientDemographics({ data }: { data: { gender: string; count: number }[] }) {
  if (!data?.length) return <EmptyState message="No patient data for this period" />;
  const total = data.reduce((s, r) => s + r.count, 0);
  return (
    <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
      <div style={{ flex: 1 }}>
        {data.map(row => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
          const color = GENDER_COLORS[row.gender] ?? C.gray;
          return (
            <div key={row.gender} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.slate, textTransform: "capitalize" }}>{row.gender}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color }}>{pct}% &nbsp;({row.count.toLocaleString()})</p>
              </div>
              <div style={{ height: 8, background: "var(--surface-sunken)", borderRadius: 999 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.5s" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <p style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{total.toLocaleString()}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>unique patients</p>
      </div>
    </div>
  );
}

// ── Executive summary builders ─────────────────────────────────────────────────

function getClinicalSummary(d: any): string[] {
  const rate = d.visits.completionRate ?? (d.visits.total > 0 ? Math.round(d.visits.completed / d.visits.total * 100) : 0);
  const los = Number(d.avgLengthOfStay ?? 0);
  const top = d.topDiagnoses?.[0];
  const labRate = d.laboratory.total > 0 ? Math.round(d.laboratory.completed / d.laboratory.total * 100) : 0;
  const lines: string[] = [];
  lines.push(
    `${(d.visits.total).toLocaleString()} patient visits were recorded during the reporting period with a ${rate}% completion rate. ` +
    `${d.visits.active} visits remain active and ${d.visits.cancelled} were cancelled.`
  );
  if (los > 0) {
    lines.push(
      `Average length of stay for completed admissions: ${los.toFixed(1)} days. ` +
      `Laboratory throughput: ${d.laboratory.completed} of ${d.laboratory.total} orders completed (${labRate}%).`
    );
  }
  if (top) {
    lines.push(
      `Leading diagnosis: "${top.name}"${top.icdCode ? ` (ICD: ${top.icdCode})` : ""} — ${top.count} recorded cases. ` +
      `${d.pharmacy.dispensed} of ${d.pharmacy.total} prescriptions dispensed.`
    );
  }
  return lines;
}

function getOperationalSummary(d: any): string[] {
  const docs = d.staffActivity?.totalActiveDoctors ?? 0;
  const avgV = d.staffActivity?.avgVisitsPerDoctor ?? 0;
  return [
    `${d.referrals.totalOutgoing} outgoing referrals processed — acceptance rate ${d.referrals.acceptanceRate}%. ` +
    `${d.referrals.completed} referrals completed; ${d.referrals.rejected} rejected.`,
    `Appointment compliance: ${d.appointments.attendanceRate}% attendance rate ` +
    `(${d.appointments.attended} attended, ${d.appointments.cancelled} cancelled of ${d.appointments.total} scheduled).`,
    docs > 0
      ? `${docs} active physician${docs !== 1 ? "s" : ""} recorded an average of ${avgV} visits per physician during this period.`
      : "No physician activity data recorded for this period.",
  ];
}

function getAdminSummary(d: any): string[] {
  const verRate = d.staff.verificationRate ?? 100;
  const lines: string[] = [
    `${d.patients.newInPeriod.toLocaleString()} new patients registered in the period, bringing the total to ${d.patients.total.toLocaleString()} active patients.`,
    `Workforce: ${d.staff.total} active staff — ${d.staff.verified ?? (d.staff.total - d.staff.unverified)} verified (${verRate}% credential compliance). ${d.staff.unverified} account${d.staff.unverified !== 1 ? "s" : ""} pending verification.`,
  ];
  if (d.audit?.totalEvents > 0) {
    lines.push(
      `${d.audit.totalEvents.toLocaleString()} audit events logged across ${d.audit.byAction?.length ?? 0} distinct action types — full tamper-evident activity trail available.`
    );
  }
  return lines;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = !(user as any)?.institutionId;

  const [tab, setTab] = useState<Tab>("clinical");
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<Record<Tab, any>>({ clinical: null, operational: null, administrative: null });
  const [loading, setLoading] = useState<Record<Tab, boolean>>({ clinical: false, operational: false, administrative: false });
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async (type: Tab, silent = false) => {
    if (!silent) setLoading(l => ({ ...l, [type]: true }));
    try {
      const res = await api.get(`/api/reports/${type}?from=${fromDate}&to=${toDate}&format=json`);
      setData(d => ({ ...d, [type]: res.data.data }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(l => ({ ...l, [type]: false }));
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchReport(tab); }, [tab, fromDate, toDate]);
  useLiveRefresh(() => fetchReport(tab, true));

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/api/reports/${tab}?from=${fromDate}&to=${toDate}&format=pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `healthchain-${tab}-report-${fromDate}-to-${toDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF export not yet available on this deployment.");
    } finally {
      setExporting(false);
    }
  };

  const d = data[tab];
  const isLoading = loading[tab];
  const periodDays = differenceInDays(new Date(toDate), new Date(fromDate)) + 1;

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "clinical",       label: "Clinical",       icon: HeartPulse },
    { key: "operational",    label: "Operational",    icon: TrendingUp },
    { key: "administrative", label: "Administrative", icon: Building2 },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0, font: "700 27px/1.1 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-primary)" }}>
              Reports &amp; Analytics
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {isSuperAdmin ? "System-wide analytics — all institutions" : "Institution-scoped analytics"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--hc-border)", fontSize: 13, outline: "none", color: "var(--text-secondary)" }} />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--hc-border)", fontSize: 13, outline: "none", color: "var(--text-secondary)" }} />
          <button onClick={() => fetchReport(tab)} disabled={isLoading}
            style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--hc-border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button onClick={handleExport} disabled={exporting || isLoading}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, background: "var(--brand)", color: "var(--white)", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", opacity: exporting ? 0.7 : 1 }}>
            <Download size={14} /> {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* ── Institution scope badge ──────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
        background: isSuperAdmin ? "var(--coral-050)" : "var(--info-tint)",
        border: `1px solid ${isSuperAdmin ? "var(--coral-100)" : "var(--blue-100)"}`,
        borderRadius: 10, width: "fit-content", marginBottom: 20,
      }}>
        <Shield size={13} style={{ color: isSuperAdmin ? C.red : C.blue }} />
        <p style={{ fontSize: 12.5, fontWeight: 700, color: isSuperAdmin ? C.red : C.blue }}>
          {isSuperAdmin
            ? "Super Admin — System-wide Report (All Institutions)"
            : `Scoped to: ${d?.institutionName ?? "Your Institution"}`}
        </p>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface-sunken)", padding: 4, borderRadius: 12, width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 600, transition: "all 0.15s", background: tab === t.key ? "var(--white)" : "transparent", color: tab === t.key ? C.green : "var(--text-secondary)", boxShadow: tab === t.key ? "var(--elev-1)" : "none" }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Period badge ─────────────────────────────────────────────────────── */}
      {d && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "7px 14px", background: "var(--brand-tint)", border: "1px solid var(--green-100)", borderRadius: 10, width: "fit-content" }}>
          <Calendar size={12} style={{ color: C.green }} />
          <p style={{ fontSize: 12.5, color: C.green, fontWeight: 600 }}>
            {format(new Date(d.period.from), "dd MMM yyyy")} — {format(new Date(d.period.to), "dd MMM yyyy")}
            &nbsp;·&nbsp;{periodDays}-day period
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          CLINICAL TAB
      ═══════════════════════════════════════════════════════════════════════════ */}
      {tab === "clinical" && (isLoading ? <Skeleton /> : !d ? null : (
        <>
          <ExecSummary lines={getClinicalSummary(d)} />

          <SectionDivider title="Key Performance Indicators" />

          {/* KPI stats — row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 12 }}>
            <StatBox label="Total Visits"    value={d.visits.total.toLocaleString()}     sub="in period"   icon={ClipboardList} color={C.green}  highlight />
            <StatBox label="Completed"       value={d.visits.completed.toLocaleString()} sub="discharged"  icon={CheckCircle2} color={C.teal}         />
            <StatBox label="Active"          value={d.visits.active.toLocaleString()}    sub="in progress" icon={Activity}     color={C.blue}         />
            <StatBox label="Cancelled"       value={d.visits.cancelled.toLocaleString()} sub="visits"     icon={AlertTriangle} color={C.red}          />
            <StatBox label="Completion Rate" value={`${d.visits.completionRate ?? 0}%`}  sub="discharged / total" icon={BarChart2} color={C.purple}  />
          </div>

          {/* KPI stats — row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            <StatBox label="Avg. Length of Stay"  value={`${Number(d.avgLengthOfStay ?? 0).toFixed(1)} d`} sub="completed admissions" icon={Clock}       color={C.slate}  />
            <StatBox label="Lab Orders"            value={d.laboratory.total.toLocaleString()}               sub={`${d.laboratory.pending} pending`}       icon={FlaskConical} color={C.amber} />
            <StatBox label="Imaging Orders"        value={d.imaging.total.toLocaleString()}                  sub={`${d.imaging.pending} pending`}          icon={Scan}      color={C.purple} />
            <StatBox label="Prescriptions"         value={d.pharmacy.total.toLocaleString()}                 sub={`${d.pharmacy.dispensed} dispensed`}     icon={Pill}      color={C.green}  />
          </div>

          <SectionDivider title="Visit Analytics" />

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <SectionCard title="Visits Trend">
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={d.visits.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-sunken)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke={C.green} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="By Priority">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={d.visits.byPriority}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-sunken)" />
                  <XAxis dataKey="priority" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {d.visits.byPriority.map((e: any, i: number) => (
                      <Cell key={i} fill={PRIORITY_COLORS[e.priority] ?? C.green} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="By Visit Type">
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={d.visits.byType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={62}
                    label={({ type, percent }: any) => `${type} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false} style={{ fontSize: 9 }}>
                    {d.visits.byType.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          <SectionDivider title="Department Performance" />

          <SectionCard title="Completion Rates by Department">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 28 }}>
              {[
                { label: "Laboratory",       total: d.laboratory.total, completed: d.laboratory.completed, color: C.amber  },
                { label: "Imaging / Radiology", total: d.imaging.total, completed: d.imaging.completed,   color: C.purple },
                { label: "Pharmacy",         total: d.pharmacy.total,   completed: d.pharmacy.dispensed,  color: C.green  },
              ].map(item => {
                const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.slate }}>{item.label}</p>
                      <p style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{pct}%</p>
                    </div>
                    <div style={{ height: 9, background: "var(--surface-sunken)", borderRadius: 999 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: item.color, borderRadius: 999, transition: "width 0.5s" }} />
                    </div>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                      {item.completed.toLocaleString()} completed of {item.total.toLocaleString()} total
                    </p>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionDivider title="Top Diagnoses" />
          <SectionCard title="Most Frequently Recorded Diagnoses"
            action={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>Top 10 by case count</span>}>
            <TopDiagnosesTable diagnoses={d.topDiagnoses ?? []} totalVisits={d.visits.total} />
          </SectionCard>

          <SectionDivider title="Patient Demographics" />
          <SectionCard title="Patient Gender Distribution">
            <PatientDemographics data={d.patientsByGender ?? []} />
          </SectionCard>
        </>
      ))}

      {/* ════════════════════════════════════════════════════════════════════════
          OPERATIONAL TAB
      ═══════════════════════════════════════════════════════════════════════════ */}
      {tab === "operational" && (isLoading ? <Skeleton /> : !d ? null : (
        <>
          <ExecSummary lines={getOperationalSummary(d)} />

          <SectionDivider title="Referral & Appointment KPIs" />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            <StatBox label="Outgoing Referrals" value={d.referrals.totalOutgoing.toLocaleString()} sub="sent out"           icon={TrendingUp}  color={C.green} highlight />
            <StatBox label="Incoming Referrals" value={d.referrals.totalIncoming.toLocaleString()} sub="received"           icon={Activity}    color={C.blue}  />
            <StatBox label="Acceptance Rate"    value={`${d.referrals.acceptanceRate}%`}            sub="accepted+completed" icon={CheckCircle2} color={C.teal}  />
            <StatBox label="Appointments"       value={d.appointments.total.toLocaleString()}        sub={`${d.appointments.attendanceRate}% attended`} icon={Calendar} color={C.purple} />
          </div>

          {/* Physician productivity */}
          {(d.staffActivity?.totalActiveDoctors ?? 0) > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
              <StatBox label="Active Physicians"        value={d.staffActivity.totalActiveDoctors}  sub="with visits in period" icon={Stethoscope} color={C.slate} />
              <StatBox label="Avg. Visits / Physician" value={d.staffActivity.avgVisitsPerDoctor}   sub="visits per doctor"     icon={BarChart2}   color={C.teal}  />
            </div>
          )}

          <SectionDivider title="Referral Analysis" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <SectionCard title="Referral Status Breakdown">
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={[
                  { status: "Pending",   count: d.referrals.pending },
                  { status: "Accepted",  count: d.referrals.accepted },
                  { status: "Completed", count: d.referrals.completed },
                  { status: "Rejected",  count: d.referrals.rejected },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-sunken)" />
                  <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {[C.amber, C.green, C.blue, C.red].map((c, i) => <Cell key={i} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="Appointment Compliance">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={[
                    { name: "Attended",  value: d.appointments.attended },
                    { name: "Cancelled", value: d.appointments.cancelled },
                    { name: "Other",     value: Math.max(0, d.appointments.total - d.appointments.attended - d.appointments.cancelled) },
                  ]} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={72}>
                    {[C.green, C.red, "var(--hc-border)"].map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          <SectionDivider title="Physician Activity" />

          <SectionCard title="Top Physicians by Visit Count"
            action={<span style={{ fontSize: 11, color: "var(--text-muted)" }}>Top 10</span>}>
            {!d.staffActivity.topDoctors?.length
              ? <EmptyState message="No physician data for this period" />
              : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--surface-sunken)" }}>
                      {["#", "Physician", "Specialization", "Visits"].map(h => (
                        <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.staffActivity.topDoctors.slice(0, 10).map((doc: any, i: number) => (
                      <tr key={doc.doctorId} style={{ borderBottom: i < 9 ? "1px solid var(--surface-sunken)" : "none", background: i % 2 === 0 ? "var(--white)" : "var(--surface-app)" }}>
                        <td style={{ padding: "11px 14px", fontWeight: 700, color: "var(--text-disabled)", fontSize: 12, width: 36 }}>{i + 1}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--sidebar-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--white)", flexShrink: 0 }}>
                              {doc.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                            </div>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Dr. {doc.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", color: C.gray }}>{doc.specialization ?? "—"}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: "var(--surface-sunken)", borderRadius: 999, minWidth: 60 }}>
                              <div style={{ height: "100%", width: `${Math.min(100, (doc.visitCount / (d.staffActivity.topDoctors[0]?.visitCount || 1)) * 100)}%`, background: C.green, borderRadius: 999 }} />
                            </div>
                            <span style={{ fontWeight: 800, color: C.green, minWidth: 30, textAlign: "right" }}>{doc.visitCount}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </SectionCard>
        </>
      ))}

      {/* ════════════════════════════════════════════════════════════════════════
          ADMINISTRATIVE TAB
      ═══════════════════════════════════════════════════════════════════════════ */}
      {tab === "administrative" && (isLoading ? <Skeleton /> : !d ? null : (
        <>
          <ExecSummary lines={getAdminSummary(d)} />

          <SectionDivider title="Institution Overview" />

          <div style={{ display: "grid", gridTemplateColumns: isSuperAdmin ? "repeat(4,1fr)" : "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
            <StatBox label="Total Patients"  value={d.patients.total.toLocaleString()}       sub="registered"          icon={Users}     color={C.blue}   highlight />
            <StatBox label="New This Period" value={d.patients.newInPeriod.toLocaleString()}  sub="registrations"       icon={TrendingUp} color={C.green} />
            <StatBox label="Total Staff"     value={d.staff.total.toLocaleString()}           sub={`${d.staff.unverified} unverified`} icon={Stethoscope} color={C.purple} />
            {isSuperAdmin && (
              <StatBox label="Institutions" value={d.institutions?.total ?? 0} sub={`${d.institutions?.active ?? 0} active`} icon={Building2} color="var(--info-ink)" />
            )}
          </div>

          {/* Staff verification KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
            <StatBox label="Verified Staff"       value={`${d.staff.verified ?? (d.staff.total - d.staff.unverified)}`} sub="credentialed accounts" icon={UserCheck} color={C.green} />
            <StatBox label="Credential Compliance" value={`${d.staff.verificationRate ?? 100}%`}                          sub="verified / total"      icon={Shield}    color={C.teal}  />
          </div>

          <SectionDivider title="Trends & Workforce" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <SectionCard title="Patient Registration Trend">
              {d.patients.registrationTrend?.length
                ? (
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={d.patients.registrationTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-sunken)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke={C.blue} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyState message="No registration data for this period" />}
            </SectionCard>

            <SectionCard title="Workforce Distribution by Role">
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={d.staff.byRole} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-sunken)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="role" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {d.staff.byRole.map((e: any, i: number) => (
                      <Cell key={i} fill={ROLE_COLORS[e.role] ?? C.green} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          <SectionDivider title="Audit & Compliance" />

          <SectionCard title={`System Audit Log — ${d.audit.totalEvents.toLocaleString()} events in period`}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={d.audit.byAction.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-sunken)" />
                  <XAxis dataKey="action" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={46} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={C.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--surface-sunken)" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Action</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.audit.byAction.slice(0, 8).map((a: any, i: number) => (
                      <tr key={a.action} style={{ borderBottom: "1px solid var(--surface-sunken)", background: i % 2 === 0 ? "var(--white)" : "var(--surface-app)" }}>
                        <td style={{ padding: "7px 10px", color: C.slate, textTransform: "capitalize" }}>
                          {a.action?.replace(/_/g, " ")}
                        </td>
                        <td style={{ padding: "7px 10px", fontWeight: 700, color: C.green, textAlign: "right" }}>
                          {Number(a.count).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionCard>

          {/* Institution comparison — super admin only */}
          {isSuperAdmin && d.institutions?.list?.length > 0 && (
            <>
              <SectionDivider title="Institution Comparison" />
              <SectionCard title="All Institutions">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--surface-sunken)" }}>
                        {["Institution", "Type", "Patients", "Staff", "Total Visits", "Status"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.institutions.list.map((inst: any, i: number) => (
                        <tr key={inst.id} style={{ borderBottom: "1px solid var(--surface-sunken)", background: i % 2 === 0 ? "var(--white)" : "var(--surface-app)" }}>
                          <td style={{ padding: "12px 12px", fontWeight: 600, color: "var(--text-primary)" }}>{inst.name}</td>
                          <td style={{ padding: "12px 12px" }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--brand-tint)", color: C.green, textTransform: "capitalize" }}>
                              {inst.type}
                            </span>
                          </td>
                          <td style={{ padding: "12px 12px", fontWeight: 600, color: C.blue }}>{inst.totalPatients.toLocaleString()}</td>
                          <td style={{ padding: "12px 12px", fontWeight: 600, color: C.purple }}>{inst.totalStaff.toLocaleString()}</td>
                          <td style={{ padding: "12px 12px", fontWeight: 600, color: C.green }}>{inst.totalVisits.toLocaleString()}</td>
                          <td style={{ padding: "12px 12px" }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: inst.isActive ? "var(--brand-tint)" : "var(--coral-050)", color: inst.isActive ? "var(--green-700)" : C.red }}>
                              {inst.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </>
          )}
        </>
      ))}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {d && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--surface-sunken)" }}>
          <FileText size={12} style={{ color: "var(--text-disabled)" }} />
          <p style={{ fontSize: 11.5, color: "var(--text-disabled)" }}>
            {isSuperAdmin ? "System-wide" : d.institutionName} · {tab.charAt(0).toUpperCase() + tab.slice(1)} Report · Generated {format(new Date(d.generatedAt), "dd MMM yyyy 'at' HH:mm")} · HealthChain EMR
          </p>
        </div>
      )}
    </div>
  );
}
