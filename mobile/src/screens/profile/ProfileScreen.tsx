import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";

import { logout, changePassword } from "../../api/auth";
import { getMyReferrals } from "../../api/records";
import { useAuthStore } from "../../store/authStore";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink: "#1A1D2E",
  inkSoft: "#5A5F7A",
  inkMuted: "#9498B3",
  teal: "#0D9488",
  tealDark: "#0F766E",
  tealDeep: "#115E59",
  tealGhost: "#F0FDFA",
  tealLight: "#CCFBF1",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  coral: "#EF4444",
  coralLight: "#FEE2E2",
  violet: "#7C3AED",
  blue: "#3B82F6",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  greenBorder: "#BBF7D0",
  bg: "#F8F9FC",
  card: "#FFFFFF",
  cardBorder: "#ECEEF4",
  divider: "#F1F2F6",
};

// ── Referral urgency colours ──────────────────────────────────────────────────
const URGENCY: Record<
  string,
  { color: string; bg: string; dot: string; label: string }
> = {
  routine: { color: C.green, bg: C.greenLight, dot: C.green, label: "Routine" },
  urgent: { color: C.amber, bg: C.amberLight, dot: C.amber, label: "Urgent" },
  emergency: {
    color: "#EA580C",
    bg: "#FFF7ED",
    dot: "#F97316",
    label: "Emergency",
  },
  critical: {
    color: C.coral,
    bg: C.coralLight,
    dot: C.coral,
    label: "Critical",
  },
};
const getU = (u: string) => URGENCY[u] ?? URGENCY.routine;

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: C.amber, bg: C.amberLight, label: "Pending" },
  accepted: { color: C.blue, bg: "#EFF6FF", label: "Accepted" },
  completed: { color: C.green, bg: C.greenLight, label: "Completed" },
  rejected: { color: C.coral, bg: C.coralLight, label: "Rejected" },
  cancelled: { color: "#6B7280", bg: "#F9FAFB", label: "Cancelled" },
};
const getS = (s: string) => STATUS[s] ?? STATUS.pending;

const MENU_SECTIONS = [
  {
    title: "Account",
    items: [
      {
        icon: "lock",
        label: "Change Password",
        sublabel: "Update your credentials",
        color: C.teal,
        bg: C.tealGhost,
      },
      {
        icon: "notifications",
        label: "Notification Settings",
        sublabel: "Manage alerts",
        color: C.violet,
        bg: "#EDE9FE",
      },
      {
        icon: "shield",
        label: "Privacy & Security",
        sublabel: "Control your data",
        color: C.blue,
        bg: "#EFF6FF",
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
        color: C.amber,
        bg: C.amberLight,
      },
      {
        icon: "info-outline",
        label: "About MeDLink",
        sublabel: "Version 1.0.0",
        color: C.inkSoft,
        bg: "#F3F4F6",
      },
    ],
  },
];

