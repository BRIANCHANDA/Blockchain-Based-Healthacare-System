import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getMyVisits } from "../../api/records";
import { getMyDependents } from "../../api/patient";
import { useAuthStore } from "../../store/authStore";
import { Visit, Dependent, RecordsStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { usePatientResource } from "../../hooks/usePatientResource";

type Props = NativeStackScreenProps<RecordsStackParamList, "RecordsList">;

const C = {
  brand:       "#059669",
  brandDeep:   "#047857",
  brandTint:   "#ECFDF5",
  brandFill:   "#D1FAE5",
  coral:       "#FF5757",
  coralTint:   "#FFE5E5",
  coralInk:    "#E13D3D",
  amber:       "#F59E0B",
  amberTint:   "#FEF3C7",
  amberInk:    "#B45309",
  violet:      "#8B5CF6",
  violetTint:  "#EDE9FE",
  ink:         "#0A0E1A",
  inkSoft:     "#4B5563",
  inkMuted:    "#9CA3AF",
  inkSubtle:   "#D1D5DB",
  bg:          "#FAFAFB",
  bgAlt:       "#F4F4F6",
  card:        "#FFFFFF",
  cardBorder:  "#E5E7EB",
  divider:     "#F0F1F3",
};

const PRIORITY: Record<string, { color: string; bg: string; label: string }> = {
  routine:   { color: C.brand,   bg: C.brandTint,  label: "Routine" },
  urgent:    { color: C.amber,   bg: C.amberTint,  label: "Urgent" },
  emergency: { color: C.coral,   bg: C.coralTint,  label: "Emergency" },
  critical:  { color: C.violet,  bg: C.violetTint, label: "Critical" },
};

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  "in-progress": { color: C.amber,    bg: C.amberTint,  label: "Active" },
  completed:     { color: C.brand,    bg: C.brandTint,  label: "Completed" },
  cancelled:     { color: C.inkMuted, bg: C.bgAlt,      label: "Cancelled" },
};

