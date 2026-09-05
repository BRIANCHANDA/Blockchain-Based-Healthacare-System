/**
 * Root navigator: decides whether the user sees the login flow or the app.
 *
 * The choice is made solely by isAuthenticated in the auth store, so signing in
 * or out anywhere in the app moves the user without any explicit navigation
 * call. loadFromStorage() runs once on mount to restore a persisted session, and
 * the spinner below covers that read — without it the login screen would flash
 * for a moment on every cold start of an already signed-in app.
 *
 * RootNavigator is a separate component purely so useNotifications() runs inside
 * NavigationContainer, which it needs in order to navigate when a notification
 * is tapped.
 */

import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "../store/authStore";
import { RootStackParamList } from "../types";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import ReferralsScreen from "../screens/referrals/ReferralsScreen";
import { useNotifications } from "../hooks/useNotifications";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Separate component so useNotifications runs inside NavigationContainer
function RootNavigator() {
  const { isAuthenticated, isLoading, loadFromStorage } = useAuthStore();

  // Wire up polling notifications
  useNotifications();

  useEffect(() => {
    loadFromStorage();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0A6640" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}