// ── Referral card (detailed) ─────────────────────────────────────────────────
function ReferralRow({ referral }: { referral: any }) {
  const u = getU(referral.urgency);
  const st = getS(referral.status);

  const dateStr = referral.referredAt
    ? new Date(referral.referredAt).toLocaleDateString("en-ZM", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <View style={[rStyles.card, { borderLeftColor: u.dot }]}>
      {/* Header: ref number + status pill */}
      <View style={rStyles.headerRow}>
        <Text style={rStyles.refNum}>{referral.referralNumber}</Text>
        <View style={[rStyles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[rStyles.statusText, { color: st.color }]}>
            {st.label}
          </Text>
        </View>
      </View>

      {/* Receiving institution — most prominent */}
      {referral.receivingInstitutionName && (
        <View style={rStyles.instRow}>
          <Icon name="local-hospital" size={13} color={u.color} />
          <Text
            style={[rStyles.instName, { color: u.color }]}
            numberOfLines={1}
          >
            {referral.receivingInstitutionName}
          </Text>
        </View>
      )}

      {/* Reason */}
      <Text style={rStyles.reason} numberOfLines={2}>
        {referral.reason}
      </Text>

      {/* Clinical summary if different from reason */}
      {referral.clinicalSummary &&
        referral.clinicalSummary !== referral.reason && (
          <Text style={rStyles.summary} numberOfLines={2}>
            {referral.clinicalSummary}
          </Text>
        )}

      {/* Footer: urgency + date */}
      <View style={rStyles.footerRow}>
        <View style={[rStyles.urgencyPill, { backgroundColor: u.bg }]}>
          <View style={[rStyles.urgencyDot, { backgroundColor: u.dot }]} />
          <Text style={[rStyles.urgencyText, { color: u.color }]}>
            {u.label}
          </Text>
        </View>
        {dateStr && <Text style={rStyles.dateText}>{dateStr}</Text>}
      </View>

      {/* Accepted/completed timestamps */}
      {referral.acceptedAt && (
        <Text style={[rStyles.timestampText, { color: C.blue }]}>
          ✓ Accepted{" "}
          {new Date(referral.acceptedAt).toLocaleDateString("en-ZM", {
            day: "numeric",
            month: "short",
          })}
        </Text>
      )}
      {referral.completedAt && (
        <Text style={[rStyles.timestampText, { color: C.green }]}>
          ✓ Completed{" "}
          {new Date(referral.completedAt).toLocaleDateString("en-ZM", {
            day: "numeric",
            month: "short",
          })}
        </Text>
      )}
      {referral.responseNotes &&
        !referral.responseNotes.startsWith("Converted") && (
          <Text style={rStyles.noteText} numberOfLines={2}>
            "{referral.responseNotes}"
          </Text>
        )}
    </View>
  );
}

const rStyles = StyleSheet.create({
  card: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    borderLeftWidth: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  refNum: {
    fontSize: 10,
    fontWeight: "700",
    color: C.inkMuted,
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
    letterSpacing: 0.5,
  },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: "800" },
  instRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  instName: { fontSize: 13, fontWeight: "700", flex: 1 },
  reason: { fontSize: 12, color: C.ink, fontWeight: "500", lineHeight: 17 },
  summary: {
    fontSize: 11,
    color: C.inkSoft,
    lineHeight: 16,
    fontStyle: "italic",
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  urgencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  urgencyDot: { width: 5, height: 5, borderRadius: 3 },
  urgencyText: { fontSize: 9, fontWeight: "700" },
  dateText: { fontSize: 10, color: C.inkMuted },
  timestampText: { fontSize: 10, marginTop: 3 },
  noteText: {
    fontSize: 10,
    color: C.inkSoft,
    fontStyle: "italic",
    marginTop: 3,
    lineHeight: 14,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Referrals state
  const [referrals, setReferrals] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(true);
  const [refExpanded, setRefExpanded] = useState(false);

  const { user, clearAuth } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Load referrals on mount
  const loadReferrals = useCallback(async () => {
    try {
      const res = await getMyReferrals();
      const raw: any[] = res?.referrals ?? res?.data?.referrals ?? [];
      // Sort: active first, then by date desc
      const sorted = [...raw].sort((a, b) => {
        const order: Record<string, number> = {
          pending: 0,
          accepted: 1,
          completed: 2,
          rejected: 3,
          cancelled: 4,
        };
        const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
        return diff !== 0
          ? diff
          : new Date(b.referredAt).getTime() - new Date(a.referredAt).getTime();
      });
      setReferrals(sorted);
    } catch {
      setReferrals([]);
    } finally {
      setRefLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

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

  const handleChangePassword = async () => {
    if (!oldPw || !newPw) {
      Toast.show({ type: "error", text1: "Please fill all fields" });
      return;
    }
    if (newPw.length < 8) {
      Toast.show({
        type: "error",
        text1: "Password must be at least 8 characters",
      });
      return;
    }
    if (newPw !== confirmPw) {
      Toast.show({ type: "error", text1: "New passwords do not match" });
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(oldPw, newPw);
      Toast.show({
        type: "success",
        text1: "Password changed. Please log in again.",
      });
      setPwModal(false);
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(async () => {
        try {
          await logout();
        } catch {}
        await clearAuth();
      }, 2000);
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1:
          err.response?.data?.error?.message || "Failed to change password",
      });
    } finally {
      setPwLoading(false);
    }
  };

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`;
  const activeCount = referrals.filter((r) =>
    ["pending", "accepted"].includes(r.status),
  ).length;
  const displayList = refExpanded ? referrals : referrals.slice(0, 3);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.tealDeep} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[C.tealDeep, C.tealDark, C.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
        >
          <View
            style={[
              styles.deco,
              { width: 180, height: 180, top: -50, right: -50 },
            ]}
          />
          <View
            style={[
              styles.deco,
              { width: 100, height: 100, bottom: 0, left: -20 },
            ]}
          />

          <View style={styles.brandRow}>
            <Text style={styles.brandName}>MedLink</Text>
            <Text style={styles.brandSub}>ZAMBIA</Text>
          </View>

          <View style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Icon name="verified" size={14} color={C.teal} />
            </View>
          </View>

          <Text style={styles.fullName}>
            {user?.firstName} {user?.lastName}
          </Text>

          <View style={styles.rolePill}>
            <View style={styles.roleDot} />
            <Text style={styles.roleText}>PATIENT</Text>
          </View>
        </LinearGradient>

        {/* ── Referrals card ───────────────────────────────────────────── */}
        <View style={styles.sectionOuter}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>MY REFERRALS</Text>
            {activeCount > 0 && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>{activeCount} active</Text>
              </View>
            )}
          </View>

          <View style={styles.menuCard}>
            {refLoading ? (
              <View style={styles.refEmpty}>
                <ActivityIndicator size="small" color={C.teal} />
              </View>
            ) : referrals.length === 0 ? (
              <View style={styles.refEmpty}>
                <Icon
                  name="local-hospital"
                  size={24}
                  color={C.inkMuted}
                  style={{ marginBottom: 6 }}
                />
                <Text style={styles.refEmptyText}>No referrals yet</Text>
                <Text style={styles.refEmptySubtext}>
                  When your doctor refers you to another hospital,{"\n"}your
                  referral details will appear here.
                </Text>
              </View>
            ) : (
              <>
                {displayList.map((r) => (
                  <ReferralRow key={r.id} referral={r} />
                ))}
                {referrals.length > 3 && (
                  <TouchableOpacity
                    style={styles.showMoreBtn}
                    onPress={() => setRefExpanded((e) => !e)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.showMoreText}>
                      {refExpanded
                        ? "Show less"
                        : `Show ${referrals.length - 3} more`}
                    </Text>
                    <Icon
                      name={refExpanded ? "expand-less" : "expand-more"}
                      size={16}
                      color={C.teal}
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {/* ── Menu sections ────────────────────────────────────────────── */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={styles.sectionOuter}>
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
                  onPress={() => {
                    if (item.label === "Change Password") setPwModal(true);
                    else Toast.show({ type: "info", text1: "Coming soon" });
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[styles.menuIconWrap, { backgroundColor: item.bg }]}
                  >
                    <Icon
                      name={item.icon as any}
                      size={17}
                      color={item.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    {item.sublabel && (
                      <Text style={styles.menuSublabel}>{item.sublabel}</Text>
                    )}
                  </View>
                  <Icon name="chevron-right" size={17} color="#D0D5E0" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* ── Sign out ─────────────────────────────────────────────────── */}
        <View style={styles.sectionOuter}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <View style={styles.signOutIcon}>
              <Icon name="logout" size={17} color={C.coral} />
            </View>
            <Text style={styles.signOutText}>Sign Out</Text>
            <Icon name="chevron-right" size={17} color="#D0D5E0" />
          </TouchableOpacity>
        </View>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>MedLink · Zambia</Text>
          <Text style={styles.footerVersion}>
            v1.0.0 · Final Year Project · CBU
          </Text>
        </View>
      </ScrollView>

      {/* ── Change Password Modal ─────────────────────────────────────── */}
      <Modal
        animationType="slide"
        transparent
        visible={pwModal}
        onRequestClose={() => setPwModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Change Password</Text>
                <Text style={styles.modalSub}>Keep your account secure</Text>
              </View>
              <TouchableOpacity
                onPress={() => setPwModal(false)}
                style={styles.modalClose}
              >
                <Icon name="close" size={18} color={C.inkMuted} />
              </TouchableOpacity>
            </View>

            {[
              {
                label: "Current Password",
                value: oldPw,
                setter: setOldPw,
                placeholder: "Enter current password",
              },
              {
                label: "New Password",
                value: newPw,
                setter: setNewPw,
                placeholder: "Min. 8 characters",
              },
              {
                label: "Confirm New Password",
                value: confirmPw,
                setter: setConfirmPw,
                placeholder: "Confirm new password",
              },
            ].map(({ label, value, setter, placeholder }) => (
              <View key={label} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{label}</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={value}
                  onChangeText={setter}
                  placeholder={placeholder}
                  placeholderTextColor={C.inkMuted}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.updateBtn, pwLoading && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={pwLoading}
            >
              <LinearGradient
                colors={[C.tealDark, C.teal]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.updateBtnGradient}
              >
                {pwLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.updateBtnText}>Update Password</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  hero: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 36,
    overflow: "hidden",
  },
  deco: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  brandRow: { alignSelf: "flex-start", marginBottom: 24 },
  brandName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: "800",
    color: "#6FCF97",
    letterSpacing: 2.5,
    marginTop: 2,
  },

  avatarOuter: { position: "relative", marginBottom: 14 },
  avatarInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: { fontSize: 32, fontWeight: "800", color: "#fff" },
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
    borderColor: C.tealGhost,
  },
  fullName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#6FCF97" },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 1.2,
  },

  // Section wrapper (replaces old menuSection)
  sectionOuter: { paddingHorizontal: 16, marginTop: 16 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  activeBadge: {
    backgroundColor: C.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.greenBorder,
  },
  activeBadgeText: { fontSize: 9, fontWeight: "700", color: C.green },

  menuCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: "#1A1D2E",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },

  // Referrals empty state
  refEmpty: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  refEmptyText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.inkSoft,
    marginBottom: 4,
  },
  refEmptySubtext: {
    fontSize: 11,
    color: C.inkMuted,
    textAlign: "center",
    lineHeight: 16,
  },

  // Show more
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  showMoreText: { fontSize: 12, fontWeight: "700", color: C.teal },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: C.divider },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: { fontSize: 14, fontWeight: "600", color: C.ink },
  menuSublabel: { fontSize: 11, color: C.inkMuted, marginTop: 1 },

  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    ...Platform.select({
      ios: {
        shadowColor: C.coral,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  signOutIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.coralLight,
    justifyContent: "center",
    alignItems: "center",
  },
  signOutText: { flex: 1, fontSize: 14, fontWeight: "700", color: C.coral },

  footer: { alignItems: "center", paddingVertical: 28 },
  footerBrand: { fontSize: 13, fontWeight: "700", color: C.inkMuted },
  footerVersion: {
    fontSize: 11,
    color: C.inkMuted,
    marginTop: 3,
    opacity: 0.6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.cardBorder,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.3,
  },
  modalSub: { fontSize: 12, color: C.inkMuted, marginTop: 2 },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.bg,
    justifyContent: "center",
    alignItems: "center",
  },

  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkSoft,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.bg,
  },

  updateBtn: { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  updateBtnGradient: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 14,
  },
  updateBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
});
