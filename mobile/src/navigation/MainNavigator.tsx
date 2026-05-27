import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import type {
  MainTabParamList,
  RecordsStackParamList,
  AccessStackParamList,
  ReferralsStackParamList,
} from "../types";

import RecordsListScreen from "../screens/records/RecordsListScreen";
import RecordDetailScreen from "../screens/records/RecordDetailScreen";
import AccessRequestsScreen from "../screens/access/AccessRequestsScreen";
import WhoHasAccessScreen from "../screens/access/WhoHasAccessScreen";
import RevokeAccessScreen from "../screens/access/RevokeAccessScreen";
import VisitHistoryScreen from "../screens/visits/VisitHistoryScreen";
import ReferralsScreen from "../screens/referrals/ReferralsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

const C = {
  teal: "#0D9488",
  tealDark: "#0F766E",
  tealGhost: "#F0FDFA",
  ink: "#1A1D2E",
  inkMuted: "#9498B3",
  card: "#FFFFFF",
  cardBorder: "#ECEEF4",
  amber: "#F59E0B",
};

const TAB_HEIGHT = 60;

type TabConfig = {
  route: keyof MainTabParamList;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
};

const TABS: TabConfig[] = [
  { route: "Records", icon: "folder-open", label: "Records" },
  { route: "Access", icon: "security", label: "Access" },
  { route: "History", icon: "history", label: "History" },
  { route: "Referrals", icon: "compare-arrows", label: "Referrals" },
];

// ── Stack navigators ──────────────────────────────────────────────────────────

const RecordsStack = createNativeStackNavigator<RecordsStackParamList>();

function RecordsNavigator() {
  return (
    <RecordsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: C.card },
        headerTintColor: C.tealDark,
        headerTitleStyle: styles.headerTitle,
        headerBackTitleVisible: false,
        headerShadowVisible: false,
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
        options={({ route }) => ({ title: route.params.visitNumber })}
      />
      {/* Profile pushed from Records header tap */}
      <RecordsStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          headerShown: true,
          headerStyle: { backgroundColor: "#0F766E" },
          headerTintColor: "#fff",
          headerTitleStyle: { color: "#fff", fontWeight: "700" },
          headerShadowVisible: false,
        }}
      />
    </RecordsStack.Navigator>
  );
}

const AccessStack = createNativeStackNavigator<AccessStackParamList>();

function AccessNavigator() {
  return (
    <AccessStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: C.card },
        headerTintColor: C.tealDark,
        headerTitleStyle: styles.headerTitle,
        headerBackTitleVisible: false,
        headerShadowVisible: false,
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

const ReferralsStack = createNativeStackNavigator<ReferralsStackParamList>();

function ReferralsNavigator() {
  return (
    <ReferralsStack.Navigator screenOptions={{ headerShown: false }}>
      <ReferralsStack.Screen name="ReferralsList" component={ReferralsScreen} />
      <ReferralsStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: true,
          title: "Profile",
          headerStyle: { backgroundColor: "#0F766E" },
          headerTintColor: "#fff",
          headerTitleStyle: { color: "#fff", fontWeight: "700" },
          headerShadowVisible: false,
        }}
      />
    </ReferralsStack.Navigator>
  );
}

// ── Custom tab bar ────────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const handlePress = useCallback(
    (routeName: string, routeKey: string, isFocused: boolean) => {
      const event = navigation.emit({
        type: "tabPress",
        target: routeKey,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(routeName);
    },
    [navigation],
  );

  return (
    <View
      style={[
        styles.tabBar,
        {
          paddingBottom: insets.bottom || 12,
          height: TAB_HEIGHT + (insets.bottom || 12),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const tab = TABS[index];

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={() => handlePress(route.name, route.key, isFocused)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
          >
            {isFocused && <View style={styles.activePill} />}

            <View style={styles.tabIconWrap}>
              <MaterialIcons
                name={tab.icon}
                size={21}
                color={isFocused ? C.tealDark : C.inkMuted}
              />
            </View>

            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {tab.label}
            </Text>

            {isFocused && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Root navigator ────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Records" component={RecordsNavigator} />
      <Tab.Screen name="Access" component={AccessNavigator} />
      <Tab.Screen name="History" component={VisitHistoryScreen} />
      <Tab.Screen name="Referrals" component={ReferralsNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerTitle: { fontWeight: "700", fontSize: 16, color: C.ink },
  tabBar: {
    flexDirection: "row",
    backgroundColor: C.card,
    paddingHorizontal: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: C.ink,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
      },
      android: { elevation: 16 },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
    gap: 3,
    paddingTop: 2,
  },
  activePill: {
    position: "absolute",
    top: 0,
    left: 6,
    right: 6,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.tealGhost,
  },
  tabIconWrap: {
    width: 36,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: C.inkMuted,
    letterSpacing: 0.2,
  },
  tabLabelActive: { color: C.tealDark, fontWeight: "700" },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.teal,
    marginTop: 1,
  },
});
