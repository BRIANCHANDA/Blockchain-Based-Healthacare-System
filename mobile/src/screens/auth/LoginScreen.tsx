import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Input from "../../components/common/Input";
import { loginPatient } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { AuthStackParamList } from "../../types";

// Zambian NRC format: 123456/78/1
function formatNRC(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}/${digits.slice(6)}`;
  return `${digits.slice(0, 6)}/${digits.slice(6, 8)}/${digits.slice(8)}`;
}

const schema = z.object({
  nationalId: z
    .string()
    .regex(/^\d{6}\/\d{2}\/\d{1,2}$/, "Format: 123456/78/1"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

// ── Design tokens (DS) ───────────────────────────────────────────────────────
const C = {
  brand: "#059669",
  brandDeep: "#047857",
  brandTint: "#ECFDF5",
  brandFill: "#D1FAE5",
  ink: "#0A0E1A",
  inkSoft: "#4B5563",
  inkMuted: "#9CA3AF",
  bg: "#FAFAFB",
  card: "#FFFFFF",
  cardBorder: "#E5E7EB",
  critical: "#FF5757",
};

export default function LoginScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const insets = useSafeAreaInsets();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await loginPatient(data.nationalId, data.password);
      if (res.success) {
        const user = { ...res.data.user, type: "patient" as const };
        await setAuth(res.data.token, user);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ??
        "Invalid credentials. Please try again.";
      Toast.show({ type: "error", text1: "Sign-in failed", text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.card }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo + wordmark ── */}
          <View style={styles.brandBlock}>
            <View style={styles.logoWrap}>
              <View style={styles.logoBox}>
                <MaterialIcons
                  name="health-and-safety"
                  size={36}
                  color={C.brand}
                />
              </View>
            </View>
            <Text style={styles.wordmark}>
              Med<Text style={{ color: C.brand }}>Link</Text>
            </Text>
            <Text style={styles.tagline}>
              Your medical records, owned by you and unlocked only with your
              permission.
            </Text>
          </View>

          {/* ── Form ── */}
          <View style={styles.formWrap}>
            <Controller
              control={control}
              name="nationalId"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="National ID (NRC)"
                  placeholder="123456/78/1"
                  value={value}
                  onChangeText={(text) => onChange(formatNRC(text))}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  error={errors.nationalId?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry
                  secureToggle
                  error={errors.password?.message}
                />
              )}
            />

            <View style={styles.forgotRow}>
              <Pressable>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>

            {/* Primary CTA — brand green per DS */}
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
              style={({ pressed }) => [
                styles.signInBtn,
                pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
                loading && { opacity: 0.6 },
              ]}
            >
              {loading ? (
                <MaterialIcons name="autorenew" size={20} color="#fff" />
              ) : null}
              <Text style={styles.signInText}>
                {loading ? "Signing in…" : "Sign in"}
              </Text>
            </Pressable>
          </View>

          <View style={{ flex: 1 }} />

          {/* ── Trust badges ── */}
          <View style={styles.trustRow}>
            <View style={styles.trustChip}>
              <MaterialIcons name="lock" size={12} color={C.brand} />
              <Text style={styles.trustText}>MedLink-secured</Text>
            </View>
            <View style={styles.trustChip}>
              <MaterialIcons name="verified-user" size={12} color={C.brand} />
              <Text style={styles.trustText}>End-to-end encrypted</Text>
            </View>
          </View>

          <Text style={styles.footer}>MedLink · Zambia · v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // ── Brand block ──
  brandBlock: {
    alignItems: "center",
    textAlign: "center",
    paddingTop: 8,
    paddingBottom: 40,
  },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoBox: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 30,
    fontWeight: "600",
    color: "#0A0E1A",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },

  // ── Form ──
  formWrap: {
    gap: 4,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginTop: -2,
    marginBottom: 4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },

  // ── CTA button — brand green per DS ──
  signInBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#059669",
    paddingVertical: 17,
    borderRadius: 14,
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#059669",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  signInText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.1,
  },

  // ── Trust ──
  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 36,
    flexWrap: "wrap",
  },
  trustChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  trustText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
    letterSpacing: 0.1,
  },

  // ── Footer ──
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
    marginTop: 16,
  },
});
