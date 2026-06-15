import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMyAuditLog } from "../../api/access";
import LoadingSpinner from "../../components/common/LoadingSpinner";

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

interface EnrichedLog {
  id: string;
  timestamp: string;
  userId: string;
  userType: string;
  actorName: string;
  actorRole: string;
  actorSpecialization: string | null;
  actorDepartment: string | null;
  actionType: string;
  resourceType: string;
  resourceId: string | null;
  resourceDetail: string | null;
  accessReason: string | null;
  isEmergencyOverride: boolean;
  isAnchored: boolean;
  blockchainTransactionId: string;
  ipAddress: string | null;
}

const ACTION_CONFIG: Record<
  string,
  { color: string; bg: string; icon: string; label: string }
> = {
  view: {
    color: C.primary,
    bg: C.primaryGhost,
    icon: "visibility",
    label: "Viewed",
  },
  create: { color: C.blue, bg: C.blueLight, icon: "add", label: "Created" },
  update: { color: C.amber, bg: C.amberLight, icon: "edit", label: "Updated" },
  delete: {
    color: C.coral,
    bg: C.coralLight,
    icon: "delete",
    label: "Deleted",
  },
  permission_grant: {
    color: C.violet,
    bg: C.violetLight,
    icon: "verified-user",
    label: "Granted Access",
  },
  permission_revoke: {
    color: C.coral,
    bg: C.coralLight,
    icon: "block",
    label: "Revoked Access",
  },
  emergency_override: {
    color: C.coral,
    bg: C.coralLight,
    icon: "warning",
    label: "Emergency",
  },
};

const ROLE_LABELS: Record<string, string> = {
  practitioner: "Doctor",
  nurse: "Nurse",
  lab_technician: "Lab Tech",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
  receptionist: "Receptionist",
  admin: "Administrator",
};

const FILTER_OPTIONS = [
  { key: "all", label: "All", color: C.ink },
  { key: "view", label: "Viewed", color: C.primary },
  { key: "create", label: "Created", color: C.blue },
  { key: "update", label: "Updated", color: C.amber },
];

