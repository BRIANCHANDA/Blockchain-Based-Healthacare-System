import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { logout } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";

type MenuItem = {
  icon: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
};

const MENU_SECTIONS = [
  {
    title: "Account",
    items: [
      {
        icon: "lock",
        label: "Change Password",
        sublabel: "Update your credentials",
      },
      {
        icon: "notifications",
        label: "Notification Settings",
        sublabel: "Manage alerts",
      },
      {
        icon: "shield",
        label: "Privacy & Security",
        sublabel: "Control your data",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        icon: "help-outline",
        label: "Help & Support",
        sublabel: "Get assistance",
      },
      {
        icon: "info-outline",
        label: "About HealthChain",
        sublabel: "Version 1.0.0",
      },
    ],
  },
];

export default function ProfileScreen() {
  const [loggingOut, setLoggingOut] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of HealthChain?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } catch {}
            await clearAuth();
            Toast.show({ type: "success", text1: "Signed out successfully" });
          },
        },
      ],
    );
  };

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#0A6640" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Hero header */}
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          {/* Brand */}
          <View style={styles.brandRow}>
            <Text style={styles.brandName}>HealthChain</Text>
            <Text style={styles.brandTag}>Zambia</Text>
          </View>

          {/* Avatar */}
          <View style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Icon name="verified" size={16} color="#0A6640" />
            </View>
          </View>

          <Text style={styles.fullName}>
            {user?.firstName} {user?.lastName}
          </Text>

          <View style={styles.patientPill}>
            <Icon name="person" size={12} color="#117039ff" />
            <Text style={styles.patientLabel}>PATIENT</Text>
          </View>
        </View>

        {/* Blockchain card */}
        <View style={styles.blockchainCard}>
          <View style={styles.blockchainTop}>
            <View style={styles.blockchainIconWrap}>
              <Icon name="link" size={18} color="#0A6640" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockchainTitle}>Blockchain Address</Text>
              <Text style={styles.blockchainSub}>
                Your unique identity on the network
              </Text>
            </View>
            <View style={styles.activeDot}>
              <View style={styles.activePulse} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          </View>

          <View style={styles.addressBox}>
            <Text style={styles.addressText} numberOfLines={2} selectable>
              {user?.blockchainAddress ?? "Not available"}
            </Text>
          </View>

          <Text style={styles.blockchainNote}>
            Your records are cryptographically secured and tamper-proof using
            this address.
          </Text>
        </View>

        {/* Menu sections */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={styles.sectionLabel}>
              {section.title.toUpperCase()}
            </Text>
            <View style={styles.menuCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    idx < section.items.length - 1 && styles.menuDivider,
                  ]}
                  onPress={() =>
                    Toast.show({ type: "info", text1: "Coming soon" })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconWrap}>
                    <Icon name={item.icon as any} size={18} color="#0A6640" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    {item.sublabel && (
                      <Text style={styles.menuSublabel}>{item.sublabel}</Text>
                    )}
                  </View>
                  <Icon name="chevron-right" size={18} color="#DDE8E2" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Sign out */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <View style={styles.signOutIcon}>
              <Icon name="logout" size={18} color="#C0392B" />
            </View>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>HealthChain Zambia</Text>
          <Text style={styles.footerVersion}>v1.0.0 · Final Year Project</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#F0F5F2" },

  // Hero
  hero: {
    backgroundColor: "#0A6640",
    alignItems: "center",
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  brandRow: { alignSelf: "flex-start", marginBottom: 24 },
  brandName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  brandTag: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6FCF97",
    letterSpacing: 2,
  },

  avatarOuter: {
    position: "relative",
    marginBottom: 14,
  },
  avatarInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: { fontSize: 30, fontWeight: "800", color: "#fff" },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E6F4EE",
  },
  fullName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  patientPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  patientLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 1,
  },

  // Blockchain card
  blockchainCard: {
    backgroundColor: "#fff",
    margin: 16,
    marginTop: -1,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#0A6640",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  blockchainTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  blockchainIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#E6F4EE",
    justifyContent: "center",
    alignItems: "center",
  },
  blockchainTitle: { fontSize: 14, fontWeight: "700", color: "#0D1F17" },
  blockchainSub: { fontSize: 12, color: "#8AA89C", marginTop: 1 },
  activeDot: { flexDirection: "row", alignItems: "center", gap: 5 },
  activePulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#0A6640",
  },
  activeText: { fontSize: 11, fontWeight: "700", color: "#0A6640" },

  addressBox: {
    backgroundColor: "#F7FAF8",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#DDE8E2",
  },
  addressText: {
    fontSize: 12,
    color: "#4A6357",
    fontFamily: "monospace",
    lineHeight: 18,
  },
  blockchainNote: { fontSize: 12, color: "#8AA89C", lineHeight: 17 },

  // Menu
  menuSection: { paddingHorizontal: 16, marginBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8AA89C",
    letterSpacing: 1,
    marginBottom: 8,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0A6640",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: "#F0F5F2" },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E6F4EE",
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: { fontSize: 14, fontWeight: "600", color: "#0D1F17" },
  menuSublabel: { fontSize: 12, color: "#8AA89C", marginTop: 1 },

  // Sign out
  signOutBtn: {
    backgroundColor: "#fff",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F5C6C6",
  },
  signOutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FDECEA",
    justifyContent: "center",
    alignItems: "center",
  },
  signOutText: { fontSize: 14, fontWeight: "700", color: "#C0392B", flex: 1 },

  // Footer
  footer: { alignItems: "center", paddingVertical: 20 },
  footerText: { fontSize: 13, fontWeight: "700", color: "#DDE8E2" },
  footerVersion: { fontSize: 11, color: "#DDE8E2", marginTop: 3 },
});
