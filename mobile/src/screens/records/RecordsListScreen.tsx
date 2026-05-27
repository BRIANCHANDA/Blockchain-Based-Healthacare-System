import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { getMyVisits } from "../../api/records";
import { useAuthStore } from "../../store/authStore";
import { Visit, RecordsStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

type Props = NativeStackScreenProps<RecordsStackParamList, "RecordsList">;

const { width } = Dimensions.get("window");

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  ink: "#1A1D2E",
  inkSoft: "#5A5F7A",
  inkMuted: "#9498B3",
  teal: "#0D9488",
  tealDark: "#0F766E",
  tealDeep: "#115E59",
  tealLight: "#CCFBF1",
  tealGhost: "#F0FDFA",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  coral: "#EF4444",
  coralLight: "#FEE2E2",
  violet: "#7C3AED",
  violetLight: "#EDE9FE",
  blue: "#3B82F6",
  blueLight: "#EFF6FF",
  bg: "#F8F9FC",
  card: "#FFFFFF",
  cardBorder: "#ECEEF4",
  divider: "#F1F2F6",
};

const PRIORITY: Record<string, { color: string; bg: string; label: string }> = {
  routine: { color: C.teal, bg: C.tealGhost, label: "Routine" },
  urgent: { color: C.amber, bg: C.amberLight, label: "Urgent" },
  emergency: { color: C.coral, bg: C.coralLight, label: "Emergency" },
  critical: { color: C.violet, bg: C.violetLight, label: "Critical" },
};

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  "in-progress": { color: C.amber, bg: C.amberLight, label: "In Progress" },
  completed: { color: C.teal, bg: C.tealGhost, label: "Completed" },
  cancelled: { color: C.inkMuted, bg: "#F3F4F6", label: "Cancelled" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  value,
  label,
  icon,
  color,
}: {
  value: number;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}15` }]}>
        <MaterialIcons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Visit Card ───────────────────────────────────────────────────────────────
function VisitCardItem({
  item,
  onPress,
}: {
  item: Visit;
  onPress: () => void;
}) {
  const priority = PRIORITY[item.priority] ?? PRIORITY.routine;
  const status = STATUS[item.status] ?? STATUS.completed;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.card}
      accessibilityRole="button"
    >
      {/* Left accent */}
      <View style={[styles.cardAccent, { backgroundColor: priority.color }]} />

      <View style={styles.cardBody}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardVisitNum}>{item.visitNumber}</Text>
            <Text style={styles.cardType}>
              {item.visitType.replace(/-/g, " ").toUpperCase()}
            </Text>
          </View>
          <View style={[styles.priorityPill, { backgroundColor: priority.bg }]}>
            <Text style={[styles.priorityText, { color: priority.color }]}>
              {priority.label}
            </Text>
          </View>
        </View>

        {/* Complaint */}
        <Text style={styles.cardComplaint} numberOfLines={2}>
          {item.chiefComplaint || "No complaint recorded"}
        </Text>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.datePill}>
            <MaterialIcons name="schedule" size={11} color={C.inkMuted} />
            <Text style={styles.dateText}>
              {formatDate(item.admissionDate)}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <View
              style={[styles.statusDot, { backgroundColor: status.color }]}
            />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>
      </View>

      <MaterialIcons
        name="chevron-right"
        size={18}
        color="#D0D5E0"
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function RecordsListScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchVisits = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getMyVisits(user.id);
      setVisits(res.data.visits);
      setError("");
    } catch {
      setError("Could not load records. Pull down to retry.");
    }
  }, [user]);

  useEffect(() => {
    fetchVisits().finally(() => setLoading(false));
  }, [fetchVisits]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVisits();
    setRefreshing(false);
  };

  const completed = visits.filter((v) => v.status === "completed").length;
  const active = visits.filter((v) => v.status === "in-progress").length;

  if (loading) return <LoadingSpinner message="Loading your records…" />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDeep} />

      {/* ── Header ── */}
      <LinearGradient
        colors={[C.tealDeep, C.tealDark, C.teal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        {/* Decorative elements */}
        <View
          style={[
            styles.deco,
            {
              width: 160,
              height: 160,
              top: -40,
              right: -30,
              borderColor: "rgba(255,255,255,0.08)",
            },
          ]}
        />
        <View
          style={[
            styles.deco,
            {
              width: 100,
              height: 100,
              bottom: 10,
              left: -20,
              borderColor: "rgba(255,255,255,0.06)",
            },
          ]}
        />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandName}>HealthChain</Text>
            <Text style={styles.brandSub}>ZAMBIA</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Profile")} // ← add this
          >
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.greeting}>Good day, {user?.firstName} 👋</Text>
        <Text style={styles.subheading}>Your medical visit history</Text>
      </LinearGradient>

      {/* ── Stats row (overlapping header) ── */}
      <View style={styles.statsRow}>
        <StatCard
          value={visits.length}
          label="Total"
          icon="description"
          color={C.blue}
        />
        <StatCard
          value={completed}
          label="Completed"
          icon="check-circle"
          color={C.teal}
        />
        <StatCard
          value={active}
          label="Active"
          icon="pending"
          color={C.amber}
        />
      </View>

      {/* ── Error ── */}
      {error ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={15} color={C.coral} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ── List ── */}
      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.teal]}
            tintColor={C.teal}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderText}>Recent visits</Text>
            <Text style={styles.listHeaderCount}>{visits.length}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="folder-open" size={28} color={C.teal} />
            </View>
            <Text style={styles.emptyTitle}>No visits yet</Text>
            <Text style={styles.emptyBody}>
              Your medical records will appear here once created by your
              healthcare provider.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <VisitCardItem
            item={item}
            onPress={() =>
              navigation.navigate("RecordDetail", {
                visitId: item.id,
                visitNumber: item.visitNumber,
              })
            }
          />
        )}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    overflow: "hidden",
  },
  deco: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  brandName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: "800",
    color: "#6FCF97",
    letterSpacing: 2.5,
    marginTop: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginTop: 3,
    fontWeight: "500",
  },

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginTop: -22,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#1A1D2E",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: C.ink },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: C.inkMuted,
    marginTop: 1,
    letterSpacing: 0.3,
  },

  // ── Error ──
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.coralLight,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 11,
    borderRadius: 12,
  },
  errorText: { color: C.coral, fontSize: 12, flex: 1, fontWeight: "500" },

  // ── List ──
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  listHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  listHeaderCount: {
    fontSize: 11,
    fontWeight: "700",
    color: C.teal,
    backgroundColor: C.tealGhost,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  // ── Card ──
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: C.card,
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: "#1A1D2E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  cardAccent: { width: 3.5 },
  cardBody: { flex: 1, padding: 14 },
  chevron: { alignSelf: "center", marginRight: 12 },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardVisitNum: {
    fontSize: 12,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: 0.2,
  },
  cardType: {
    fontSize: 9,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },

  cardComplaint: {
    fontSize: 14,
    fontWeight: "600",
    color: C.ink,
    lineHeight: 19,
    marginBottom: 12,
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  datePill: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 11, color: C.inkMuted, fontWeight: "500" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },

  // ── Empty ──
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.tealGhost,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    color: C.inkMuted,
    textAlign: "center",
    lineHeight: 19,
  },
});
