import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons as Icon } from "@expo/vector-icons";

import { getVisitDetail } from "../../api/records";
import { useAuthStore } from "../../store/authStore";
import { RecordsStackParamList } from "../../types";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Card from "../../components/common/Card";

type Props = NativeStackScreenProps<RecordsStackParamList, "RecordDetail">;

// ── Small section heading ──────────────────────────────────
function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={18} color="#16A34A" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

export default function RecordDetailScreen({ route }: Props) {
  const { visitId } = route.params;
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getVisitDetail(user.id, visitId)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading visit details…" />;
  if (!data)
    return (
      <View style={styles.center}>
        <Text style={styles.errText}>Could not load this record.</Text>
      </View>
    );

  const {
    visit,
    consultations = [],
    diagnoses = [],
    vitalSigns = [],
    labOrders = [],
    imagingOrders = [],
    prescriptions = [],
  } = data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* Visit summary card */}
      <Card style={styles.heroCard}>
        <Text style={styles.heroVisitNum}>{visit.visitNumber}</Text>
        <Text style={styles.heroType}>
          {visit.visitType?.toUpperCase()} VISIT
        </Text>
        <Text style={styles.heroComplaint}>{visit.chiefComplaint}</Text>
        <View style={styles.heroMeta}>
          <Text style={styles.heroMetaText}>
            📅{" "}
            {new Date(visit.admissionDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
          <Text style={styles.heroMetaText}>
            🔖 {visit.status?.replace("-", " ").toUpperCase()}
          </Text>
        </View>
      </Card>

      {/* Vitals */}
      {vitalSigns.length > 0 && (
        <Section icon="monitor-heart" title="Vital Signs">
          <Card>
            {vitalSigns.slice(0, 1).map((v: any) => (
              <View key={v.id}>
                <View style={styles.vitalsGrid}>
                  {v.temperature && (
                    <VitalTile
                      label="Temp"
                      value={`${v.temperature} °C`}
                      icon="thermostat"
                    />
                  )}
                  {v.pulseRate && (
                    <VitalTile
                      label="Pulse"
                      value={`${v.pulseRate} bpm`}
                      icon="favorite"
                    />
                  )}
                  {v.oxygenSaturation && (
                    <VitalTile
                      label="SpO₂"
                      value={`${v.oxygenSaturation}%`}
                      icon="air"
                    />
                  )}
                  {v.bloodPressureSystolic && (
                    <VitalTile
                      label="BP"
                      value={`${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`}
                      icon="speed"
                    />
                  )}
                  {v.weight && (
                    <VitalTile
                      label="Weight"
                      value={`${v.weight} kg`}
                      icon="monitor-weight"
                    />
                  )}
                  {v.height && (
                    <VitalTile
                      label="Height"
                      value={`${v.height} cm`}
                      icon="height"
                    />
                  )}
                </View>
                {v.nurseNotes && (
                  <Text style={styles.notes}>📝 {v.nurseNotes}</Text>
                )}
              </View>
            ))}
          </Card>
        </Section>
      )}

      {/* Consultations */}
      {consultations.length > 0 && (
        <Section icon="medical-services" title="Doctor's Notes">
          {consultations.map((c: any) => (
            <Card key={c.id}>
              <Row label="Assessment" value={c.assessment} />
              <Row label="Plan" value={c.plan} />
              <Row label="Clinical Findings" value={c.clinicalFindings} />
              <Row label="Follow-up" value={c.followUpInstructions} />
              {c.nextAppointmentDate && (
                <Row
                  label="Next Appointment"
                  value={new Date(c.nextAppointmentDate).toLocaleDateString(
                    "en-GB",
                  )}
                />
              )}
            </Card>
          ))}
        </Section>
      )}

      {/* Diagnoses */}
      {diagnoses.length > 0 && (
        <Section icon="diagnosis" title="Diagnoses">
          {diagnoses.map((d: any) => (
            <Card key={d.id}>
              <View style={styles.diagRow}>
                <Text style={styles.icdCode}>{d.icdCode}</Text>
                <Text
                  style={[
                    styles.diagStatus,
                    {
                      color:
                        d.diagnosisType === "confirmed" ? "#10B981" : "#F59E0B",
                    },
                  ]}
                >
                  {d.diagnosisType?.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.diagName}>{d.diagnosisName}</Text>
              {d.severity && (
                <Text style={styles.diagSeverity}>Severity: {d.severity}</Text>
              )}
            </Card>
          ))}
        </Section>
      )}

      {/* Lab Orders */}
      {labOrders.length > 0 && (
        <Section icon="biotech" title="Lab Tests">
          {labOrders.map((o: any) => (
            <Card key={o.id}>
              <View style={styles.labRow}>
                <Text style={styles.labName}>{o.testName}</Text>
                <Text
                  style={[
                    styles.labStatus,
                    { color: o.status === "resulted" ? "#10B981" : "#F59E0B" },
                  ]}
                >
                  {o.status?.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.labCode}>
                {o.testCode} · {o.specimenType}
              </Text>
            </Card>
          ))}
        </Section>
      )}

      {/* Imaging */}
      {imagingOrders.length > 0 && (
        <Section icon="radiology" title="Imaging">
          {imagingOrders.map((o: any) => (
            <Card key={o.id}>
              <View style={styles.labRow}>
                <Text style={styles.labName}>
                  {o.modality?.toUpperCase()} — {o.bodyPart}
                </Text>
                <Text
                  style={[
                    styles.labStatus,
                    { color: o.status === "reported" ? "#10B981" : "#F59E0B" },
                  ]}
                >
                  {o.status?.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.labCode}>{o.indication}</Text>
            </Card>
          ))}
        </Section>
      )}

      {/* Prescriptions */}
      {prescriptions.length > 0 && (
        <Section icon="medication" title="Prescriptions">
          {prescriptions.map((p: any) => (
            <Card key={p.id}>
              <View style={styles.labRow}>
                <Text style={styles.labName}>{p.prescriptionNumber}</Text>
                <Text
                  style={[
                    styles.labStatus,
                    { color: p.status === "dispensed" ? "#10B981" : "#F59E0B" },
                  ]}
                >
                  {p.status?.toUpperCase()}
                </Text>
              </View>
            </Card>
          ))}
        </Section>
      )}

      {/* Discharge */}
      {visit.dischargeDiagnosis && (
        <Section icon="exit-to-app" title="Discharge Summary">
          <Card>
            <Row label="Diagnosis" value={visit.dischargeDiagnosis} />
            <Row label="Summary" value={visit.dischargeSummary} />
            <Row label="Instructions" value={visit.dischargeInstructions} />
            {visit.followUpDate && (
              <Row
                label="Follow-up Date"
                value={new Date(visit.followUpDate).toLocaleDateString("en-GB")}
              />
            )}
          </Card>
        </Section>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function VitalTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <View style={styles.vitalTile}>
      <Icon name={icon} size={20} color="#16A34A" />
      <Text style={styles.vitalValue}>{value}</Text>
      <Text style={styles.vitalLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Add to every screen's container style
  container: {
    flex: 1,
    backgroundColor: "#F0F4FF",
    paddingBottom: 80, // clears the tab bar
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errText: { color: "#DC2626" },
  heroCard: { backgroundColor: "#16A34A", marginBottom: 16 },
  heroVisitNum: { fontSize: 12, color: "#BFDBFE", fontWeight: "700" },
  heroType: { fontSize: 11, color: "#93C5FD", marginTop: 2 },
  heroComplaint: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 6,
    marginBottom: 12,
  },
  heroMeta: { flexDirection: "row", gap: 16 },
  heroMetaText: { fontSize: 12, color: "#BFDBFE" },
  section: { marginBottom: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginTop: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1E3A5F" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rowLabel: { fontSize: 13, color: "#6B7280", flex: 1 },
  rowValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },
  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  vitalTile: {
    width: "28%",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 10,
  },
  vitalValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#166534",
    marginTop: 4,
  },
  vitalLabel: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  notes: { marginTop: 10, fontSize: 13, color: "#374151", fontStyle: "italic" },
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  icdCode: { fontSize: 12, fontWeight: "700", color: "#16A34A" },
  diagStatus: { fontSize: 11, fontWeight: "700" },
  diagName: { fontSize: 15, fontWeight: "600", color: "#111827", marginTop: 4 },
  diagSeverity: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  labRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labName: { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1 },
  labStatus: { fontSize: 11, fontWeight: "700" },
  labCode: { fontSize: 12, color: "#6B7280", marginTop: 4 },
});
