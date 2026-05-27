import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StatusBar,
  Platform,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyReferrals } from "../../api/records";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink: "#1A1D2E",
  inkSoft: "#5A5F7A",
  inkMuted: "#9498B3",
  teal: "#0D9488",
  tealDark: "#0F766E",
  tealDeep: "#115E59",
  tealGhost: "#F0FDFA",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  coral: "#EF4444",
  coralLight: "#FEE2E2",
  blue: "#3B82F6",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  greenBorder: "#BBF7D0",
  bg: "#F8F9FC",
  card: "#FFFFFF",
  cardBorder: "#ECEEF4",
  divider: "#F1F2F6",
};

const URGENCY: Record<
  string,
  { color: string; bg: string; dot: string; border: string; label: string }
> = {
  routine: {
    color: C.green,
    bg: C.greenLight,
    dot: C.green,
    border: C.greenBorder,
    label: "Routine",
  },
  urgent: {
    color: C.amber,
    bg: C.amberLight,
    dot: C.amber,
    border: "#FDE68A",
    label: "Urgent",
  },
  emergency: {
    color: "#EA580C",
    bg: "#FFF7ED",
    dot: "#F97316",
    border: "#FED7AA",
    label: "Emergency",
  },
  critical: {
    color: C.coral,
    bg: C.coralLight,
    dot: C.coral,
    border: "#FECACA",
    label: "Critical",
  },
};
const getU = (u: string) => URGENCY[u] ?? URGENCY.routine;

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: C.amber, bg: C.amberLight, label: "Pending" },
  accepted: { color: C.blue, bg: "#EFF6FF", label: "Accepted" },
  completed: { color: C.green, bg: C.greenLight, label: "Completed" },
  rejected: { color: C.coral, bg: C.coralLight, label: "Rejected" },
  cancelled: { color: "#6B7280", bg: "#F9FAFB", label: "Cancelled" },
};
const getS = (s: string) => STATUS[s] ?? STATUS.pending;

function fmtDate(d: string, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(
    "en-ZM",
    opts ?? { day: "numeric", month: "short", year: "numeric" },
  );
}

