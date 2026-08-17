"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Download, RefreshCw, Calendar, FileText, Activity,
  FlaskConical, Scan, Pill, HeartPulse, ClipboardList,
  Stethoscope, UserCheck, BarChart2, Clock, Package,
} from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  green:  "#166534", teal: "#0e7490", blue: "#2563eb",
  purple: "#7c3aed", amber: "#d97706", red: "#dc2626",
  slate:  "#374151", gray: "#6b7280", pink: "#db2777",
};
const CHART_COLORS = [C.green, C.blue, C.amber, C.purple, C.teal, C.red, C.pink];

// ── Role metadata ─────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string; icon: any }> = {
  practitioner:   { label: "Physician",          color: C.blue,   icon: Stethoscope },
  nurse:          { label: "Nurse",               color: C.teal,   icon: HeartPulse  },
  lab_technician: { label: "Lab Technician",      color: C.amber,  icon: FlaskConical},
  radiologist:    { label: "Radiologist",         color: C.purple, icon: Scan        },
  pharmacist:     { label: "Pharmacist",          color: C.green,  icon: Pill        },
  receptionist:   { label: "Receptionist",        color: C.slate,  icon: ClipboardList},
  admin:          { label: "Administrator",       color: C.red,    icon: UserCheck   },
};

// ── Primitives ────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color }: {
  label: string; value: any; sub?: string; icon: any; color: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eaecf0", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} style={{ color }} />
        </div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>
        {value != null ? String(value) : "—"}
      </p>
      {sub && <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eaecf0", overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "13px 20px", borderBottom: "1px solid #f3f4f6" }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111" }}>{title}</p>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function Divider({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 16px" }}>
      <div style={{ height: 1, flex: 1, background: "#e5e7eb" }} />
      <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>{title}</p>
      <div style={{ height: 1, flex: 1, background: "#e5e7eb" }} />
    </div>
  );
}

