import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  RefreshControl,
  StatusBar,
} from "react-native";
let LocalAuthentication: typeof import("expo-local-authentication") | null = null;
try { LocalAuthentication = require("expo-local-authentication"); } catch { /* native module not available */ }
import { MaterialIcons } from "@expo/vector-icons";
import { getMySensitiveRecords } from "../../api/patient";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import type { SensitiveRecord } from "../../types";

// ── DS tokens ─────────────────────────────────────────────────────────────────
const C = {
  brand:       "#059669",
  brandTint:   "#ECFDF5",
  amber:       "#F59E0B",
  amberTint:   "#FFFBEB",
  amberBorder: "#FDE68A",
  coral:       "#EF4444",
  coralTint:   "#FEF2F2",
  violet:      "#8B5CF6",
  violetTint:  "#EDE9FE",
  blue:        "#3B82F6",
  blueTint:    "#DBEAFE",
  ink:         "#0A0E1A",
  inkSoft:     "#4B5563",
  inkMuted:    "#9CA3AF",
  bg:          "#FAFAFB",
  card:        "#FFFFFF",
  cardBorder:  "#E5E7EB",
  lock:        "#92400E",
  lockBg:      "#FEF3C7",
  lockBorder:  "#FDE68A",
};

// ── Category display config ───────────────────────────────────────────────────
const CATEGORY_META: Record<
  SensitiveRecord["category"],
  { label: string; icon: string; color: string; bg: string }
> = {
  infectious_disease: { label: "Infectious Disease", icon: "coronavirus",     color: C.coral,  bg: C.coralTint  },
  mental_health:      { label: "Mental Health",       icon: "psychology",      color: C.violet, bg: C.violetTint },
  reproductive:       { label: "Reproductive Health", icon: "pregnant-woman",  color: C.brand,  bg: C.brandTint  },
  genetic:            { label: "Genetic",             icon: "biotech",         color: C.blue,   bg: C.blueTint   },
  substance_use:      { label: "Substance Use",       icon: "warning",         color: C.amber,  bg: C.amberTint  },
  other:              { label: "Other",               icon: "info",            color: C.inkMuted, bg: C.bg       },
};

const STATUS_META: Record<
  SensitiveRecord["status"],
  { label: string; color: string; bg: string }
> = {
  positive:  { label: "Positive",  color: C.coral,   bg: C.coralTint  },
  negative:  { label: "Negative",  color: C.brand,   bg: C.brandTint  },
  carrier:   { label: "Carrier",   color: C.amber,   bg: C.amberTint  },
  resolved:  { label: "Resolved",  color: C.brand,   bg: C.brandTint  },
  active:    { label: "Active",    color: C.coral,   bg: C.coralTint  },
  unknown:   { label: "Unknown",   color: C.inkMuted, bg: C.bg        },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Biometric lock screen ─────────────────────────────────────────────────────
interface LockScreenProps {
  onUnlock: () => void;
  error?: string;
  checking: boolean;
}
function LockScreen({ onUnlock, error, checking }: LockScreenProps) {
  return (
    <View style={styles.lockContainer}>
      <View style={styles.lockIconWrap}>
        <MaterialIcons name="fingerprint" size={72} color={C.amber} />
      </View>
      <Text style={styles.lockTitle}>Sensitive Records</Text>
      <Text style={styles.lockBody}>
        This section contains confidential medical information.{"\n"}
        Verify your identity to continue.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={16} color={C.coral} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.unlockBtn, checking && styles.unlockBtnDisabled]}
        onPress={onUnlock}
        disabled={checking}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name={checking ? "hourglass-top" : "lock-open"}
          size={20}
          color="#fff"
        />
        <Text style={styles.unlockBtnText}>
          {checking ? "Verifying…" : "Unlock with Biometrics"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.lockFootnote}>
        Use Face ID, fingerprint, or device PIN
      </Text>
    </View>
  );
}

