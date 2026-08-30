"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Building2,
  Search,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  UserPlus,
  AlertCircle,
  ArrowRight,
  Hash,
  Inbox,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Page,
  PageHeader,
  Card,
  Field,
  Input,
  Button,
  Pill,
  Avatar,
  Banner,
  EmptyState,
  SkeletonRow,
  SectionLabel,
  SegmentedControl,
  Modal,
  hoverRow,
  TONES,
  type Tone,
} from "@/components/dashboard/ui";

/* ==========================================================================
   Incoming referrals — patients sent here from another institution.

   Two ways in: browse the list, or look a patient up by the referral number
   they arrived holding. Both end at the same action — converting the referral
   into a live visit at this institution.
   ========================================================================== */

// ── Types ─────────────────────────────────────────────────────────────────────
interface IncomingReferral {
  id: string;
  referralNumber: string;
  patientId: string;
  patientName: string;
  gender: string;
  bloodType: string;
  reason: string;
  clinicalSummary: string;
  urgency: string;
  status: string;
  referredAt: string;
  referringInstitutionName: string;
  receivingDepartmentId?: string;
  receivingPractitionerId?: string;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────
const URGENCY: Record<string, { tone: Tone; label: string; icon: React.ElementType }> = {
  routine: { tone: "success", label: "Routine", icon: Clock },
  urgent: { tone: "urgent", label: "Urgent", icon: AlertTriangle },
  emergency: { tone: "critical", label: "Emergency", icon: AlertTriangle },
  critical: { tone: "accent", label: "Critical", icon: Zap },
};
const getU = (u: string) => URGENCY[u] ?? URGENCY.routine;

const STATUS: Record<string, { tone: Tone; label: string }> = {
  pending: { tone: "urgent", label: "Pending" },
  accepted: { tone: "info", label: "Accepted" },
  completed: { tone: "success", label: "Completed" },
  rejected: { tone: "critical", label: "Rejected" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};
const getS = (s: string) => STATUS[s] ?? STATUS.pending;

/** Urgency banner shared by the lookup result and the admit modal. */
function ReferralSummary({ referral }: { referral: IncomingReferral }) {
  const u = getU(referral.urgency);
  const t = TONES[u.tone];
  const st = getS(referral.status);

  return (
    <div
      style={{
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--hc-border)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: 8, padding: "9px 14px", background: t.tint }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.dot }} />
        <span
          style={{
            font: "700 11px/1 var(--font-sans)",
            letterSpacing: "var(--ls-caps)",
            textTransform: "uppercase",
            color: t.ink,
          }}
        >
          {u.label}
        </span>
        <span style={{ font: "500 11px/1 var(--font-mono)", color: t.ink, opacity: 0.85 }}>
          {referral.referralNumber}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <Pill tone={st.tone} style={{ height: 18, fontSize: 10 }}>
            {st.label}
          </Pill>
        </span>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
        <p
          style={{
            margin: 0,
            font: "700 13.5px/1 var(--font-sans)",
            color: "var(--text-primary)",
          }}
        >
          {referral.patientName}
        </p>
        <p
          style={{
            margin: 0,
            font: "400 12.5px/1.5 var(--font-sans)",
            color: "var(--text-secondary)",
          }}
        >
          {referral.reason}
        </p>
        <p
          className="inline-flex items-center"
          style={{
            margin: 0,
            gap: 5,
            font: "400 11.5px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          <Building2 className="w-3 h-3" />
          Referred from {referral.referringInstitutionName}
        </p>
      </div>
    </div>
  );
}

// ── Referral row ──────────────────────────────────────────────────────────────
// NOTE: do NOT name the prop "ref" — it is a reserved React prop and will be dropped silently.
function ReferralRow({
  referral,
  idx,
  onAdmit,
}: {
  referral: IncomingReferral;
  idx: number;
  onAdmit: (r: IncomingReferral) => void;
}) {
  const u = getU(referral.urgency);
  const st = getS(referral.status);
  const Icon = u.icon;
  const isCrit = referral.urgency === "critical";
  const dot = TONES[u.tone].dot;

  return (
    <div
      className="flex items-center"
      style={{
        gap: 14,
        padding: "12px 20px",
        borderBottom: "1px solid var(--border-faint)",
        transition: "background var(--dur-fast) var(--ease-standard)",
      }}
      {...hoverRow}
    >
      {/* Urgency dot — only a critical referral pulses for attention. */}
      <span className="relative flex flex-shrink-0" style={{ width: 8, height: 8 }}>
        {isCrit && (
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: dot,
              animation: "hcPing 2.4s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
        )}
        <span
          className="relative rounded-full"
          style={{ width: 8, height: 8, background: dot }}
        />
      </span>

      <Avatar name={referral.patientName} seed={idx} />

      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 5 }}>
        <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
          <span
            className="truncate"
            style={{ font: "700 13.5px/1 var(--font-sans)", color: "var(--text-primary)" }}
          >
            {referral.patientName}
          </span>
          <span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--text-muted)" }}>
            {referral.referralNumber}
          </span>
          <Pill tone={u.tone} icon={Icon} style={{ height: 18, fontSize: 10 }}>
            {u.label}
          </Pill>
        </div>