function shortTx(tx: string) {
  if (!tx || tx === "no-tx") return null;
  return tx.length > 16 ? `${tx.slice(0, 8)}…${tx.slice(-6)}` : tx;
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({
  value,
  label,
  color,
  icon,
}: {
  value: number;
  label: string;
  color: string;
  icon: string;
}) {
  return (
    <View style={[styles.statTile, { borderColor: `${color}30` }]}>
      <Icon
        name={icon as any}
        size={14}
        color={color}
        style={{ marginBottom: 4 }}
      />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Log card ─────────────────────────────────────────────────────────────────
function LogCard({ log, onPress }: { log: EnrichedLog; onPress: () => void }) {
  const config = ACTION_CONFIG[log.actionType] ?? ACTION_CONFIG.view;
  const time = new Date(log.timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const roleLabel = ROLE_LABELS[log.actorRole] ?? log.actorRole;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.logCard,
        log.isEmergencyOverride && styles.logCardEmergency,
      ]}
    >
      {/* Emergency stripe */}
      {log.isEmergencyOverride && <View style={styles.emergencyStripe} />}

      <View style={styles.logRow}>
        <View style={[styles.logIconWrap, { backgroundColor: config.bg }]}>
          <Icon name={config.icon as any} size={18} color={config.color} />
        </View>

        <View style={styles.logBody}>
          <View style={styles.logTopRow}>
            <Text style={[styles.logAction, { color: config.color }]}>
              {config.label}
            </Text>
            <Text style={styles.logTime}>{time}</Text>
          </View>

          <Text style={styles.actorName} numberOfLines={1}>
            {log.actorName}
            <Text style={styles.actorRole}> · {roleLabel}</Text>
          </Text>

          {log.resourceDetail && (
            <Text style={styles.resourceDetail} numberOfLines={1}>
              {log.resourceDetail}
            </Text>
          )}

          {!log.resourceDetail && (
            <Text style={styles.resourceType} numberOfLines={1}>
              {log.resourceType?.replace(/_/g, " ")}
            </Text>
          )}

          {/* Badge row */}
          <View style={styles.badgeRow}>
            {log.isAnchored && (
              <View style={styles.anchorBadge}>
                <Icon name="link" size={9} color={C.primaryDark} />
                <Text style={styles.anchorText}>On-chain</Text>
              </View>
            )}
            {log.isEmergencyOverride && (
              <View style={styles.emergencyBadge}>
                <Icon name="warning" size={9} color={C.coral} />
                <Text style={styles.emergencyText}>Emergency</Text>
              </View>
            )}
            {log.actorDepartment && (
              <Text style={styles.deptText}>{log.actorDepartment}</Text>
            )}
          </View>
        </View>

        <Icon name="chevron-right" size={18} color={C.inkSubtle} />
      </View>
    </TouchableOpacity>
  );
}

// ── Detail modal ─────────────────────────────────────────────────────────────
function DetailModal({
  log,
  onClose,
}: {
  log: EnrichedLog | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!log) return null;

  const config = ACTION_CONFIG[log.actionType] ?? ACTION_CONFIG.view;
  const roleLabel = ROLE_LABELS[log.actorRole] ?? log.actorRole;
  const ts = new Date(log.timestamp);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={[modal.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={modal.handle} />

          {/* Header */}
          <View style={modal.headerRow}>
            <View style={[modal.headerIcon, { backgroundColor: config.bg }]}>
              <Icon name={config.icon as any} size={22} color={config.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[modal.title, { color: config.color }]}>
                {config.label}
              </Text>
              <Text style={modal.sub}>
                {ts.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {"  ·  "}
                {ts.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
              <Icon name="close" size={18} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Emergency banner */}
            {log.isEmergencyOverride && (
              <View style={modal.emergencyBanner}>
                <Icon name="warning" size={16} color={C.coral} />
                <View style={{ flex: 1 }}>
                  <Text style={modal.emergencyTitle}>
                    Emergency Override Access
                  </Text>
                  <Text style={modal.emergencyBody}>
                    This staff member accessed your records under emergency
                    protocols, bypassing normal permission.
                  </Text>
                </View>
              </View>
            )}

            {/* Who */}
            <Text style={modal.sectionLabel}>Who</Text>
            <View style={modal.detailCard}>
              <View style={modal.detailRow}>
                <Text style={modal.detailKey}>Name</Text>
                <Text style={modal.detailVal}>{log.actorName}</Text>
              </View>
              <View style={modal.detailRow}>
                <Text style={modal.detailKey}>Role</Text>
                <Text style={modal.detailVal}>{roleLabel}</Text>
              </View>
              {log.actorSpecialization && (
                <View style={modal.detailRow}>
                  <Text style={modal.detailKey}>Specialty</Text>
                  <Text style={modal.detailVal}>{log.actorSpecialization}</Text>
                </View>
              )}
              {log.actorDepartment && (
                <View style={modal.detailRow}>
                  <Text style={modal.detailKey}>Department</Text>
                  <Text style={modal.detailVal}>{log.actorDepartment}</Text>
                </View>
              )}
            </View>

            {/* What */}
            <Text style={modal.sectionLabel}>What</Text>
            <View style={modal.detailCard}>
              <View style={modal.detailRow}>
                <Text style={modal.detailKey}>Action</Text>
                <Text style={modal.detailVal}>{config.label}</Text>
              </View>
              <View style={modal.detailRow}>
                <Text style={modal.detailKey}>Record Type</Text>
                <Text style={modal.detailVal}>
                  {log.resourceType?.replace(/_/g, " ")}
                </Text>
              </View>
              {log.resourceDetail && (
                <View style={modal.detailRow}>
                  <Text style={modal.detailKey}>Details</Text>
                  <Text
                    style={[modal.detailVal, { flex: 1.5 }]}
                    numberOfLines={3}
                  >
                    {log.resourceDetail}
                  </Text>
                </View>
              )}
              {log.accessReason && (
                <View style={modal.detailRow}>
                  <Text style={modal.detailKey}>Reason</Text>
                  <Text style={[modal.detailVal, { flex: 1.5 }]}>
                    {log.accessReason}
                  </Text>
                </View>
              )}
            </View>

            {/* Connection */}
            {log.ipAddress && (
              <>
                <Text style={modal.sectionLabel}>Connection</Text>
                <View style={modal.detailCard}>
                  <View style={modal.detailRow}>
                    <Text style={modal.detailKey}>IP Address</Text>
                    <Text
                      style={[modal.detailVal, { fontFamily: "monospace" }]}
                    >
                      {log.ipAddress}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function VisitHistoryScreen() {
  const [logs, setLogs] = useState<EnrichedLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<EnrichedLog | null>(null);
  const insets = useSafeAreaInsets();

  const fetchLogs = useCallback(async () => {
    try {
      const res = await getMyAuditLog();
      setLogs(res.data?.data?.dbLogs ?? res.data?.dbLogs ?? []);
      setStats(res.data?.data?.stats ?? null);
    } catch {
      setLogs([]);
      setStats(null);
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

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.actionType === filter);
  }, [logs, filter]);

  // Group by date
  const sections = useMemo(() => {
    const grouped = filteredLogs.reduce(
      (acc: Record<string, EnrichedLog[]>, log) => {
        const date = new Date(log.timestamp).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        if (!acc[date]) acc[date] = [];
        acc[date].push(log);
        return acc;
      },
      {},
    );
    return Object.entries(grouped);
  }, [filteredLogs]);

  if (loading) return <LoadingSpinner message="Loading audit trail…" />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.greeting}>Access History</Text>
        <Text style={styles.subgreeting}>
          Everyone who has accessed your records, with blockchain proof
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatTile
          value={stats?.total ?? logs.length}
          label="Total"
          color={C.ink}
          icon="list-alt"
        />
        <StatTile
          value={stats?.uniqueActors ?? 0}
          label="People"
          color={C.primary}
          icon="people"
        />

        <StatTile
          value={stats?.emergencyOverrides ?? 0}
          label="Emergency"
          color={stats?.emergencyOverrides ? C.coral : C.inkMuted}
          icon="warning"
        />
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key;
            const count =
              opt.key === "all"
                ? logs.length
                : logs.filter((l) => l.actionType === opt.key).length;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setFilter(opt.key)}
                style={[
                  styles.filterPill,
                  active && {
                    backgroundColor: opt.color,
                    borderColor: opt.color,
                  },
                ]}
              >
                <Text style={[styles.filterText, active && { color: "#fff" }]}>
                  {opt.label}
                </Text>
                <View
                  style={[
                    styles.filterBadge,
                    active && { backgroundColor: "rgba(255,255,255,0.2)" },
                  ]}
                >
                  <Text
                    style={[styles.filterCount, active && { color: "#fff" }]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Empty state */}
      {filteredLogs.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Icon name="history" size={32} color={C.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {logs.length === 0
              ? "No history yet"
              : "Nothing matches this filter"}
          </Text>
          <Text style={styles.emptyBody}>
            {logs.length === 0
              ? "Access events will appear here once your records are viewed by healthcare providers."
              : "Try selecting a different filter."}
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
              colors={[C.primary]}
              tintColor={C.primary}
            />
          }
          renderItem={({ item: [date, dayLogs] }) => (
            <View style={styles.section}>
              <View style={styles.dateRow}>
                <View style={styles.dateLine} />
                <View style={styles.datePill}>
                  <Icon name="event" size={11} color={C.inkSoft} />
                  <Text style={styles.dateText}>{date}</Text>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>{dayLogs.length}</Text>
                  </View>
                </View>
                <View style={styles.dateLine} />
              </View>

              {dayLogs.map((log) => (
                <LogCard
                  key={log.id}
                  log={log}
                  onPress={() => setSelectedLog(log)}
                />
              ))}
            </View>
          )}
        />
      )}

      <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  headerBar: { paddingHorizontal: 20, paddingBottom: 16 },
  greeting: {
    fontSize: 28,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.8,
  },
  subgreeting: {
    fontSize: 13,
    color: C.inkMuted,
    marginTop: 4,
    fontWeight: "500",
    lineHeight: 18,
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  statTile: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  statValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.inkMuted,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  filterRow: { paddingBottom: 8 },
  filterContent: { paddingHorizontal: 20, gap: 8 },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.card,
  },
  filterText: { fontSize: 12, fontWeight: "700", color: C.inkSoft },
  filterBadge: {
    backgroundColor: C.bgAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    minWidth: 18,
    alignItems: "center",
  },
  filterCount: { fontSize: 10, fontWeight: "800", color: C.inkSoft },

  listContent: { padding: 20, paddingBottom: 110 },
  section: { marginBottom: 8 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    marginTop: 8,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: C.divider },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkSoft,
    letterSpacing: 0.2,
  },
  dateBadge: {
    backgroundColor: C.bgAlt,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  dateBadgeText: { fontSize: 9, fontWeight: "800", color: C.inkSoft },

  logCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
  },
  logCardEmergency: { borderColor: "#FECACA", backgroundColor: "#FFFBFB" },
  emergencyStripe: { height: 3, backgroundColor: C.coral },
  logRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  logIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  logBody: { flex: 1, minWidth: 0 },
  logTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  logAction: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  logTime: { fontSize: 11, color: C.inkMuted, fontWeight: "600" },
  actorName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.2,
  },
  actorRole: { fontSize: 12, color: C.inkMuted, fontWeight: "500" },
  resourceDetail: {
    fontSize: 12,
    color: C.inkSoft,
    marginTop: 2,
    fontWeight: "500",
  },
  resourceType: {
    fontSize: 12,
    color: C.inkMuted,
    marginTop: 2,
    fontWeight: "500",
    textTransform: "capitalize",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  anchorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: C.primaryGhost,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  anchorText: {
    fontSize: 9,
    fontWeight: "800",
    color: C.primaryDark,
    letterSpacing: 0.3,
  },
  emergencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: C.coralLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  emergencyText: {
    fontSize: 9,
    fontWeight: "800",
    color: C.coral,
    letterSpacing: 0.3,
  },
  deptText: { fontSize: 10, color: C.inkMuted, fontWeight: "600" },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: C.primaryGhost,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.ink,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14,
    color: C.inkSoft,
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
  },
});

const modal = StyleSheet.create({
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
    maxHeight: "92%",
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
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    textTransform: "capitalize",
  },
  sub: { fontSize: 12, color: C.inkMuted, marginTop: 2, fontWeight: "500" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.bgAlt,
    justifyContent: "center",
    alignItems: "center",
  },

  emergencyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: C.coralLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 16,
  },
  emergencyTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.coral,
    marginBottom: 2,
  },
  emergencyBody: {
    fontSize: 12,
    color: "#7F1D1D",
    lineHeight: 17,
    fontWeight: "500",
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.inkSoft,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 8,
  },
  detailCard: {
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    gap: 12,
  },
  detailKey: {
    fontSize: 12,
    color: C.inkMuted,
    fontWeight: "600",
    flex: 1,
    textTransform: "capitalize",
  },
  detailVal: {
    fontSize: 13,
    color: C.ink,
    fontWeight: "600",
    flex: 1.5,
    textAlign: "right",
  },

  blockchainCard: {
    backgroundColor: C.primaryGhost,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.primaryLight,
    marginBottom: 8,
  },
  bcHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  bcHeaderText: { fontSize: 13, fontWeight: "800", color: C.primaryDark },
  bcBody: {
    fontSize: 12,
    color: C.primaryDark,
    lineHeight: 17,
    fontWeight: "500",
    marginBottom: 10,
  },
  bcTxBox: {
    backgroundColor: C.card,
    padding: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  bcTxLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: C.inkMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bcTxValue: {
    fontSize: 11,
    fontWeight: "600",
    color: C.primaryDark,
    fontFamily: "monospace",
  },
});
