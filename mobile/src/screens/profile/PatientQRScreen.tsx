import { View, Text, StyleSheet, ScrollView, StatusBar, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";

import { useAuthStore } from "../../store/authStore";

const C = {
  brand:        "#059669",
  brandDeep:    "#047857",
  brandTint:    "#ECFDF5",
  brandFill:    "#D1FAE5",
  successInk:   "#047857",
  ink:          "#0A0E1A",
  bg:           "#FAFAFB",
  card:         "#FFFFFF",
  cardBorder:   "#E5E7EB",
  inkMuted:     "#9CA3AF",
};

const MONO_FONT = Platform.OS === "android" ? "monospace" : "Courier";

export default function PatientQRScreen() {
  const { user } = useAuthStore();
  const payload = JSON.stringify({ t: "hc-patient", id: user?.id });
  const nrcDisplay = (user as any)?.nationalId ?? user?.id ?? "—";

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── DS ID card — deep green card with brand-green header strip ── */}
        <View style={styles.idCard}>
          {/* Header strip: logo + wordmark + PATIENT badge */}
          <View style={styles.cardHeader}>
            <View style={styles.logoMark}>
              <MaterialIcons name="health-and-safety" size={18} color="#fff" />
            </View>
            <Text style={styles.cardWordmark}>MedLink Zambia</Text>
            <View style={styles.patientBadge}>
              <Text style={styles.patientBadgeText}>PATIENT</Text>
            </View>
          </View>

          {/* QR code — white container inside the deep-green card */}
          <View style={styles.qrContainer}>
            {user?.id ? (
              <QRCode
                value={payload}
                size={196}
                color={C.ink}
                backgroundColor="#fff"
              />
            ) : (
              <Text style={styles.error}>Could not load your ID</Text>
            )}
          </View>

          {/* Patient name + NRC in white text */}
          <View style={styles.nameSection}>
            <Text style={styles.patientName}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={styles.nrcText}>NRC {nrcDisplay}</Text>
          </View>
        </View>

        {/* ── Reassurance card ── */}
        <View style={styles.reassuranceCard}>
          <MaterialIcons
            name="security"
            size={22}
            color={C.successInk}
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <Text style={styles.reassuranceText}>
            This code contains only your patient ID —{" "}
            <Text style={{ fontWeight: "700" }}>no medical information</Text>.
            Staff still need your permission to view your records.
          </Text>
        </View>

        {/* ── Trust badge ── */}
        <View style={styles.trustRow}>
          <View style={styles.trustChip}>
            <MaterialIcons name="lock" size={12} color={C.brand} />
            <Text style={styles.trustChipText}>ID-only · No health data</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },

  // ── DS ID card ──
  idCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: C.brandDeep,
    ...Platform.select({
      ios: {
        shadowColor: C.ink,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 32,
      },
      android: { elevation: 10 },
    }),
  },

  // Header strip — brand green
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: C.brand,
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardWordmark: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: -0.1,
  },
  patientBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  patientBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },

  // QR container — white box inside deep-green card
  qrContainer: {
    margin: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 13,
    color: "#dc2626",
    fontWeight: "600",
    padding: 40,
  },

  // Name + NRC beneath QR
  nameSection: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    alignItems: "center",
  },
  patientName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  nrcText: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: MONO_FONT,
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 0.2,
  },

  // ── Reassurance card ──
  reassuranceCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: C.brandFill,
    borderWidth: 1,
    borderColor: "rgba(5,150,105,0.22)",
  },
  reassuranceText: {
    flex: 1,
    fontSize: 15,
    color: C.successInk,
    lineHeight: 22,
    fontWeight: "400",
  },

  // ── Trust badge ──
  trustRow: {
    alignItems: "center",
    paddingTop: 4,
  },
  trustChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.brandTint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  trustChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.brandDeep,
    letterSpacing: 0.1,
  },
});
