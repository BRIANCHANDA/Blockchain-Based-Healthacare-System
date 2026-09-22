"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { CreateReferralModal } from "@/components/doctor/tabs/CreateReferalModal";
import { InternalReferralModal } from "@/components/doctor/tabs/InternalReferralModal";
import {
  ArrowLeftRight,
  Building2,
  ChevronRight,
  Stethoscope,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Pill as Badge,
  MonoTag,
  Button,
  EmptyState,
  SkeletonBlock,
  SectionLabel,
  TONES,
} from "@/components/dashboard/ui";
import { getReferralUrgency, getReferralStatus } from "./referralVocab";

/* ==========================================================================
   Referrals tab.

   Two distinct routes out of a visit:
     · Internal — another specialist in this institution (an appointment)
     · External — another institution entirely (anchored on the blockchain)

   The list below shows OUTGOING referrals for the whole practitioner, not
   just this visit — /api/referrals/outgoing takes no visit filter.
   ========================================================================== */

interface Referral {
  id: string;
  referralNumber: string;
  patientName: string;
  reason: string;
  urgency: string;
  status: string;
  referredAt: string;
  acceptedAt?: string;
  completedAt?: string;
  responseNotes?: string;
  receivingInstitutionName: string;
}

// ── Referral card ─────────────────────────────────────────────────────────────
function ReferralCard({ referral }: { referral: Referral }) {
  const u = getReferralUrgency(referral.urgency);
  const s = getReferralStatus(referral.status);
  const sTone = TONES[s.tone];
  const StatusIcon = s.icon;

  return (
    <div
      style={{
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
            style={{
              font: "700 11px/1 var(--font-sans)",
              letterSpacing: "var(--ls-caps)",
              textTransform: "uppercase",
              color: sTone.ink,
            }}
          >
            {s.label}
          </span>
        </span>
        <MonoTag style={{ height: 18, fontSize: 10, background: "var(--surface-card)" }}>
          {referral.referralNumber}
        </MonoTag>
      </div>

      <div
        style={{
          padding: 16,
          background: "var(--surface-card)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
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
            <Building2 className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            {referral.receivingInstitutionName}
          </span>
        </div>

        <p
          style={{
            margin: 0,
            font: "400 12.5px/1.6 var(--font-sans)",
            color: "var(--text-secondary)",
          }}
        >
          {referral.reason}
        </p>

        <div className="flex items-center justify-between flex-wrap" style={{ gap: 10 }}>
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
                Accepted {format(new Date(referral.acceptedAt), "dd MMM HH:mm")}
              </span>
            )}
            {referral.completedAt && (
              <span
                style={{ font: "500 11px/1 var(--font-sans)", color: "var(--green-800)" }}
              >
                Completed {format(new Date(referral.completedAt), "dd MMM HH:mm")}
              </span>
            )}
          </div>
        </div>

        {referral.responseNotes && (
          <div
            className="flex"
            style={{
              gap: 8,
              padding: "10px 12px",
              borderRadius: "var(--r-xs)",
              background: "var(--surface-sunken)",
            }}
          >
            <ChevronRight
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: "var(--text-muted)", marginTop: 2 }}
            />
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
        )}
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
interface ReferralTabProps {
  visitId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  referringDoctorId?: string;
  priority?: string;
  isCompleted: boolean;
  readOnly?: boolean;
  onHandover?: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ReferralTab({
  visitId,
  patientId,
  patientName,
  chiefComplaint,
  referringDoctorId,
  priority,
  isCompleted,
  readOnly = false,
  onHandover,
  onSuccess,
  onError,
}: ReferralTabProps) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExternal, setShowExternal] = useState(false); // cross-institution modal
  const [showInternal, setShowInternal] = useState(false); // same-institution modal

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/referrals/outgoing");
      setReferrals(res.data?.data?.referrals ?? []);
    } catch {
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    load();
  }, [load]);

  const actions = (
    <>
      <Button icon={Stethoscope} onClick={() => setShowInternal(true)}>
        Internal
      </Button>
      <Button
        variant="primary"
        icon={ArrowLeftRight}
        onClick={() => setShowExternal(true)}
        style={{ background: "var(--blue-600)", boxShadow: "none" }}
      >
        External
      </Button>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
        <div className="flex flex-col" style={{ gap: 5 }}>
          <SectionLabel>Referrals</SectionLabel>
          {referrals.length > 0 && (
            <span
              style={{
                font: "400 12px/1 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              {referrals.length} referral{referrals.length !== 1 ? "s" : ""} sent
            </span>
          )}
        </div>

        {!isCompleted && !readOnly && (
          <div className="flex items-center" style={{ gap: 10 }}>
            {actions}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col" style={{ gap: 12 }}>
          {[...Array(2)].map((_, i) => (
            <SkeletonBlock key={i} height={128} radius="var(--r-md)" />
          ))}
        </div>
      ) : referrals.length === 0 ? (
        <div
          style={{
            borderRadius: "var(--r-md)",
            border: "1.5px dashed var(--hc-border)",
            background: "var(--surface-sunken)",
          }}
        >
          <EmptyState
            icon={ArrowLeftRight}
            title="No referrals yet"
            message="Refer this patient to a colleague or another institution."
            tone="info"
            pad={40}
            action={
              !isCompleted && !readOnly ? (
                <div className="flex items-center" style={{ gap: 10 }}>
                  {actions}
                </div>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 12 }}>
          {referrals.map((r) => (
            <ReferralCard key={r.id} referral={r} />
          ))}
        </div>
      )}

      {/* ── External referral modal (cross-institution, blockchain) ─────── */}
      {showExternal && !readOnly && (
        <CreateReferralModal
          visitId={visitId}
          patientId={patientId}
          patientName={patientName}
          chiefComplaint={chiefComplaint}
          onClose={() => setShowExternal(false)}
          onSuccess={(referralNumber) => {
            setShowExternal(false);
            onSuccess(`Referral ${referralNumber} created successfully`);
            load();
          }}
        />
      )}

      {/* ── Internal referral modal (same institution, specialist) ──────── */}
      {showInternal && !readOnly && (
        <InternalReferralModal
          referringDoctorId={referringDoctorId}
          priority={priority}
          visitId={visitId}
          patientId={patientId}
          patientName={patientName}
          chiefComplaint={chiefComplaint}
          onClose={() => setShowInternal(false)}
          onSuccess={(msg) => {
            setShowInternal(false);
            onHandover?.();
            onSuccess(msg);
          }}
        />
      )}
    </div>
  );
}
