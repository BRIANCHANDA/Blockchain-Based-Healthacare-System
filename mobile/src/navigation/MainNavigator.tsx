import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons as Icon } from "@expo/vector-icons";

import {
  MainTabParamList,
  RecordsStackParamList,
  AccessStackParamList,
} from "../types";

import RecordsListScreen from "../screens/records/RecordsListScreen";
import RecordDetailScreen from "../screens/records/RecordDetailScreen";
import AccessRequestsScreen from "../screens/access/AccessRequestsScreen";
import WhoHasAccessScreen from "../screens/access/WhoHasAccessScreen";
import RevokeAccessScreen from "../screens/access/RevokeAccessScreen";
import VisitHistoryScreen from "../screens/visits/VisitHistoryScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

const PRIMARY = "#0A6640";
const TAB_HEIGHT = 64;

const RecordsStack = createNativeStackNavigator<RecordsStackParamList>();
function RecordsNavigator() {
  return (
    <RecordsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: PRIMARY },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        headerBackTitleVisible: false,
      }}
    >
      <RecordsStack.Screen
        name="RecordsList"
        component={RecordsListScreen}
        options={{ headerShown: false }}
      />
      <RecordsStack.Screen
        name="RecordDetail"
        component={RecordDetailScreen}
        options={({ route }) => ({
          title: route.params.visitNumber,
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: PRIMARY,
          headerTitleStyle: { fontWeight: "700", color: "#0D1F17" },
        })}
      />
    </RecordsStack.Navigator>
  );
}

const AccessStack = createNativeStackNavigator<AccessStackParamList>();
function AccessNavigator() {
  return (
    <AccessStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: PRIMARY,
        headerTitleStyle: { fontWeight: "700", color: "#0D1F17" },
        headerBackTitleVisible: false,
      }}
    >
      <AccessStack.Screen
        name="AccessRequests"
        component={AccessRequestsScreen}
        options={{ headerShown: false }}
      />
      <AccessStack.Screen
        name="WhoHasAccess"
        component={WhoHasAccessScreen}
        options={{ title: "Who Has Access" }}
      />
      <AccessStack.Screen
        name="RevokeAccess"
        component={RevokeAccessScreen}
        options={{ title: "Revoke Access" }}
      />
    </AccessStack.Navigator>
  );
}

// Custom Tab Bar
function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom;

  const tabs = [
    { name: "Records", icon: "folder-open", label: "Records" },
    { name: "Access", icon: "security", label: "Access" },
    { name: "Visits", icon: "history", label: "History" },
    { name: "Profile", icon: "person", label: "Profile" },
  ];

  return (
    <View
      style={[
        styles.tabBar,
        { paddingBottom: bottomPad, height: TAB_HEIGHT + bottomPad },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const tab = tabs[index];

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <View
            key={route.key}
            style={styles.tabItem}
            // @ts-ignore
            onStartShouldSetResponder={() => true}
            onResponderRelease={onPress}
          >
            <View
              style={[styles.tabIconWrap, isFocused && styles.tabIconActive]}
            >
              <Icon
                // @ts-ignore
                name={tab.icon}
                size={22}
                color={isFocused ? "#fff" : "#8AA89C"}
              />
            </View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Records" component={RecordsNavigator} />
      <Tab.Screen name="Access" component={AccessNavigator} />
      <Tab.Screen name="Visits" component={VisitHistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF4F1",
    paddingHorizontal: 8,
    paddingTop: 10,
    shadowColor: "#0A6640",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
  },
  tabIconWrap: {
    width: 44,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconActive: {
    backgroundColor: "#0A6640",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8AA89C",
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: "#0A6640",
    fontWeight: "700",
  },
});
