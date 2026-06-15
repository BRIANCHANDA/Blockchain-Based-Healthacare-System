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
  FlatList,
  RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyReferrals } from "../../api/records";

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: "#059669",
  primaryDark: "#047857",
  primaryGhost: "#ECFDF5",
  primaryLight: "#D1FAE5",
  coral: "#FF5757",
  coralLight: "#FFE4E4",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  blue: "#3B82F6",
  blueLight: "#DBEAFE",
  violet: "#8B5CF6",
  violetLight: "#EDE9FE",
  orange: "#EA580C",
  orangeLight: "#FFF7ED",
  ink: "#0A0E1A",
  inkSoft: "#4B5563",
  inkMuted: "#9CA3AF",
  inkSubtle: "#D1D5DB",
  bg: "#FAFAFB",
  bgAlt: "#F4F5F7",
  card: "#FFFFFF",
  cardBorder: "#E5E7EB",
  divider: "#F3F4F6",
};

const URGENCY: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  routine: {
    color: C.primary,
    bg: C.primaryGhost,
    border: C.primaryLight,
    label: "Routine",
  },
  urgent: {
    color: C.amber,
    bg: C.amberLight,
    border: "#FDE68A",
    label: "Urgent",
  },
  emergency: {
    color: C.orange,
    bg: C.orangeLight,
    border: "#FED7AA",
    label: "Emergency",
  },
  critical: {
    color: C.coral,
    bg: C.coralLight,
    border: "#FECACA",
    label: "Critical",
  },
};

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: C.amber, bg: C.amberLight, label: "Pending" },
  accepted: { color: C.blue, bg: C.blueLight, label: "Accepted" },
  completed: { color: C.primary, bg: C.primaryGhost, label: "Completed" },
  rejected: { color: C.coral, bg: C.coralLight, label: "Rejected" },
  cancelled: { color: C.inkMuted, bg: C.bgAlt, label: "Cancelled" },
};

const getU = (u: string) => URGENCY[u] ?? URGENCY.routine;
const getS = (s: string) => STATUS[s] ?? STATUS.pending;

function fmtDate(d: string, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(
    "en-ZM",
    opts ?? { day: "numeric", month: "short", year: "numeric" },
  );
}

