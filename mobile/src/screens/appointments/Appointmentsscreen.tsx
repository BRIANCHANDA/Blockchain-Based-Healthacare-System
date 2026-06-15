import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  getMyAppointments,
  requestAppointment,
  cancelAppointmentRequest,
  getMyInstitutions,
} from "../../api/appointments";
import LoadingSpinner from "../../components/common/LoadingSpinner";

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: "#059669",
  primaryDark: "#047857",
  primaryDeep: "#064E3B",
  primaryGhost: "#ECFDF5",
  primaryLight: "#D1FAE5",
  coral: "#FF5757",
  coralLight: "#FFE4E4",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  blue: "#3B82F6",
  blueLight: "#DBEAFE",
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

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string; icon: string }
> = {
  scheduled: {
    color: C.blue,
    bg: C.blueLight,
    label: "Scheduled",
    icon: "event",
  },
  "in-progress": {
    color: C.amber,
    bg: C.amberLight,
    label: "In Progress",
    icon: "hourglass-empty",
  },
  completed: {
    color: C.primary,
    bg: C.primaryGhost,
    label: "Completed",
    icon: "check-circle",
  },
  cancelled: {
    color: C.inkMuted,
    bg: C.bgAlt,
    label: "Cancelled",
    icon: "cancel",
  },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  routine: { color: C.primary, bg: C.primaryGhost },
  urgent: { color: C.amber, bg: C.amberLight },
  emergency: { color: C.coral, bg: C.coralLight },
  critical: { color: "#7C3AED", bg: "#EDE9FE" },
};

