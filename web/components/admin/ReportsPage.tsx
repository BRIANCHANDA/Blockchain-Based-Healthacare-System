"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  FileText,
  Activity,
  Building2,
  Users,
  Download,
  RefreshCw,
  TrendingUp,
  FlaskConical,
  Scan,
  Pill,
  Stethoscope,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Shield,
} from "lucide-react";
import { format, subDays } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "clinical" | "operational" | "administrative";

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  emergency: "#ea580c",
  urgent: "#f59e0b",
  routine: "#16a34a",
};
const ROLE_COLORS: Record<string, string> = {
  practitioner: "#2563eb",
  nurse: "#0e7490",
  lab_technician: "#d97706",
  radiologist: "#7c3aed",
  pharmacist: "#166534",
  receptionist: "#0369a1",
  admin: "#dc2626",
};
const CHART_COLORS = [
  "#166534",
  "#2563eb",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0e7490",
  "#ea580c",
];

// ── Reusable components ───────────────────────────────────────────────────────
function StatBox({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: any;
  sub?: string;
  icon: any;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #eaecf0",
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={15} style={{ color }} />
        </div>
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </p>
      </div>
      <p style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>
        {value?.toLocaleString() ?? "—"}
      </p>
      {sub && (
        <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 4 }}>{sub}</p>
      )}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eaecf0",
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6" }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111" }}>
          {title}
        </p>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      style={{
        height: 200,
        background: "#f1f5f9",
        borderRadius: 12,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = !(user as any)?.institutionId;

  const [tab, setTab] = useState<Tab>("clinical");
  const [fromDate, setFromDate] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<Record<Tab, any>>({
    clinical: null,
    operational: null,
    administrative: null,
  });
  const [loading, setLoading] = useState<Record<Tab, boolean>>({
    clinical: false,
    operational: false,
    administrative: false,
  });
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(
    async (type: Tab) => {
      setLoading((l) => ({ ...l, [type]: true }));
      try {
        const res = await api.get(
          `/api/reports/${type}?from=${fromDate}&to=${toDate}&format=json`,
        );
        setData((d) => ({ ...d, [type]: res.data.data }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading((l) => ({ ...l, [type]: false }));
      }
    },
    [fromDate, toDate],
  );

  useEffect(() => {
    fetchReport(tab);
  }, [tab, fromDate, toDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(
        `/api/reports/${tab}?from=${fromDate}&to=${toDate}&format=pdf`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
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

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "clinical", label: "Clinical", icon: Activity },
    { key: "operational", label: "Operational", icon: TrendingUp },
    { key: "administrative", label: "Administrative", icon: Building2 },
  ];

  return (
    <div style={{ maxWidth: 1200, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#111827",
              fontFamily: "'Playfair Display', serif",
              marginBottom: 4,
            }}
          >
            Reports
          </h1>
          <p style={{ fontSize: 13.5, color: "#9ca3af" }}>
            {isSuperAdmin
              ? "System-wide analytics"
              : `Analytics for ${d?.institutionName ?? "your institution"}`}
          </p>
        </div>

        {/* Date range + export */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              outline: "none",
              color: "#374151",
            }}
          />
          <span style={{ fontSize: 13, color: "#9ca3af" }}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontSize: 13,
              outline: "none",
              color: "#374151",
            }}
          />
          <button
            onClick={() => fetchReport(tab)}
            disabled={isLoading}
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
            }}
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              borderRadius: 10,
              background: "linear-gradient(135deg,#166534,#15803d)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              opacity: exporting ? 0.7 : 1,
            }}
          >
            <Download size={14} /> {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          background: "#f1f5f9",
          padding: 4,
          borderRadius: 12,
          width: "fit-content",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 18px",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 600,
              transition: "all 0.15s",
              background: tab === t.key ? "#fff" : "transparent",
              color: tab === t.key ? "#166534" : "#6b7280",
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Period badge */}
      {d && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
            padding: "8px 14px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 10,
            width: "fit-content",
          }}
        >
          <Calendar size={13} style={{ color: "#166534" }} />
          <p style={{ fontSize: 12.5, color: "#166534", fontWeight: 600 }}>
            {format(new Date(d.period.from), "dd MMM yyyy")} —{" "}
            {format(new Date(d.period.to), "dd MMM yyyy")}
          </p>
        </div>
      )}

      {/* ── CLINICAL TAB ────────────────────────────────────────────────────── */}
      {tab === "clinical" &&
        (isLoading ? (
          <Skeleton />
        ) : !d ? null : (
          <>
            {/* Visit summary stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <StatBox
                label="Total Visits"
                value={d.visits.total}
                sub="in period"
                icon={ClipboardList}
                color="#166534"
              />
              <StatBox
                label="Completed"
                value={d.visits.completed}
                sub="discharged"
                icon={CheckCircle2}
                color="#0e7490"
              />
              <StatBox
                label="Active"
                value={d.visits.active}
                sub="in progress"
                icon={Activity}
                color="#2563eb"
              />
              <StatBox
                label="Cancelled"
                value={d.visits.cancelled}
                sub="visits"
                icon={AlertTriangle}
                color="#dc2626"
              />
            </div>

            {/* Lab / Imaging / Pharmacy */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <StatBox
                label="Lab Orders"
                value={d.laboratory.total}
                sub={`${d.laboratory.pending} pending`}
                icon={FlaskConical}
                color="#d97706"
              />
              <StatBox
                label="Imaging Orders"
                value={d.imaging.total}
                sub={`${d.imaging.pending} pending`}
                icon={Scan}
                color="#7c3aed"
              />
              <StatBox
                label="Prescriptions"
                value={d.pharmacy.total}
                sub={`${d.pharmacy.dispensed} dispensed`}
                icon={Pill}
                color="#166534"
              />
            </div>

            {/* Charts row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 16,
                marginBottom: 20,
              }}
            >
              {/* Visits trend */}
              <SectionCard title="Visits Trend">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={d.visits.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => v?.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#166534"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* By priority */}
              <SectionCard title="By Priority">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={d.visits.byPriority}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="priority" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {d.visits.byPriority.map((entry: any, i: number) => (
                        <Cell
                          key={i}
                          fill={PRIORITY_COLORS[entry.priority] ?? "#166534"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* By type */}
              <SectionCard title="By Visit Type">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={d.visits.byType}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      label={({ type, percent }: any) =>
                        `${type} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                      style={{ fontSize: 10 }}
                    >
                      {d.visits.byType.map((_: any, i: number) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            {/* Lab / Imaging / Pharmacy breakdown */}
            <SectionCard title="Department Completion Rates">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 20,
                }}
              >
                {[
                  {
                    label: "Laboratory",
                    total: d.laboratory.total,
                    completed: d.laboratory.completed,
                    color: "#d97706",
                  },
                  {
                    label: "Imaging",
                    total: d.imaging.total,
                    completed: d.imaging.completed,
                    color: "#7c3aed",
                  },
                  {
                    label: "Pharmacy",
                    total: d.pharmacy.total,
                    completed: d.pharmacy.dispensed,
                    color: "#166534",
                  },
                ].map((item) => {
                  const pct =
                    item.total > 0
                      ? Math.round((item.completed / item.total) * 100)
                      : 0;
                  return (
                    <div key={item.label}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#374151",
                          }}
                        >
                          {item.label}
                        </p>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: item.color,
                          }}
                        >
                          {pct}%
                        </p>
                      </div>
                      <div
                        style={{
                          height: 8,
                          background: "#f1f5f9",
                          borderRadius: 999,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: item.color,
                            borderRadius: 999,
                            transition: "width 0.5s",
                          }}
                        />
                      </div>
                      <p
                        style={{
                          fontSize: 11.5,
                          color: "#9ca3af",
                          marginTop: 4,
                        }}
                      >
                        {item.completed} of {item.total}
                      </p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </>
        ))}

      {/* ── OPERATIONAL TAB ─────────────────────────────────────────────────── */}
      {tab === "operational" &&
        (isLoading ? (
          <Skeleton />
        ) : !d ? null : (
          <>
            {/* Referrals stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <StatBox
                label="Outgoing Referrals"
                value={d.referrals.totalOutgoing}
                sub="sent out"
                icon={TrendingUp}
                color="#166534"
              />
              <StatBox
                label="Incoming Referrals"
                value={d.referrals.totalIncoming}
                sub="received"
                icon={Activity}
                color="#2563eb"
              />
              <StatBox
                label="Acceptance Rate"
                value={`${d.referrals.acceptanceRate}%`}
                sub="accepted+completed"
                icon={CheckCircle2}
                color="#0e7490"
              />
              <StatBox
                label="Appointments"
                value={d.appointments.total}
                sub={`${d.appointments.attendanceRate}% attended`}
                icon={Calendar}
                color="#7c3aed"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 20,
              }}
            >
              {/* Referral status breakdown */}
              <SectionCard title="Referral Status Breakdown">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={[
                      { status: "Pending", count: d.referrals.pending },
                      { status: "Accepted", count: d.referrals.accepted },
                      { status: "Completed", count: d.referrals.completed },
                      { status: "Rejected", count: d.referrals.rejected },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {["#f59e0b", "#16a34a", "#2563eb", "#dc2626"].map(
                        (c, i) => (
                          <Cell key={i} fill={c} />
                        ),
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Appointment compliance */}
              <SectionCard title="Appointment Compliance">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 180,
                  }}
                >
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Attended", value: d.appointments.attended },
                          {
                            name: "Cancelled",
                            value: d.appointments.cancelled,
                          },
                          {
                            name: "Other",
                            value: Math.max(
                              0,
                              d.appointments.total -
                                d.appointments.attended -
                                d.appointments.cancelled,
                            ),
                          },
                        ]}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                      >
                        {["#166534", "#dc2626", "#e5e7eb"].map((c, i) => (
                          <Cell key={i} fill={c} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            {/* Top doctors table */}
            <SectionCard title="Top Doctors by Visit Count">
              {!d.staffActivity.topDoctors?.length ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "#9ca3af",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  No data for this period
                </p>
              ) : (
                <div>
                  {/* Table header */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1.5fr 1fr",
                      gap: 12,
                      padding: "8px 16px",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    {["Doctor", "Specialization", "Visits"].map((h) => (
                      <p
                        key={h}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#9ca3af",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {h}
                      </p>
                    ))}
                  </div>
                  {d.staffActivity.topDoctors
                    .slice(0, 10)
                    .map((doc: any, i: number) => (
                      <div
                        key={doc.doctorId}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1.5fr 1fr",
                          gap: 12,
                          padding: "12px 16px",
                          borderBottom: i < 9 ? "1px solid #f9fafb" : "none",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background:
                                "linear-gradient(135deg,#1e293b,#334155)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#fff",
                            }}
                          >
                            {doc.name
                              ?.split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#111",
                            }}
                          >
                            {doc.name}
                          </p>
                        </div>
                        <p style={{ fontSize: 12.5, color: "#6b7280" }}>
                          {doc.specialization ?? "—"}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              background: "#f1f5f9",
                              borderRadius: 999,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, (doc.visitCount / (d.staffActivity.topDoctors[0]?.visitCount || 1)) * 100)}%`,
                                background: "#166534",
                                borderRadius: 999,
                              }}
                            />
                          </div>
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#166534",
                              minWidth: 30,
                              textAlign: "right",
                            }}
                          >
                            {doc.visitCount}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </SectionCard>
          </>
        ))}

      {/* ── ADMINISTRATIVE TAB ──────────────────────────────────────────────── */}
      {tab === "administrative" &&
        (isLoading ? (
          <Skeleton />
        ) : !d ? null : (
          <>
            {/* Top stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSuperAdmin
                  ? "repeat(4,1fr)"
                  : "repeat(3,1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <StatBox
                label="Total Patients"
                value={d.patients.total}
                sub="registered"
                icon={Users}
                color="#2563eb"
              />
              <StatBox
                label="New This Period"
                value={d.patients.newInPeriod}
                sub="registrations"
                icon={TrendingUp}
                color="#166534"
              />
              <StatBox
                label="Total Staff"
                value={d.staff.total}
                sub={`${d.staff.unverified} unverified`}
                icon={Stethoscope}
                color="#7c3aed"
              />
              {isSuperAdmin && (
                <StatBox
                  label="Institutions"
                  value={d.institutions?.total}
                  sub={`${d.institutions?.active} active`}
                  icon={Building2}
                  color="#0369a1"
                />
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 20,
              }}
            >
              {/* Patient registration trend */}
              <SectionCard title="Patient Registration Trend">
                {d.patients.registrationTrend?.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={d.patients.registrationTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => v?.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#9ca3af",
                      textAlign: "center",
                      padding: "60px 0",
                    }}
                  >
                    No registration data for this period
                  </p>
                )}
              </SectionCard>

              {/* Staff by role */}
              <SectionCard title="Staff by Role">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={d.staff.byRole} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="role"
                      tick={{ fontSize: 10 }}
                      width={90}
                    />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {d.staff.byRole.map((entry: any, i: number) => (
                        <Cell
                          key={i}
                          fill={ROLE_COLORS[entry.role] ?? "#166534"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            {/* Audit events */}
            <SectionCard
              title={`Audit Log — ${d.audit.totalEvents.toLocaleString()} events`}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                }}
              >
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={d.audit.byAction.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="action"
                      tick={{ fontSize: 9 }}
                      angle={-30}
                      textAnchor="end"
                      height={45}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#166534" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    justifyContent: "center",
                  }}
                >
                  {d.audit.byAction.slice(0, 6).map((a: any, i: number) => (
                    <div
                      key={a.action}
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: CHART_COLORS[i % CHART_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      <p
                        style={{
                          fontSize: 12.5,
                          color: "#374151",
                          flex: 1,
                          textTransform: "capitalize",
                        }}
                      >
                        {a.action?.replace(/_/g, " ")}
                      </p>
                      <p
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: "#111",
                        }}
                      >
                        {Number(a.count).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* Institution comparison (super admin only) */}
            {isSuperAdmin && d.institutions?.list?.length > 0 && (
              <SectionCard title="Institution Comparison">
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                        {[
                          "Institution",
                          "Type",
                          "Patients",
                          "Staff",
                          "Total Visits",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "8px 12px",
                              textAlign: "left",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#9ca3af",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.institutions.list.map((inst: any, i: number) => (
                        <tr
                          key={inst.id}
                          style={{
                            borderBottom:
                              i < d.institutions.list.length - 1
                                ? "1px solid #f9fafb"
                                : "none",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#fafbfc")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "none")
                          }
                        >
                          <td style={{ padding: "12px 12px" }}>
                            <p style={{ fontWeight: 600, color: "#111" }}>
                              {inst.name}
                            </p>
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: "#f0fdf4",
                                color: "#166534",
                                textTransform: "capitalize",
                              }}
                            >
                              {inst.type}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "12px 12px",
                              fontWeight: 600,
                              color: "#2563eb",
                            }}
                          >
                            {inst.totalPatients.toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: "12px 12px",
                              fontWeight: 600,
                              color: "#7c3aed",
                            }}
                          >
                            {inst.totalStaff.toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: "12px 12px",
                              fontWeight: 600,
                              color: "#166534",
                            }}
                          >
                            {inst.totalVisits.toLocaleString()}
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: inst.isActive
                                  ? "#f0fdf4"
                                  : "#fef2f2",
                                color: inst.isActive ? "#15803d" : "#dc2626",
                              }}
                            >
                              {inst.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}
          </>
        ))}

      {/* Generated at footer */}
      {d && (
        <p
          style={{
            fontSize: 11.5,
            color: "#d1d5db",
            textAlign: "center",
            marginTop: 24,
          }}
        >
          Report generated at{" "}
          {format(new Date(d.generatedAt), "dd MMM yyyy HH:mm")} · HealthChain
          EMR
        </p>
      )}
    </div>
  );
}
