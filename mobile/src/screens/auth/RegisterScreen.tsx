import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";

import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import { registerPatient, loginPatient } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { AuthStackParamList } from "../../types";

const schema = z
  .object({
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
    gender: z.enum(["male", "female", "other"], {
      errorMap: () => ({ message: "Required" }),
    }),
    phoneNumber: z.string().min(9, "Enter a valid phone number"),
    address: z.string().min(5, "Enter your full address"),
    nationalId: z.string().min(4, "Enter your National ID"),
    emergencyContact: z.string().min(5, "Enter an emergency contact"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gender: "male" },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { confirmPassword, ..._rest } = data;
      // build an explicit payload with required fields so types align with the API
      const payload = {
        firstName: data.firstName!,
        lastName: data.lastName!,
        // optional fields from the API can be omitted or set to undefined
        middleName: undefined,
        dateOfBirth: data.dateOfBirth!,
        gender: data.gender,
        bloodType: undefined,
        phoneNumber: data.phoneNumber!,
        email: undefined,
        address: data.address!,
        nationalId: data.nationalId!,
        emergencyContact: data.emergencyContact!,
        maritalStatus: undefined,
        occupation: undefined,
        password: data.password!,
      };
      await registerPatient(payload);
      // auto-login after registration
      const res = await loginPatient(data.nationalId, data.password);
      if (res.success) {
        await setAuth(res.data.token, { ...res.data.user, type: "patient" });
        Toast.show({
          type: "success",
          text1: "Account created!",
          text2: "Welcome to MedChain",
        });
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ?? "Registration failed. Try again.";
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
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Fill in your details to get started</Text>

        <View style={styles.form}>
          {/* Row: first + last name */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="First Name"
                    placeholder="John"
                    value={value}
                    onChangeText={onChange}
                    error={errors.firstName?.message}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Last Name"
                    placeholder="Doe"
                    value={value}
                    onChangeText={onChange}
                    error={errors.lastName?.message}
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="nationalId"
            render={({ field: { onChange, value } }) => (
              <Input
                label="National ID"
                placeholder="123456/78/9"
                value={value}
                onChangeText={onChange}
                autoCapitalize="characters"
                error={errors.nationalId?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Date of Birth"
                placeholder="YYYY-MM-DD"
                value={value}
                onChangeText={onChange}
                keyboardType="numeric"
                error={errors.dateOfBirth?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="phoneNumber"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Phone Number"
                placeholder="+260 97 XXXXXXX"
                value={value}
                onChangeText={onChange}
                keyboardType="phone-pad"
                error={errors.phoneNumber?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Address"
                placeholder="e.g. Kitwe, Copperbelt"
                value={value}
                onChangeText={onChange}
                error={errors.address?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="emergencyContact"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Emergency Contact"
                placeholder="Name & phone number"
                value={value}
                onChangeText={onChange}
                error={errors.emergencyContact?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Password"
                placeholder="Min 8 characters"
                value={value}
                onChangeText={onChange}
                secureTextEntry
                secureToggle
                error={errors.password?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Confirm Password"
                placeholder="Repeat password"
                value={value}
                onChangeText={onChange}
                secureTextEntry
                secureToggle
                error={errors.confirmPassword?.message}
              />
            )}
          />

          <Button
            label="Create Account"
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
  container: { flexGrow: 1, backgroundColor: "#F0F4FF", padding: 24 },
  topBar: { marginBottom: 16 },
  back: { color: "#16A34A", fontSize: 15, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "800", color: "#1E3A5F" },
  subtitle: { fontSize: 14, color: "#6B7280", marginBottom: 24, marginTop: 4 },
  form: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 3,
  },
  row: { flexDirection: "row" },
});
