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
import { loginPatient } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { AuthStackParamList } from "../../types";

const schema = z.object({
  nationalId: z.string().min(4, "Enter your National ID"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormData = z.infer<typeof schema>;

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

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
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🏥</Text>
          </View>
          <Text style={styles.title}>HealthChain</Text>
          <Text style={styles.subtitle}>Zambia's Secure Patient Portal</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSub}>Sign in with your National ID</Text>

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

          <Button
            label="Sign In"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
            style={{ marginTop: 8 }}
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
  title: { fontSize: 28, fontWeight: "800", color: "#1E3A5F" },
  subtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  form: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  formSub: { fontSize: 13, color: "#6B7280", marginBottom: 24 },
});
