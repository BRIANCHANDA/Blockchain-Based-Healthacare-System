import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getVisitDetail } from "../../api/records";
import { useAuthStore } from "../../store/authStore";
import { RecordsStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

type Props = NativeStackScreenProps<RecordsStackParamList, "RecordDetail">;

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  ink: "#1A1D2E",
  inkSoft: "#5A5F7A",
  inkMuted: "#9498B3",
  teal: "#0D9488",
  tealDark: "#0F766E",
  tealDeep: "#115E59",
  tealGhost: "#F0FDFA",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  coral: "#EF4444",
  coralLight: "#FEE2E2",
  violet: "#7C3AED",
  blue: "#3B82F6",
  blueGhost: "#EFF6FF",
  rose: "#F43F5E",
  roseGhost: "#FFF1F2",
  bg: "#F8F9FC",
  card: "#FFFFFF",
  cardBorder: "#ECEEF4",
  divider: "#F1F2F6",
};

// ── Types ────────────────────────────────────────────────────────────────────
interface VitalSigns {
  id: string;
  temperature?: number;
  pulseRate?: number;
  oxygenSaturation?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  weight?: number;
  height?: number;
  nurseNotes?: string;
}
interface Consultation {
  id: string;
  assessment?: string;
  plan?: string;
  clinicalFindings?: string;
  followUpInstructions?: string;
  nextAppointmentDate?: string;
}
interface Diagnosis {
  id: string;
  icdCode?: string;
  diagnosisName?: string;
  diagnosisType?: string;
  severity?: string;
}
interface LabOrder {
  id: string;
  testName?: string;
  testCode?: string;
  specimenType?: string;
  status?: string;
}
interface ImagingOrder {
  id: string;
  modality?: string;
  bodyPart?: string;
  indication?: string;
  status?: string;
}
interface Prescription {
  id: string;
  prescriptionNumber?: string;
  status?: string;
}
interface VisitDetail {
  visit: {
    visitNumber: string;
    visitType?: string;
    chiefComplaint?: string;
    admissionDate: string;
    status?: string;
    dischargeDiagnosis?: string;
    dischargeSummary?: string;
    dischargeInstructions?: string;
    followUpDate?: string;
  };
  consultations: Consultation[];
  diagnoses: Diagnosis[];
  vitalSigns: VitalSigns[];
  labOrders: LabOrder[];
  imagingOrders: ImagingOrder[];
  prescriptions: Prescription[];
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  iconColor,
  iconBg,
  count,
  children,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  iconColor: string;
  iconBg: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={14} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && (
          <View style={[styles.countBadge, { backgroundColor: iconBg }]}>
            <Text style={[styles.countText, { color: iconColor }]}>
              {count}
            </Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

function VitalTile({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.vitalTile}>
      <View style={[styles.vitalIconWrap, { backgroundColor: `${color}15` }]}>
        <MaterialIcons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.vitalValue}>{value}</Text>
      <Text style={styles.vitalLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    resulted: { color: C.teal, bg: C.tealGhost },
    reported: { color: C.teal, bg: C.tealGhost },
    dispensed: { color: C.teal, bg: C.tealGhost },
    pending: { color: C.amber, bg: C.amberLight },
    ordered: { color: C.blue, bg: C.blueGhost },
  };
  const cfg = map[status ?? ""] ?? { color: C.inkMuted, bg: "#F3F4F6" };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>
        {status?.toUpperCase()}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (value == null || value === "") return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{String(value)}</Text>
    </View>
  );
}

