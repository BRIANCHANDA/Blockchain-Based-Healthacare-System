import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import {
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
} from "../../api/access";
import { AccessStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

type Props = NativeStackScreenProps<AccessStackParamList, "AccessRequests">;

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

const ROLE_META: Record<
  string,
  { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }
> = {
  practitioner: {
    icon: "medical-services",
    color: C.primary,
    bg: C.primaryGhost,
  },
  nurse: { icon: "local-hospital", color: C.blue, bg: C.blueLight },
  lab_technician: { icon: "biotech", color: C.violet, bg: C.violetLight },
  radiologist: { icon: "image-search", color: C.amber, bg: C.amberLight },
  pharmacist: { icon: "medication", color: C.primary, bg: C.primaryGhost },
};

export default function AccessRequestsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await getAccessRequests();
      setRequests(res.data?.requests ?? []);
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    fetchRequests().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const handleApprove = (req: any) => {
    Alert.alert(
      "Grant Access",
      `Allow ${req.requesterName ?? "this clinician"} to access your records for 24 hours?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setActioning(req.id);
            try {
              await approveAccessRequest(req.id, 24);
              Toast.show({
                type: "success",
                text1: "Access Granted",
                text2: "24-hour access approved",
              });
              setRequests((prev) => prev.filter((r) => r.id !== req.id));
            } catch {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: "Could not approve request",
              });
            } finally {
              setActioning(null);
            }
          },
        },
      ],
    );
  };

  const handleReject = (req: any) => {
    Alert.alert(
      "Decline Request",
      `Deny access for ${req.requesterName ?? "this clinician"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setActioning(req.id);
            try {
              await rejectAccessRequest(req.id);
              Toast.show({ type: "success", text1: "Request Declined" });
              setRequests((prev) => prev.filter((r) => r.id !== req.id));
            } catch {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: "Could not decline request",
              });
            } finally {
              setActioning(null);
            }
          },
        },
      ],
    );
  };

  const pending = requests.filter((r) => r.status === "pending");

  if (loading) return <LoadingSpinner message="Loading access requests…" />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Access Requests</Text>
            <Text style={styles.subgreeting}>
              Review who wants to see your records
            </Text>
          </View>
          {pending.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pending.length}</Text>
            </View>
          )}
        </View>

        {/* ── Tab pills ── */}
        <View style={styles.tabRow}>
          <View style={styles.tabActive}>
            <MaterialIcons name="notifications" size={14} color="#fff" />
            <Text style={styles.tabActiveText}>Requests</Text>
            {pending.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pending.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.tabInactive}
            onPress={() => navigation.navigate("WhoHasAccess")}
            activeOpacity={0.7}
          >
            <MaterialIcons name="group" size={14} color={C.inkSoft} />
            <Text style={styles.tabInactiveText}>Has Access</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={pending}
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
              <MaterialIcons
                name="check-circle-outline"
                size={36}
                color={C.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyBody}>
              No pending access requests at this time.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const role =
            ROLE_META[item.requestedByUserType] ?? ROLE_META.practitioner;
          const isActioning = actioning === item.id;
          return (
            <View style={styles.card}>
              {/* Provider row */}
              <View style={styles.providerRow}>
                <View style={[styles.roleIcon, { backgroundColor: role.bg }]}>
                  <MaterialIcons
                    name={role.icon}
                    size={22}
                    color={role.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerName}>
                    {item.requesterName ?? "Healthcare Provider"}
                  </Text>
                  <Text style={styles.providerRole}>
                    {item.requestedByUserType?.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
                <View style={styles.pendingPill}>
                  <View style={styles.pendingDot} />
                  <Text style={styles.pendingText}>Pending</Text>
                </View>
              </View>

              {/* Reason */}
              <View style={styles.reasonBox}>
                <MaterialIcons
                  name="format-quote"
                  size={16}
                  color={C.inkMuted}
                />
                <Text style={styles.reasonText}>
                  {item.reason ?? "Access requested for clinical review"}
                </Text>
              </View>

              {/* Meta */}
              <View style={styles.metaRow}>
                <MaterialIcons name="schedule" size={13} color={C.inkMuted} />
                <Text style={styles.metaText}>
                  Requested until{" "}
                  {new Date(item.expiresAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.rejectBtn, isActioning && styles.btnDisabled]}
                  onPress={() => handleReject(item)}
                  disabled={isActioning}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="close" size={16} color={C.coral} />
                  <Text style={styles.rejectBtnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, isActioning && styles.btnDisabled]}
                  onPress={() => handleApprove(item)}
                  disabled={isActioning}
                  activeOpacity={0.9}
                >
                  <MaterialIcons name="check" size={16} color="#fff" />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
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
    backgroundColor: C.amber,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },

  // ── Tabs (DS segmented control: white card on inset gray bg) ──
  tabRow: {
    flexDirection: "row",
    backgroundColor: C.bgAlt,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabActive: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.card,
    borderRadius: 9,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#0A0E1A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  tabActiveText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.1,
  },
  tabBadge: {
    backgroundColor: C.amber,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
  },
  tabInactive: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  tabInactiveText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.inkSoft,
    letterSpacing: -0.1,
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },

  empty: {
    alignItems: "center",
    marginTop: 80,
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
  },
  emptyBody: {
    fontSize: 14,
    color: C.inkSoft,
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
  },

  // ── Card ──
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },

  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  providerName: {
    fontSize: 16,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.3,
  },
  providerRole: {
    fontSize: 10,
    color: C.inkMuted,
    marginTop: 2,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.amberLight,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.amber,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.amber,
    letterSpacing: 0.3,
  },

  reasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.divider,
  },
  reasonText: {
    fontSize: 13,
    color: C.inkSoft,
    fontStyle: "italic",
    flex: 1,
    lineHeight: 19,
    fontWeight: "500",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  metaText: {
    fontSize: 12,
    color: C.inkMuted,
    fontWeight: "500",
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.coralLight,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.coral,
    letterSpacing: -0.1,
  },
  approveBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.ink,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.1,
  },
  btnDisabled: { opacity: 0.5 },
});
