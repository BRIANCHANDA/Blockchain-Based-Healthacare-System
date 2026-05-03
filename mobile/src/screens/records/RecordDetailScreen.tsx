import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";

import { getVisitDetail } from "../../api/records";
import { useAuthStore } from "../../store/authStore";
import { RecordsStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";

type Props = NativeStackScreenProps<RecordsStackParamList, "RecordDetail">;

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

function SectionHeader({
  icon,
  title,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.sectionHdr}>
      <View style={styles.sectionIconWrap}>
        <MaterialIcons name={icon} size={14} color="#0A6640" />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.infoCard}>{children}</View>;
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

function VitalTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.vitalTile}>
      <MaterialIcons name={icon} size={18} color="#0A6640" />
      <Text style={styles.vitalValue}>{value}</Text>
      <Text style={styles.vitalLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    resulted: { color: "#0A6640", bg: "#E6F4EE" },
    reported: { color: "#0A6640", bg: "#E6F4EE" },
    dispensed: { color: "#0A6640", bg: "#E6F4EE" },
    pending: { color: "#B45309", bg: "#FEF3C7" },
    ordered: { color: "#B45309", bg: "#FEF3C7" },
  };
  const cfg = map[status ?? ""] ?? { color: "#6B7280", bg: "#F3F4F6" };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>
        {status?.toUpperCase()}
      </Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function RecordDetailScreen({ route }: Props) {
  const { visitId } = route.params;
  const user = useAuthStore((s) => s.user);

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
        <MaterialIcons name="error-outline" size={40} color="#B91C1C" />
        <Text style={styles.errTitle}>Could not load record</Text>
        <Text style={styles.errBody}>Pull back and try again.</Text>
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <Text style={styles.heroTag}>
          {visit.visitType?.replace(/-/g, " ").toUpperCase()} VISIT
        </Text>
        <Text style={styles.heroNum}>{visit.visitNumber}</Text>
        <Text style={styles.heroComplaint}>{visit.chiefComplaint}</Text>

        <View style={styles.heroPills}>
          <View style={styles.heroPill}>
            <View style={[styles.heroDot, { backgroundColor: "#6FCF97" }]} />
            <Text style={styles.heroPillText}>
              {visit.status?.replace(/-/g, " ")}
            </Text>
          </View>
          <View style={styles.heroPill}>
            <MaterialIcons
              name="event"
              size={11}
              color="rgba(255,255,255,0.6)"
            />
            <Text style={styles.heroPillText}>{admDate}</Text>
          </View>
        </View>
      </View>

      {/* ── Vital Signs ── */}
      {vitalSigns.length > 0 && (
        <View style={styles.section}>
          <SectionHeader icon="monitor-heart" title="Vital signs" />
          {vitalSigns.slice(0, 1).map((v) => (
            <View key={v.id}>
              <View style={styles.vitalsGrid}>
                {v.temperature && (
                  <VitalTile
                    icon="thermostat"
                    label="Temp"
                    value={`${v.temperature} °C`}
                  />
                )}
                {v.pulseRate && (
                  <VitalTile
                    icon="favorite"
                    label="Pulse"
                    value={`${v.pulseRate} bpm`}
                  />
                )}
                {v.oxygenSaturation && (
                  <VitalTile
                    icon="air"
                    label="SpO₂"
                    value={`${v.oxygenSaturation}%`}
                  />
                )}
                {v.bloodPressureSystolic && (
                  <VitalTile
                    icon="speed"
                    label="BP"
                    value={`${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`}
                  />
                )}
                {v.weight && (
                  <VitalTile
                    icon="monitor-weight"
                    label="Weight"
                    value={`${v.weight} kg`}
                  />
                )}
                {v.height && (
                  <VitalTile
                    icon="height"
                    label="Height"
                    value={`${v.height} cm`}
                  />
                )}
              </View>
              {v.nurseNotes && (
                <Text style={styles.nurseNote}>{v.nurseNotes}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── Diagnoses ── */}
      {diagnoses.length > 0 && (
        <View style={styles.section}>
          <SectionHeader icon="diagnosis" title="Diagnoses" />
          {diagnoses.map((d) => (
            <View key={d.id} style={styles.diagCard}>
              <View style={styles.diagTop}>
                <Text style={styles.icdCode}>{d.icdCode}</Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        d.diagnosisType === "confirmed" ? "#E6F4EE" : "#FEF3C7",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color:
                          d.diagnosisType === "confirmed"
                            ? "#0A6640"
                            : "#B45309",
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
        </View>
      )}

      {/* ── Consultations ── */}
      {consultations.length > 0 && (
        <View style={styles.section}>
          <SectionHeader icon="medical-services" title="Doctor's notes" />
          {consultations.map((c) => (
            <InfoCard key={c.id}>
              <InfoRow label="Assessment" value={c.assessment} />
              <InfoRow label="Plan" value={c.plan} />
              <InfoRow label="Clinical findings" value={c.clinicalFindings} />
              <InfoRow label="Follow-up" value={c.followUpInstructions} />
              {c.nextAppointmentDate && (
                <InfoRow
                  label="Next appointment"
                  value={new Date(c.nextAppointmentDate).toLocaleDateString(
                    "en-GB",
                  )}
                />
              )}
            </InfoCard>
          ))}
        </View>
      )}

      {/* ── Lab Orders ── */}
      {labOrders.length > 0 && (
        <View style={styles.section}>
          <SectionHeader icon="biotech" title="Lab tests" />
          {labOrders.map((o) => (
            <View key={o.id} style={styles.listCard}>
              <View style={styles.listCardLeft}>
                <Text style={styles.listCardTitle}>{o.testName}</Text>
                <Text style={styles.listCardSub}>
                  {o.testCode} · {o.specimenType}
                </Text>
              </View>
              <StatusBadge status={o.status} />
            </View>
          ))}
        </View>
      )}

      {/* ── Imaging ── */}
      {imagingOrders.length > 0 && (
        <View style={styles.section}>
          <SectionHeader icon="radiology" title="Imaging" />
          {imagingOrders.map((o) => (
            <View key={o.id} style={styles.listCard}>
              <View style={styles.listCardLeft}>
                <Text style={styles.listCardTitle}>
                  {o.modality?.toUpperCase()} — {o.bodyPart}
                </Text>
                <Text style={styles.listCardSub}>{o.indication}</Text>
              </View>
              <StatusBadge status={o.status} />
            </View>
          ))}
        </View>
      )}

      {/* ── Prescriptions ── */}
      {prescriptions.length > 0 && (
        <View style={styles.section}>
          <SectionHeader icon="medication" title="Prescriptions" />
          {prescriptions.map((p) => (
            <View key={p.id} style={styles.listCard}>
              <Text style={styles.listCardTitle}>{p.prescriptionNumber}</Text>
              <StatusBadge status={p.status} />
            </View>
          ))}
        </View>
      )}

      {/* ── Discharge Summary ── */}
      {visit.dischargeDiagnosis && (
        <View style={styles.section}>
          <SectionHeader icon="exit-to-app" title="Discharge summary" />
          <InfoCard>
            <InfoRow label="Diagnosis" value={visit.dischargeDiagnosis} />
            <InfoRow label="Summary" value={visit.dischargeSummary} />
            <InfoRow label="Instructions" value={visit.dischargeInstructions} />
            {visit.followUpDate && (
              <InfoRow
                label="Follow-up date"
                value={new Date(visit.followUpDate).toLocaleDateString("en-GB")}
              />
            )}
          </InfoCard>
        </View>
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const PRIMARY = "#0A6640";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F2F5F2" },
  content: { padding: 16 },

  // Error state
  errScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  errTitle: { fontSize: 16, fontWeight: "700", color: "#0D1F17" },
  errBody: { fontSize: 13, color: "#8AA89C" },

  // Hero
  hero: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  heroTag: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroNum: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6FCF97",
    marginBottom: 6,
  },
  heroComplaint: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 22,
    marginBottom: 12,
  },
  heroPills: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroPillText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },

  // Section
  section: { marginBottom: 4 },
  sectionHdr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "#E6F4EE",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#0D1F17" },

  // Vitals
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  vitalTile: {
    width: "30%",
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#EEF4F1",
  },
  vitalValue: { fontSize: 13, fontWeight: "700", color: PRIMARY, marginTop: 4 },
  vitalLabel: { fontSize: 10, color: "#8AA89C", marginTop: 2 },
  nurseNote: {
    fontSize: 12,
    color: "#5A7A69",
    fontStyle: "italic",
    marginTop: 8,
    padding: 10,
    backgroundColor: "#F0F8F4",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
  },

  // Info card
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#EEF4F1",
    marginBottom: 6,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F2F6F3",
  },
  infoLabel: { fontSize: 12, color: "#8AA89C", fontWeight: "500", flex: 1 },
  infoValue: {
    fontSize: 12,
    color: "#0D1F17",
    fontWeight: "600",
    flex: 2,
    textAlign: "right",
    lineHeight: 17,
  },

  // Diagnosis
  diagCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#EEF4F1",
    padding: 12,
    marginBottom: 6,
  },
  diagTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  icdCode: { fontSize: 11, fontWeight: "700", color: PRIMARY },
  diagName: { fontSize: 14, fontWeight: "600", color: "#0D1F17" },
  diagSeverity: { fontSize: 11, color: "#8AA89C", marginTop: 3 },

  // List card (labs, imaging, prescriptions)
  listCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#EEF4F1",
    padding: 12,
    marginBottom: 6,
  },
  listCardLeft: { flex: 1, marginRight: 8 },
  listCardTitle: { fontSize: 13, fontWeight: "600", color: "#0D1F17" },
  listCardSub: { fontSize: 11, color: "#8AA89C", marginTop: 2 },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
});
