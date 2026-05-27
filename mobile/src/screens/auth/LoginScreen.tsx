import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Pressable,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import { LinearGradient } from "expo-linear-gradient";

import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { loginPatient } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { AuthStackParamList } from "../../types";

const { width } = Dimensions.get("window");

const schema = z.object({
  nationalId: z.string().min(4, "Enter your National ID"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  // Core
  ink: "#1A1D2E",
  inkSoft: "#5A5F7A",
  inkMuted: "#9498B3",
  // Brand
  teal: "#0D9488",
  tealDark: "#0F766E",
  tealLight: "#CCFBF1",
  tealGhost: "#F0FDFA",
  // Accent
  amber: "#F59E0B",
  coral: "#F87171",
  // Surface
  bg: "#F8F9FC",
  card: "#FFFFFF",
  cardBorder: "#E8EAF0",
  // Input
  inputBg: "#F4F5F9",
  inputBorder: "#DFE1EA",
  inputFocus: "#0D9488",
};

export default function LoginScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

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
        "Login failed. Check your credentials.";
      Toast.show({ type: "error", text1: "Login Failed", text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Top visual ── */}
        <LinearGradient
          colors={["#0F766E", "#0D9488", "#14B8A6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative circles */}
          <View style={[styles.deco, styles.deco1]} />
          <View style={[styles.deco, styles.deco2]} />
          <View style={[styles.deco, styles.deco3]} />

          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoPlus}>+</Text>
            </View>
          </View>
          <Text style={styles.brand}>MedLink</Text>
          <View style={styles.countryPill}>
            <View style={styles.countryDot} />
            <Text style={styles.countryText}>ZAMBIA</Text>
          </View>
          <Text style={styles.tagline}>
            Your health records, secured on MedLink
          </Text>
        </LinearGradient>

        {/* ── Form card ── */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSub}>
            Sign in to access your medical records
          </Text>

          <Controller
            control={control}
            name="nationalId"
            render={({ field: { onChange, value } }) => (
              <Input
                label="National ID"
                placeholder="e.g. 123456/78/9"
                value={value}
                onChangeText={onChange}
                autoCapitalize="characters"
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

          {/* Sign in button */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            style={({ pressed }) => [
              styles.signInBtn,
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
              loading && { opacity: 0.7 },
            ]}
          >
            <LinearGradient
              colors={["#0F766E", "#0D9488"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signInGradient}
            >
              <Text style={styles.signInText}>
                {loading ? "Signing in…" : "Sign In"}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Secured by MedLink Security</Text>
            <View style={styles.dividerLine} />
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          MedLink © {new Date().getFullYear()} · Zambia
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    backgroundColor: C.bg,
  },

  // ── Hero ──
  hero: {
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingBottom: 48,
    alignItems: "center",
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  deco: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  deco1: { width: 200, height: 200, top: -60, right: -40 },
  deco2: { width: 140, height: 140, bottom: -30, left: -30 },
  deco3: {
    width: 80,
    height: 80,
    top: 40,
    left: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  logoWrap: { marginBottom: 14 },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlus: {
    fontSize: 32,
    fontWeight: "300",
    color: "#fff",
    marginTop: -2,
  },
  brand: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.6,
  },
  countryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  countryDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#6FCF97",
  },
  countryText: {
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginTop: 10,
    fontWeight: "500",
  },

  // ── Form card ──
  formCard: {
    backgroundColor: C.card,
    marginHorizontal: 20,
    marginTop: -24,
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#0D1F17",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: { elevation: 6 },
    }),
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.4,
  },
  formSub: {
    fontSize: 13,
    color: C.inkSoft,
    marginTop: 4,
    marginBottom: 24,
  },

  // ── Button ──
  signInBtn: {
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
  },
  signInGradient: {
    paddingVertical: 15,
    alignItems: "center",
    borderRadius: 14,
  },
  signInText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },

  // ── Divider ──
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#EEEEF2" },
  dividerText: {
    fontSize: 10,
    fontWeight: "600",
    color: C.inkMuted,
    letterSpacing: 0.5,
  },

  // ── Trust ──
  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  trustChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.tealGhost,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  trustLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.tealDark,
    letterSpacing: 0.3,
  },

  // ── Footer ──
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: C.inkMuted,
    marginTop: 24,
    marginBottom: 32,
  },
});
