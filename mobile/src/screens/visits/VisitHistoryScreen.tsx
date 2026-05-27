import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Platform,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { getMyAuditLog } from "../../api/access";
import { AuditLog } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

// ── Design tokens ────────────────────────────────────────────────────────────
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
  blueGhost: "#EFF6FF",
  violet: "#7C3AED",
  violetGhost: "#EDE9FE",
  bg: "#F8F9FC",
  card: "#FFFFFF",
  cardBorder: "#ECEEF4",
  divider: "#F1F2F6",
};

const ACTION_CONFIG: Record<
  string,
  { color: string; bg: string; icon: string; label: string }
> = {
  view: { color: C.teal, bg: C.tealGhost, icon: "visibility", label: "Viewed" },
  create: {
    color: C.blue,
    bg: C.blueGhost,
    icon: "add-circle",
    label: "Created",
  },
  update: { color: C.amber, bg: C.amberLight, icon: "edit", label: "Updated" },
  delete: {
    color: C.coral,
    bg: C.coralLight,
    icon: "delete",
    label: "Deleted",
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LogCard({ log }: { log: AuditLog }) {
  const config = ACTION_CONFIG[log.actionType] ?? ACTION_CONFIG.view;
  const time = new Date(log.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const userLabel = log.userType
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={styles.logCard}>
      <View style={[styles.logIconWrap, { backgroundColor: config.bg }]}>
        <Icon name={config.icon as any} size={17} color={config.color} />
      </View>

      <View style={styles.logBody}>
        <View style={styles.logTop}>
          <Text style={[styles.logAction, { color: config.color }]}>
            {config.label}
          </Text>
          <Text style={styles.logDot}>·</Text>
          <Text style={styles.logResource}>
            {log.resourceType?.replace(/_/g, " ")}
          </Text>
        </View>
        <Text style={styles.logUser}>{userLabel}</Text>
        {log.ipAddress && (
          <View style={styles.ipRow}>
            <Icon name="router" size={10} color={C.inkMuted} />
            <Text style={styles.logIp}>{log.ipAddress}</Text>
          </View>
        )}
      </View>

      <View style={styles.logTime}>
        <Text style={styles.logTimeText}>{time}</Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

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

  // Group by date
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

  const viewCount = logs.filter((l) => l.actionType === "view").length;
  const createCount = logs.filter((l) => l.actionType === "create").length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDeep} />

      {/* ── Header ── */}
      <LinearGradient
        colors={[C.tealDeep, C.tealDark, C.teal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View
          style={[
            styles.deco,
            { width: 130, height: 130, top: -30, right: -25 },
          ]}
        />
        <View
          style={[styles.deco, { width: 80, height: 80, bottom: 5, left: -15 }]}
        />

        <Text style={styles.headerTitle}>Access History</Text>
        <Text style={styles.headerSub}>
          Every time someone accessed your records
        </Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatPill value={logs.length} label="Total" />
          <View style={styles.statsDivider} />
          <StatPill value={viewCount} label="Views" />
          <View style={styles.statsDivider} />
          <StatPill value={createCount} label="Created" />
          <View style={styles.statsDivider} />
          <StatPill value={sections.length} label="Days" />
        </View>
      </LinearGradient>

      {/* ── Empty state ── */}
      {logs.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Icon name="history" size={28} color={C.teal} />
          </View>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptyBody}>
            Access events will appear here once your records are viewed by
            healthcare providers.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={([date]) => date}
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
          renderItem={({ item: [date, dayLogs] }) => (
            <View style={styles.section}>
              {/* Date separator */}
              <View style={styles.dateRow}>
                <View style={styles.dateLine} />
                <View style={styles.datePill}>
                  <Icon name="event" size={10} color={C.inkMuted} />
                  <Text style={styles.dateText}>{date}</Text>
                </View>
                <View style={styles.dateLine} />
              </View>

              {dayLogs.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: "hidden",
  },
  deco: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginTop: 3,
    marginBottom: 16,
    fontWeight: "500",
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
  statPill: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "800", color: "#fff" },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
    fontWeight: "600",
  },
  statsDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 4,
  },

  // List
  listContent: { padding: 16, paddingBottom: 110 },

  // Section
  section: { marginBottom: 6 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    marginTop: 10,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: C.cardBorder },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  dateText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 0.3,
  },

  // Log card
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: "#1A1D2E",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  logIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  logBody: { flex: 1 },
  logTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  logAction: { fontSize: 13, fontWeight: "700" },
  logDot: { fontSize: 12, color: C.inkMuted },
  logResource: { fontSize: 12, color: C.inkMuted, flex: 1 },
  logUser: { fontSize: 13, fontWeight: "600", color: C.ink },
  ipRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  logIp: { fontSize: 10, color: C.inkMuted },
  logTime: {
    backgroundColor: C.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  logTimeText: { fontSize: 11, fontWeight: "600", color: C.inkMuted },

  // Empty
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
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