const TYPE_LABEL: Record<string, string> = {
  outpatient:   "Outpatient",
  inpatient:    "Inpatient",
  emergency:    "Emergency",
  consultation: "Consultation",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function QuickAction({
  icon, title, sub, bg, fg, onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string; sub: string; bg: string; fg: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <MaterialIcons name={icon} size={21} color={fg} />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function VisitCard({ item, onPress }: { item: Visit; onPress: () => void }) {
  const priority = PRIORITY[item.priority] ?? PRIORITY.routine;
  const status   = STATUS[item.status]    ?? STATUS.completed;
  const typeLabel = TYPE_LABEL[item.visitType] ?? item.visitType;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.visitNum}>{item.visitNumber}</Text>
        <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.complaint} numberOfLines={2}>
        {item.chiefComplaint || "No complaint recorded"}
      </Text>
      <View style={styles.divider} />
      <View style={styles.cardFooter}>
        <View style={styles.typeChip}><Text style={styles.typeText}>{typeLabel}</Text></View>
        <View style={[styles.priorityPill, { backgroundColor: priority.bg }]}>
          <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
          <Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={styles.metaItem}>
          <MaterialIcons name="event" size={13} color={C.inkMuted} />
          <Text style={styles.metaText}>{formatDate(item.admissionDate)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function RecordsListScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const { dependents, activePatientId, activeDependentName, setDependents, setActivePatient, clearActivePatient } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [bannerDismissed, setBannerDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("health_banner_viewed")
      .then((v) => setBannerDismissed(v === "true"))
      .catch(() => setBannerDismissed(false));
  }, []);

  const dismissBanner = async () => {
    await AsyncStorage.setItem("health_banner_viewed", "true");
    setBannerDismissed(true);
  };

  // Load dependents once on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyDependents(user.id)
      .then((res) => {
        const deps: Dependent[] = (res.data?.data ?? []).map((d: any) => ({
          id: d.linkId ?? d.id,
          patientId: d.patientId,
          firstName: d.firstName ?? d.guardianName?.split(" ")[0] ?? "Child",
          lastName: d.lastName ?? d.guardianName?.split(" ").slice(1).join(" ") ?? "",
          relationship: d.relationship,
          endsAt: d.endsAt,
          dateOfBirth: d.dateOfBirth,
        }));
        if (!cancelled) setDependents(deps);
      })
      .catch(() => { if (!cancelled) setDependents([]); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Resolve which patient ID to fetch records for
  const effectivePatientId = activePatientId ?? user?.id ?? "";

  const fetchVisits = useCallback(async () => {
    if (!effectivePatientId) return [];
    const res = await getMyVisits(effectivePatientId);
    return res.data.visits as Visit[];
  }, [effectivePatientId]);
  const { data: visits, loading, refreshing, error: failed, refresh: onRefresh } = usePatientResource(fetchVisits, [] as Visit[]);
  const error = failed ? "Could not load records. Pull down to retry." : "";

  const handleSelectSelf = async () => {
    await clearActivePatient();
  };

  const handleSelectDependent = async (dep: Dependent) => {
    await setActivePatient(dep.patientId, `${dep.firstName} ${dep.lastName}`);
  };

  if (loading) return <LoadingSpinner message="Loading records…" />;

  const firstName = activePatientId
    ? activeDependentName?.split(" ")[0] ?? "Dependent"
    : (user?.firstName ?? "");

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.brand]} tintColor={C.brand} />
        }
        ListHeaderComponent={
          <>
            {/* ── Header bar ── */}
            <View style={styles.headerInner}>
              <View>
                <Text style={styles.greeting}>Hi, {firstName}</Text>
                <Text style={styles.subgreeting}>
                  {activePatientId ? "Viewing as guardian" : "Your medical records"}
                </Text>
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open your profile" style={styles.avatarBtn} activeOpacity={0.7} onPress={() => navigation.navigate("Profile")}>
                <Text style={styles.avatarText}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
              </TouchableOpacity>
            </View>

            {/* ── Family switcher (only if guardian has dependents) ── */}
            {dependents.length > 0 && (
              <View style={styles.switcherOuter}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcherRow}>
                  {/* Self chip */}
                  <TouchableOpacity
                    style={[styles.switcherChip, !activePatientId && styles.switcherChipActive]}
                    onPress={handleSelectSelf}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="person" size={13} color={!activePatientId ? "#fff" : C.inkSoft} />
                    <Text style={[styles.switcherChipText, !activePatientId && styles.switcherChipTextActive]}>
                      Self
                    </Text>
                  </TouchableOpacity>
                  {/* Dependent chips */}
                  {dependents.map((dep) => {
                    const isActive = activePatientId === dep.patientId;
                    return (
                      <TouchableOpacity
                        key={dep.id}
                        style={[styles.switcherChip, isActive && styles.switcherChipActive]}
                        onPress={() => handleSelectDependent(dep)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="child-care" size={13} color={isActive ? "#fff" : C.amber} />
                        <Text style={[styles.switcherChipText, isActive && styles.switcherChipTextActive]}>
                          {dep.firstName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── Viewing-as banner ── */}
            {activePatientId && activeDependentName && (
              <View style={styles.viewingBanner}>
                <MaterialIcons name="child-care" size={16} color={C.amberInk} />
                <Text style={styles.viewingText}>
                  Viewing records for <Text style={styles.viewingName}>{activeDependentName}</Text>
                </Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Switch to your own records" onPress={clearActivePatient} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="close" size={16} color={C.amberInk} />
                </TouchableOpacity>
              </View>
            )}

            {/* ── Allergy safety banner ── */}
            {bannerDismissed === false && !activePatientId && (
              <View style={styles.allergyBanner}>
                <MaterialIcons name="warning" size={18} color={C.coralInk} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.allergyText}>Blood type & allergies in your health summary</Text>
                </View>
                <TouchableOpacity onPress={() => { dismissBanner(); navigation.navigate("Profile"); }}>
                  <Text style={styles.allergyLink}>View</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Quick actions (only for self) ── */}
            {!activePatientId && (
              <View style={styles.quickRow}>
                <QuickAction icon="qr-code" title="My Hospital ID" sub="Show at reception" bg={C.brandTint} fg={C.brandDeep} onPress={() => navigation.navigate("PatientQR")} />
                <QuickAction icon="trending-up" title="Health Trends" sub="Vitals over time" bg={C.violetTint} fg="#7C3AED" onPress={() => navigation.navigate("VitalsTrends")} />
              </View>
            )}

            {/* ── Sensitive records entry (self only) ── */}
            {!activePatientId && (
              <TouchableOpacity style={styles.sensitiveEntry} activeOpacity={0.8} onPress={() => navigation.navigate("SensitiveRecords")}>
                <View style={styles.sensitiveLeft}>
                  <View style={styles.sensitiveIconWrap}>
                    <MaterialIcons name="fingerprint" size={22} color={C.amber} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sensitiveTitle}>Sensitive Medical Records</Text>
                    <Text style={styles.sensitiveSub}>HIV status, mental health, reproductive & genetic — biometric protected</Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={C.inkMuted} />
              </TouchableOpacity>
            )}

            {/* ── Section label ── */}
            <View style={styles.sectionRow}>
              <MaterialIcons name="folder" size={16} color={C.inkMuted} />
              <Text style={styles.sectionTitle}>Medical visits</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{visits.length}</Text>
              </View>
            </View>

            {/* ── Error banner ── */}
            {error ? (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={15} color={C.coral} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={error ? null :
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="folder-open" size={32} color={C.brand} />
            </View>
            <Text style={styles.emptyTitle}>No visits yet</Text>
            <Text style={styles.emptyBody}>
              {activePatientId
                ? "No medical records found for this dependent."
                : "Your medical records will appear here once your healthcare provider creates them."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <VisitCard item={item} onPress={() => navigation.navigate("RecordDetail", { visitId: item.id, visitNumber: item.visitNumber })} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },

  // Header
  headerInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 4 },
  greeting: { fontSize: 28, fontWeight: "800", color: C.ink, letterSpacing: -0.8 },
  subgreeting: { fontSize: 14, color: C.inkMuted, fontWeight: "500", marginTop: 2 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: C.brand,
    justifyContent: "center", alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: C.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },

  // Family switcher
  switcherOuter: { marginBottom: 12 },
  switcherRow: { flexDirection: "row", gap: 8, paddingRight: 4 },
  switcherChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
  },
  switcherChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  switcherChipText: { fontSize: 13, fontWeight: "700", color: C.inkSoft },
  switcherChipTextActive: { color: "#fff" },

  // Viewing-as banner
  viewingBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 14, backgroundColor: C.amberTint,
    borderWidth: 1, borderColor: "#FDE68A", marginBottom: 14,
  },
  viewingText: { flex: 1, fontSize: 13, fontWeight: "600", color: C.amberInk },
  viewingName: { fontWeight: "800" },

  // Allergy banner
  allergyBanner: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    borderRadius: 14, backgroundColor: C.coralTint, borderWidth: 1,
    borderColor: "rgba(225,61,61,0.2)", marginBottom: 14,
  },
  allergyText: { fontSize: 13, fontWeight: "600", color: C.coralInk, flex: 1 },
  allergyLink: { fontSize: 12, fontWeight: "700", color: C.coralInk, textDecorationLine: "underline" },

  // Quick actions
  quickRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  quickCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: C.cardBorder, gap: 10,
    ...Platform.select({
      ios: { shadowColor: "#0A0E1A", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  quickIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  quickTitle: { fontSize: 15, fontWeight: "700", color: C.ink, letterSpacing: -0.2 },
  quickSub: { fontSize: 13, fontWeight: "500", color: C.inkMuted, marginTop: -4 },

  // Sensitive records
  sensitiveEntry: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FFFBEB",
    borderWidth: 1.5, borderColor: "#FDE68A", borderRadius: 16, padding: 14, marginBottom: 20, gap: 10,
  },
  sensitiveLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  sensitiveIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" },
  sensitiveTitle: { fontSize: 14, fontWeight: "700", color: C.ink, marginBottom: 2 },
  sensitiveSub: { fontSize: 11, color: C.inkSoft, lineHeight: 15, fontWeight: "500" },

  // Section header
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: C.inkSoft, flex: 1, letterSpacing: -0.1 },
  countBadge: { backgroundColor: C.brand, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, minWidth: 24, alignItems: "center" },
  countText: { fontSize: 11, fontWeight: "800", color: "#fff" },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.coralTint, padding: 12, borderRadius: 12, marginBottom: 12 },
  errorText: { color: C.coral, fontSize: 12.5, flex: 1, fontWeight: "600" },

  // Visit card
  card: {
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.cardBorder,
    ...Platform.select({
      ios: { shadowColor: "#0A0E1A", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  visitNum: { fontSize: 11, fontWeight: "700", color: C.inkMuted, letterSpacing: 0.3 },
  statusChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  complaint: { fontSize: 16, fontWeight: "700", color: C.ink, lineHeight: 22, letterSpacing: -0.3, marginBottom: 12 },
  divider: { height: 1, backgroundColor: C.divider, marginBottom: 10 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  typeChip: { height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: C.bgAlt, justifyContent: "center" },
  typeText: { fontSize: 11, fontWeight: "600", color: C.inkSoft },
  priorityPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: C.inkMuted, fontWeight: "500" },

  // Empty
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: C.brandTint, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: C.ink, marginBottom: 6, letterSpacing: -0.3 },
  emptyBody: { fontSize: 14, color: C.inkSoft, textAlign: "center", lineHeight: 21, fontWeight: "500" },
});
