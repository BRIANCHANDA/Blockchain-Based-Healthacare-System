/**
 * Access requests — the patient's inbox of pending consent decisions.
 *
 * This screen is where objective 3 becomes visible to the patient: a clinician
 * has asked to read their records, and nobody sees anything until the patient
 * taps Approve here. Rejecting is a first-class outcome, not a dismissal.
 *
 * HOW LONG ACCESS LASTS IS THE PATIENT'S DECISION. The sheet below offers
 * presets and a free-text entry, defaulting to 24 hours — the duration that
 * applies if the patient simply confirms without choosing. The backend accepts
 * 1 to 720 hours (30 days) and the chaincode rejects anything non-positive, so
 * the bounds are enforced on the ledger and not merely in this UI.
 *
 * An approval does not merely update a database row. The backend forwards it to
 * the AccessControl chaincode, which writes a permission bounded by the duration
 * the patient chose; every later read is checked against that ledger entry, so
 * access ends on its own when the window passes. This is why an approval can
 * take a moment and why the row is disabled (via `actioning`) while it commits —
 * a double tap would submit the decision twice.
 *
 * ROLE_META exists so a request names a person the patient can recognise — the
 * role and institution asking — rather than an opaque practitioner id.
 */

import React, { useState, useCallback } from "react";
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
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
import { usePatientResource } from "../../hooks/usePatientResource";

type Props = NativeStackScreenProps<AccessStackParamList, "AccessRequests">;

// ── Design tokens ────────────────────────────────────────────────────────────
/**
 * Preset windows offered to the patient.
 *
 * Chosen to match how consent is actually given: one appointment, one day, a
 * course of treatment, a hospital stay. DEFAULT_HOURS is what applies if the
 * patient approves without touching anything.
 */
const DEFAULT_HOURS = 24;
const MAX_HOURS = 720; // 30 days — the backend's own ceiling
const DURATION_PRESETS = [
  { hours: 1,   label: "1 hour",  note: "This visit" },
  { hours: 8,   label: "8 hours", note: "Today" },
  { hours: 24,  label: "24 hours", note: "Default" },
  { hours: 72,  label: "3 days",  note: "Short course" },
  { hours: 168, label: "7 days",  note: "A week" },
  { hours: 720, label: "30 days", note: "Maximum" },
];

