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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import Input from "../../components/common/Input";
import { changePassword } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { AuthStackParamList } from "../../types";

const schema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<AuthStackParamList, "ChangePassword">;

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: "#059669",
  primaryDark: "#047857",
  primaryGhost: "#ECFDF5",
  coral: "#FF5757",
  ink: "#0A0E1A",
  inkSoft: "#4B5563",
  inkMuted: "#9CA3AF",
  bg: "#FAFAFB",
  bgAlt: "#F4F5F7",
  card: "#FFFFFF",
  cardBorder: "#E5E7EB",
};

export default function ChangePasswordScreen(_: Props) {
  const [loading, setLoading] = useState(false);
  const { token, user, setAuth } = useAuthStore();
  const insets = useSafeAreaInsets();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await changePassword("test1234", data.newPassword);
      const updatedUser = { ...user!, mustChangePassword: false };
      await setAuth(token!, updatedUser);
      Toast.show({
        type: "success",
        text1: "Password Changed",
        text2: "You can now use your new password.",
      });
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ??
        "Failed to change password. Please try again.";
      Toast.show({ type: "error", text1: "Error", text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Lock icon ── */}
          <View style={styles.iconWrap}>
            <View style={styles.iconBox}>
              <MaterialIcons name="lock-outline" size={32} color="#fff" />
            </View>
          </View>

          {/* ── Headline ── */}
          <View style={styles.headlineWrap}>
            <Text style={styles.headline}>Set your{"\n"}new password</Text>
            <Text style={styles.subheadline}>
              For your security, please set a personal password before
              continuing.
            </Text>
          </View>

          {/* ── Form ── */}
          <View style={styles.formWrap}>
            <Controller
              control={control}
              name="newPassword"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="New Password"
                  placeholder="At least 8 characters"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry
                  secureToggle
                  error={errors.newPassword?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Confirm Password"
                  placeholder="Re-enter new password"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry
                  secureToggle
                  error={errors.confirmPassword?.message}
                />
              )}
            />

            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                loading && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.submitText}>
                {loading ? "Updating…" : "Set Password"}
              </Text>
              {!loading && (
                <MaterialIcons name="arrow-forward" size={18} color="#fff" />
              )}
            </Pressable>
          </View>

          {/* ── Security tips ── */}
          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>Password tips</Text>
            {[
              "Use at least 8 characters",
              "Mix letters, numbers and symbols",
              "Don't reuse old passwords",
            ].map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <MaterialIcons
                  name="check-circle"
                  size={14}
                  color={C.primary}
                />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  iconWrap: {
    alignItems: "flex-start",
    marginBottom: 28,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: C.ink,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: C.ink,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },

  headlineWrap: { marginBottom: 36 },
  headline: {
    fontSize: 30,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -1.2,
    lineHeight: 36,
  },
  subheadline: {
    fontSize: 14,
    color: C.inkSoft,
    marginTop: 10,
    lineHeight: 21,
    fontWeight: "500",
  },

  formWrap: { gap: 4 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.ink,
    paddingVertical: 17,
    borderRadius: 14,
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: C.ink,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  submitText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },

  tipsBox: {
    marginTop: 32,
    padding: 16,
    backgroundColor: C.primaryGhost,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: C.primaryDark,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    color: C.inkSoft,
    fontWeight: "500",
  },
});