// ── Referral list card ────────────────────────────────────────────────────────
function ReferralCard({
  referral,
  onPress,
}: {
  referral: any;
  onPress: () => void;
}) {
  const u = getU(referral.urgency);
  const st = getS(referral.status);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: u.dot }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.refNum}>{referral.referralNumber}</Text>
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>
            {st.label}
          </Text>
        </View>
      </View>

      {/* Institution */}
      {referral.receivingInstitutionName && (
        <View style={styles.instRow}>
          <Icon name="local-hospital" size={13} color={u.color} />
          <Text style={[styles.instName, { color: u.color }]} numberOfLines={1}>
            {referral.receivingInstitutionName}
          </Text>
        </View>
      )}

      {/* Reason */}
      <Text style={styles.reason} numberOfLines={2}>
        {referral.reason}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={[styles.urgencyPill, { backgroundColor: u.bg }]}>
          <View style={[styles.urgencyDot, { backgroundColor: u.dot }]} />
          <Text style={[styles.urgencyText, { color: u.color }]}>
            {u.label}
          </Text>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.dateText}>{fmtDate(referral.referredAt)}</Text>
          <Icon name="chevron-right" size={14} color={C.inkMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Referral detail modal ─────────────────────────────────────────────────────
function ReferralDetailModal({
  referral,
  onClose,
}: {
  referral: any;
  onClose: () => void;
}) {
  const u = getU(referral.urgency);
  const st = getS(referral.status);
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <View style={detail.overlay}>
        <View style={[detail.sheet, { paddingBottom: insets.bottom + 20 }]}>
          {/* Handle */}
          <View style={detail.handle} />

          {/* Header row */}
          <View style={detail.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={detail.refNum}>{referral.referralNumber}</Text>
              <View style={[detail.statusPill, { backgroundColor: st.bg }]}>
                <Text style={[detail.statusText, { color: st.color }]}>
                  {st.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={detail.closeBtn}>
              <Icon name="close" size={18} color={C.inkMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Referred to — hero section */}
            <View
              style={[
                detail.institutionBox,
                { borderColor: u.border, backgroundColor: u.bg },
              ]}
            >
              <Text style={[detail.institutionLabel, { color: u.color }]}>
                Referred to
              </Text>
              <View style={detail.institutionRow}>
                <Icon name="local-hospital" size={20} color={u.color} />
                <Text style={[detail.institutionName, { color: u.color }]}>
                  {referral.receivingInstitutionName ?? "Unknown Institution"}
                </Text>
              </View>
              <View style={[detail.urgencyBadge, { backgroundColor: u.dot }]}>
                <Text style={detail.urgencyBadgeText}>{u.label} priority</Text>
              </View>
            </View>

            {/* Reason */}
            <View style={detail.section}>
              <Text style={detail.sectionLabel}>Reason for referral</Text>
              <Text style={detail.sectionBody}>{referral.reason}</Text>
            </View>

            {/* Clinical summary */}
            {referral.clinicalSummary &&
              referral.clinicalSummary !== referral.reason && (
                <View style={detail.section}>
                  <Text style={detail.sectionLabel}>Clinical summary</Text>
                  <Text style={detail.sectionBody}>
                    {referral.clinicalSummary}
                  </Text>
                </View>
              )}

            {/* Timeline */}
            <View style={detail.section}>
              <Text style={detail.sectionLabel}>Timeline</Text>
              <View style={detail.timelineItem}>
                <View
                  style={[detail.timelineDot, { backgroundColor: C.teal }]}
                />
                <View>
                  <Text style={detail.timelineEvent}>Referred</Text>
                  <Text style={detail.timelineDate}>
                    {fmtDate(referral.referredAt, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
              {referral.acceptedAt && (
                <View style={detail.timelineItem}>
                  <View
                    style={[detail.timelineDot, { backgroundColor: C.blue }]}
                  />
                  <View>
                    <Text style={detail.timelineEvent}>
                      Accepted by receiving institution
                    </Text>
                    <Text style={detail.timelineDate}>
                      {fmtDate(referral.acceptedAt, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                </View>
              )}
              {referral.completedAt && (
                <View style={detail.timelineItem}>
                  <View
                    style={[detail.timelineDot, { backgroundColor: C.green }]}
                  />
                  <View>
                    <Text style={detail.timelineEvent}>Completed</Text>
                    <Text style={detail.timelineDate}>
                      {fmtDate(referral.completedAt, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Response notes */}
            {referral.responseNotes &&
              !referral.responseNotes.startsWith("Converted") && (
                <View style={detail.section}>
                  <Text style={detail.sectionLabel}>
                    Response from institution
                  </Text>
                  <View style={detail.noteBox}>
                    <Icon name="format-quote" size={16} color={C.inkMuted} />
                    <Text style={detail.noteText}>
                      {referral.responseNotes}
                    </Text>
                  </View>
                </View>
              )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const detail = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "90%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.cardBorder,
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  refNum: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkMuted,
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
    marginBottom: 4,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { fontSize: 10, fontWeight: "700" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
  },

  institutionBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  institutionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  institutionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  institutionName: { fontSize: 16, fontWeight: "700", flex: 1 },
  urgencyBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  urgencyBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },

  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  sectionBody: { fontSize: 13, color: C.ink, lineHeight: 20 },

  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  timelineEvent: { fontSize: 12, fontWeight: "600", color: C.ink },
  timelineDate: { fontSize: 11, color: C.inkMuted, marginTop: 1 },

  noteBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 12,
  },
  noteText: {
    fontSize: 12,
    color: C.inkSoft,
    fontStyle: "italic",
    flex: 1,
    lineHeight: 18,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const load = useCallback(async () => {
    try {
      const res = await getMyReferrals();
      const raw: any[] = res?.referrals ?? res?.data?.referrals ?? [];
      const sorted = [...raw].sort((a, b) => {
        const order: Record<string, number> = {
          pending: 0,
          accepted: 1,
          completed: 2,
          rejected: 3,
          cancelled: 4,
        };
        const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
        return diff !== 0
          ? diff
          : new Date(b.referredAt).getTime() - new Date(a.referredAt).getTime();
      });
      setReferrals(sorted);
    } catch {
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = referrals.filter((r) => {
    if (filter === "active") return ["pending", "accepted"].includes(r.status);
    if (filter === "completed")
      return ["completed", "rejected", "cancelled"].includes(r.status);
    return true;
  });

  const activeCount = referrals.filter((r) =>
    ["pending", "accepted"].includes(r.status),
  ).length;
  const completedCount = referrals.filter((r) =>
    ["completed", "rejected", "cancelled"].includes(r.status),
  ).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>My Referrals</Text>
          {!loading && activeCount > 0 && (
            <Text style={styles.pageSubtitle}>
              <Text style={{ color: C.amber, fontWeight: "700" }}>
                {activeCount} active
              </Text>
              {completedCount > 0 && ` · ${completedCount} completed`}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={load} style={styles.refreshBtn}>
          <Icon name="refresh" size={18} color={C.tealDark} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["all", "active", "completed"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f === "all"
                ? `All (${referrals.length})`
                : f === "active"
                  ? `Active (${activeCount})`
                  : `Past (${completedCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.teal} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Icon
            name="compare-arrows"
            size={40}
            color={C.inkMuted}
            style={{ marginBottom: 10 }}
          />
          <Text style={styles.emptyTitle}>
            {referrals.length === 0
              ? "No referrals yet"
              : "No referrals in this category"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {referrals.length === 0
              ? "When your doctor refers you to another hospital, it will appear here"
              : "Try switching the filter above"}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((r) => (
            <ReferralCard
              key={r.id}
              referral={r}
              onPress={() => setSelected(r)}
            />
          ))}
        </ScrollView>
      )}

      {/* Detail modal */}
      {selected && (
        <ReferralDetailModal
          referral={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.4,
  },
  pageSubtitle: { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.tealGhost,
    justifyContent: "center",
    alignItems: "center",
  },

  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  filterTabActive: { backgroundColor: C.tealGhost, borderColor: C.teal },
  filterText: { fontSize: 11, fontWeight: "600", color: C.inkMuted },
  filterTextActive: { color: C.tealDark },

  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 8 },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderLeftWidth: 3,
    padding: 12,
    gap: 5,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refNum: {
    fontSize: 10,
    fontWeight: "700",
    color: C.inkMuted,
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
  },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  statusText: { fontSize: 9, fontWeight: "800" },
  instRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  instName: { fontSize: 13, fontWeight: "700", flex: 1 },
  reason: { fontSize: 11, color: C.inkSoft, lineHeight: 16 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  urgencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  urgencyDot: { width: 5, height: 5, borderRadius: 3 },
  urgencyText: { fontSize: 9, fontWeight: "700" },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  dateText: { fontSize: 9, color: C.inkMuted },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.inkSoft,
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: C.inkMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});
