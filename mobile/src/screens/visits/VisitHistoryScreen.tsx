import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMyAuditLog } from "../../api/access";
import { AuditLog } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const ACTION_CONFIG: Record<
  string,
  { color: string; bg: string; icon: string; label: string }
> = {
  view: {
    color: "#0A6640",
    bg: "#E6F4EE",
    icon: "visibility",
    label: "Viewed",
  },
  create: {
    color: "#1A6B8A",
    bg: "#E3F2F8",
    icon: "add-circle",
    label: "Created",
  },
  update: { color: "#C9952A", bg: "#FDF3DC", icon: "edit", label: "Updated" },
  delete: { color: "#C0392B", bg: "#FDECEA", icon: "delete", label: "Deleted" },
};

export default function VisitHistoryScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const fetchLogs = useCallback(async () => {
    try {
      const res = await getMyAuditLog();
      setLogs(res.data?.dbLogs ?? []);
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    fetchLogs().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  if (loading) return <LoadingSpinner message="Loading audit trail…" />;

  // Group logs by date
  const grouped = logs.reduce((acc: Record<string, AuditLog[]>, log) => {
    const date = new Date(log.timestamp).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  const sections = Object.entries(grouped);

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#0A6640" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Access History</Text>
        <Text style={styles.headerSub}>
          Every time someone accessed your records
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{logs.length}</Text>
            <Text style={styles.summaryLabel}>Total Events</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>
              {logs.filter((l) => l.actionType === "view").length}
            </Text>
            <Text style={styles.summaryLabel}>Views</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{sections.length}</Text>
            <Text style={styles.summaryLabel}>Days</Text>
          </View>
        </View>
      </View>

      {logs.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="history" size={36} color="#0A6640" />
          </View>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptyText}>
            Access events will appear here once your records are viewed
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={([date]) => date}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#0A6640"]}
            />
          }
          renderItem={({ item: [date, dayLogs] }) => (
            <View style={styles.section}>
              <View style={styles.dateRow}>
                <View style={styles.dateLine} />
                <Text style={styles.dateLabel}>{date}</Text>
                <View style={styles.dateLine} />
              </View>

              {dayLogs.map((log, idx) => {
                const config =
                  ACTION_CONFIG[log.actionType] ?? ACTION_CONFIG.view;
                return (
                  <View key={log.id} style={styles.logCard}>
                    <View
                      style={[styles.logIcon, { backgroundColor: config.bg }]}
                    >
                      <Icon
                        name={config.icon as any}
                        size={18}
                        color={config.color}
                      />
                    </View>

                    <View style={styles.logContent}>
                      <View style={styles.logTop}>
                        <Text
                          style={[styles.logAction, { color: config.color }]}
                        >
                          {config.label}
                        </Text>
                        <Text style={styles.logResource}>
                          {log.resourceType?.replace(/_/g, " ")}
                        </Text>
                      </View>
                      <Text style={styles.logUser}>
                        {log.userType
                          ?.replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Text>
                      {log.ipAddress && (
                        <Text style={styles.logIp}>{log.ipAddress}</Text>
                      )}
                    </View>

                    <Text style={styles.logTime}>
                      {new Date(log.timestamp).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F0F5F2" },

  header: {
    backgroundColor: "#0A6640",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginTop: 3,
    marginBottom: 16,
  },

  summaryRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryNum: { fontSize: 22, fontWeight: "800", color: "#fff" },
  summaryLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
    fontWeight: "500",
  },
  summaryDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 4,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
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

  section: { marginBottom: 8 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    marginTop: 4,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: "#DDE8E2" },
  dateLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8AA89C",
    letterSpacing: 0.5,
  },

  logCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    shadowColor: "#0A6640",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  logContent: { flex: 1 },
  logTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  logAction: { fontSize: 13, fontWeight: "700" },
  logResource: { fontSize: 12, color: "#8AA89C" },
  logUser: { fontSize: 13, fontWeight: "600", color: "#0D1F17" },
  logIp: { fontSize: 11, color: "#8AA89C", marginTop: 2 },
  logTime: {
    fontSize: 12,
    color: "#8AA89C",
    fontWeight: "600",
    textAlign: "right",
  },
});
