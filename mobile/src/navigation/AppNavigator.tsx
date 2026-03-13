import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore } from "../store/authStore";
import { RootStackParamList } from "../types";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
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
