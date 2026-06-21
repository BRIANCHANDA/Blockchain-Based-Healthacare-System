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
import Toast from "react-native-toast-message";
import QRCode from "react-native-qrcode-svg";

import { logout, changePassword } from "../../api/auth";
import { getMyReferrals } from "../../api/records";
import { getMyHealth, getPatientProfile } from "../../api/patient";
import { useAuthStore } from "../../store/authStore";

// ── Design tokens ─────────────────────────────────────────────────────────────
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

const URGENCY: Record<string, { color: string; bg: string; label: string }> = {
  routine: { color: C.primary, bg: C.primaryGhost, label: "Routine" },
  urgent: { color: C.amber, bg: C.amberLight, label: "Urgent" },
  emergency: { color: "#EA580C", bg: "#FFF7ED", label: "Emergency" },
  critical: { color: C.coral, bg: C.coralLight, label: "Critical" },
};
const getU = (u: string) => URGENCY[u] ?? URGENCY.routine;

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: C.amber, bg: C.amberLight, label: "Pending" },
  accepted: { color: C.blue, bg: C.blueLight, label: "Accepted" },
  completed: { color: C.primary, bg: C.primaryGhost, label: "Completed" },
  rejected: { color: C.coral, bg: C.coralLight, label: "Rejected" },
  cancelled: { color: C.inkMuted, bg: C.bgAlt, label: "Cancelled" },
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
        color: C.primary,
        bg: C.primaryGhost,
      },
      {
        icon: "notifications",
        label: "Notification Settings",
        sublabel: "Manage alerts",
        color: C.violet,
        bg: C.violetLight,
      },
      {
        icon: "shield",
        label: "Privacy & Security",
        sublabel: "Control your data",
        color: C.blue,
        bg: C.blueLight,
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
        label: "About MedLink",
        sublabel: "Version 1.0.0",
        color: C.inkSoft,
        bg: C.bgAlt,
      },
    ],
  },
];