/** Render a duration the way a person would say it. */
function describeHours(h: number): string {
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

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
  const [actioning, setActioning] = useState<string | null>(null);

  // Duration sheet: which request is being decided, and for how long.
  const [pendingReq, setPendingReq] = useState<any | null>(null);
  const [selectedHours, setSelectedHours] = useState<number>(DEFAULT_HOURS);
  const [customHours, setCustomHours] = useState<string>("");

  /**
   * A typed value wins over the selected preset, but only once it parses.
   * While the field is empty or mid-edit the preset still stands, so the sheet
   * always has a valid duration to commit.
   */
  const parsedCustom = Number(customHours);
  const effectiveHours = customHours.trim() !== "" && Number.isFinite(parsedCustom)
    ? parsedCustom
    : selectedHours;

  const fetchRequests = useCallback(async () => {
    const res = await getAccessRequests();
    return (res.data?.requests ?? []) as any[];
  }, []);
  const { data: requests, loading, refreshing, error, refresh: onRefresh, update: setRequests } = usePatientResource(fetchRequests, [] as any[]);

  /**
   * Approving opens the duration sheet rather than granting immediately.
   *
   * How long a clinician may read the record is the substance of the consent
   * decision, not a detail — so it is asked for explicitly. The sheet opens on
   * the 24-hour default, so a patient who just wants to say yes taps twice.
   */
  const handleApprove = (req: any) => {
    setPendingReq(req);
    setSelectedHours(DEFAULT_HOURS);
    setCustomHours("");
  };

  /** Commit the decision with whatever duration the patient settled on. */
  const confirmApprove = async () => {
    if (!pendingReq) return;

    const hours = effectiveHours;
    // Guard here as well as on the server: a value the ledger would reject
    // should never leave the phone, or the patient sees an opaque failure.
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) {
      Toast.show({
        type: "error",
        text1: "Invalid duration",
        text2: `Choose between 1 and ${MAX_HOURS} hours`,
      });
      return;
    }

    const req = pendingReq;
    setPendingReq(null);
    setActioning(req.id);
    try {
      await approveAccessRequest(req.id, hours);
      Toast.show({
        type: "success",
        text1: "Access granted",
        text2: `${describeHours(hours)} of access approved`,
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

      {error && (
        <View style={{ padding: 16, paddingTop: insets.top + 16 }}>
          <Text accessibilityLiveRegion="polite">Could not refresh access requests. {requests.length ? "Showing previously loaded requests." : "Please try again."}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={onRefresh} disabled={refreshing} style={{ minHeight: 48, justifyContent: "center" }}>
            <Text>{refreshing ? "Retrying…" : "Retry"}</Text>
          </TouchableOpacity>
        </View>
      )}

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
        ListEmptyComponent={error ? null :
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
              {/* Guardian / dependent banner */}
              {item.isForDependent && item.dependentName && (
                <View style={styles.dependentBanner}>
                  <MaterialIcons name="child-care" size={15} color="#7C3AED" />
                  <Text style={styles.dependentBannerText}>
                    Access request for{" "}
                    <Text style={{ fontWeight: "800" }}>{item.dependentName}</Text>
                    {item.dependentRelationship ? ` (your ${item.dependentRelationship})` : ""}
                  </Text>
                </View>
              )}

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

      {/* ── Duration sheet ──────────────────────────────────────────────────
          How long the clinician may read the record. Opens on the 24-hour
          default so approving without a choice still works in two taps. */}
      <Modal
        visible={pendingReq !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPendingReq(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetBackdrop}
        >
          <TouchableOpacity
            style={styles.sheetDismiss}
            activeOpacity={1}
            onPress={() => setPendingReq(null)}
            accessibilityLabel="Cancel"
          />

          <View
            style={[
              styles.sheet,
              // Clear the gesture bar or navigation buttons. The minimum keeps
              // a sensible gap on devices that report no inset at all.
              { paddingBottom: Math.max(insets.bottom, 16) + 12 },
            ]}
          >
            <View style={styles.sheetGrip} />

            <Text style={styles.sheetTitle}>Grant access</Text>
            <Text style={styles.sheetSub}>
              {pendingReq?.requesterName ?? "This clinician"} will be able to read
              your records for the time you choose. Access ends on its own — you
              do not have to remember to revoke it.
            </Text>

            <Text style={styles.sheetLabel}>For how long?</Text>
            <View style={styles.presetGrid}>
              {DURATION_PRESETS.map((p) => {
                const active = customHours.trim() === "" && selectedHours === p.hours;
                return (
                  <TouchableOpacity
                    key={p.hours}
                    style={[styles.preset, active && styles.presetActive]}
                    onPress={() => { setSelectedHours(p.hours); setCustomHours(""); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.presetLabel, active && styles.presetLabelActive]}>
                      {p.label}
                    </Text>
                    <Text style={[styles.presetNote, active && styles.presetNoteActive]}>
                      {p.note}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>Or enter hours</Text>
            <TextInput
              style={styles.customInput}
              value={customHours}
              onChangeText={(t) => setCustomHours(t.replace(/[^0-9]/g, ""))}
              placeholder={`${DEFAULT_HOURS}`}
              placeholderTextColor={C.inkMuted}
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel="Custom duration in hours"
            />
            <Text style={styles.hint}>
              Between 1 and {MAX_HOURS} hours (30 days).
            </Text>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.sheetCancel}
                onPress={() => setPendingReq(null)}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetConfirm} onPress={confirmApprove}>
                <MaterialIcons name="check" size={18} color="#FFFFFF" />
                <Text style={styles.sheetConfirmText}>
                  Allow {describeHours(effectiveHours)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Duration sheet ─────────────────────────────────────────────────────────
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10,14,26,0.45)" },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    // Bottom padding is applied inline from the safe-area inset, not here — a
    // fixed value sat underneath Android's navigation bar, so the Allow button
    // collided with the system back/home controls.
  },
  sheetGrip: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: C.inkSubtle, alignSelf: "center", marginBottom: 16,
  },
  sheetTitle: { fontSize: 19, fontWeight: "800", color: C.ink, marginBottom: 6 },
  sheetSub: { fontSize: 13, lineHeight: 19, color: C.inkSoft, marginBottom: 18 },
  sheetLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 0.5,
    color: C.inkMuted, textTransform: "uppercase", marginBottom: 9,
  },

  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  preset: {
    minWidth: "31%", flexGrow: 1,
    paddingVertical: 11, paddingHorizontal: 10,
    borderRadius: 12, borderWidth: 1.5,
    borderColor: C.cardBorder, backgroundColor: C.bgAlt,
  },
  presetActive: { borderColor: C.primary, backgroundColor: C.primaryGhost },
  presetLabel: { fontSize: 14, fontWeight: "700", color: C.ink },
  presetLabelActive: { color: C.primaryDark },
  presetNote: { fontSize: 10, color: C.inkMuted, marginTop: 1 },
  presetNoteActive: { color: C.primary },

  customInput: {
    borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontWeight: "600", color: C.ink, backgroundColor: C.bgAlt,
  },
  hint: { fontSize: 11, color: C.inkMuted, marginTop: 6, marginBottom: 18 },

  sheetActions: { flexDirection: "row", gap: 10 },
  sheetCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 13,
    borderWidth: 1.5, borderColor: C.cardBorder, alignItems: "center",
  },
  sheetCancelText: { fontSize: 15, fontWeight: "700", color: C.inkSoft },
  sheetConfirm: {
    flex: 2, paddingVertical: 14, borderRadius: 13,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  sheetConfirmText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },

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
  dependentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.violetLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  dependentBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5B21B6",
    flex: 1,
    lineHeight: 17,
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
