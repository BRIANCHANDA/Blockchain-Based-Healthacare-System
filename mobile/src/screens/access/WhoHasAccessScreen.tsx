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
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMyPermissions } from "../../api/access";
import { AccessStackParamList, Permission } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

type Props = NativeStackScreenProps<AccessStackParamList, "WhoHasAccess">;

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

export default function WhoHasAccessScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPerms = useCallback(async () => {
    try {
      const res = await getMyPermissions();
      setPermissions(
        (res.data?.permissions ?? []).filter((p: Permission) => p.isActive),
      );
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
  const active = permissions.filter((p) => !isExpired(p));
  const expired = permissions.filter((p) => isExpired(p));

  if (loading) return <LoadingSpinner message="Loading permissions…" />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Custom header ── */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.6}
        >
          <MaterialIcons name="arrow-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Who Has Access</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Hero summary ── */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryNumber}>{active.length}</Text>
          <Text style={styles.summaryLabel}>
            Active permission{active.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.summaryIcon}>
          <MaterialIcons name="verified-user" size={24} color={C.primary} />
        </View>
      </View>

      <FlatList
        data={[...active, ...expired]}
        keyExtractor={(p) => p.id}
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
              <MaterialIcons name="lock-outline" size={36} color={C.primary} />
            </View>
            <Text style={styles.emptyTitle}>No active permissions</Text>
            <Text style={styles.emptyBody}>
              No one currently has access to your records.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const exp = isExpired(item);
          return (
            <View style={[styles.card, exp && styles.cardExpired]}>
              <View style={styles.providerRow}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: exp ? C.bgAlt : C.primaryGhost },
                  ]}
                >
                  <MaterialIcons
                    name="person"
                    size={22}
                    color={exp ? C.inkMuted : C.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, exp && styles.nameExpired]}>
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
                    { backgroundColor: exp ? C.bgAlt : C.primaryGhost },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: exp ? C.inkMuted : C.primary },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: exp ? C.inkMuted : C.primaryDark },
                    ]}
                  >
                    {exp ? "Expired" : "Active"}
                  </Text>
                </View>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailChip}>
                  <MaterialIcons name="vpn-key" size={12} color={C.inkMuted} />
                  <Text style={styles.detailText}>
                    {item.permissionType?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detailChip}>
                  <MaterialIcons name="schedule" size={12} color={C.inkMuted} />
                  <Text style={styles.detailText}>
                    Expires{" "}
                    {new Date(item.expiresAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                </View>
              </View>

              {!exp && (
                <TouchableOpacity
                  style={styles.revokeBtn}
                  onPress={() =>
                    navigation.navigate("RevokeAccess", {
                      permissionId: item.id,
                      granteeName: item.granteeName ?? "this clinician",
                      practitionerId: item.grantedToUserId,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="block" size={14} color={C.coral} />
                  <Text style={styles.revokeBtnText}>Revoke Access</Text>
                </TouchableOpacity>
              )}
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

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.3,
  },

  // ── Summary ──
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    padding: 20,
    backgroundColor: C.ink,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLeft: { flex: 1 },
  summaryNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  summaryLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
    marginTop: 4,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(5,150,105,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },

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
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cardExpired: { opacity: 0.6 },

  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.3,
  },
  nameExpired: { color: C.inkMuted },
  role: {
    fontSize: 10,
    color: C.inkMuted,
    marginTop: 2,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  detailsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.bg,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.divider,
  },
  detailText: {
    fontSize: 11,
    color: C.inkSoft,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  revokeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: C.coralLight,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  revokeBtnText: {
    color: C.coral,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
});
