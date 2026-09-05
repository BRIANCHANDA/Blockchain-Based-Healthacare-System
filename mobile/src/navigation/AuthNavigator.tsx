/**
 * Authentication stack.
 *
 * There is no self-registration screen, deliberately. A patient record is
 * created by hospital staff at the point of care — the receptionist registers
 * them, which is what ties the record to a real, identified person and to an
 * institution. The mobile app is where that patient then signs in and exercises
 * control over their records; it is not where the identity is created.
 *
 * ChangePassword sits here because a patient registered by staff is issued a
 * temporary password and must set their own before reaching the app.
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthStackParamList } from "../types";
import LoginScreen from "../screens/auth/LoginScreen";
import ChangePasswordScreen from "../screens/auth/changepassword";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
}