const DEPARTMENTS = [
  "General OPD",
  "Cardiology",
  "Gynaecology",
  "Paediatrics",
  "Orthopaedics",
  "ENT",
  "Ophthalmology",
  "Dermatology",
  "Neurology",
  "Urology",
  "Psychiatry",
  "Dentistry",
  "Physiotherapy",
  "Nutrition & Dietetics",
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Appointment card ─────────────────────────────────────────────────────────
function AppointmentCard({
  item,
  onCancel,
}: {
  item: any;
  onCancel: (id: string) => void;
}) {
  const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.scheduled;
  const pr = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG.routine;
  const canCancel = item.status === "scheduled";
  const isRequest = item.isPatientRequested;

  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.visitNumRow}>
          <Text style={styles.visitNum}>{item.visitNumber}</Text>
          {isRequest && (
            <View style={styles.requestTag}>
              <Text style={styles.requestTagText}>Your request</Text>
            </View>
          )}
        </View>
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <MaterialIcons name={st.icon as any} size={11} color={st.color} />
          <Text style={[styles.statusText, { color: st.color }]}>
            {st.label}
          </Text>
        </View>
      </View>

      <Text style={styles.institutionName} numberOfLines={1}>
        {item.institutionName ?? "Hospital"}
      </Text>

      <Text style={styles.reason} numberOfLines={2}>
        {item.chiefComplaint ?? "No reason recorded"}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialIcons name="event" size={13} color={C.inkMuted} />
          <Text style={styles.metaText}>{fmtDateTime(item.admissionDate)}</Text>
        </View>
        {item.doctorName && (
          <>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <MaterialIcons name="person" size={13} color={C.inkMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {item.doctorName}
              </Text>
            </View>
          </>
        )}
      </View>

      {item.admittingDiagnosis &&
        !item.admittingDiagnosis.startsWith("APT-") && (
          <View style={styles.deptRow}>
            <MaterialIcons name="local-hospital" size={12} color={C.primary} />
            <Text style={styles.deptText}>{item.admittingDiagnosis}</Text>
          </View>
        )}

      <View style={styles.cardFooter}>
        <View style={[styles.priorityPill, { backgroundColor: pr.bg }]}>
          <View style={[styles.priorityDot, { backgroundColor: pr.color }]} />
          <Text style={[styles.priorityText, { color: pr.color }]}>
            {item.priority}
          </Text>
        </View>
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onCancel(item.id)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={12} color={C.coral} />
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Request modal ────────────────────────────────────────────────────────────
function RequestModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2>(1);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loadingInst, setLoadingInst] = useState(true);
  const [selectedInst, setSelectedInst] = useState<any>(null);
  const [preferredDate, setPreferredDate] = useState(
    new Date(Date.now() + 86400000),
  );
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [reason, setReason] = useState("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent">("routine");
  const [submitting, setSubmitting] = useState(false);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadingInst(true);
    getMyInstitutions()
      .then((res) => setInstitutions(res.data?.data?.institutions ?? []))
      .catch(() => setInstitutions([]))
      .finally(() => setLoadingInst(false));
  }, [visible]);

  const reset = () => {
    setStep(1);
    setSelectedInst(null);
    setPreferredDate(new Date(Date.now() + 86400000));
    setReason("");
    setDepartment("");
    setPriority("routine");
    setSubmitting(false);
    setPickerMode(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Two-step date/time picker — works on both Android & iOS ────────────────
  const openDatePicker = () => setPickerMode("date");

  const handlePickerChange = (event: any, selected?: Date) => {
    // Android fires "dismissed" when user cancels — close picker, do nothing else
    if (event?.type === "dismissed" || !selected) {
      setPickerMode(null);
      return;
    }

    if (pickerMode === "date") {
      // Keep the existing time on the new date
      const newDate = new Date(selected);
      newDate.setHours(
        preferredDate.getHours(),
        preferredDate.getMinutes(),
        0,
        0,
      );
      setPreferredDate(newDate);
      // Now ask for time
      setPickerMode("time");
    } else if (pickerMode === "time") {
      // Keep the date but update the time
      const newDate = new Date(preferredDate);
      newDate.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setPreferredDate(newDate);
      setPickerMode(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedInst) {
      Toast.show({ type: "error", text1: "Please select a hospital" });
      return;
    }
    if (reason.trim().length < 10) {
      Toast.show({
        type: "error",
        text1: "Describe your reason (min 10 chars)",
      });
      return;
    }

    setSubmitting(true);
    try {
      await requestAppointment({
        institutionId: selectedInst.id,
        preferredDate: preferredDate.toISOString(),
        reason: reason.trim(),
        department: department || undefined,
        priority,
      });
      Toast.show({
        type: "success",
        text1: "Request Submitted",
        text2: "The hospital will confirm your appointment.",
      });
      reset();
      onSubmit();
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: err.response?.data?.error?.message ?? "Could not submit request",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={modal.overlay}>
        <View style={[modal.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={modal.handle} />

          <View style={modal.header}>
            <View>
              <Text style={modal.title}>Request Appointment</Text>
              <Text style={modal.sub}>
                Step {step} of 2 —{" "}
                {step === 1 ? "Choose hospital" : "Appointment details"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={modal.closeBtn}
              activeOpacity={0.6}
            >
              <MaterialIcons name="close" size={18} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Step 1: Pick hospital ── */}
            {step === 1 && (
              <View>
                <Text style={modal.sectionLabel}>Select Hospital</Text>
                <Text style={modal.sectionSub}>
                  Only hospitals where you have had a past visit are shown.
                </Text>

                {loadingInst ? (
                  <View style={modal.loadingWrap}>
                    <ActivityIndicator color={C.primary} />
                  </View>
                ) : institutions.length === 0 ? (
                  <View style={modal.emptyWrap}>
                    <MaterialIcons
                      name="local-hospital"
                      size={32}
                      color={C.inkSubtle}
                    />
                    <Text style={modal.emptyText}>No hospitals found</Text>
                    <Text style={modal.emptySubtext}>
                      You need to have had a previous visit at a hospital before
                      you can request an appointment.
                    </Text>
                  </View>
                ) : (
                  institutions.map((inst) => {
                    const isSelected = selectedInst?.id === inst.id;
                    return (
                      <TouchableOpacity
                        key={inst.id}
                        style={[
                          modal.institutionRow,
                          isSelected && modal.institutionRowSelected,
                        ]}
                        onPress={() => setSelectedInst(inst)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            modal.instIconWrap,
                            {
                              backgroundColor: isSelected
                                ? C.primaryGhost
                                : C.bgAlt,
                            },
                          ]}
                        >
                          <MaterialIcons
                            name="local-hospital"
                            size={20}
                            color={isSelected ? C.primary : C.inkMuted}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              modal.instName,
                              isSelected && { color: C.primaryDark },
                            ]}
                          >
                            {inst.institutionName}
                          </Text>
                          <Text style={modal.instMeta}>
                            {inst.institutionType} · {inst.visitCount} past
                            visit{inst.visitCount !== 1 ? "s" : ""}
                            {inst.lastVisitDate
                              ? ` · Last: ${fmtDate(inst.lastVisitDate)}`
                              : ""}
                          </Text>
                        </View>
                        {isSelected && (
                          <MaterialIcons
                            name="check-circle"
                            size={20}
                            color={C.primary}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}

                {selectedInst && (
                  <TouchableOpacity
                    style={modal.nextBtn}
                    onPress={() => setStep(2)}
                    activeOpacity={0.9}
                  >
                    <Text style={modal.nextBtnText}>Continue</Text>
                    <MaterialIcons
                      name="arrow-forward"
                      size={16}
                      color="#fff"
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Step 2: Details ── */}
            {step === 2 && (
              <View>
                <View style={modal.selectedInstBox}>
                  <MaterialIcons
                    name="local-hospital"
                    size={16}
                    color={C.primary}
                  />
                  <Text style={modal.selectedInstText}>
                    {selectedInst?.institutionName}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setStep(1)}
                    style={{ marginLeft: "auto" }}
                  >
                    <Text style={modal.changeText}>Change</Text>
                  </TouchableOpacity>
                </View>

                <Text style={modal.sectionLabel}>Preferred Date & Time</Text>
                <TouchableOpacity
                  style={modal.dateBtn}
                  onPress={openDatePicker}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="event" size={18} color={C.primary} />
                  <Text style={modal.dateBtnText}>
                    {fmtDateTime(preferredDate.toISOString())}
                  </Text>
                  <MaterialIcons
                    name="edit"
                    size={14}
                    color={C.inkMuted}
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>
                <Text style={modal.helperText}>
                  Tap to pick date, then time
                </Text>

                {/* Single picker that switches between date and time mode */}
                {pickerMode !== null && (
                  <DateTimePicker
                    value={preferredDate}
                    mode={pickerMode}
                    is24Hour={false}
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={pickerMode === "date" ? new Date() : undefined}
                    onChange={handlePickerChange}
                  />
                )}

                <Text style={modal.sectionLabel}>
                  Department <Text style={modal.optionalTag}>(optional)</Text>
                </Text>
                <TouchableOpacity
                  style={modal.deptBtn}
                  onPress={() => setShowDeptPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      modal.deptBtnText,
                      !department && { color: C.inkMuted },
                    ]}
                  >
                    {department || "Select department…"}
                  </Text>
                  <MaterialIcons
                    name="chevron-right"
                    size={18}
                    color={C.inkSubtle}
                  />
                </TouchableOpacity>

                {showDeptPicker && (
                  <View style={modal.deptList}>
                    <TouchableOpacity
                      style={modal.deptItem}
                      onPress={() => {
                        setDepartment("");
                        setShowDeptPicker(false);
                      }}
                    >
                      <Text style={[modal.deptItemText, { color: C.inkMuted }]}>
                        No preference
                      </Text>
                    </TouchableOpacity>
                    {DEPARTMENTS.map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[
                          modal.deptItem,
                          department === d && modal.deptItemSelected,
                        ]}
                        onPress={() => {
                          setDepartment(d);
                          setShowDeptPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            modal.deptItemText,
                            department === d && {
                              color: C.primaryDark,
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {d}
                        </Text>
                        {department === d && (
                          <MaterialIcons
                            name="check"
                            size={14}
                            color={C.primary}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={modal.sectionLabel}>Priority</Text>
                <View style={modal.priorityRow}>
                  {(["routine", "urgent"] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        modal.priorityBtn,
                        priority === p && modal.priorityBtnActive,
                      ]}
                      onPress={() => setPriority(p)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          modal.priorityBtnText,
                          priority === p && modal.priorityBtnTextActive,
                        ]}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {priority === "urgent" && (
                  <View style={modal.urgentNote}>
                    <MaterialIcons name="info" size={14} color={C.amber} />
                    <Text style={modal.urgentNoteText}>
                      Mark urgent only if you need to be seen soon. The hospital
                      will prioritise accordingly.
                    </Text>
                  </View>
                )}

                <Text style={modal.sectionLabel}>Reason for Visit *</Text>
                <TextInput
                  style={modal.textarea}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Describe your symptoms or reason for the appointment…"
                  placeholderTextColor={C.inkMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <Text style={modal.charCount}>{reason.length} / 500</Text>

                <TouchableOpacity
                  style={[modal.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.9}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={modal.submitBtnText}>Submit Request</Text>
                      <MaterialIcons name="send" size={16} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>

                <Text style={modal.disclaimer}>
                  This is a request, not a confirmed booking. The hospital
                  receptionist will confirm your date and time.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  const load = useCallback(async () => {
    try {
      const res = await getMyAppointments();
      setAppointments(res.data?.data?.appointments ?? []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCancel = (id: string) => {
    Alert.alert(
      "Cancel Appointment",
      "Are you sure you want to cancel this appointment request?",
      [
        { text: "Keep It", style: "cancel" },
        {
          text: "Cancel It",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelAppointmentRequest(id);
              Toast.show({ type: "success", text1: "Appointment cancelled" });
              load();
            } catch (err: any) {
              Toast.show({
                type: "error",
                text1: "Error",
                text2: err.response?.data?.error?.message ?? "Could not cancel",
              });
            }
          },
        },
      ],
    );
  };

  const now = new Date();
  const filtered = appointments.filter((a) => {
    const date = new Date(a.admissionDate);
    if (filter === "upcoming") return date >= now && a.status !== "cancelled";
    if (filter === "past")
      return date < now || a.status === "completed" || a.status === "cancelled";
    return true;
  });

  const upcomingCount = appointments.filter(
    (a) => new Date(a.admissionDate) >= now && a.status !== "cancelled",
  ).length;

  if (loading) return <LoadingSpinner message="Loading appointments…" />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Appointments</Text>
            <Text style={styles.subgreeting}>
              {upcomingCount > 0
                ? `${upcomingCount} upcoming`
                : "No upcoming appointments"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => setShowModal(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.newBtnText}>Request</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {(
            [
              { key: "upcoming", label: "Upcoming" },
              { key: "past", label: "Past" },
              { key: "all", label: "All" },
            ] as const
          ).map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.tab, filter === f.key && styles.tabActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  filter === f.key && styles.tabTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="event" size={36} color={C.primary} />
            </View>
            <Text style={styles.emptyTitle}>No appointments</Text>
            <Text style={styles.emptyBody}>
              {filter === "upcoming"
                ? "No upcoming appointments. Tap Request to book at a hospital."
                : "No appointments in this category."}
            </Text>
            {filter === "upcoming" && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setShowModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>Request Appointment</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <AppointmentCard item={item} onCancel={handleCancel} />
        )}
      />

      <RequestModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={() => {
          setShowModal(false);
          load();
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  headerBar: { paddingHorizontal: 20, paddingBottom: 16 },
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
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  newBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  tabRow: {
    flexDirection: "row",
    backgroundColor: C.bgAlt,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 9 },
  tabActive: { backgroundColor: C.ink },
  tabText: { fontSize: 13, fontWeight: "700", color: C.inkSoft },
  tabTextActive: { color: "#fff" },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110 },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  visitNumRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  visitNum: {
    fontSize: 11,
    fontWeight: "700",
    color: C.inkMuted,
    letterSpacing: 0.3,
    fontFamily: Platform.OS === "android" ? "monospace" : "Courier",
  },
  requestTag: {
    backgroundColor: C.primaryGhost,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  requestTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: C.primaryDark,
    letterSpacing: 0.3,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
  institutionName: {
    fontSize: 16,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  reason: {
    fontSize: 13,
    color: C.inkSoft,
    fontWeight: "500",
    lineHeight: 19,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: C.inkMuted, fontWeight: "500" },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.inkSubtle,
  },
  deptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  deptText: { fontSize: 12, color: C.primaryDark, fontWeight: "600" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  priorityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "capitalize",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.coralLight,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cancelBtnText: { fontSize: 11, fontWeight: "700", color: C.coral },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
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
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: C.ink,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.1,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10,14,26,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "93%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.cardBorder,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: C.inkMuted, marginTop: 2, fontWeight: "500" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.bgAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: C.inkSoft,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  sectionSub: {
    fontSize: 13,
    color: C.inkMuted,
    fontWeight: "500",
    marginBottom: 12,
    marginTop: -4,
    lineHeight: 19,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: "500",
    color: C.inkMuted,
    textTransform: "none",
    letterSpacing: 0,
  },
  loadingWrap: { paddingVertical: 40, alignItems: "center" },
  emptyWrap: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "700", color: C.ink },
  emptySubtext: {
    fontSize: 13,
    color: C.inkMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  institutionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 8,
    backgroundColor: C.card,
  },
  institutionRowSelected: {
    borderColor: C.primaryLight,
    backgroundColor: C.primaryGhost,
  },
  instIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  instName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.2,
  },
  instMeta: {
    fontSize: 12,
    color: C.inkMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.ink,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.1,
  },
  selectedInstBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primaryGhost,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primaryLight,
    marginTop: 4,
  },
  selectedInstText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.primaryDark,
    flex: 1,
  },
  changeText: { fontSize: 12, fontWeight: "700", color: C.primary },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    padding: 14,
  },
  dateBtnText: { fontSize: 14, fontWeight: "600", color: C.ink, flex: 1 },
  helperText: {
    fontSize: 11,
    color: C.inkMuted,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: "500",
  },
  deptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    padding: 14,
  },
  deptBtnText: { fontSize: 14, fontWeight: "600", color: C.ink },
  deptList: {
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 4,
    backgroundColor: C.card,
  },
  deptItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  deptItemSelected: { backgroundColor: C.primaryGhost },
  deptItemText: { fontSize: 14, color: C.ink, fontWeight: "500" },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    backgroundColor: C.bg,
  },
  priorityBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
  priorityBtnText: { fontSize: 13, fontWeight: "700", color: C.inkSoft },
  priorityBtnTextActive: { color: "#fff" },
  urgentNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.amberLight,
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  urgentNoteText: {
    fontSize: 12,
    color: "#92400E",
    flex: 1,
    lineHeight: 18,
    fontWeight: "500",
  },
  textarea: {
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.bg,
    minHeight: 100,
    fontWeight: "500",
  },
  charCount: {
    fontSize: 11,
    color: C.inkMuted,
    textAlign: "right",
    marginTop: 4,
    fontWeight: "500",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.ink,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.1,
  },
  disclaimer: {
    fontSize: 12,
    color: C.inkMuted,
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 12,
    marginBottom: 8,
  },
});