// ── Referral card ─────────────────────────────────────────────────────────────
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
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Top row */}
      <View style={styles.cardTopRow}>
        <Text style={styles.refNum}>{referral.referralNumber}</Text>
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>
            {st.label}
          </Text>
        </View>
      </View>

      {/* Institution — headline */}
      {referral.receivingInstitutionName && (
        <Text style={styles.instName} numberOfLines={1}>
          {referral.receivingInstitutionName}
        </Text>
      )}

      {/* Reason */}
      <Text style={styles.reason} numberOfLines={2}>
        {referral.reason}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View
          style={[
            styles.urgencyPill,
            { backgroundColor: u.bg, borderColor: u.border },
          ]}
        >
          <View style={[styles.urgencyDot, { backgroundColor: u.color }]} />
          <Text style={[styles.urgencyText, { color: u.color }]}>
            {u.label}
          </Text>
        </View>

        <View style={styles.footerRight}>
          <MaterialIcons name="event" size={12} color={C.inkMuted} />
          <Text style={styles.dateText}>{fmtDate(referral.referredAt)}</Text>
          <MaterialIcons
            name="chevron-right"
            size={16}
            color={C.inkSubtle}
            style={{ marginLeft: 2 }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
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
        <View style={[detail.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={detail.handle} />

          {/* Header */}
          <View style={detail.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={detail.refNum}>{referral.referralNumber}</Text>
              <View style={[detail.statusPill, { backgroundColor: st.bg }]}>
                <Text style={[detail.statusText, { color: st.color }]}>
                  {st.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={detail.closeBtn}
              activeOpacity={0.6}
            >
              <MaterialIcons name="close" size={18} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Institution hero */}
            <View
              style={[
                detail.institutionBox,
                { backgroundColor: u.bg, borderColor: u.border },
              ]}
            >
              <Text style={[detail.institutionLabel, { color: u.color }]}>
                Referred to
              </Text>
              <View style={detail.institutionRow}>
                <MaterialIcons
                  name="local-hospital"
                  size={22}
                  color={u.color}
                />
                <Text
                  style={[detail.institutionName, { color: C.ink }]}
                  numberOfLines={2}
                >
                  {referral.receivingInstitutionName ?? "Unknown Institution"}
                </Text>
              </View>
              <View style={[detail.urgencyBadge, { backgroundColor: u.color }]}>
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
              <View style={detail.timelineWrap}>
                {[
                  {
                    event: "Referred",
                    date: referral.referredAt,
                    color: C.primary,
                  },
                  {
                    event: "Accepted by receiving hospital",
                    date: referral.acceptedAt,
                    color: C.blue,
                  },
                  {
                    event: "Completed",
                    date: referral.completedAt,
                    color: C.primary,
                  },
                ]
                  .filter((t) => t.date)
                  .map((t, i, arr) => (
                    <View key={i} style={detail.timelineItem}>
                      <View style={detail.timelineLeftCol}>
                        <View
                          style={[
                            detail.timelineDot,
                            { backgroundColor: t.color },
                          ]}
                        />
                        {i < arr.length - 1 && (
                          <View style={detail.timelineLine} />
                        )}
                      </View>
                      <View
                        style={{
                          flex: 1,
                          paddingBottom: i < arr.length - 1 ? 16 : 0,
                        }}
                      >
                        <Text style={detail.timelineEvent}>{t.event}</Text>
                        <Text style={detail.timelineDate}>
                          {fmtDate(t.date, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            </View>

            {/* Response notes */}
            {referral.responseNotes &&
              !referral.responseNotes.startsWith("Converted") && (
                <View style={detail.section}>
                  <Text style={detail.sectionLabel}>
                    Response from institution
                  </Text>
                  <View style={detail.noteBox}>
                    <MaterialIcons
                      name="format-quote"
                      size={16}
                      color={C.inkMuted}
                    />
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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const load = useCallback(async () => {
    try {
      const res = await getMyReferrals();
      const raw: any[] = res?.referrals ?? res?.data?.referrals ?? [];
      const order: Record<string, number> = {
        pending: 0,
        accepted: 1,
        completed: 2,
        rejected: 3,
        cancelled: 4,
      };
      setReferrals(
        [...raw].sort((a, b) => {
          const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
          return diff !== 0
            ? diff
            : new Date(b.referredAt).getTime() -
                new Date(a.referredAt).getTime();
        }),
      );
    } catch {
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>My Referrals</Text>
            <Text style={styles.subgreeting}>
              {loading
                ? "Loading…"
                : activeCount > 0
                  ? `${activeCount} active · ${completedCount} completed`
                  : "Your referral history"}
            </Text>
          </View>
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          )}
        </View>

        {/* Filter tabs */}
        <View style={styles.tabRow}>
          {(
            [
              { key: "all", label: "All", count: referrals.length },
              { key: "active", label: "Active", count: activeCount },
              { key: "completed", label: "Past", count: completedCount },
            ] as const
          ).map((f) => {
            const isActive = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                >
                  {f.label}
                </Text>
                <View
                  style={[styles.tabCount, isActive && styles.tabCountActive]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      isActive && styles.tabCountTextActive,
                    ]}
                  >
                    {f.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[C.primary]}
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="swap-horiz" size={36} color={C.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {referrals.length === 0 ? "No referrals yet" : "Nothing here"}
              </Text>
              <Text style={styles.emptyBody}>
                {referrals.length === 0
                  ? "When your doctor refers you to another hospital, it will appear here."
                  : "Try switching the filter above."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ReferralCard referral={item} onPress={() => setSelected(item)} />
          )}
        />
      )}

      {selected && (
        <ReferralDetailModal
          referral={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  headerBar: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.8,
  },
  subgreeting: {
    fontSize: 14,
    color: C.inkMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  badge: {
    minWidth: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.ink,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },

  // ── Tabs ──
  tabRow: {
    flexDirection: "row",
    backgroundColor: C.bgAlt,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: C.ink,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: C.inkSoft,
    letterSpacing: -0.1,
  },
  tabTextActive: {
    color: "#fff",
  },
  tabCount: {
    backgroundColor: C.cardBorder,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 20,
    alignItems: "center",
  },
  tabCountActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.inkSoft,
  },
  tabCountTextActive: {
    color: "#fff",
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },

  // ── Card ──
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  refNum: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 0.3,
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  instName: {
    fontSize: 16,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  reason: {
    fontSize: 13,
    color: C.inkSoft,
    lineHeight: 19,
    fontWeight: "500",
    marginBottom: 12,
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  urgencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  urgencyText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: C.inkMuted,
    fontWeight: "500",
  },

  // ── Empty / loading ──
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.primaryGhost,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.ink,
    marginBottom: 6,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    color: C.inkSoft,
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
  },
});

// ── Detail modal styles ──────────────────────────────────────────────────────
const detail = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10,14,26,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
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
    marginBottom: 20,
  },
  refNum: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 0.3,
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
    marginBottom: 6,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.bgAlt,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Institution hero ──
  institutionBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  institutionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  institutionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  institutionName: {
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    letterSpacing: -0.4,
  },
  urgencyBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  urgencyBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
    textTransform: "capitalize",
  },

  // ── Sections ──
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.inkSoft,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    color: C.ink,
    lineHeight: 21,
    fontWeight: "500",
  },

  // ── Timeline ──
  timelineWrap: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  timelineLeftCol: {
    alignItems: "center",
    width: 12,
    paddingTop: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#fff",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: C.divider,
    marginTop: 2,
  },
  timelineEvent: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.2,
  },
  timelineDate: {
    fontSize: 12,
    color: C.inkMuted,
    marginTop: 2,
    fontWeight: "500",
  },

  // ── Response note ──
  noteBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.divider,
  },
  noteText: {
    fontSize: 13,
    color: C.inkSoft,
    fontStyle: "italic",
    flex: 1,
    lineHeight: 19,
    fontWeight: "500",
  },
});