        <span
          className="truncate"
          style={{ font: "400 12.5px/1 var(--font-sans)", color: "var(--text-secondary)" }}
        >
          {referral.reason}
        </span>

        <span
          className="inline-flex items-center flex-wrap"
          style={{ gap: 10, font: "400 11.5px/1 var(--font-sans)", color: "var(--text-muted)" }}
        >
          <span className="inline-flex items-center" style={{ gap: 5 }}>
            <Building2 className="w-3 h-3" />
            {referral.referringInstitutionName}
          </span>
          <span>
            {formatDistanceToNow(new Date(referral.referredAt), { addSuffix: true })}
          </span>
        </span>
      </div>

      <div className="flex items-center flex-shrink-0" style={{ gap: 10 }}>
        <span className="hidden sm:inline-flex">
          <Pill tone={st.tone}>{st.label}</Pill>
        </span>
        {referral.status === "pending" && (
          <Button
            variant="primary"
            size="sm"
            icon={UserPlus}
            onClick={() => onAdmit(referral)}
          >
            Admit
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Admit modal ───────────────────────────────────────────────────────────────
function AdmitModal({
  referral,
  onClose,
  onAdmitted,
}: {
  referral: IncomingReferral;
  onClose: () => void;
  onAdmitted: (visitId: string, visitNumber: string) => void;
}) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [visitType, setVisitType] = useState<"consultation" | "outpatient" | "inpatient">(
    "consultation",
  );
  const [wardOrRoom, setWardOrRoom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefer doctors who are online; if none are, fall back to the full roster
  // so a referral can still be admitted outside busy hours.
  useEffect(() => {
    api
      .get("/api/practitioners/online?role=practitioner")
      .then((res) => {
        const online: Doctor[] = res.data.data?.staff ?? [];
        if (online.length > 0) {
          setDoctors(online);
          return;
        }
        return api
          .get("/api/practitioners?role=practitioner&limit=50")
          .then((r2) => setDoctors(r2.data.data?.practitioners ?? []));
      })
      .catch(() => setDoctors([]))
      .finally(() => setLoadingDocs(false));
  }, []);

  const handleAdmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post(`/api/referrals/${referral.id}/convert-to-visit`, {
        assignedDoctorId: selectedDoc || undefined,
        visitType,
        wardOrRoom: wardOrRoom || undefined,
      });
      onAdmitted(res.data.data.visitId, res.data.data.visitNumber);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? "Failed to admit patient.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Admit referred patient"
      subtitle="Convert this referral into a visit"
      icon={UserPlus}
      width={480}
      scroll
      onClose={onClose}
      footer={
        <>
          <Button full onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            full
            icon={UserPlus}
            loading={submitting}
            onClick={handleAdmit}
          >
            {submitting ? "Admitting…" : "Admit patient"}
          </Button>
        </>
      }
    >
      <ReferralSummary referral={referral} />

      <Field label="Visit type">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 8,
          }}
        >
          {(["consultation", "outpatient", "inpatient"] as const).map((vt) => {
            const on = visitType === vt;
            return (
              <button
                key={vt}
                onClick={() => setVisitType(vt)}
                style={{
                  height: 38,
                  borderRadius: "var(--r-sm)",
                  border: `1px solid ${on ? "var(--brand)" : "var(--hc-border)"}`,
                  background: on ? "var(--brand-tint)" : "var(--surface-sunken)",
                  color: on ? "var(--green-800)" : "var(--text-secondary)",
                  font: `${on ? 700 : 500} 12.5px/1 var(--font-sans)`,
                  textTransform: "capitalize",
                  cursor: "pointer",
                  transition: "all var(--dur-fast) var(--ease-standard)",
                }}
              >
                {vt}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Ward / room" hint="Optional">
        <Input
          value={wardOrRoom}
          onChange={(e) => setWardOrRoom(e.target.value)}
          placeholder="e.g. Ward 3, Room 12"
        />
      </Field>

      <Field label="Assign doctor" hint="Optional — can be assigned later.">
        {loadingDocs ? (
          <div
            className="animate-pulse"
            style={{ height: 40, borderRadius: "var(--r-sm)", background: "var(--surface-sunken)" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            <button
              onClick={() => setSelectedDoc("")}
              className="w-full text-left"
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                border: `1px solid ${!selectedDoc ? "var(--brand)" : "var(--hc-border)"}`,
                background: !selectedDoc ? "var(--brand-tint)" : "var(--surface-sunken)",
                font: "400 12.5px/1 var(--font-sans)",
                fontStyle: "italic",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Unassigned — assign later
            </button>

            {doctors.length === 0 && (
              <p
                style={{
                  margin: 0,
                  padding: "10px 12px",
                  font: "400 12.5px/1 var(--font-sans)",
                  color: "var(--text-muted)",
                }}
              >
                No doctors found
              </p>
            )}

            {doctors.map((doc, i) => {
              const on = selectedDoc === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc.id)}
                  className="w-full flex items-center text-left"
                  style={{
                    gap: 11,
                    padding: "9px 12px",
                    borderRadius: "var(--r-sm)",
                    border: `1px solid ${on ? "var(--brand)" : "var(--hc-border)"}`,
                    background: on ? "var(--brand-tint)" : "var(--surface-sunken)",
                    cursor: "pointer",
                    transition: "all var(--dur-fast) var(--ease-standard)",
                  }}
                >
                  <Avatar name={`${doc.firstName} ${doc.lastName}`} size={28} seed={i} />
                  <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 3 }}>
                    <span
                      className="truncate"
                      style={{
                        font: "600 13px/1 var(--font-sans)",
                        color: "var(--text-primary)",
                      }}
                    >
                      Dr. {doc.firstName} {doc.lastName}
                    </span>
                    {doc.specialization && (
                      <span
                        className="truncate"
                        style={{
                          font: "400 11.5px/1 var(--font-sans)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {doc.specialization}
                      </span>
                    )}
                  </span>
                  {doc.lastSeenAt && (
                    <span
                      className="inline-flex items-center flex-shrink-0"
                      style={{
                        gap: 5,
                        font: "500 11px/1 var(--font-sans)",
                        color: "var(--green-800)",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--green-600)",
                        }}
                      />
                      Online
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {error && (
        <Banner tone="critical" icon={AlertCircle}>
          {error}
        </Banner>
      )}
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Filter = "all" | "pending" | "accepted" | "completed";

export default function IncomingReferralsPage() {
  const router = useRouter();

  const [referrals, setReferrals] = useState<IncomingReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [lookup, setLookup] = useState("");
  const [lookupResult, setLookupResult] = useState<IncomingReferral | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [admitting, setAdmitting] = useState<IncomingReferral | null>(null);
  const [admitted, setAdmitted] = useState<{
    visitId: string;
    visitNumber: string;
  } | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = filter !== "all" ? `?status=${filter}` : "";
        const res = await api.get(`/api/referrals/incoming${params}`);
        setReferrals(res.data.data.referrals ?? []);
      } catch (err: any) {
        setError(err.response?.data?.error?.message ?? "Failed to load referrals.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const iv = setInterval(() => load(true), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleLookup = async () => {
    const val = lookup.trim();
    if (!val) return;
    setLooking(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      // Send as-is — the backend matches case-insensitively.
      const res = await api.get(`/api/referrals/lookup/${val}`);
      setLookupResult(res.data.data);
    } catch (err: any) {
      setLookupError(err.response?.data?.error?.message ?? "Referral not found.");
    } finally {
      setLooking(false);
    }
  };

  /*
   * The server filters by status, so `referrals` only ever holds rows for the
   * active tab. A count is therefore only meaningful for that tab — showing
   * one on the others would report 0 for statuses that may well have rows.
   */
  const activeCount = loading ? undefined : referrals.length;

  return (
    <Page>
      <PageHeader
        eyebrow="Records"
        title="Incoming referrals"
        subtitle={
          <>
            {format(new Date(), "EEEE, d MMMM yyyy")}
            {!loading && filter === "pending" && referrals.length > 0 && (
              <span style={{ color: "var(--urgent-ink)", fontWeight: 600 }}>
                {" "}
                · {referrals.length} pending
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

      {/* ── Referral number lookup — the primary front-desk action ────────── */}
      <Card pad={20}>
        <SectionLabel style={{ marginBottom: 12 }}>
          Patient has a referral number?
        </SectionLabel>

        <div className="flex flex-wrap" style={{ gap: 10 }}>
          <div className="relative" style={{ flex: "1 1 220px", minWidth: 0 }}>
            <Hash
              className="absolute w-4 h-4"
              style={{
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <Input
              value={lookup}
              onChange={(e) => setLookup(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="REF-1234567890-ABC"
              style={{
                paddingLeft: 36,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
              }}
            />
          </div>
          <Button
            variant="primary"
            icon={Search}
            loading={looking}
            disabled={!lookup.trim()}
            onClick={handleLookup}
            style={{ height: 40 }}
          >
            Look up
          </Button>
        </div>

        {lookupError && (
          <div style={{ marginTop: 12 }}>
            <Banner tone="critical" icon={AlertCircle}>
              {lookupError}
            </Banner>
          </div>
        )}

        {lookupResult && (
          <div style={{ marginTop: 12 }}>
            <ReferralSummary referral={lookupResult} />
            <div style={{ marginTop: 10 }}>
              {lookupResult.status === "pending" ? (
                <Button
                  variant="primary"
                  icon={UserPlus}
                  onClick={() => setAdmitting(lookupResult)}
                >
                  Admit this patient
                </Button>
              ) : (
                <p
                  style={{
                    margin: 0,
                    font: "400 12.5px/1.5 var(--font-sans)",
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                  }}
                >
                  This referral is already {lookupResult.status} and cannot be re-admitted.
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      <SegmentedControl<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "pending", label: "Pending", count: filter === "pending" ? activeCount : undefined },
          { value: "accepted", label: "Accepted", count: filter === "accepted" ? activeCount : undefined },
          { value: "completed", label: "Completed", count: filter === "completed" ? activeCount : undefined },
          { value: "all", label: "All", count: filter === "all" ? activeCount : undefined },
        ]}
      />

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

      {/* ── Referral list ─────────────────────────────────────────────────── */}
      <Card>
        {loading ? (
          [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
        ) : referrals.length === 0 ? (
          <EmptyState
            icon={filter === "pending" ? CheckCircle2 : Inbox}
            title={
              filter === "pending" ? "No pending referrals" : `No ${filter} referrals`
            }
            message="Referrals from other institutions appear here."
            pad={64}
          />
        ) : (
          referrals.map((r, i) => (
            <ReferralRow key={r.id} referral={r} idx={i} onAdmit={setAdmitting} />
          ))
        )}
      </Card>

      {/* Admit modal */}
      {admitting && (
        <AdmitModal
          referral={admitting}
          onClose={() => {
            setAdmitting(null);
            setLookupResult(null);
          }}
          onAdmitted={(visitId, visitNumber) => {
            setAdmitting(null);
            setLookupResult(null);
            setAdmitted({ visitId, visitNumber });
            load(true);
          }}
        />
      )}

      {/* Success toast — carries an action, so it is not the plain Toast. */}
      {admitted && (
        <div
          className="fixed z-50"
          style={{
            bottom: 24,
            right: 24,
            width: 320,
            padding: 18,
            background: "var(--surface-card)",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hc-border)",
            boxShadow: "var(--elev-3)",
          }}
        >
          <div className="flex items-start" style={{ gap: 12 }}>
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 38,
                height: 38,
                borderRadius: "var(--r-sm)",
                background: "var(--brand-tint)",
                color: "var(--green-700)",
              }}
            >
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
              <p
                style={{
                  margin: 0,
                  font: "700 13.5px/1 var(--font-sans)",
                  color: "var(--text-primary)",
                }}
              >
                Patient admitted
              </p>
              <p
                style={{
                  margin: 0,
                  font: "400 12px/1.4 var(--font-sans)",
                  color: "var(--text-muted)",
                }}
              >
                Visit{" "}
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {admitted.visitNumber}
                </span>{" "}
                created
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => setAdmitted(null)}
              style={{ width: 26 }}
            />
          </div>

          <Button
            variant="primary"
            full
            iconRight={ArrowRight}
            style={{ marginTop: 14 }}
            onClick={() => {
              router.push(`/dashboard/receptionist/visits/${admitted.visitId}`);
              setAdmitted(null);
            }}
          >
            Open visit
          </Button>
        </div>
      )}
    </Page>
  );
}
