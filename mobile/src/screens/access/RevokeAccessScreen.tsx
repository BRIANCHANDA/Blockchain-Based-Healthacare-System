import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { revokeAccess } from "../../api/access";
import { AccessStackParamList } from "../../types";

type Props = NativeStackScreenProps<AccessStackParamList, "RevokeAccess">;

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

const WHAT_HAPPENS = [
  { text: "Their permission will be removed immediately", negative: true },
  { text: "They will no longer be able to view your records", negative: true },
  {
    text: "This action is permanently logged in your audit trail",
    negative: false,
  },
  { text: "You can re-grant access at any time", negative: false },
];

export default function RevokeAccessScreen({ route, navigation }: Props) {
  const { granteeName, practitionerId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const handleRevoke = () => {
    Alert.alert(
      "Confirm Revocation",
      `This will immediately remove ${granteeName}'s access to your records.\n\nAre you sure?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Revoke",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await revokeAccess(practitionerId);
              Toast.show({
                type: "success",
                text1: "Access Revoked",
                text2: `${granteeName} no longer has access`,
              });
              navigation.goBack();
            } catch (err: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2:
                  err.response?.data?.error?.message ??
                  "Could not revoke access. Try again.",
              });
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.6}
        >
          <MaterialIcons name="arrow-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revoke Access</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Warning icon ── */}
        <View style={styles.warningWrap}>
          <View style={styles.warningIcon}>
            <MaterialIcons name="block" size={36} color={C.coral} />
          </View>
        </View>

        {/* ── Headline ── */}
        <Text style={styles.headline}>
          Revoke access for{"\n"}
          <Text style={{ color: C.primaryDark }}>{granteeName}</Text>?
        </Text>
        <Text style={styles.subheadline}>
          Their permission to view your medical records will be removed
          immediately.
        </Text>

        {/* ── What happens card ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What happens when you revoke</Text>
          {WHAT_HAPPENS.map((point, i) => (
            <View
              key={i}
              style={[
                styles.point,
                i === WHAT_HAPPENS.length - 1 && { marginBottom: 0 },
              ]}
            >
              <View
                style={[
                  styles.pointIcon,
                  {
                    backgroundColor: point.negative
                      ? C.coralLight
                      : C.primaryGhost,
                  },
                ]}
              >
                <MaterialIcons
                  name={point.negative ? "remove" : "check"}
                  size={14}
                  color={point.negative ? C.coral : C.primary}
                />
              </View>
              <Text style={styles.pointText}>{point.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Security note ── */}
        <View style={styles.infoBox}>
          <View style={styles.infoIconWrap}>
            <MaterialIcons name="verified-user" size={16} color={C.primary} />
          </View>
          <Text style={styles.infoText}>
            All permission changes are recorded in your secure audit trail for
            complete transparency.
          </Text>
        </View>
      </ScrollView>

      {/* ── Bottom actions ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.revokeBtn, loading && styles.btnDisabled]}
          onPress={handleRevoke}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <MaterialIcons name="hourglass-empty" size={16} color="#fff" />
          ) : (
            <MaterialIcons name="block" size={16} color="#fff" />
          )}
          <Text style={styles.revokeBtnText}>
            {loading ? "Revoking…" : "Revoke Access"}
          </Text>
        </TouchableOpacity>
      </View>
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

  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 140,
  },

  warningWrap: {
    alignItems: "center",
    marginBottom: 24,
  },
  warningIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.coralLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  headline: {
    fontSize: 26,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.8,
    lineHeight: 32,
    textAlign: "center",
    marginBottom: 10,
  },
  subheadline: {
    fontSize: 14,
    color: C.inkSoft,
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
    marginBottom: 28,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  point: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  pointIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  pointText: {
    fontSize: 13,
    color: C.ink,
    flex: 1,
    lineHeight: 19,
    fontWeight: "500",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.primaryGhost,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  infoText: {
    fontSize: 12.5,
    color: C.primaryDark,
    flex: 1,
    lineHeight: 18,
    fontWeight: "600",
  },

  // ── Bottom ──
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 13,
    backgroundColor: C.bgAlt,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.inkSoft,
    letterSpacing: -0.1,
  },
  revokeBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 13,
    backgroundColor: C.coral,
    ...Platform.select({
      ios: {
        shadowColor: C.coral,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  revokeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.1,
  },
  btnDisabled: { opacity: 0.6 },
});
