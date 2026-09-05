import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getVisitDetail } from "../../api/records";
import { useAuthStore } from "../../store/authStore";
import { RecordsStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ScanGallery from "../../components/records/ScanGallery";

type Props = NativeStackScreenProps<RecordsStackParamList, "RecordDetail">;

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: "#059669",
  primaryDark: "#047857",
  primaryDeep: "#064E3B",
  primaryGhost: "#ECFDF5",

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
  /**
   * The radiologist's report, including the images they uploaded.
   *
   * GET /visits/:id/summary has always returned this; the interface simply
   * did not declare it, so the findings and the scans were fetched and then
   * discarded — the patient saw that an X-ray had been ordered, but never
   * the result and never the picture.
   */
  report?: {
    findings?: string;
    impression?: string;
    recommendations?: string;
    imageUrls?: string[];
    reportedAt?: string;
  } | null;
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

function Section({
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
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && (
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{count}</Text>
          </View>
        )}
      </View>
      <View style={styles.sectionBody}>{children}</View>
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
      <View style={[styles.vitalIconWrap, { backgroundColor: `${color}18` }]}>
        <MaterialIcons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.vitalValue}>{value}</Text>
      <Text style={styles.vitalLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    resulted: { color: C.primary, bg: C.primaryGhost },
    reported: { color: C.primary, bg: C.primaryGhost },
    dispensed: { color: C.primary, bg: C.primaryGhost },
    pending: { color: C.amber, bg: C.amberLight },
    ordered: { color: C.blue, bg: C.blueLight },
  };
  const cfg = map[status ?? ""] ?? { color: C.inkMuted, bg: C.bgAlt };
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

export default function RecordDetailScreen({ route, navigation }: Props) {
  const { visitId } = route.params;
  const user = useAuthStore((s) => s.user);
  const activePatientId = useAuthStore((s) => s.activePatientId);
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Use the active dependent's ID when a guardian is viewing a child's record
  const effectivePatientId = activePatientId ?? user?.id ?? "";

  useEffect(() => {
    if (!effectivePatientId) return;
    getVisitDetail(effectivePatientId, visitId)
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [effectivePatientId, visitId]);

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

  const statusColor = visit.status === "completed" ? C.primary : C.amber;
  const statusLabel =
    visit.status === "in-progress" ? "Active" : (visit.status ?? "Completed");

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Custom header bar ── */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.6}
        >
          <MaterialIcons name="arrow-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visit Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero — clean, no gradient ── */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroVisitNum}>{visit.visitNumber}</Text>
            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor:
                    statusColor === C.primary ? C.primaryGhost : C.amberLight,
                },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          <Text style={styles.heroComplaint}>
            {visit.chiefComplaint || "No complaint recorded"}
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <MaterialIcons name="event" size={14} color={C.inkMuted} />
              <Text style={styles.heroMetaText}>{admDate}</Text>
            </View>
            <View style={styles.heroMetaDot} />
            <View style={styles.heroMetaItem}>
              <MaterialIcons
                name="local-hospital"
                size={14}
                color={C.inkMuted}
              />
              <Text style={styles.heroMetaText}>
                {visit.visitType?.replace(/-/g, " ")}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Vital Signs ── */}
        {vitalSigns.length > 0 && (
          <Section
            icon="favorite"
            title="Vital Signs"
            iconColor={C.coral}
            iconBg={C.coralLight}
          >
            {vitalSigns.slice(0, 1).map((v) => (
              <View key={v.id}>
                <View style={styles.vitalsGrid}>
                  {v.temperature != null && (
                    <VitalTile
                      icon="thermostat"
                      label="Temperature"
                      value={`${v.temperature}°C`}
                      color={C.coral}
                    />
                  )}
                  {v.pulseRate != null && (
                    <VitalTile
                      icon="favorite"
                      label="Pulse"
                      value={`${v.pulseRate} bpm`}
                      color={C.coral}
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
                      label="Blood Pressure"
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
                      color={C.primary}
                    />
                  )}
                </View>
                {v.nurseNotes && (
                  <View style={styles.noteWrap}>
                    <View style={styles.noteAccent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noteLabel}>Nurse note</Text>
                      <Text style={styles.noteText}>{v.nurseNotes}</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </Section>
        )}

        {/* ── Diagnoses ── */}
        {diagnoses.length > 0 && (
          <Section
            icon="assignment"
            title="Diagnoses"
            iconColor={C.violet}
            iconBg={C.violetLight}
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
                            ? C.primaryGhost
                            : C.amberLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color:
                            d.diagnosisType === "confirmed"
                              ? C.primary
                              : C.amber,
                        },
                      ]}
                    >
                      {d.diagnosisType?.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.diagName}>{d.diagnosisName}</Text>
                {d.severity && (
                  <Text style={styles.diagSeverity}>
                    Severity: {d.severity}
                  </Text>
                )}
              </View>
            ))}
          </Section>
        )}

        {/* ── Consultations ── */}
        {consultations.length > 0 && (
          <Section
            icon="medical-services"
            title="Doctor's Notes"
            iconColor={C.blue}
            iconBg={C.blueLight}
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
          </Section>
        )}

        {/* ── Lab Orders ── */}
        {labOrders.length > 0 && (
          <Section
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
          </Section>
        )}

        {/* ── Imaging ── */}
        {imagingOrders.length > 0 && (
          <Section
            icon="image-search"
            title="Imaging"
            iconColor={C.primary}
            iconBg={C.primaryGhost}
            count={imagingOrders.length}
          >
            {imagingOrders.map((o) => (
              <View key={o.id}>
                <ListItem
                  title={`${o.modality?.toUpperCase()} — ${o.bodyPart}`}
                  subtitle={o.indication}
                  status={o.status}
                />

                {o.report?.impression ? (
                  <View style={styles.reportBox}>
                    <Text style={styles.reportLabel}>Impression</Text>
                    <Text style={styles.reportText}>{o.report.impression}</Text>
                  </View>
                ) : null}

                {o.report?.findings ? (
                  <View style={styles.reportBox}>
                    <Text style={styles.reportLabel}>Findings</Text>
                    <Text style={styles.reportText}>{o.report.findings}</Text>
                  </View>
                ) : null}

                {o.report?.imageUrls?.length ? (
                  <ScanGallery
                    urls={o.report.imageUrls}
                    category="radiology"
                    label={o.modality?.toUpperCase()}
                  />
                ) : null}
              </View>
            ))}
          </Section>
        )}

        {/* ── Prescriptions ── */}
        {prescriptions.length > 0 && (
          <Section
            icon="medication"
            title="Prescriptions"
            iconColor={C.primaryDark}
            iconBg={C.primaryGhost}
            count={prescriptions.length}
          >
            {prescriptions.map((p) => (
              <ListItem
                key={p.id}
                title={p.prescriptionNumber ?? "Rx"}
                status={p.status}
              />
            ))}
          </Section>
        )}

        {/* ── Discharge ── */}
        {visit.dischargeDiagnosis && (
          <Section
            icon="exit-to-app"
            title="Discharge Summary"
            iconColor={C.inkSoft}
            iconBg={C.bgAlt}
          >
            <View style={styles.infoCard}>
              <InfoRow label="Diagnosis" value={visit.dischargeDiagnosis} />
              <InfoRow label="Summary" value={visit.dischargeSummary} />
              <InfoRow
                label="Instructions"
                value={visit.dischargeInstructions}
              />
              {visit.followUpDate && (
                <InfoRow
                  label="Follow-up"
                  value={new Date(visit.followUpDate).toLocaleDateString(
                    "en-GB",
                  )}
                />
              )}
            </View>
          </Section>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  reportBox: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: C.primaryGhost,
  },
  reportLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: C.inkMuted,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  reportText: { fontSize: 13, lineHeight: 19, color: C.inkSoft },
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 24 },

  // Error
  errScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.bg,
  },
  errIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.coralLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  errTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.3,
  },
  errBody: { fontSize: 14, color: C.inkMuted },

  // Header bar
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

  // ── Hero ──
  hero: {
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  heroVisitNum: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 0.5,
    fontVariant: ["tabular-nums"],
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "capitalize",
  },
  heroComplaint: {
    fontSize: 22,
    fontWeight: "800",
    color: C.ink,
    lineHeight: 28,
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroMetaText: {
    fontSize: 13,
    color: C.inkSoft,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.inkSubtle,
  },

  // ── Section ──
  section: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: C.ink,
    flex: 1,
    letterSpacing: -0.2,
  },
  sectionCount: {
    backgroundColor: C.ink,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 22,
    alignItems: "center",
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  sectionBody: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },

  // ── Vitals ──
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vitalTile: {
    width: "31%",
    flexGrow: 1,
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.divider,
  },
  vitalIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  vitalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.3,
  },
  vitalLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: C.inkMuted,
    marginTop: 2,
    letterSpacing: 0.2,
    textAlign: "center",
  },

  noteWrap: {
    flexDirection: "row",
    marginTop: 12,
    backgroundColor: C.primaryGhost,
    borderRadius: 12,
    overflow: "hidden",
  },
  noteAccent: { width: 3, backgroundColor: C.primary },
  noteLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.primaryDark,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  noteText: {
    fontSize: 13,
    color: C.ink,
    fontStyle: "italic",
    lineHeight: 19,
    fontWeight: "500",
  },

  // ── Diagnosis ──
  diagCard: {
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.divider,
  },
  diagTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
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
    fontWeight: "800",
    color: C.violet,
    letterSpacing: 0.3,
  },
  diagName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.2,
  },
  diagSeverity: {
    fontSize: 12,
    color: C.inkMuted,
    marginTop: 3,
    fontWeight: "500",
  },

  // ── Info card ──
  infoCard: {
    backgroundColor: C.bg,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.divider,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  infoLabel: {
    fontSize: 12,
    color: C.inkMuted,
    fontWeight: "600",
    flex: 1,
    letterSpacing: 0.1,
  },
  infoValue: {
    fontSize: 13,
    color: C.ink,
    fontWeight: "600",
    flex: 2,
    textAlign: "right",
    lineHeight: 18,
  },

  // ── List item ──
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.divider,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.2,
  },
  listItemSub: {
    fontSize: 12,
    color: C.inkMuted,
    marginTop: 2,
    fontWeight: "500",
  },

  // ── Badge ──
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
