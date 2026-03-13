import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMyVisits } from "../../api/records";
import { useAuthStore } from "../../store/authStore";
import { Visit, RecordsStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Card from "../../components/common/Card";

type Props = NativeStackScreenProps<RecordsStackParamList, "RecordsList">;

const PRIORITY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  routine: { color: "#0A6640", bg: "#E6F4EE", label: "Routine" },
  urgent: { color: "#C9952A", bg: "#FDF3DC", label: "Urgent" },
  emergency: { color: "#C0392B", bg: "#FDECEA", label: "Emergency" },
  critical: { color: "#6D28D9", bg: "#EDE9FE", label: "Critical" },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  "in-progress": { color: "#C9952A", bg: "#FDF3DC" },
  completed: { color: "#0A6640", bg: "#E6F4EE" },
  cancelled: { color: "#6B7280", bg: "#F3F4F6" },
};

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
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVisits();
    setRefreshing(false);
  };

  if (loading) return <LoadingSpinner message="Loading your records…" />;

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#0A6640" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.brandName}>HealthChain</Text>
            <Text style={styles.brandTag}>Zambia</Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </Text>
          </View>
        </View>
        <Text style={styles.greeting}>Good day, {user?.firstName} 👋</Text>
        <Text style={styles.subheading}>Your medical visit history</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{visits.length}</Text>
            <Text style={styles.statLabel}>Total Visits</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {visits.filter((v) => v.status === "completed").length}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {visits.filter((v) => v.status === "in-progress").length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Icon name="error-outline" size={18} color="#C0392B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0A6640"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="folder-open" size={36} color="#0A6640" />
            </View>
            <Text style={styles.emptyTitle}>No visits yet</Text>
            <Text style={styles.emptyText}>
              Your medical records will appear here
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
              activeOpacity={0.75}
              style={styles.cardWrap}
            >
              <View style={styles.card}>
                {/* Left accent bar */}
                <View
                  style={[
                    styles.accentBar,
                    { backgroundColor: priority.color },
                  ]}
                />

                <View style={styles.cardContent}>
                  {/* Top row */}
                  <View style={styles.cardTop}>
                    <Text style={[styles.visitNum, { color: priority.color }]}>
                      {item.visitNumber}
                    </Text>
                    <View
                      style={[styles.pill, { backgroundColor: priority.bg }]}
                    >
                      <Text
                        style={[styles.pillText, { color: priority.color }]}
                      >
                        {priority.label}
                      </Text>
                    </View>
                  </View>

                  {/* Visit type */}
                  <Text style={styles.visitType}>
                    {item.visitType.replace("-", " ").toUpperCase()}
                  </Text>

                  {/* Chief complaint */}
                  <Text style={styles.complaint} numberOfLines={2}>
                    {item.chiefComplaint}
                  </Text>

                  {/* Bottom row */}
                  <View style={styles.cardBottom}>
                    <View style={styles.metaRow}>
                      <Icon name="event" size={13} color="#8AA89C" />
                      <Text style={styles.metaText}>
                        {new Date(item.admissionDate).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: status.bg },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: status.color },
                        ]}
                      />
                      <Text
                        style={[styles.statusText, { color: status.color }]}
                      >
                        {item.status === "in-progress"
                          ? "In Progress"
                          : item.status.charAt(0).toUpperCase() +
                            item.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>

                <Icon
                  name="chevron-right"
                  size={20}
                  color="#DDE8E2"
                  style={styles.chevron}
                />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F0F5F2" },

  // Header
  header: {
    backgroundColor: "#0A6640",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  brandName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  brandTag: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6FCF97",
    letterSpacing: 1.5,
    marginTop: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  greeting: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginTop: 3,
    marginBottom: 18,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  statCard: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800", color: "#fff" },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 4,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDECEA",
    margin: 16,
    padding: 12,
    borderRadius: 10,
  },
  errorText: { color: "#C0392B", fontSize: 13, flex: 1 },

  // Empty
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#E6F4EE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0D1F17",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#8AA89C",
    textAlign: "center",
    lineHeight: 19,
  },

  // Card
  cardWrap: { marginBottom: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    shadowColor: "#0A6640",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  accentBar: { width: 4 },
  cardContent: { flex: 1, padding: 14 },
  chevron: { alignSelf: "center", marginRight: 10 },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  visitNum: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },

  visitType: {
    fontSize: 10,
    color: "#8AA89C",
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  complaint: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0D1F17",
    marginBottom: 10,
    lineHeight: 20,
  },

  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: "#8AA89C" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
});
