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
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMyPermissions } from "../../api/access";
import { AccessStackParamList, Permission } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

type Props = NativeStackScreenProps<AccessStackParamList, "WhoHasAccess">;

export default function WhoHasAccessScreen({ navigation }: Props) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const fetchPerms = useCallback(async () => {
    try {
      const res = await getMyPermissions();
      const raw: Permission[] = res.data?.permissions ?? [];
      setPermissions(raw.filter((p) => p.isActive));
    } catch {
      setPermissions([]);
    }
  }, []);

  useEffect(() => {
    fetchPerms().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPerms();
    setRefreshing(false);
  };

  const isExpired = (p: Permission) => new Date(p.expiresAt) < new Date();

  if (loading) return <LoadingSpinner message="Loading permissions…" />;

  const active = permissions.filter((p) => !isExpired(p));
  const expired = permissions.filter((p) => isExpired(p));

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#0A6640" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Who Has Access</Text>
            <Text style={styles.headerSub}>Active blockchain permissions</Text>
          </View>
          <View style={styles.countBubble}>
            <Text style={styles.countNum}>{active.length}</Text>
            <Text style={styles.countLabel}>Active</Text>
          </View>
        </View>

        {/* Back to requests */}
        <TouchableOpacity
          style={styles.backTab}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.backTabText}>Back to Requests</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...active, ...expired]}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0A6640"]}
          />
        }
        ListHeaderComponent={
          active.length > 0 ? (
            <View style={styles.infoBox}>
              <Icon name="verified-user" size={16} color="#0A6640" />
              <Text style={styles.infoText}>
                {active.length} clinician{active.length !== 1 ? "s" : ""}{" "}
                currently have blockchain-verified access to your records.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="lock" size={36} color="#0A6640" />
            </View>
            <Text style={styles.emptyTitle}>No active permissions</Text>
            <Text style={styles.emptyText}>
              No one currently has access to your records
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const expired = isExpired(item);
          return (
            <View style={[styles.card, expired && styles.cardExpired]}>
              {/* Status strip */}
              <View
                style={[
                  styles.statusStrip,
                  { backgroundColor: expired ? "#6B7280" : "#0A6640" },
                ]}
              />

              <View style={styles.cardBody}>
                <View style={styles.providerRow}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: expired ? "#F3F4F6" : "#E6F4EE" },
                    ]}
                  >
                    <Icon
                      name="person"
                      size={22}
                      color={expired ? "#9CA3AF" : "#0A6640"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, expired && styles.nameExpired]}>
                      {item.granteeName ?? item.grantedToUserId}
                    </Text>
                    <Text style={styles.role}>
                      {item.granteeRole?.replace("_", " ").toUpperCase() ??
                        "CLINICIAN"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: expired ? "#F3F4F6" : "#E6F4EE" },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: expired ? "#9CA3AF" : "#0A6640" },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: expired ? "#6B7280" : "#0A6640" },
                      ]}
                    >
                      {expired ? "Expired" : "Active"}
                    </Text>
                  </View>
                </View>

                {/* Permission details */}
                <View style={styles.detailsRow}>
                  <View style={styles.detailChip}>
                    <Icon name="vpn-key" size={12} color="#8AA89C" />
                    <Text style={styles.detailText}>
                      {item.permissionType?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailChip}>
                    <Icon name="schedule" size={12} color="#8AA89C" />
                    <Text style={styles.detailText}>
                      Expires{" "}
                      {new Date(item.expiresAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </Text>
                  </View>
                </View>

                {!expired && (
                  <TouchableOpacity
                    style={styles.revokeBtn}
                    onPress={() =>
                      navigation.navigate("RevokeAccess", {
                        permissionId: item.id,
                        granteeName: item.granteeName ?? "this clinician",
                        practitionerId: item.grantedToUserId,
                      })
                    }
                  >
                    <Icon name="block" size={14} color="#C0392B" />
                    <Text style={styles.revokeBtnText}>Revoke Access</Text>
                  </TouchableOpacity>
                )}
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
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 3 },
  countBubble: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  countNum: { fontSize: 22, fontWeight: "800", color: "#fff" },
  countLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
  },
  backTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  backTabText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#E6F4EE",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#B3D9C8",
  },
  infoText: { color: "#064D30", fontSize: 13, flex: 1, lineHeight: 18 },

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
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: "#0A6640",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardExpired: { opacity: 0.7 },
  statusStrip: { width: 4 },
  cardBody: { flex: 1, padding: 14 },

  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  name: { fontSize: 15, fontWeight: "700", color: "#0D1F17" },
  nameExpired: { color: "#6B7280" },
  role: {
    fontSize: 10,
    color: "#8AA89C",
    marginTop: 2,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },

  detailsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F7FAF8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailText: { fontSize: 11, color: "#4A6357", fontWeight: "600" },

  revokeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FDECEA",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#F5C6C6",
  },
  revokeBtnText: { color: "#C0392B", fontSize: 13, fontWeight: "700" },
});