function ListItem({
  title,
  subtitle,
  status,
}: {
  title: string;
  subtitle?: string;
  status?: string;
}) {
  return (
    <View style={styles.listItem}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={styles.listItemTitle}>{title}</Text>
        {subtitle && <Text style={styles.listItemSub}>{subtitle}</Text>}
      </View>
      <StatusBadge status={status} />
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function RecordDetailScreen({ route }: Props) {
  const { visitId } = route.params;
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    getVisitDetail(user.id, visitId)
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user, visitId]);

  if (loading) return <LoadingSpinner message="Loading visit details…" />;

  if (error || !data) {
    return (
      <View style={styles.errScreen}>
        <View style={styles.errIconWrap}>
          <MaterialIcons name="error-outline" size={28} color={C.coral} />
        </View>
        <Text style={styles.errTitle}>Could not load record</Text>
        <Text style={styles.errBody}>Please go back and try again.</Text>
      </View>
    );
  }

  const {
    visit,
    consultations = [],
    diagnoses = [],
    vitalSigns = [],
    labOrders = [],
    imagingOrders = [],
    prescriptions = [],
  } = data;

  const admDate = new Date(visit.admissionDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statusColor =
    visit.status === "in-progress"
      ? "#6FCF97"
      : visit.status === "completed"
        ? "#6FCF97"
        : "#F59E0B";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <LinearGradient
        colors={[C.tealDeep, C.tealDark, C.teal]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        {/* Decorative */}
        <View
          style={[
            styles.deco,
            { width: 140, height: 140, top: -30, right: -30 },
          ]}
        />
        <View
          style={[
            styles.deco,
            { width: 90, height: 90, bottom: 10, left: -20 },
          ]}
        />

        <Text style={styles.heroTag}>
          {visit.visitType?.replace(/-/g, " ").toUpperCase()} VISIT
        </Text>
        <Text style={styles.heroNum}>{visit.visitNumber}</Text>
        <Text style={styles.heroComplaint}>
          {visit.chiefComplaint || "No complaint"}
        </Text>

        <View style={styles.heroPills}>
          <View style={styles.heroPill}>
            <View style={[styles.heroDot, { backgroundColor: statusColor }]} />
            <Text style={styles.heroPillText}>
              {visit.status?.replace(/-/g, " ")}
            </Text>
          </View>
          <View style={styles.heroPill}>
            <MaterialIcons
              name="event"
              size={11}
              color="rgba(255,255,255,0.5)"
            />
            <Text style={styles.heroPillText}>{admDate}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Vital Signs ── */}
      {vitalSigns.length > 0 && (
        <SectionCard
          icon="monitor-heart"
          title="Vital Signs"
          iconColor={C.rose}
          iconBg={C.roseGhost}
        >
          {vitalSigns.slice(0, 1).map((v) => (
            <View key={v.id}>
              <View style={styles.vitalsGrid}>
                {v.temperature != null && (
                  <VitalTile
                    icon="thermostat"
                    label="Temp"
                    value={`${v.temperature} °C`}
                    color={C.coral}
                  />
                )}
                {v.pulseRate != null && (
                  <VitalTile
                    icon="favorite"
                    label="Pulse"
                    value={`${v.pulseRate} bpm`}
                    color={C.rose}
                  />
                )}
                {v.oxygenSaturation != null && (
                  <VitalTile
                    icon="air"
                    label="SpO₂"
                    value={`${v.oxygenSaturation}%`}
                    color={C.blue}
                  />
                )}
                {v.bloodPressureSystolic != null && (
                  <VitalTile
                    icon="speed"
                    label="BP"
                    value={`${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`}
                    color={C.violet}
                  />
                )}
                {v.weight != null && (
                  <VitalTile
                    icon="monitor-weight"
                    label="Weight"
                    value={`${v.weight} kg`}
                    color={C.amber}
                  />
                )}
                {v.height != null && (
                  <VitalTile
                    icon="height"
                    label="Height"
                    value={`${v.height} cm`}
                    color={C.teal}
                  />
                )}
              </View>
              {v.nurseNotes && (
                <View style={styles.nurseNoteWrap}>
                  <View style={styles.nurseNoteLine} />
                  <Text style={styles.nurseNote}>{v.nurseNotes}</Text>
                </View>
              )}
            </View>
          ))}
        </SectionCard>
      )}

      {/* ── Diagnoses ── */}
      {diagnoses.length > 0 && (
        <SectionCard
          icon="assignment"
          title="Diagnoses"
          iconColor={C.violet}
          iconBg="#EDE9FE"
          count={diagnoses.length}
        >
          {diagnoses.map((d) => (
            <View key={d.id} style={styles.diagCard}>
              <View style={styles.diagTop}>
                <View style={styles.icdBadge}>
                  <Text style={styles.icdText}>{d.icdCode}</Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        d.diagnosisType === "confirmed"
                          ? C.tealGhost
                          : C.amberLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color:
                          d.diagnosisType === "confirmed" ? C.teal : C.amber,
                      },
                    ]}
                  >
                    {d.diagnosisType?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.diagName}>{d.diagnosisName}</Text>
              {d.severity && (
                <Text style={styles.diagSeverity}>Severity: {d.severity}</Text>
              )}
            </View>
          ))}
        </SectionCard>
      )}

      {/* ── Consultations ── */}
      {consultations.length > 0 && (
        <SectionCard
          icon="medical-services"
          title="Doctor's Notes"
          iconColor={C.blue}
          iconBg={C.blueGhost}
          count={consultations.length}
        >
          {consultations.map((c) => (
            <View key={c.id} style={styles.infoCard}>
              <InfoRow label="Assessment" value={c.assessment} />
              <InfoRow label="Plan" value={c.plan} />
              <InfoRow label="Clinical Findings" value={c.clinicalFindings} />
              <InfoRow label="Follow-up" value={c.followUpInstructions} />
              {c.nextAppointmentDate && (
                <InfoRow
                  label="Next Appointment"
                  value={new Date(c.nextAppointmentDate).toLocaleDateString(
                    "en-GB",
                  )}
                />
              )}
            </View>
          ))}
        </SectionCard>
      )}

      {/* ── Lab Orders ── */}
      {labOrders.length > 0 && (
        <SectionCard
          icon="biotech"
          title="Lab Tests"
          iconColor={C.amber}
          iconBg={C.amberLight}
          count={labOrders.length}
        >
          {labOrders.map((o) => (
            <ListItem
              key={o.id}
              title={o.testName ?? "Unknown Test"}
              subtitle={`${o.testCode ?? ""} · ${o.specimenType ?? ""}`}
              status={o.status}
            />
          ))}
        </SectionCard>
      )}

      {/* ── Imaging ── */}
      {imagingOrders.length > 0 && (
        <SectionCard
          icon="image-search"
          title="Imaging"
          iconColor={C.teal}
          iconBg={C.tealGhost}
          count={imagingOrders.length}
        >
          {imagingOrders.map((o) => (
            <ListItem
              key={o.id}
              title={`${o.modality?.toUpperCase()} — ${o.bodyPart}`}
              subtitle={o.indication}
              status={o.status}
            />
          ))}
        </SectionCard>
      )}

      {/* ── Prescriptions ── */}
      {prescriptions.length > 0 && (
        <SectionCard
          icon="medication"
          title="Prescriptions"
          iconColor={C.tealDark}
          iconBg={C.tealGhost}
          count={prescriptions.length}
        >
          {prescriptions.map((p) => (
            <ListItem
              key={p.id}
              title={p.prescriptionNumber ?? "Rx"}
              status={p.status}
            />
          ))}
        </SectionCard>
      )}

      {/* ── Discharge ── */}
      {visit.dischargeDiagnosis && (
        <SectionCard
          icon="exit-to-app"
          title="Discharge Summary"
          iconColor={C.inkSoft}
          iconBg="#F3F4F6"
        >
          <View style={styles.infoCard}>
            <InfoRow label="Diagnosis" value={visit.dischargeDiagnosis} />
            <InfoRow label="Summary" value={visit.dischargeSummary} />
            <InfoRow label="Instructions" value={visit.dischargeInstructions} />
            {visit.followUpDate && (
              <InfoRow
                label="Follow-up"
                value={new Date(visit.followUpDate).toLocaleDateString("en-GB")}
              />
            )}
          </View>
        </SectionCard>
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 24 },

  // Error
  errScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  errIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.coralLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  errTitle: { fontSize: 16, fontWeight: "700", color: C.ink },
  errBody: { fontSize: 13, color: C.inkMuted },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },
  deco: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroTag: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  heroNum: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6FCF97",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  heroComplaint: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  heroPills: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroPillText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },

  // Section card
  sectionCard: {
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: C.ink, flex: 1 },
  countBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  countText: { fontSize: 10, fontWeight: "800" },

  // Vitals
  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vitalTile: {
    width: "30%",
    flexGrow: 1,
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  vitalIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  vitalValue: { fontSize: 14, fontWeight: "800", color: C.ink },
  vitalLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: C.inkMuted,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  nurseNoteWrap: {
    flexDirection: "row",
    marginTop: 12,
    backgroundColor: C.tealGhost,
    borderRadius: 10,
    overflow: "hidden",
  },
  nurseNoteLine: { width: 3, backgroundColor: C.teal },
  nurseNote: {
    flex: 1,
    fontSize: 12,
    color: C.inkSoft,
    fontStyle: "italic",
    padding: 10,
    lineHeight: 17,
  },

  // Diagnosis
  diagCard: {
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  diagTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  icdBadge: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  icdText: {
    fontSize: 10,
    fontWeight: "700",
    color: C.violet,
    letterSpacing: 0.3,
  },
  diagName: { fontSize: 14, fontWeight: "600", color: C.ink },
  diagSeverity: { fontSize: 11, color: C.inkMuted, marginTop: 3 },

  // Info card
  infoCard: {
    backgroundColor: C.bg,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  infoLabel: { fontSize: 12, color: C.inkMuted, fontWeight: "500", flex: 1 },
  infoValue: {
    fontSize: 12,
    color: C.ink,
    fontWeight: "600",
    flex: 2,
    textAlign: "right",
    lineHeight: 17,
  },

  // List item
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  listItemTitle: { fontSize: 13, fontWeight: "600", color: C.ink },
  listItemSub: { fontSize: 11, color: C.inkMuted, marginTop: 2 },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
});
