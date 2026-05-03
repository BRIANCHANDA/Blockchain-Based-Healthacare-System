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
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";

import { getMyVisits } from "../../api/records";
import { useAuthStore } from "../../store/authStore";
import { Visit, RecordsStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

type Props = NativeStackScreenProps<RecordsStackParamList, "RecordsList">;

const PRIMARY = "#0A6640";
const PRIMARY_LIGHT = "#E6F4EE";

const PRIORITY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  routine: { color: "#0A6640", bg: "#E6F4EE", label: "Routine" },
  urgent: { color: "#B45309", bg: "#FEF3C7", label: "Urgent" },
  emergency: { color: "#B91C1C", bg: "#FEE2E2", label: "Emergency" },
  critical: { color: "#6D28D9", bg: "#EDE9FE", label: "Critical" },
};

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  "in-progress": { color: "#B45309", bg: "#FEF3C7", label: "In Progress" },
  completed: { color: "#0A6640", bg: "#E6F4EE", label: "Completed" },
  cancelled: { color: "#6B7280", bg: "#F3F4F6", label: "Cancelled" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusLabel(status: string) {
  return (
    STATUS_CONFIG[status]?.label ??
    status.charAt(0).toUpperCase() + status.slice(1)
  );
}

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

  const completedCount = visits.filter((v) => v.status === "completed").length;
  const inProgressCount = visits.filter(
    (v) => v.status === "in-progress",
  ).length;

  if (loading) return <LoadingSpinner message="Loading your records…" />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandName}>HealthChain</Text>
            <Text style={styles.brandSub}>ZAMBIA</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            accessibilityLabel="Open profile"
            activeOpacity={0.8}
          >
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.greeting}>Good day, {user?.firstName} 👋</Text>
        <Text style={styles.subheading}>Your medical visit history</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{visits.length}</Text>
            <Text style={styles.statLbl}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{completedCount}</Text>
            <Text style={styles.statLbl}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{inProgressCount}</Text>
            <Text style={styles.statLbl}>Active</Text>
          </View>
        </View>
      </View>

      {/* ── Error banner ── */}
      {error ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color="#B91C1C" />
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
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        ListHeaderComponent={
          <Text style={styles.listHeader}>Recent visits</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="folder-open" size={32} color={PRIMARY} />
            </View>
            <Text style={styles.emptyTitle}>No visits yet</Text>
            <Text style={styles.emptyBody}>
              Your medical records will appear here once created.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const priority =
            PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.routine;
          const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.completed;

          return (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("RecordDetail", {
                  visitId: item.id,
                  visitNumber: item.visitNumber,
                })
              }
              activeOpacity={0.7}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`Visit ${item.visitNumber}, ${item.chiefComplaint}`}
            >
              <View
                style={[styles.accentBar, { backgroundColor: priority.color }]}
              />

              <View style={styles.cardBody}>
                {/* Top row */}
                <View style={styles.cardTop}>
                  <Text style={[styles.visitNumber, { color: priority.color }]}>
                    {item.visitNumber}
                  </Text>
                  <View style={[styles.pill, { backgroundColor: priority.bg }]}>
                    <Text style={[styles.pillText, { color: priority.color }]}>
                      {priority.label}
                    </Text>
                  </View>
                </View>

                {/* Visit type */}
                <Text style={styles.visitType}>
                  {item.visitType.replace(/-/g, " ").toUpperCase()}
                </Text>

                {/* Chief complaint */}
                <Text style={styles.complaint} numberOfLines={2}>
                  {item.chiefComplaint}
                </Text>

                {/* Bottom row */}
                <View style={styles.cardFooter}>
                  <View style={styles.metaChip}>
                    <MaterialIcons name="event" size={11} color="#9AAFA8" />
                    <Text style={styles.metaText}>
                      {formatDate(item.admissionDate)}
                    </Text>
                  </View>
                  <View
                    style={[styles.statusPill, { backgroundColor: status.bg }]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: status.color },
                      ]}
                    />
                    <Text style={[styles.statusText, { color: status.color }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
              </View>

              <MaterialIcons
                name="chevron-right"
                size={20}
                color="#C8DDD5"
                style={styles.chevron}
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F2F5F2" },

  // Header
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  brandName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6FCF97",
    letterSpacing: 2,
    marginTop: 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 3,
    marginBottom: 16,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800", color: "#fff" },
  statLbl: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 4,
  },

  // Error
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
  },
  errorText: { color: "#B91C1C", fontSize: 12, flex: 1 },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 110 },
  listHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5A7A69",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 9,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  accentBar: { width: 3 },
  cardBody: { flex: 1, padding: 12 },
  chevron: { alignSelf: "center", marginRight: 10 },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  visitNumber: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  pillText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  visitType: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8AA89C",
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  complaint: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0D1F17",
    lineHeight: 18,
    marginBottom: 10,
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, color: "#9AAFA8" },
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

  // Empty state
  empty: { alignItems: "center", marginTop: 64, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: PRIMARY_LIGHT,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0D1F17",
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    color: "#8AA89C",
    textAlign: "center",
    lineHeight: 19,
  },
});
