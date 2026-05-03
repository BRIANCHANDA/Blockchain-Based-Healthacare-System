import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";

import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { updatePatientProfile } from "../../api/patient";
import { useAuthStore } from "../../store/authStore";
import { AuthStackParamList } from "../../types";

const schema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

type Props = NativeStackScreenProps<AuthStackParamList, "ChangePassword">;

export default function ChangePasswordScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const { token, user, setAuth } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await updatePatientProfile({ password: data.newPassword });
      if (res.data.success) {
        const updatedUser = { ...user, mustChangePassword: false };
        await setAuth(token!, updatedUser);
        Toast.show({
          type: "success",
          text1: "Password Changed",
          text2: "You can now log in with your new password.",
        });
        navigation.replace("MainApp");
      }
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🔐</Text>
          </View>
          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.subtitle}>
            You are required to set a new password for security reasons.
          </Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="newPassword"
            render={({ field: { onChange, value } }) => (
              <Input
                label="New Password"
                placeholder="Enter new password"
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
                placeholder="Confirm new password"
                value={value}
                onChangeText={onChange}
                secureTextEntry
                secureToggle
                error={errors.confirmPassword?.message}
              />
            )}
          />

          <Button
            label={loading ? "Updating..." : "Update Password"}
            onPress={handleSubmit(onSubmit)}
            loading={loading}
            style={{ marginTop: 16 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F0F4FF",
    padding: 24,
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: 40 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgb(2, 77, 36)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  iconText: { fontSize: 36 },
  title: { fontSize: 24, fontWeight: "800", color: "#1E3A5F" },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
});
