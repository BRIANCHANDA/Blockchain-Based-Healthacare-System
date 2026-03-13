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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
} from "../../api/access";
import { AccessStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

type Props = NativeStackScreenProps<AccessStackParamList, "AccessRequests">;

const ROLE_META: Record<string, { icon: string; color: string; bg: string }> = {
  practitioner: { icon: "medical-services", color: "#0A6640", bg: "#E6F4EE" },
  nurse: { icon: "local-hospital", color: "#1A6B8A", bg: "#E3F2F8" },
  lab_technician: { icon: "biotech", color: "#6D28D9", bg: "#EDE9FE" },
  radiologist: { icon: "medication", color: "#C9952A", bg: "#FDF3DC" },
  pharmacist: { icon: "medication", color: "#047857", bg: "#ECFDF5" },
};

export default function AccessRequestsScreen({ navigation }: Props) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

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
      "Reject Request",
      `Deny access for ${req.requesterName ?? "this clinician"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setActioning(req.id);
            try {
              await rejectAccessRequest(req.id);
              Toast.show({ type: "success", text1: "Request Rejected" });
              setRequests((prev) => prev.filter((r) => r.id !== req.id));
            } catch {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: "Could not reject request",
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
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#0A6640" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Access Requests</Text>
            <Text style={styles.headerSub}>
              Review who wants to see your records
            </Text>
          </View>
          {pending.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pending.length}</Text>
            </View>
          )}
        </View>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <View style={styles.tabActive}>
            <Icon name="notifications" size={14} color="#0A6640" />
            <Text style={styles.tabActiveText}>Requests</Text>
          </View>
          <TouchableOpacity
            style={styles.tabInactive}
            onPress={() => navigation.navigate("WhoHasAccess")}
          >
            <Icon name="group" size={14} color="#8AA89C" />
            <Text style={styles.tabInactiveText}>Has Access</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={pending}
        keyExtractor={(r) => r.id}
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
              <Icon name="check-circle" size={36} color="#0A6640" />
            </View>
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptyText}>
              No pending access requests at this time
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const role =
            ROLE_META[item.requestedByUserType] ?? ROLE_META.practitioner;
          const isActioning = actioning === item.id;

          return (
            <View style={styles.card}>
              {/* Provider info */}
              <View style={styles.providerRow}>
                <View style={[styles.roleIcon, { backgroundColor: role.bg }]}>
                  <Icon name={role.icon as any} size={22} color={role.color} />
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
                <Icon name="format-quote" size={16} color="#8AA89C" />
                <Text style={styles.reasonText}>
                  {item.reason ?? "Access requested for clinical review"}
                </Text>
              </View>

              {/* Expiry */}
              <View style={styles.metaRow}>
                <Icon name="schedule" size={13} color="#8AA89C" />
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
                >
                  <Icon name="close" size={16} color="#C0392B" />
                  <Text style={styles.rejectBtnText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.approveBtn, isActioning && styles.btnDisabled]}
                  onPress={() => handleApprove(item)}
                  disabled={isActioning}
                >
                  <Icon name="check" size={16} color="#fff" />
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

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F0F5F2" },

  header: {
    backgroundColor: "#0A6640",
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 3 },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#C9952A",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  badgeText: { fontSize: 13, fontWeight: "800", color: "#fff" },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: 3,
    marginBottom: 0,
  },
  tabActive: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 9,
    marginBottom: -1,
  },
  tabActiveText: { fontSize: 13, fontWeight: "700", color: "#0A6640" },
  tabInactive: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
  },
  tabInactiveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },

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

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0A6640",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  roleIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  providerName: { fontSize: 15, fontWeight: "700", color: "#0D1F17" },
  providerRole: {
    fontSize: 11,
    color: "#8AA89C",
    marginTop: 2,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FDF3DC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C9952A",
  },
  pendingText: { fontSize: 11, fontWeight: "700", color: "#C9952A" },

  reasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F7FAF8",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  reasonText: {
    fontSize: 13,
    color: "#4A6357",
    fontStyle: "italic",
    flex: 1,
    lineHeight: 18,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 14,
  },
  metaText: { fontSize: 12, color: "#8AA89C" },

  actions: { flexDirection: "row", gap: 10 },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#FDECEA",
    borderWidth: 1,
    borderColor: "#F5C6C6",
  },
  rejectBtnText: { fontSize: 14, fontWeight: "700", color: "#C0392B" },
  approveBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#0A6640",
  },
  approveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.5 },
});