// ── Record card ───────────────────────────────────────────────────────────────
function RecordCard({ record }: { record: SensitiveRecord }) {
  const cat    = CATEGORY_META[record.category];
  const status = STATUS_META[record.status];

  return (
    <View style={[styles.card, { borderLeftColor: cat.color, borderLeftWidth: 4 }]}>
      {/* Category row */}
      <View style={styles.cardHeader}>
        <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
          <MaterialIcons name={cat.icon as any} size={13} color={cat.color} />
          <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Condition */}
      <Text style={styles.conditionText}>{record.condition}</Text>

      {/* Notes */}
      {record.notes ? (
        <Text style={styles.notesText}>{record.notes}</Text>
      ) : null}

      {/* Footer dates */}
      <View style={styles.cardFooter}>
        {record.diagnosedDate ? (
          <Text style={styles.dateText}>
            Diagnosed: {formatDate(record.diagnosedDate)}
          </Text>
        ) : null}
        <Text style={styles.dateText}>
          Recorded: {formatDate(record.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SensitiveRecordsScreen() {
  const [unlocked, setUnlocked]     = useState(false);
  const [checking, setChecking]     = useState(false);
  const [authError, setAuthError]   = useState<string | undefined>();
  const [records, setRecords]       = useState<SensitiveRecord[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const appState = useRef(AppState.currentState);

  // Lock when app is backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (
        appState.current === "active" &&
        (next === "inactive" || next === "background")
      ) {
        setUnlocked(false);
        setRecords([]);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await getMySensitiveRecords();
      setRecords(res.data?.data ?? []);
    } catch {
      setRecords([]);
    }
  }, []);

  const authenticate = useCallback(async () => {
    setChecking(true);
    setAuthError(undefined);
    try {
      if (!LocalAuthentication) {
        setAuthError("Biometric authentication is not available in this build.");
        setChecking(false);
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setAuthError(
          "No biometrics enrolled on this device. Please set up Face ID or fingerprint in your phone's Settings first."
        );
        setChecking(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:           "Verify your identity to view sensitive records",
        fallbackLabel:           "Use PIN",
        disableDeviceFallback:   false,
        cancelLabel:             "Cancel",
      });

      if (result.success) {
        setUnlocked(true);
        setLoading(true);
        await fetchRecords();
        setLoading(false);
      } else {
        const msg =
          result.error === "user_cancel"   ? "Authentication cancelled."
          : result.error === "lockout"     ? "Too many attempts. Try again later."
          : result.error === "lockout_permanent" ? "Biometrics locked. Use your PIN."
          : "Authentication failed. Please try again.";
        setAuthError(msg);
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  }, [fetchRecords]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecords();
    setRefreshing(false);
  };

  // ── Lock screen ──
  if (!unlocked) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <LockScreen
          onUnlock={authenticate}
          error={authError}
          checking={checking}
        />
      </View>
    );
  }

  // ── Loading after auth ──
  if (loading) {
    return <LoadingSpinner message="Loading your records…" />;
  }

  // ── Unlocked: records view ──
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.brand]}
            tintColor={C.brand}
          />
        }
      >
        {/* Confidentiality banner */}
        <View style={styles.banner}>
          <MaterialIcons name="lock" size={15} color={C.lock} />
          <Text style={styles.bannerText}>
            Strictly confidential · Only you and your treating doctors can see this
          </Text>
        </View>

        {/* Re-lock button */}
        <TouchableOpacity
          style={styles.relockBtn}
          onPress={() => { setUnlocked(false); setRecords([]); }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="lock" size={14} color={C.inkMuted} />
          <Text style={styles.relockText}>Lock</Text>
        </TouchableOpacity>

        {/* Records */}
        {records.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="shield" size={36} color={C.inkMuted} />
            <Text style={styles.emptyTitle}>No sensitive records</Text>
            <Text style={styles.emptyBody}>
              Your doctor will add information here when relevant to your care.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.countLabel}>
              {records.length} record{records.length !== 1 ? "s" : ""}
            </Text>
            {records.map((r) => (
              <RecordCard key={r.id} record={r} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Lock screen
  lockContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  lockIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: C.amberTint,
    borderWidth: 2,
    borderColor: C.amberBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  lockBody: {
    fontSize: 14,
    color: C.inkSoft,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.coralTint,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    width: "100%",
  },
  errorText: {
    fontSize: 13,
    color: C.coral,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 15,
    marginBottom: 14,
    width: "100%",
    justifyContent: "center",
  },
  unlockBtnDisabled: { opacity: 0.6 },
  unlockBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.1,
  },
  lockFootnote: {
    fontSize: 12,
    color: C.inkMuted,
    fontWeight: "500",
  },

  // Unlocked header
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.lockBg,
    borderWidth: 1,
    borderColor: C.lockBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  bannerText: {
    fontSize: 12,
    color: C.lock,
    fontWeight: "600",
    flex: 1,
    lineHeight: 17,
  },
  relockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.card,
    marginBottom: 16,
  },
  relockText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.inkMuted,
  },
  countLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Record card
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 1,
  },
  catText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  conditionText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: C.inkSoft,
    lineHeight: 19,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: "row",
    gap: 14,
    marginTop: 4,
    flexWrap: "wrap",
  },
  dateText: {
    fontSize: 11,
    color: C.inkMuted,
    fontWeight: "500",
  },

  // Empty
  empty: {
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 36,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.ink,
    marginTop: 10,
  },
  emptyBody: {
    fontSize: 13,
    color: C.inkSoft,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 19,
  },
});