function ExecSummary({ lines }: { lines: string[] }) {
  return (
    <div style={{ background: "#f8fafc", borderLeft: "4px solid #166534", borderRadius: "0 12px 12px 0", padding: "16px 20px", marginBottom: 24 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
        Performance Summary
      </p>
      {lines.map((l, i) => (
        <p key={i} style={{ fontSize: 13, color: C.slate, lineHeight: 1.7, marginBottom: i < lines.length - 1 ? 6 : 0 }}>{l}</p>
      ))}
    </div>
  );
}

function TrendChart({ data, color, label }: { data: { date: string; count: number }[]; color: string; label: string }) {
  if (!data?.length) return <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>No trend data for this period</p>;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => String(v)?.slice(5)} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} name={label} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BreakdownBar({ data, color, labelKey, countKey = "count" }: { data: any[]; color: string; labelKey: string; countKey?: string }) {
  if (!data?.length) return <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>No data</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey={labelKey} tick={{ fontSize: 10 }} width={110} />
        <Tooltip />
        <Bar dataKey={countKey} radius={[0, 4, 4, 0]}>
          {data.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Executive summary builders ────────────────────────────────────────────────
function buildSummary(d: any): string[] {
  const { role, summary: s, staffName } = d;
  switch (role) {
    case 'practitioner':
      return [
        `${staffName} conducted ${s.consultations} consultation${s.consultations !== 1 ? 's' : ''} during this period, making ${s.diagnosesMade} documented diagnoses.`,
        `Orders placed: ${s.labOrdersPlaced} laboratory, ${s.imagingOrdered} imaging, ${s.prescriptionsWritten} prescriptions (${s.dispensingRate}% dispensed).`,
      ];
    case 'nurse':
      return [
        `${staffName} recorded ${s.vitalsRecorded} set${s.vitalsRecorded !== 1 ? 's' : ''} of vital signs for ${s.distinctPatients} distinct patient${s.distinctPatients !== 1 ? 's' : ''} during this period.`,
        `${s.assignedVisits} visit${s.assignedVisits !== 1 ? 's' : ''} were assigned to this nurse during the period.`,
      ];
    case 'lab_technician':
      return [
        `${staffName} resulted ${s.testsResulted} laboratory test${s.testsResulted !== 1 ? 's' : ''} during the reporting period.`,
        s.pendingAssigned > 0 ? `${s.pendingAssigned} test order${s.pendingAssigned !== 1 ? 's are' : ' is'} currently assigned and awaiting processing.` : 'No pending tests currently assigned.',
      ];
    case 'radiologist':
      return [
        `${staffName} completed ${s.reportsCompleted} imaging report${s.reportsCompleted !== 1 ? 's' : ''} during this period.`,
        s.pendingAssigned > 0 ? `${s.pendingAssigned} imaging order${s.pendingAssigned !== 1 ? 's are' : ' is'} currently assigned and pending.` : 'No imaging studies currently pending.',
      ];
    case 'pharmacist':
      return [
        `${staffName} dispensed ${s.itemsDispensed} medication item${s.itemsDispensed !== 1 ? 's' : ''} across ${s.prescriptionsDispensed} prescription${s.prescriptionsDispensed !== 1 ? 's' : ''} during this period.`,
        `${s.stockMovementsDone} stock movement${s.stockMovementsDone !== 1 ? 's were' : ' was'} recorded (receipts, adjustments, and dispensing events).`,
      ];
    case 'receptionist':
      return [
        `${staffName} opened ${s.visitsCreated} patient visit${s.visitsCreated !== 1 ? 's' : ''} during this period — ${s.appointmentsCreated} appointment${s.appointmentsCreated !== 1 ? 's' : ''} and ${s.walkinVisits} walk-in${s.walkinVisits !== 1 ? 's' : ''}.`,
      ];
    case 'admin': {
      const scope = d.scope === 'system-wide' ? 'across all institutions' : 'at this institution';
      return [
        `${staffName} oversees ${s.staffActive} active staff member${s.staffActive !== 1 ? 's' : ''} ${scope}, with ${s.staffAdded} added during this period.`,
        `${s.patientsRegistered} patient registration${s.patientsRegistered !== 1 ? 's' : ''} and ${s.visitsRecorded} visit${s.visitsRecorded !== 1 ? 's' : ''} were recorded, against ${s.auditEvents} audited action${s.auditEvents !== 1 ? 's' : ''}.`,
        s.emergencyOverrides > 0
          ? `${s.emergencyOverrides} emergency consent override${s.emergencyOverrides !== 1 ? 's were' : ' was'} invoked and ${s.emergencyOverrides !== 1 ? 'are' : 'is'} listed below for review.`
          : 'No emergency consent overrides were invoked during this period.',
      ];
    }
    default:
      return ['No performance data available for this role.'];
  }
}

// ── Role-specific content sections ───────────────────────────────────────────
function PractitionerContent({ d }: { d: any }) {
  const s = d.summary;
  return (
    <>
      <Divider title="Clinical Activity" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
        <KPICard label="Consultations"    value={s.consultations}         sub="completed"          icon={ClipboardList} color={C.blue}   />
        <KPICard label="Diagnoses Made"   value={s.diagnosesMade}         sub="documented"         icon={Activity}      color={C.green}  />
        <KPICard label="Lab Orders"       value={s.labOrdersPlaced}       sub="ordered"            icon={FlaskConical}  color={C.amber}  />
        <KPICard label="Imaging Orders"   value={s.imagingOrdered}        sub="ordered"            icon={Scan}          color={C.purple} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <KPICard label="Rx Written"       value={s.prescriptionsWritten}  sub="prescribed"         icon={Pill}          color={C.teal}   />
        <KPICard label="Rx Dispensed"     value={s.prescriptionsDispensed} sub="by pharmacy"       icon={Pill}          color={C.green}  />
        <KPICard label="Dispensing Rate"  value={`${s.dispensingRate}%`}  sub="prescriptions dispensed" icon={BarChart2} color={C.purple} />
      </div>

      <Divider title="Activity Trend" />
      <SectionCard title="Daily Consultations">
        <TrendChart data={d.trend} color={C.blue} label="Consultations" />
      </SectionCard>

      {d.topDiagnoses?.length > 0 && (
        <>
          <Divider title="Top Diagnoses Made" />
          <SectionCard title="Most Frequently Recorded Diagnoses">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                  {["#", "ICD", "Diagnosis", "Count"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.topDiagnoses.map((dx: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f9fafb", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "10px 12px", color: "#d1d5db", fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {dx.icdCode
                        ? <span style={{ fontFamily: "monospace", fontSize: 11.5, fontWeight: 700, color: C.green, background: "#f0fdf4", padding: "2px 7px", borderRadius: 4 }}>{dx.icdCode}</span>
                        : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111" }}>{dx.name}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 800, color: C.green }}>{dx.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {d.labByCategory?.length > 0 && (
          <SectionCard title="Lab Orders by Category">
            <BreakdownBar data={d.labByCategory} color={C.amber} labelKey="category" />
          </SectionCard>
        )}
        {d.imagingByModality?.length > 0 && (
          <SectionCard title="Imaging by Modality">
            <BreakdownBar data={d.imagingByModality} color={C.purple} labelKey="modality" />
          </SectionCard>
        )}
      </div>

      {d.recentActivity?.length > 0 && (
        <>
          <Divider title="Recent Activity" />
          <SectionCard title="5 Most Recent Consultations">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                  {["Visit No.", "Chief Complaint", "Priority", "Date"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.recentActivity.map((r: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f9fafb", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: C.green, fontWeight: 700 }}>{r.visitNumber}</td>
                    <td style={{ padding: "10px 12px", color: C.slate }}>{r.chiefComplaint ?? "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: r.priority === "critical" ? "#fef2f2" : r.priority === "urgent" ? "#fffbeb" : "#f0fdf4", color: r.priority === "critical" ? C.red : r.priority === "urgent" ? C.amber : C.green, textTransform: "capitalize" }}>
                        {r.priority}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: C.gray, fontSize: 12 }}>{r.date ? format(new Date(r.date), "dd MMM yyyy HH:mm") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </>
      )}
    </>
  );
}

function NurseContent({ d }: { d: any }) {
  const s = d.summary;
  return (
    <>
      <Divider title="Nursing Activity" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <KPICard label="Vitals Recorded"    value={s.vitalsRecorded}   sub="total sets"      icon={HeartPulse}    color={C.teal}  />
        <KPICard label="Patients Triaged"   value={s.distinctPatients} sub="unique patients" icon={UserCheck}     color={C.blue}  />
        <KPICard label="Visits Assigned"    value={s.assignedVisits}   sub="in period"       icon={ClipboardList} color={C.green} />
      </div>
      <Divider title="Daily Trend" />
      <SectionCard title="Vital Signs Recorded Per Day">
        <TrendChart data={d.trend} color={C.teal} label="Vitals" />
      </SectionCard>
    </>
  );
}

function LabTechContent({ d }: { d: any }) {
  const s = d.summary;
  return (
    <>
      <Divider title="Laboratory Activity" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
        <KPICard label="Tests Resulted"   value={s.testsResulted}   sub="completed in period" icon={FlaskConical} color={C.amber}  />
        <KPICard label="Pending (Assigned)" value={s.pendingAssigned} sub="awaiting processing" icon={Clock}       color={C.red}    />
      </div>
      <Divider title="Breakdown" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="Tests Resulted Per Day">
          <TrendChart data={d.trend} color={C.amber} label="Tests" />
        </SectionCard>
        {d.testByCategory?.length > 0 && (
          <SectionCard title="Tests by Category">
            <BreakdownBar data={d.testByCategory} color={C.amber} labelKey="category" />
          </SectionCard>
        )}
      </div>
    </>
  );
}

function RadiologistContent({ d }: { d: any }) {
  const s = d.summary;
  return (
    <>
      <Divider title="Radiology Activity" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
        <KPICard label="Reports Completed"  value={s.reportsCompleted}  sub="in period"           icon={Scan}   color={C.purple} />
        <KPICard label="Pending (Assigned)" value={s.pendingAssigned}   sub="awaiting reporting"  icon={Clock}  color={C.red}    />
      </div>
      <Divider title="Breakdown" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="Reports Completed Per Day">
          <TrendChart data={d.trend} color={C.purple} label="Reports" />
        </SectionCard>
        {d.byModality?.length > 0 && (
          <SectionCard title="Studies by Modality">
            <BreakdownBar data={d.byModality} color={C.purple} labelKey="modality" />
          </SectionCard>
        )}
      </div>
    </>
  );
}

function PharmacistContent({ d }: { d: any }) {
  const s = d.summary;
  return (
    <>
      <Divider title="Pharmacy Activity" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <KPICard label="Items Dispensed"         value={s.itemsDispensed}        sub="medication items"   icon={Pill}    color={C.green} />
        <KPICard label="Prescriptions Dispensed" value={s.prescriptionsDispensed} sub="scripts fulfilled"  icon={FileText} color={C.teal}  />
        <KPICard label="Stock Movements"         value={s.stockMovementsDone}    sub="recorded"           icon={Package} color={C.amber} />
      </div>
      <Divider title="Daily Trend" />
      <SectionCard title="Items Dispensed Per Day">
        <TrendChart data={d.trend} color={C.green} label="Items Dispensed" />
      </SectionCard>
    </>
  );
}

function ReceptionistContent({ d }: { d: any }) {
  const s = d.summary;
  return (
    <>
      <Divider title="Reception Activity" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <KPICard label="Visits Opened"     value={s.visitsCreated}      sub="total"       icon={ClipboardList} color={C.slate} />
        <KPICard label="Appointments"      value={s.appointmentsCreated} sub="scheduled"   icon={Calendar}      color={C.blue}  />
        <KPICard label="Walk-ins"          value={s.walkinVisits}        sub="registered"  icon={UserCheck}     color={C.teal}  />
      </div>
      <Divider title="Daily Trend" />
      <SectionCard title="Visits Opened Per Day">
        <TrendChart data={d.trend} color={C.slate} label="Visits" />
      </SectionCard>
    </>
  );
}

function AdminContent({ d }: { d: any }) {
  const s = d.summary;
  const roster: Array<{ role: string; count: number }> = d.staffByRole ?? [];
  const overrides: Array<{ reason: string; at: string }> = d.recentOverrides ?? [];
  return (
    <>
      <Divider title="Institution Oversight" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <KPICard label="Active Staff"        value={s.staffActive}        sub="on roster"    icon={UserCheck}     color={C.slate} />
        <KPICard label="Staff Added"         value={s.staffAdded}         sub="this period"  icon={UserCheck}     color={C.blue}  />
        <KPICard label="Patients Registered" value={s.patientsRegistered} sub="this period"  icon={ClipboardList} color={C.green} />
        <KPICard label="Visits Recorded"     value={s.visitsRecorded}     sub="this period"  icon={Activity}      color={C.teal}  />
        <KPICard label="Audited Actions"     value={s.auditEvents}        sub="logged"       icon={Activity}      color={C.purple} />
        <KPICard label="Emergency Overrides" value={s.emergencyOverrides} sub="consent bypassed" icon={Activity}  color={C.red}   />
      </div>

      {roster.length > 0 && (
        <>
          <Divider title="Staff Roster by Role" />
          <SectionCard title="Active Staff by Role">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.role} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "8px 4px", color: C.slate, textTransform: "capitalize" }}>
                      {r.role.replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700, color: C.green }}>
                      {r.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </>
      )}

      <Divider title="Admissions Trend" />
      <SectionCard title="Visits Recorded Per Day">
        <TrendChart data={d.trend} color={C.teal} label="Visits" />
      </SectionCard>

      {/* Consent bypasses are what an administrator answers for, so they are
          itemised rather than reduced to a count. */}
      {overrides.length > 0 && (
        <>
          <Divider title="Emergency Consent Overrides" />
          <SectionCard title="Invoked During This Period">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {overrides.map((o, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "8px 4px", color: C.red, whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {o.at ? format(new Date(o.at), "dd MMM yyyy HH:mm") : "—"}
                    </td>
                    <td style={{ padding: "8px 4px", color: C.slate }}>{o.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PersonalReportPage() {
  const { user } = useAuthStore();
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [toDate, setToDate]     = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/reports/personal?from=${fromDate}&to=${toDate}&format=json`);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchReport(); }, [fromDate, toDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/api/reports/personal?from=${fromDate}&to=${toDate}&format=pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `healthchain-personal-report-${fromDate}-to-${toDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF export not yet available on this deployment.");
    } finally {
      setExporting(false);
    }
  };

  const roleMeta  = ROLE_META[data?.role ?? (user as any)?.role ?? ""] ?? { label: "Staff", color: C.slate, icon: Activity };
  const periodDays = differenceInDays(new Date(toDate), new Date(fromDate)) + 1;

  function renderRoleContent() {
    if (!data) return null;
    switch (data.role) {
      case 'practitioner':   return <PractitionerContent d={data} />;
      case 'nurse':          return <NurseContent        d={data} />;
      case 'lab_technician': return <LabTechContent      d={data} />;
      case 'radiologist':    return <RadiologistContent  d={data} />;
      case 'pharmacist':     return <PharmacistContent   d={data} />;
      case 'receptionist':   return <ReceptionistContent d={data} />;
      case 'admin':          return <AdminContent        d={data} />;
      default: return <p style={{ color: C.gray, fontSize: 13, textAlign: "center", padding: "40px 0" }}>No performance data available.</p>;
    }
  }

  return (
    <div style={{ maxWidth: 1100, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${roleMeta.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <roleMeta.icon size={18} style={{ color: roleMeta.color }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", fontFamily: "'Playfair Display', serif" }}>
              My Performance Report
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            {roleMeta.label}{data?.specialization ? ` · ${data.specialization}` : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", color: "#374151" }} />
          <span style={{ fontSize: 13, color: "#9ca3af" }}>to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", color: "#374151" }} />
          <button onClick={fetchReport} disabled={loading}
            style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button onClick={handleExport} disabled={exporting || loading}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, background: `linear-gradient(135deg,${roleMeta.color},${roleMeta.color}cc)`, color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", opacity: exporting ? 0.7 : 1 }}>
            <Download size={14} /> {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* ── Period badge ─────────────────────────────────────────────────────── */}
      {data && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, padding: "7px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, width: "fit-content" }}>
          <Calendar size={12} style={{ color: C.green }} />
          <p style={{ fontSize: 12.5, color: C.green, fontWeight: 600 }}>
            {format(new Date(data.period.from), "dd MMM yyyy")} — {format(new Date(data.period.to), "dd MMM yyyy")}
            &nbsp;·&nbsp;{periodDays}-day period
          </p>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ height: 200, background: "#f1f5f9", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {!loading && data && (
        <>
          <ExecSummary lines={buildSummary(data)} />
          {renderRoleContent()}

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 32, paddingTop: 20, borderTop: "1px solid #f3f4f6" }}>
            <FileText size={12} style={{ color: "#d1d5db" }} />
            <p style={{ fontSize: 11.5, color: "#d1d5db" }}>
              {data.staffName} · {roleMeta.label} · Report generated {format(new Date(data.generatedAt), "dd MMM yyyy 'at' HH:mm")} · HealthChain EMR
            </p>
          </div>
        </>
      )}
    </div>
  );
}
