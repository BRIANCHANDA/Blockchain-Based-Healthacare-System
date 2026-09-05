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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const PIN_KEY = "sensitive_records_pin";
const PIN_LEN = 6;

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

// ── PIN dot display ───────────────────────────────────────────────────────────
function PinDots({ value, total = PIN_LEN }: { value: string; total?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, justifyContent: "center", marginVertical: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: i < value.length ? C.amber : "transparent",
            borderWidth: 2,
            borderColor: i < value.length ? C.amber : C.inkMuted,
          }}
        />
      ))}
    </View>
  );
}

// ── Numeric keypad ────────────────────────────────────────────────────────────
function Keypad({ onPress, onDelete }: { onPress: (d: string) => void; onDelete: () => void }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", width: 240, alignSelf: "center", gap: 10 }}>
      {keys.map((k, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => k === "⌫" ? onDelete() : k !== "" ? onPress(k) : undefined}
          disabled={k === ""}
          style={{
            width: 68, height: 54, borderRadius: 12,
            backgroundColor: k === "" ? "transparent" : C.card,
            borderWidth: k === "" ? 0 : 1,
            borderColor: C.cardBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={0.6}
        >
          <Text style={{ fontSize: k === "⌫" ? 18 : 20, fontWeight: "700", color: C.ink }}>
            {k}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── PIN entry/setup screen ────────────────────────────────────────────────────
function PinScreen({
  mode,
  onSuccess,
  onBack,
}: {
  mode: "entry" | "setup";
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [pin, setPin]           = useState("");
  const [confirm, setConfirm]   = useState("");
  const [step, setStep]         = useState<"enter" | "confirm">("enter");
  const [error, setError]       = useState("");
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked]     = useState(false);

  const press = (d: string) => {
    if (locked) return;
    if (step === "enter" && pin.length < PIN_LEN) {
      setPin(p => p + d);
      setError("");
    } else if (step === "confirm" && confirm.length < PIN_LEN) {
      setConfirm(c => c + d);
      setError("");
    }
  };

  const del = () => {
    if (locked) return;
    if (step === "confirm") setConfirm(c => c.slice(0, -1));
    else setPin(p => p.slice(0, -1));
  };

  // Auto-submit when full
  useEffect(() => {
    if (mode === "setup") {
      if (step === "enter" && pin.length === PIN_LEN) {
        setTimeout(() => setStep("confirm"), 150);
      } else if (step === "confirm" && confirm.length === PIN_LEN) {
        if (confirm === pin) {
          AsyncStorage.setItem(PIN_KEY, pin).then(onSuccess);
        } else {
          setError("PINs don't match. Try again.");
          setConfirm("");
        }
      }
    } else {
      if (pin.length === PIN_LEN) {
        AsyncStorage.getItem(PIN_KEY).then((stored) => {
          if (pin === stored) {
            onSuccess();
          } else {
            const next = attempts + 1;
            setAttempts(next);
            setPin("");
            if (next >= 5) {
              setLocked(true);
              setError("Too many attempts. Wait 30 seconds.");
              setTimeout(() => {
                setLocked(false);
                setAttempts(0);
                setError("");
              }, 30000);
            } else {
              setError(`Incorrect PIN (${5 - next} attempt${5 - next === 1 ? "" : "s"} left)`);
            }
          }
        });
      }
    }
  }, [pin, confirm]);

  const title = mode === "setup"
    ? (step === "enter" ? "Create a security PIN" : "Confirm your PIN")
    : "Enter your PIN";
  const subtitle = mode === "setup"
    ? (step === "enter"
        ? `Choose a ${PIN_LEN}-digit PIN to secure sensitive records`
        : "Re-enter the same PIN to confirm")
    : `Enter your ${PIN_LEN}-digit security PIN`;

  const current = step === "confirm" ? confirm : pin;

  return (
    <View style={styles.lockContainer}>
      <View style={styles.lockIconWrap}>
        <MaterialIcons name="lock" size={40} color={C.amber} />
      </View>
      <Text style={styles.lockTitle}>{title}</Text>
      <Text style={[styles.lockBody, { marginBottom: 0 }]}>{subtitle}</Text>

      <PinDots value={current} />

      {error ? (
        <View style={[styles.errorBox, { marginBottom: 14 }]}>
          <MaterialIcons name="error-outline" size={16} color={C.coral} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Keypad onPress={press} onDelete={del} />

      <TouchableOpacity onPress={onBack} style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 13, color: C.inkMuted, fontWeight: "600" }}>
          ← Back
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Biometric lock screen ─────────────────────────────────────────────────────
function LockScreen({
  onBiometric,
  onPin,
  error,
  checking,
  hasBiometric,
}: {
  onBiometric: () => void;
  onPin: () => void;
  error?: string;
  checking: boolean;
  hasBiometric: boolean;
}) {
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

      {hasBiometric && (
        <TouchableOpacity
          style={[styles.unlockBtn, checking && styles.unlockBtnDisabled]}
          onPress={onBiometric}
          disabled={checking}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={checking ? "hourglass-top" : "fingerprint"}
            size={20}
            color="#fff"
          />
          <Text style={styles.unlockBtnText}>
            {checking ? "Verifying…" : "Use Biometrics"}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.pinBtn, checking && { opacity: 0.5 }]}
        onPress={onPin}
        disabled={checking}
        activeOpacity={0.8}
      >
        <MaterialIcons name="pin" size={18} color={C.amber} />
        <Text style={styles.pinBtnText}>Use PIN instead</Text>
      </TouchableOpacity>

      <Text style={styles.lockFootnote}>
        {hasBiometric
          ? "Fingerprint, Face ID or PIN"
          : "Enter your security PIN"}
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
      <View style={styles.cardHeader}>
        <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
          <MaterialIcons name={cat.icon as any} size={13} color={cat.color} />
          <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.conditionText}>{record.condition}</Text>
      {record.notes ? <Text style={styles.notesText}>{record.notes}</Text> : null}
      <View style={styles.cardFooter}>
        {record.diagnosedDate ? (
          <Text style={styles.dateText}>Diagnosed: {formatDate(record.diagnosedDate)}</Text>
        ) : null}
        <Text style={styles.dateText}>Recorded: {formatDate(record.createdAt)}</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
type Screen = "lock" | "pin-entry" | "pin-setup";

export default function SensitiveRecordsScreen() {
  const [screen, setScreen]     = useState<Screen>("lock");
  const [checking, setChecking] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const [hasBiometric, setHasBiometric] = useState(false);
  const [hasPin, setHasPin]     = useState(false);
  const [records, setRecords]   = useState<SensitiveRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  // Check biometric capability and PIN existence on mount
  useEffect(() => {
    (async () => {
      if (LocalAuthentication) {
        const [hw, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        setHasBiometric(hw && enrolled);
      }
      const stored = await AsyncStorage.getItem(PIN_KEY);
      setHasPin(!!stored);
    })();
  }, []);

  // Lock when app is backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appState.current === "active" && (next === "inactive" || next === "background")) {
        setUnlocked(false);
        setRecords([]);
        setScreen("lock");
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const fetchAndUnlock = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMySensitiveRecords();
      setRecords(res.data?.data ?? []);
      // Unlock only on success. This previously sat in a `finally`, so a network
      // failure showed the unlocked screen with an empty list — indistinguishable
      // from "you have no sensitive records on file", which on this screen is a
      // materially different and misleading statement.
      setUnlocked(true);
    } catch {
      setRecords([]);
      setAuthError("Could not load your records. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const tryBiometric = useCallback(async () => {
    if (!LocalAuthentication) {
      // FAIL CLOSED. This previously called fetchAndUnlock(), which meant that
      // when the native module was unavailable the screen opened HIV status,
      // mental-health and reproductive records with no authentication at all.
      // On this screen the absence of one factor must fall back to the other,
      // never to open access.
      setAuthError("Biometrics unavailable on this device. Use your PIN.");
      setScreen(hasPin ? "pin-entry" : "pin-setup");
      return;
    }
    setChecking(true);
    setAuthError(undefined);
    try {
      // No timeout here, deliberately.
      //
      // This used to race authenticateAsync against a 5-second timer. But that
      // call opens the system biometric dialog and then waits for a HUMAN — and
      // nobody notices a prompt, picks the phone up and positions a finger in
      // under five seconds reliably. When the timer won, the screen jumped to
      // PIN entry while the fingerprint dialog was still open, and the user's
      // eventual success was discarded because the race had already resolved.
      // That is why biometric unlock appeared never to work.
      //
      // authenticateAsync resolves on its own: success, user_cancel when
      // dismissed, or lockout after too many attempts. Every outcome is handled
      // below, so there is nothing left for a timeout to rescue.
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         "Verify your identity",
        fallbackLabel:         "Use Phone PIN",
        disableDeviceFallback: false,
      });

      if (result.success) {
        await fetchAndUnlock();
      } else if (result.error === "user_cancel" || result.error === "app_cancel") {
        // User dismissed — do nothing, stay on lock screen
      } else if (result.error === "lockout") {
        // The OS has locked biometrics after too many failed attempts.
        // ("lockout_permanent" was also tested here, but it is not one of the
        //  codes expo-local-authentication can return — that branch was dead.)
        setAuthError("Too many attempts. Use your PIN.");
        setScreen(hasPin ? "pin-entry" : "pin-setup");
      } else if (result.error === "not_enrolled" || result.error === "not_available") {
        // No fingerprint registered on the device, or no sensor.
        setAuthError("No biometrics set up on this device. Use your PIN.");
        setScreen(hasPin ? "pin-entry" : "pin-setup");
      } else {
        // Includes "timeout", which the library itself reports if the prompt
        // goes unanswered — distinct from the artificial 5-second race that
        // used to cut the user off mid-authentication.
        setAuthError(`Biometric failed (${result.error}). Use your PIN.`);
        setScreen(hasPin ? "pin-entry" : "pin-setup");
      }
    } catch (e: any) {
      setAuthError("Biometric error. Use your PIN.");
      setScreen(hasPin ? "pin-entry" : "pin-setup");
    } finally {
      setChecking(false);
    }
  }, [fetchAndUnlock, hasPin]);

  const goPin = useCallback(() => {
    setAuthError(undefined);
    setScreen(hasPin ? "pin-entry" : "pin-setup");
  }, [hasPin]);

  const onPinSuccess = useCallback(async () => {
    setHasPin(true);
    await fetchAndUnlock();
  }, [fetchAndUnlock]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAndUnlock();
    setRefreshing(false);
  };

  // ── PIN screens ──
  if (!unlocked && screen === "pin-entry") {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <PinScreen mode="entry" onSuccess={onPinSuccess} onBack={() => setScreen("lock")} />
      </View>
    );
  }

  if (!unlocked && screen === "pin-setup") {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <PinScreen mode="setup" onSuccess={onPinSuccess} onBack={() => setScreen("lock")} />
      </View>
    );
  }

  // ── Lock screen ──
  if (!unlocked) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <LockScreen
          onBiometric={tryBiometric}
          onPin={goPin}
          error={authError}
          checking={checking}
          hasBiometric={hasBiometric}
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.brand]} tintColor={C.brand} />
        }
      >
        <View style={styles.banner}>
          <MaterialIcons name="lock" size={15} color={C.lock} />
          <Text style={styles.bannerText}>
            Strictly confidential · Only you and your treating doctors can see this
          </Text>
        </View>
        <TouchableOpacity
          style={styles.relockBtn}
          onPress={() => { setUnlocked(false); setRecords([]); setScreen("lock"); }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="lock" size={14} color={C.inkMuted} />
          <Text style={styles.relockText}>Lock</Text>
        </TouchableOpacity>
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
            {records.map((r) => <RecordCard key={r.id} record={r} />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  lockContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  lockIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.amberTint,
    borderWidth: 2,
    borderColor: C.amberBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  lockBody: {
    fontSize: 14,
    color: C.inkSoft,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.coralTint,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
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
    paddingVertical: 14,
    marginBottom: 10,
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
  pinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginBottom: 14,
    width: "100%",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.amberBorder,
    backgroundColor: C.amberTint,
  },
  pinBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.amber,
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
  catText: { fontSize: 11, fontWeight: "700" },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
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
