"use client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, appointmentApi } from "@/lib/api";
import {
  ArrowLeftRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Search,
  X,
  Stethoscope,
  CalendarDays,
  User,
  ArrowRight,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  KpiCard,
  KpiGrid,
  Pill as Badge,
  MonoTag,
  Button,
  Banner,
  EmptyState,
  SkeletonBlock,
  SectionLabel,
  SearchInput,
  SegmentedControl,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";
import { getReferralUrgency, getReferralStatus } from "./referralVocab";

/* ==========================================================================
   Referrals page.

   Three streams, and the split is entirely client-side because the API has
   no "referred by me" filter:

     Incoming        APT- visits assigned TO me that carry an
                     admittingDiagnosis (the marker of an internal referral)
     Sent — internal  APT- visits I created but assigned to someone else
     Sent — external  /api/referrals/outgoing (cross-institution, on-chain)

   The session check at the top of load() exists only to get `myId` for that
   split — without it, incoming and outgoing cannot be told apart.
   ========================================================================== */

// ── Types ─────────────────────────────────────────────────────────────────────
interface ExternalReferral {
  id: string;
  referralNumber: string;
  patientName: string;
  patientId: string;
  reason: string;
  clinicalSummary: string;
  urgency: string;
  status: string;
  referredAt: string;
  acceptedAt?: string;
  completedAt?: string;
  responseNotes?: string;
  receivingInstitutionName: string;
}

interface InternalReferral {
  id: string;
  visitNumber: string;
  patientName: string;
  patientId: string;
  chiefComplaint: string;
  admittingDiagnosis: string;
  priority: string;
  admissionDate: string;
  status: string;
  // for outgoing (I sent it)
  assignedDoctorId?: string;
  doctorName?: string;
  // for incoming (sent to me)
  createdByPractitionerId?: string;
  referringDoctorName?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────
type FilterKey = "all" | "pending" | "accepted" | "completed" | "rejected";
type MainTab = "incoming" | "outgoing-internal" | "outgoing-external";

/* Which tone each main tab's count badge takes. */
const TAB_TONE: Record<MainTab, Tone> = {
  incoming: "success",
  "outgoing-internal": "info",
  "outgoing-external": "urgent",
};

// ── External referral card ────────────────────────────────────────────────────
function ExternalCard({ referral }: { referral: ExternalReferral }) {
  const u = getReferralUrgency(referral.urgency);
  const st = getReferralStatus(referral.status);
  const sTone = TONES[st.tone];
  const StatusIcon = st.icon;

  /* The backend writes "Converted to visit …" into responseNotes when the
     receiving hospital admits the patient — that is an outcome, not a note. */
  const admitted = referral.responseNotes?.startsWith("Converted to visit");

  return (
    <div
      className="w-full"
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ gap: 10, padding: "10px 16px", background: sTone.tint }}
      >
        <span className="inline-flex items-center" style={{ gap: 8 }}>
          <StatusIcon className="w-3.5 h-3.5" style={{ color: sTone.ink }} />
          <span
            style={{ font: "700 11.5px/1 var(--font-sans)", color: sTone.ink }}
          >
            {st.label}
          </span>
        </span>
        <MonoTag style={{ height: 18, fontSize: 10, background: "var(--surface-card)" }}>
          {referral.referralNumber}
        </MonoTag>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex flex-col" style={{ gap: 5 }}>
          <p
            style={{
              margin: 0,
              font: "700 13.5px/1 var(--font-sans)",
              color: "var(--text-primary)",
            }}
          >
            {referral.patientName}
          </p>
          <span
            className="inline-flex items-center"
            style={{
              gap: 6,
              font: "400 12px/1 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            <ArrowRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            {referral.receivingInstitutionName}
          </span>
        </div>

        <p
          className="line-clamp-2"
          style={{
            margin: 0,
            font: "400 12.5px/1.6 var(--font-sans)",
            color: "var(--text-secondary)",
          }}
        >
          {referral.reason}
        </p>

        <div
          className="flex items-center justify-between flex-wrap"
          style={{
            gap: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--border-faint)",
          }}
        >
          <Badge tone={u.tone} icon={u.icon} style={{ height: 20, fontSize: 10 }}>
            {u.label}
          </Badge>
          <div className="text-right flex flex-col" style={{ gap: 3 }}>
            <span
              style={{
                font: "400 11px/1 var(--font-sans)",
                color: "var(--text-muted)",
              }}
            >
              {formatDistanceToNow(new Date(referral.referredAt), { addSuffix: true })}
            </span>
            {referral.acceptedAt && (
              <span
                style={{ font: "500 11px/1 var(--font-sans)", color: "var(--info-ink)" }}
              >
                Accepted {format(new Date(referral.acceptedAt), "dd MMM, HH:mm")}
              </span>
            )}
          </div>
        </div>

        {admitted ? (
          <Banner tone="success" icon={CheckCircle2}>
            Patient admitted at the receiving institution.
          </Banner>
        ) : (
          referral.responseNotes && (
            <div
              className="flex"
              style={{
                gap: 8,
                padding: "10px 12px",
                borderRadius: "var(--r-xs)",
                background: "var(--surface-sunken)",
              }}
            >
              <SectionLabel style={{ flexShrink: 0, marginTop: 2 }}>Note</SectionLabel>
              <p
                style={{
                  margin: 0,
                  font: "400 12px/1.5 var(--font-sans)",
                  color: "var(--text-secondary)",
                  fontStyle: "italic",
                }}
              >
                {referral.responseNotes}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Internal referral card ────────────────────────────────────────────────────
function InternalCard({
  referral,
  direction,
  onOpen,
}: {
  referral: InternalReferral;
  direction: "incoming" | "outgoing";
  onOpen?: () => void;
}) {
  const u = getReferralUrgency(referral.priority);
  const st = getReferralStatus(referral.status);
  const uTone = TONES[u.tone];
  const StatusIcon = st.icon;
  const date = new Date(referral.admissionDate);
  const dateLabel = isToday(date)
    ? "Today"
    : isTomorrow(date)
      ? "Tomorrow"
      : format(date, "EEE d MMM");

  return (
    <button
      onClick={onOpen}
      className="w-full text-left"
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--hc-border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        cursor: onOpen ? "pointer" : "default",
        transition: "box-shadow var(--dur-base) var(--ease-standard)",
      }}
      onMouseEnter={(e) => {
        if (onOpen) e.currentTarget.style.boxShadow = "var(--elev-2)";
      }}
      onMouseLeave={(e) => {
        if (onOpen) e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        className="flex items-center justify-between flex-wrap"
        style={{ gap: 10, padding: "10px 16px", background: uTone.tint }}
      >
        <span className="inline-flex items-center" style={{ gap: 8 }}>
          <Stethoscope className="w-3.5 h-3.5" style={{ color: uTone.ink }} />
          <span
            style={{ font: "700 11.5px/1 var(--font-sans)", color: uTone.ink }}
          >
            {direction === "incoming" ? "Incoming" : "Sent"} · internal
          </span>
        </span>
        <span className="inline-flex items-center" style={{ gap: 8 }}>
          <Badge tone={st.tone} icon={StatusIcon} style={{ height: 18, fontSize: 10 }}>
            {st.label}
          </Badge>
          <MonoTag
            style={{ height: 18, fontSize: 10, background: "var(--surface-card)" }}
          >
            {referral.visitNumber}
          </MonoTag>
        </span>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex items-start justify-between" style={{ gap: 12 }}>
          <div className="min-w-0 flex flex-col" style={{ gap: 6 }}>
            <span className="inline-flex items-center" style={{ gap: 8 }}>
              <User className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <span
                style={{
                  font: "700 13.5px/1 var(--font-sans)",
                  color: "var(--text-primary)",
                }}
              >
                {referral.patientName}
              </span>
            </span>

            {/* Who it came from, or who it went to. */}
            {direction === "outgoing" && referral.doctorName && (
              <span
                className="inline-flex items-center"
                style={{
                  gap: 6,
                  marginLeft: 22,
                  font: "400 12px/1 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                <ArrowRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                Referred to Dr. {referral.doctorName}
              </span>
            )}
            {direction === "incoming" && referral.referringDoctorName && (
              <span
                className="inline-flex items-center"
                style={{
                  gap: 6,
                  marginLeft: 22,
                  font: "400 12px/1 var(--font-sans)",
                  color: "var(--text-secondary)",
                }}
              >
                <ArrowRight
                  className="w-3 h-3"
                  style={{ color: "var(--text-muted)", transform: "scaleX(-1)" }}
                />
                From Dr. {referral.referringDoctorName}
              </span>
            )}
          </div>
          {onOpen && (
            <ChevronRight
              className="w-4 h-4 flex-shrink-0"
              style={{ color: "var(--text-disabled)", marginTop: 2 }}
            />
          )}
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: "var(--r-xs)",
            background: "var(--surface-sunken)",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <SectionLabel>
            {direction === "outgoing" ? "Your referral note" : "Reason for referral"}
          </SectionLabel>
          <p
            style={{
              margin: 0,
              font: "400 12.5px/1.6 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            {referral.admittingDiagnosis || referral.chiefComplaint}
          </p>
        </div>

        <div
          className="flex items-center justify-between flex-wrap"
          style={{
            gap: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--border-faint)",
          }}
        >
          <Badge tone={u.tone} icon={u.icon} style={{ height: 20, fontSize: 10 }}>
            {u.label}
          </Badge>
          <span
            className="inline-flex items-center"
            style={{
              gap: 6,
              font: "400 11px/1 var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            <CalendarDays className="w-3 h-3" />
            {dateLabel} · {format(date, "h:mm a")}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return <SkeletonBlock height={210} radius="var(--r-md)" />;
}

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS: { key: MainTab; label: string; icon: any }[] = [
  { key: "incoming", label: "Incoming", icon: Stethoscope },
  { key: "outgoing-internal", label: "Sent — Internal", icon: ArrowRight },
  { key: "outgoing-external", label: "Sent — External", icon: ArrowLeftRight },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DoctorReferralsPage() {
  const router = useRouter();

  const [outgoingExternal, setOutgoingExternal] = useState<ExternalReferral[]>(
    [],
  );
  const [outgoingInternal, setOutgoingInternal] = useState<InternalReferral[]>(
    [],
  );
  const [incoming, setIncoming] = useState<InternalReferral[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("incoming");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      // Get my user ID first — needed to split incoming vs outgoing
      const myProfileRes = await api.get("/api/auth/session/check");
      const myId = myProfileRes.data?.data?.user?.id;

      const [extRes, incomingRes, outgoingInternalRes, handoversRes] = await Promise.all([
        // Outgoing external referrals
        api.get("/api/referrals/outgoing"),
        // Incoming internal: APT- visits assigned TO me (doctorId filter)
        myId
          ? appointmentApi.list({
              status: "scheduled",
              doctorId: myId,
              limit: 100,
            })
          : Promise.resolve({ data: { data: { appointments: [] } } }),
        // Outgoing internal: all scheduled APT- visits at institution,
        // filtered client-side for ones I created for someone else
        appointmentApi.list({ status: "scheduled", limit: 200 }),
        appointmentApi.handovers(),
      ]);

      setOutgoingExternal(extRes.data?.data?.referrals ?? []);

      // INCOMING: assigned to me, has admittingDiagnosis (= internal referral)
      const incomingRaw: any[] = incomingRes.data?.data?.appointments ?? [];
      const myIncoming = incomingRaw
        .filter(
          (a: any) => a.visitNumber?.startsWith("APT-") && a.admittingDiagnosis,
        )
        .map((a: any) => ({
          id: a.id,
          visitNumber: a.visitNumber,
          patientName: a.patientName,
          patientId: a.patientId,
          chiefComplaint: a.chiefComplaint,
          admittingDiagnosis: a.admittingDiagnosis,
          priority: a.priority,
          admissionDate: a.admissionDate,
          status: a.status,
          assignedDoctorId: a.assignedDoctorId,
          doctorName: a.doctorName,
          createdByPractitionerId: a.createdByPractitionerId,
          referringDoctorName: a.referringDoctorName ?? null,
        }));

      // OUTGOING INTERNAL: I created it, assigned to someone else
      const allScheduled: any[] =
        outgoingInternalRes.data?.data?.appointments ?? [];
      const myOutgoing = allScheduled
        .filter(
          (a: any) =>
            a.visitNumber?.startsWith("APT-") &&
            a.admittingDiagnosis &&
            a.createdByPractitionerId === myId &&
            a.assignedDoctorId !== myId,
        )
        .map((a: any) => ({
          id: a.id,
          visitNumber: a.visitNumber,
          patientName: a.patientName,
          patientId: a.patientId,
          chiefComplaint: a.chiefComplaint,
          admittingDiagnosis: a.admittingDiagnosis,
          priority: a.priority,
          admissionDate: a.admissionDate,
          status: a.status,
          assignedDoctorId: a.assignedDoctorId,
          doctorName: a.doctorName,
          createdByPractitionerId: a.createdByPractitionerId,
        }));

      setOutgoingInternal([...(handoversRes.data?.data?.outgoing ?? []), ...myOutgoing]);
      setIncoming([...(handoversRes.data?.data?.incoming ?? []), ...myIncoming]);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ?? "Failed to load referrals.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useLiveRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
  }, [load]);

  // Counts
  const extCounts: Record<FilterKey, number> = {
    all: outgoingExternal.length,
    pending: outgoingExternal.filter((r) => r.status === "pending").length,
    accepted: outgoingExternal.filter((r) => r.status === "accepted").length,
    completed: outgoingExternal.filter((r) => r.status === "completed").length,
    rejected: outgoingExternal.filter((r) => r.status === "rejected").length,
  };

  const applySearch = (items: any[], fields: string[]) =>
    !search
      ? items
      : items.filter((i) =>
          fields.some((f) =>
            i[f]?.toLowerCase?.().includes(search.toLowerCase()),
          ),
        );

  const filteredExternal = outgoingExternal
    .filter((r) => filter === "all" || r.status === filter)
    .filter(
      (r) =>
        !search ||
        [
          r.patientName,
          r.referralNumber,
          r.receivingInstitutionName,
          r.reason,
        ].some((f) => f?.toLowerCase().includes(search.toLowerCase())),
    );

  const filteredOutInternal = applySearch(outgoingInternal, [
    "patientName",
    "visitNumber",
    "admittingDiagnosis",
    "doctorName",
  ]);
  const filteredIncoming = applySearch(incoming, [
    "patientName",
    "visitNumber",
    "admittingDiagnosis",
    "referringDoctorName",
  ]);

  const tabBadge: Record<MainTab, number> = {
    incoming: incoming.length,
    "outgoing-internal": outgoingInternal.length,
    "outgoing-external": extCounts.pending,
  };

  const isFiltered = !!search || filter !== "all";
  const clearFilters = () => {
    setSearch("");
    setFilter("all");
  };

  /* Every stream renders the same grid — only the cards differ. */
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 14,
  };

  return (
    <Page maxWidth={1200}>
      <PageHeader
        eyebrow="Coordination"
        title="Referrals"
        subtitle={
          <>
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && incoming.length > 0 && (
              <span style={{ color: "var(--green-700)", fontWeight: 600 }}>
                {" "}
                · {incoming.length} incoming
              </span>
            )}
            {!loading && extCounts.pending > 0 && (
              <span style={{ color: "var(--urgent-ink)", fontWeight: 600 }}>
                {" "}
                · {extCounts.pending} awaiting response
              </span>
            )}
          </>
        }
        actions={
          <Button
            icon={RefreshCw}
            onClick={() => load(true)}
            disabled={refreshing}
            style={{ padding: 0, width: 38 }}
          />
        }
      />

      <KpiGrid min={220}>
        <KpiCard
          label="Incoming"
          value={incoming.length}
          sub="Referred to you"
          icon={Stethoscope}
          tone="success"
          loading={loading}
          onClick={() => setMainTab("incoming")}
        />
        <KpiCard
          label="Sent · internal"
          value={outgoingInternal.length}
          sub="To colleagues here"
          icon={ArrowRight}
          tone="info"
          loading={loading}
          onClick={() => setMainTab("outgoing-internal")}
        />
        <KpiCard
          label="Sent · external"
          value={outgoingExternal.length}
          sub="To other institutions"
          icon={ArrowLeftRight}
          tone="urgent"
          loading={loading}
          onClick={() => setMainTab("outgoing-external")}
        />
      </KpiGrid>

      {/* ── Main tabs + search ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
        <SegmentedControl<MainTab>
          value={mainTab}
          onChange={setMainTab}
          options={TABS.map(({ key, label }) => ({
            value: key,
            label,
            count: tabBadge[key],
          }))}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search patient, doctor, reason…"
          icon={Search}
          clearIcon={X}
          style={{ flex: "1 1 200px", maxWidth: 320 }}
        />
      </div>

      {/* Status filter — only meaningful for external referrals. */}
      {mainTab === "outgoing-external" && (
        <SegmentedControl<FilterKey>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: extCounts.all },
            { value: "pending", label: "Pending", count: extCounts.pending },
            { value: "accepted", label: "Accepted", count: extCounts.accepted },
            { value: "completed", label: "Completed", count: extCounts.completed },
            { value: "rejected", label: "Rejected", count: extCounts.rejected },
          ]}
        />
      )}

      {error && (
        <Banner
          tone="critical"
          icon={AlertCircle}
          action={
            <Button variant="ghost" size="sm" onClick={() => load(false)}>
              Retry
            </Button>
          }
        >
          {error}
        </Banner>
      )}

      {/* ── INCOMING INTERNAL ────────────────────────────────────────────── */}
      {mainTab === "incoming" &&
        (loading ? (
          <div style={gridStyle}>
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredIncoming.length === 0 ? (
          <Card>
            <EmptyState
              icon={Stethoscope}
              title="No incoming referrals"
              message="When a colleague refers a patient to you, it appears here."
              pad={64}
            />
          </Card>
        ) : (
          <div style={gridStyle}>
            {filteredIncoming.map((r) => (
              <InternalCard
                key={r.id}
                referral={r}
                direction="incoming"
                onOpen={() => router.push(`/dashboard/doctor/visit/${r.id}`)}
              />
            ))}
          </div>
        ))}

      {/* ── OUTGOING INTERNAL ────────────────────────────────────────────── */}
      {mainTab === "outgoing-internal" &&
        (loading ? (
          <div style={gridStyle}>
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredOutInternal.length === 0 ? (
          <Card>
            <EmptyState
              icon={ArrowRight}
              title="No internal referrals sent"
              message="Patients you refer to a colleague within this institution appear here."
              tone="info"
              pad={64}
            />
          </Card>
        ) : (
          <div style={gridStyle}>
            {filteredOutInternal.map((r) => (
              <InternalCard key={r.id} referral={r} direction="outgoing" />
            ))}
          </div>
        ))}

      {/* ── OUTGOING EXTERNAL ────────────────────────────────────────────── */}
      {mainTab === "outgoing-external" &&
        (loading ? (
          <div style={gridStyle}>
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredExternal.length === 0 ? (
          <Card>
            <EmptyState
              icon={ArrowLeftRight}
              title={
                outgoingExternal.length === 0
                  ? "No external referrals sent"
                  : "No referrals match your filters"
              }
              message={
                outgoingExternal.length === 0
                  ? "Referrals to other institutions appear here."
                  : "Try clearing your search or status filter."
              }
              tone="urgent"
              pad={64}
              action={
                isFiltered ? (
                  <Button size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div style={gridStyle}>
            {filteredExternal.map((r) => (
              <ExternalCard key={r.id} referral={r} />
            ))}
          </div>
        ))}

      {!loading && (
        <p
          className="text-center"
          style={{
            margin: 0,
            font: "400 12px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          {mainTab === "incoming" &&
            `${filteredIncoming.length} incoming referral${filteredIncoming.length !== 1 ? "s" : ""}`}
          {mainTab === "outgoing-internal" &&
            `${filteredOutInternal.length} internal referral${filteredOutInternal.length !== 1 ? "s" : ""} sent`}
          {mainTab === "outgoing-external" &&
            `${filteredExternal.length} of ${outgoingExternal.length} external referral${outgoingExternal.length !== 1 ? "s" : ""}`}
        </p>
      )}
    </Page>
  );
}