// ── Referral row ──────────────────────────────────────────────────────────────
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
    <View style={rStyles.card}>
      <View style={rStyles.headerRow}>
        <Text style={rStyles.refNum}>{referral.referralNumber}</Text>
        <View style={[rStyles.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[rStyles.statusText, { color: st.color }]}>
            {st.label}
          </Text>
        </View>
      </View>

      {referral.receivingInstitutionName && (
        <View style={rStyles.instRow}>
          <Icon name="local-hospital" size={14} color={u.color} />
          <Text style={[rStyles.instName, { color: C.ink }]} numberOfLines={1}>
            {referral.receivingInstitutionName}
          </Text>
        </View>
      )}

      <Text style={rStyles.reason} numberOfLines={2}>
        {referral.reason}
      </Text>

      <View style={rStyles.footerRow}>
        <View style={[rStyles.urgencyPill, { backgroundColor: u.bg }]}>
          <View style={[rStyles.urgencyDot, { backgroundColor: u.color }]} />
          <Text style={[rStyles.urgencyText, { color: u.color }]}>
            {u.label}
          </Text>
        </View>
        {dateStr && <Text style={rStyles.dateText}>{dateStr}</Text>}
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  refNum: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkMuted,
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
    letterSpacing: 0.4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  instRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  instName: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    letterSpacing: -0.2,
  },
  reason: {
    fontSize: 13,
    color: C.inkSoft,
    fontWeight: "500",
    lineHeight: 19,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  urgencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  urgencyDot: { width: 5, height: 5, borderRadius: 3 },
  urgencyText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  dateText: { fontSize: 11, color: C.inkMuted, fontWeight: "500" },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);

  const [referrals, setReferrals] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(true);
  const [refExpanded, setRefExpanded] = useState(false);

  // Health summary — blood type + allergies
  const [health, setHealth] = useState<{
    bloodType: string;
    allergies: { id: string; allergen: string; allergyType: string; severity: string; reaction?: string }[];
  } | null>(null);
  const [demographics, setDemographics] = useState<{
    dateOfBirth?: string; gender?: string; phoneNumber?: string;
    maritalStatus?: string; occupation?: string;
  } | null>(null);

  const { user, clearAuth, dependents, setActivePatient } = useAuthStore();
  const insets = useSafeAreaInsets();

  const loadReferrals = useCallback(async () => {
    try {
      const res = await getMyReferrals();
      const raw: any[] = res?.referrals ?? res?.data?.referrals ?? [];
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
    // Load blood type + allergies
    getMyHealth()
      .then((res: any) => setHealth(res.data?.data ?? res.data ?? null))
      .catch(() => {});
    // Load demographics (DOB, gender, phone)
    getPatientProfile()
      .then((res: any) => setDemographics(res.data?.data ?? res.data ?? null))
      .catch(() => {});
  }, [loadReferrals]);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of MedLink?", [
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
    ]);
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
  const qrPayload = JSON.stringify({ t: "hc-patient", id: user?.id });
  const activeCount = referrals.filter((r) =>
    ["pending", "accepted"].includes(r.status),
  ).length;
  const displayList = refExpanded ? referrals : referrals.slice(0, 3);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 110,
          paddingTop: insets.top + 16,
        }}
      >
        {/* ── Profile card ─────────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Icon name="check" size={12} color="#fff" />
            </View>
          </View>

          <Text style={styles.fullName}>
            {user?.firstName} {user?.lastName}
          </Text>

          <View style={styles.rolePill}>
            <View style={styles.roleDot} />
            <Text style={styles.roleText}>PATIENT</Text>
          </View>
        </View>

        {/* ── Health summary — DS safety-critical pattern ──────────────── */}
        <View style={styles.sectionOuter}>
          <Text style={styles.sectionLabel}>Health Summary</Text>
          <View style={[styles.menuCard, styles.healthCard]}>

            {/* Blood type + DOB row */}
            <View style={styles.healthRow}>
              <View style={styles.healthItem}>
                <Text style={styles.healthItemLabel}>BLOOD TYPE</Text>
                <View style={styles.healthItemValueRow}>
                  <Icon name="water-drop" size={14} color={C.coral} />
                  <Text style={[styles.healthItemValue, { color: C.coral }]}>
                    {health?.bloodType && health.bloodType !== "unknown"
                      ? health.bloodType
                      : "—"}
                  </Text>
                </View>
              </View>
              {demographics?.dateOfBirth && (
                <View style={styles.healthItem}>
                  <Text style={styles.healthItemLabel}>DATE OF BIRTH</Text>
                  <View style={styles.healthItemValueRow}>
                    <Icon name="cake" size={14} color={C.inkSoft} />
                    <Text style={styles.healthItemValue}>
                      {new Date(demographics.dateOfBirth).toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.healthDivider} />

            {/* Allergies section */}
            <View style={styles.allergiesSection}>
              <View style={styles.allergiesHeader}>
                <Icon name="warning" size={14} color={C.coral} />
                <Text style={styles.allergiesTitle}>Allergies</Text>
                {health && health.allergies.length > 0 && (
                  <View style={styles.allergyCountBadge}>
                    <Text style={styles.allergyCountText}>
                      {health.allergies.length}
                    </Text>
                  </View>
                )}
              </View>

              {!health ? (
                <ActivityIndicator
                  size="small"
                  color={C.coral}
                  style={{ marginTop: 8 }}
                />
              ) : health.allergies.length === 0 ? (
                <Text style={styles.noAllergyText}>
                  No allergies on record
                </Text>
              ) : (
                <View style={styles.allergyList}>
                  {health.allergies.map((a) => (
                    <View key={a.id} style={styles.allergyRow}>
                      <View style={styles.allergyLeft}>
                        <Text style={styles.allergenName}>{a.allergen}</Text>
                        <Text style={styles.allergyType}>
                          {a.allergyType.replace("_", " ")}
                          {a.reaction ? ` · ${a.reaction}` : ""}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.severityPill,
                          {
                            backgroundColor:
                              a.severity === "life_threatening" || a.severity === "severe"
                                ? C.coralLight
                                : C.amberLight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.severityText,
                            {
                              color:
                                a.severity === "life_threatening" || a.severity === "severe"
                                  ? C.coral
                                  : C.amber,
                            },
                          ]}
                        >
                          {a.severity.replace("_", " ")}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Demographics row — gender, phone */}
            {demographics && (demographics.gender || demographics.phoneNumber) && (
              <>
                <View style={styles.healthDivider} />
                <View style={styles.healthRow}>
                  {demographics.gender && (
                    <View style={styles.healthItem}>
                      <Text style={styles.healthItemLabel}>GENDER</Text>
                      <View style={styles.healthItemValueRow}>
                        <Icon name="person" size={14} color={C.inkSoft} />
                        <Text style={styles.healthItemValue}>
                          {demographics.gender.charAt(0).toUpperCase() +
                            demographics.gender.slice(1)}
                        </Text>
                      </View>
                    </View>
                  )}
                  {demographics.phoneNumber && (
                    <View style={styles.healthItem}>
                      <Text style={styles.healthItemLabel}>PHONE</Text>
                      <View style={styles.healthItemValueRow}>
                        <Icon name="phone" size={14} color={C.inkSoft} />
                        <Text style={styles.healthItemValue}>
                          {demographics.phoneNumber}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Hospital QR ID ───────────────────────────────────────────── */}
        <View style={styles.sectionOuter}>
          <Text style={styles.sectionLabel}>My Hospital ID</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setQrExpanded((e) => !e)}
              activeOpacity={0.6}
            >
              <View
                style={[
                  styles.menuIconWrap,
                  { backgroundColor: C.primaryGhost },
                ]}
              >
                <Icon name="qr-code" size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>
                  {qrExpanded ? "Hide QR code" : "Show QR code"}
                </Text>
                <Text style={styles.menuSublabel}>
                  Scan at reception for instant check-in
                </Text>
              </View>
              <Icon
                name={qrExpanded ? "expand-less" : "expand-more"}
                size={20}
                color={C.inkSubtle}
              />
            </TouchableOpacity>

            {qrExpanded && (
              <>
                <View style={qrStyles.body}>
                  <Text style={qrStyles.name}>
                    {user?.firstName} {user?.lastName}
                  </Text>
                  <Text style={qrStyles.brand}>MedLink Zambia</Text>

                  <View style={qrStyles.qrWrap}>
                    {user?.id ? (
                      <QRCode
                        value={qrPayload}
                        size={200}
                        color={C.ink}
                        backgroundColor="#fff"
                      />
                    ) : (
                      <Text style={qrStyles.error}>Could not load your ID</Text>
                    )}
                  </View>

                  <View style={qrStyles.hintRow}>
                    <Icon name="qr-code-scanner" size={14} color={C.primary} />
                    <Text style={qrStyles.hintText}>
                      The receptionist scans this code to pull up your record —
                      no card or national ID needed.
                    </Text>
                  </View>
                </View>

                <View style={qrStyles.privacy}>
                  <Icon name="lock" size={13} color={C.inkMuted} />
                  <Text style={qrStyles.privacyText}>
                    This code contains only your patient ID — no medical
                    information. Staff still need permission to view your
                    records.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Referrals ─────────────────────────────────────────────────── */}
        <View style={styles.sectionOuter}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>My Referrals</Text>
            {activeCount > 0 && (
              <View style={styles.activeBadge}>
                <View style={styles.activeBadgeDot} />
                <Text style={styles.activeBadgeText}>{activeCount} active</Text>
              </View>
            )}
          </View>

          <View style={styles.menuCard}>
            {refLoading ? (
              <View style={styles.refEmpty}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            ) : referrals.length === 0 ? (
              <View style={styles.refEmpty}>
                <Icon
                  name="local-hospital"
                  size={28}
                  color={C.inkSubtle}
                  style={{ marginBottom: 8 }}
                />
                <Text style={styles.refEmptyText}>No referrals yet</Text>
                <Text style={styles.refEmptySubtext}>
                  When your doctor refers you to another hospital, the details
                  will appear here.
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
                      color={C.primary}
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {/* ── My Children (guardian view) ──────────────────────────────── */}
        {dependents.length > 0 && (
          <View style={styles.sectionOuter}>
            <Text style={styles.sectionLabel}>My Children</Text>
            <View style={styles.menuCard}>
              {dependents.map((dep, idx) => (
                <TouchableOpacity
                  key={dep.id}
                  style={[styles.menuItem, idx < dependents.length - 1 && styles.menuDivider]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setActivePatient(dep.patientId, `${dep.firstName} ${dep.lastName}`);
                    Toast.show({ type: "info", text1: `Viewing ${dep.firstName}'s records`, text2: "Go to Records tab" });
                  }}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: "#FEF3C7" }]}>
                    <Icon name="child-care" size={18} color="#B45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuLabel}>{dep.firstName} {dep.lastName}</Text>
                    <Text style={styles.menuSublabel} numberOfLines={1}>
                      {dep.relationship.replace("_", " ")} · Tap to view records
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={C.inkSubtle} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Menu sections ─────────────────────────────────────────────── */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={styles.sectionOuter}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
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
                  activeOpacity={0.6}
                >
                  <View
                    style={[styles.menuIconWrap, { backgroundColor: item.bg }]}
                  >
                    <Icon
                      name={item.icon as any}
                      size={18}
                      color={item.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    {item.sublabel && (
                      <Text style={styles.menuSublabel}>{item.sublabel}</Text>
                    )}
                  </View>
                  <Icon name="chevron-right" size={20} color={C.inkSubtle} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* ── Sign out ──────────────────────────────────────────────────── */}
        <View style={styles.sectionOuter}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
            disabled={loggingOut}
          >
            <View style={styles.signOutIcon}>
              {loggingOut ? (
                <ActivityIndicator size="small" color={C.coral} />
              ) : (
                <Icon name="logout" size={18} color={C.coral} />
              )}
            </View>
            <Text style={styles.signOutText}>Sign Out</Text>
            <Icon name="chevron-right" size={20} color={C.inkSubtle} />
          </TouchableOpacity>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>MedLink · Zambia</Text>
          <Text style={styles.footerVersion}>
            v1.0.0 · CBU Final Year Project
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
                <Icon name="close" size={18} color={C.inkSoft} />
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
              style={[styles.updateBtn, pwLoading && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={pwLoading}
              activeOpacity={0.9}
            >
              {pwLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.updateBtnText}>Update Password</Text>
                  <Icon name="arrow-forward" size={16} color="#fff" />
                </>
              )}
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

  // Profile card
  profileCard: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  avatarOuter: { position: "relative", marginBottom: 16 },
  avatarInner: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: C.bg,
  },
  fullName: {
    fontSize: 24,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primaryGhost,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  roleText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.primaryDark,
    letterSpacing: 1,
  },

  // Section
  sectionOuter: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: C.inkSoft,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.primaryGhost,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  activeBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.primary,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: C.primaryDark,
    letterSpacing: 0.2,
  },
  menuCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.cardBorder,
  },

  // ── Health summary card ──
  healthCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderColor: "rgba(255,87,87,0.22)", // DS: coral tint border for safety-critical
  },
  healthRow: {
    flexDirection: "row",
    gap: 0,
  },
  healthItem: {
    flex: 1,
    padding: 16,
  },
  healthItemLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  healthItemValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  healthItemValue: {
    fontSize: 15,
    fontWeight: "600",
    color: C.ink,
    letterSpacing: -0.1,
  },
  healthDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginHorizontal: 16,
  },

  // Allergies
  allergiesSection: {
    padding: 16,
  },
  allergiesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  allergiesTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: C.coral,
    letterSpacing: -0.1,
  },
  allergyCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.coralLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  allergyCountText: {
    fontSize: 11,
    fontWeight: "800",
    color: C.coral,
  },
  noAllergyText: {
    fontSize: 13,
    color: C.inkMuted,
    fontWeight: "500",
    fontStyle: "italic",
  },
  allergyList: {
    gap: 10,
  },
  allergyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  allergyLeft: {
    flex: 1,
  },
  allergenName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.2,
  },
  allergyType: {
    fontSize: 12,
    color: C.inkMuted,
    fontWeight: "500",
    marginTop: 2,
    textTransform: "capitalize",
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  severityText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },

  // Referrals empty state
  refEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  refEmptyText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  refEmptySubtext: {
    fontSize: 12,
    color: C.inkMuted,
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "500",
  },
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.divider,
    backgroundColor: C.primaryGhost,
  },
  showMoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.primaryDark,
  },

  // Menu item
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.2,
  },
  menuSublabel: {
    fontSize: 12,
    color: C.inkMuted,
    marginTop: 1,
    fontWeight: "500",
  },

  // Sign out
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  signOutIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: C.coralLight,
    justifyContent: "center",
    alignItems: "center",
  },
  signOutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: C.coral,
    letterSpacing: -0.2,
  },

  // Footer
  footer: { alignItems: "center", paddingVertical: 32, gap: 4 },
  footerBrand: {
    fontSize: 13,
    fontWeight: "700",
    color: C.inkSoft,
    letterSpacing: -0.2,
  },
  footerVersion: { fontSize: 11, color: C.inkMuted, fontWeight: "500" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,14,26,0.5)",
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
    fontSize: 20,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.5,
  },
  modalSub: {
    fontSize: 13,
    color: C.inkMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.bgAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.inkSoft,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  input: {
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.bg,
    fontWeight: "500",
  },
  updateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  updateBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
});

// ── QR section styles ─────────────────────────────────────────────────────────
const qrStyles = StyleSheet.create({
  body: {
    alignItems: "center",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  brand: {
    fontSize: 10,
    fontWeight: "700",
    color: C.primary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  qrWrap: {
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  error: {
    fontSize: 13,
    color: "#dc2626",
    fontWeight: "600",
    padding: 40,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 4,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: C.inkSoft,
    lineHeight: 17,
    fontWeight: "500",
  },
  privacy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.divider,
    backgroundColor: C.bgAlt,
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    color: C.inkMuted,
    lineHeight: 16,
    fontWeight: "500",
  },
});
