import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Pressable,
  Dimensions,
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
import AppointmentsScreen from "../screens/appointments/Appointmentsscreen";
import VitalsTrendsScreen from "../screens/health/VitalsTrendsScreen";
import PatientQRScreen from "../screens/profile/PatientQRScreen";

// ── DS tokens ─────────────────────────────────────────────────────────────────
const C = {
  brand:       "#059669",
  brandDeep:   "#047857",
  ink:         "#0A0E1A",
  inkSoft:     "#4B5563",
  inkMuted:    "#9CA3AF",
  bg:          "#FAFAFB",
  card:        "#FFFFFF",
  cardBorder:  "#E5E7EB",
  divider:     "#F0F1F3",
};

// ── Layout constants ──────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get("window");
const TAB_HEIGHT  = 64;
const FAB_SIZE    = 56;
const FAB_PROTRUDE = 22; // DS: `top: -22` above the tab bar

// ── Tab config ────────────────────────────────────────────────────────────────
type TabConfig = {
  route: keyof MainTabParamList;
  icon:  keyof typeof MaterialIcons.glyphMap;
  label: string;
};

// DS icons: Records=description, Access=security, History=show-chart, Referrals=send
const TABS: TabConfig[] = [
  { route: "Records",    icon: "description", label: "Records"  },
  { route: "Access",     icon: "security",    label: "Access"   },
  { route: "History",    icon: "show-chart",  label: "History"  },
  { route: "Referrals",  icon: "send",        label: "Referrals"},
];

// ── Shared stack header options ───────────────────────────────────────────────
const innerHeader = {
  headerShown:      true,
  headerStyle:      { backgroundColor: C.card },
  headerTintColor:  C.ink,
  headerTitleStyle: { color: C.ink, fontWeight: "700" as const, fontSize: 17 },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
};

// ── Stack navigators ──────────────────────────────────────────────────────────
const RecordsStack = createNativeStackNavigator<RecordsStackParamList>();
function RecordsNavigator() {
  return (
    <RecordsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: C.card },
        headerTintColor: C.ink,
        headerTitleStyle: styles.headerTitle,
        headerBackTitleVisible: false,
        headerShadowVisible: false,
      }}
    >
      <RecordsStack.Screen name="RecordsList"  component={RecordsListScreen}  options={{ headerShown: false }} />
      <RecordsStack.Screen name="RecordDetail" component={RecordDetailScreen} options={{ headerShown: false }} />
      <RecordsStack.Screen name="Profile"      component={ProfileScreen}      options={{ ...innerHeader, title: "Profile" }} />
      <RecordsStack.Screen name="VitalsTrends" component={VitalsTrendsScreen} options={{ ...innerHeader, title: "Health Trends" }} />
      <RecordsStack.Screen name="PatientQR"    component={PatientQRScreen}    options={{ ...innerHeader, title: "My Hospital ID" }} />
    </RecordsStack.Navigator>
  );
}

const AccessStack = createNativeStackNavigator<AccessStackParamList>();
function AccessNavigator() {
  return (
    <AccessStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: C.card },
        headerTintColor: C.ink,
        headerTitleStyle: styles.headerTitle,
        headerBackTitleVisible: false,
        headerShadowVisible: false,
      }}
    >
      <AccessStack.Screen name="AccessRequests" component={AccessRequestsScreen} options={{ headerShown: false }} />
      <AccessStack.Screen name="WhoHasAccess"   component={WhoHasAccessScreen}   options={{ title: "Who Has Access" }} />
      <AccessStack.Screen name="RevokeAccess"   component={RevokeAccessScreen}   options={{ title: "Revoke Access" }} />
    </AccessStack.Navigator>
  );
}

const ReferralsStack = createNativeStackNavigator<ReferralsStackParamList>();
function ReferralsNavigator() {
  return (
    <ReferralsStack.Navigator screenOptions={{ headerShown: false }}>
      <ReferralsStack.Screen name="ReferralsList" component={ReferralsScreen} />
      <ReferralsStack.Screen name="Profile"       component={ProfileScreen}  options={{ ...innerHeader, title: "Profile" }} />
    </ReferralsStack.Navigator>
  );
}

const AppointmentsStack = createNativeStackNavigator();
function AppointmentsNavigator() {
  return (
    <AppointmentsStack.Navigator screenOptions={{ headerShown: false }}>
      <AppointmentsStack.Screen name="AppointmentsList" component={AppointmentsScreen} />
    </AppointmentsStack.Navigator>
  );
}

// ── DS-spec tab bar ───────────────────────────────────────────────────────────
// Layout: [Records] [Access] ── 72px FAB slot ── [History] [Referrals]
// FAB protrudes FAB_PROTRUDE px above the bar, centered, always brand green.
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

  const handleFAB = () => navigation.navigate("Appointments");

  const apptIndex    = state.routes.findIndex((r) => r.name === "Appointments");
  const isApptActive = state.index === apptIndex;

  // Split visible tabs: 2 left, 2 right (Appointments is hidden)
  const visible     = state.routes.filter((r) => r.name !== "Appointments");
  const leftRoutes  = visible.slice(0, 2);
  const rightRoutes = visible.slice(2);

  const tabBarActualH = TAB_HEIGHT + (insets.bottom || 0);

  // FAB vertical position: bottom of FAB aligns tabBarActualH + FAB_PROTRUDE - FAB_SIZE above wrapper bottom
  const fabBottom = tabBarActualH + FAB_PROTRUDE - FAB_SIZE;
  const fabLeft   = (SCREEN_W - FAB_SIZE) / 2;

  const renderTab = (route: (typeof visible)[0]) => {
    const realIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === realIndex;
    const tab       = TABS.find((t) => t.route === route.name);
    if (!tab) return null;

    return (
      <TouchableOpacity
        key={route.key}
        style={styles.tabItem}
        onPress={() => handlePress(route.name, route.key, isFocused)}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
      >
        <MaterialIcons
          name={tab.icon}
          size={24}
          color={isFocused ? C.brand : C.inkMuted}
        />
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: "relative" }}>
      {/* ── Central FAB — brand green, protrudes above bar ── */}
      <Pressable
        onPress={handleFAB}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: fabBottom,
            left:   fabLeft,
          },
          pressed        && { transform: [{ scale: 0.92 }] },
          isApptActive   && styles.fabActive,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Book Appointment"
      >
        <MaterialIcons
          name={isApptActive ? "event" : "add"}
          size={28}
          color="#fff"
        />
      </Pressable>

      {/* ── Tab bar ── */}
      <View
        style={[
          styles.tabBar,
          {
            paddingBottom: insets.bottom || 8,
            height: tabBarActualH,
          },
        ]}
      >
        {leftRoutes.map(renderTab)}

        {/* Center slot — keeps space for the FAB; tapping it opens appointments */}
        <TouchableOpacity
          style={styles.fabSlot}
          onPress={handleFAB}
          activeOpacity={1}
          accessibilityLabel="Book Appointment"
        />

        {rightRoutes.map(renderTab)}
      </View>
    </View>
  );
}

// ── Root navigator ─────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Records"      component={RecordsNavigator}      />
      <Tab.Screen name="Access"       component={AccessNavigator}       />
      <Tab.Screen name="History"      component={VisitHistoryScreen}    />
      <Tab.Screen name="Referrals"    component={ReferralsNavigator}    />
      {/* Hidden — opened only via FAB */}
      <Tab.Screen
        name="Appointments"
        component={AppointmentsNavigator}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerTitle: {
    fontWeight: "700",
    fontSize: 17,
    color: C.ink,
    letterSpacing: -0.3,
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: "row",
    backgroundColor: C.card,
    paddingHorizontal: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder, // DS: var(--border) = #E5E7EB
    ...Platform.select({
      ios: {
        shadowColor: "#0A0E1A",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },

  // Individual tab button
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
    minHeight: 44, // DS: 44px min touch target
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: C.inkMuted,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: C.brand,
    fontWeight: "600",
  },

  // Center spacer slot (72px wide, same as DS spec)
  fabSlot: {
    width: 72,
    flexShrink: 0,
  },

  // ── FAB — DS spec: brand green, 56px, 4px border, elevBrand shadow ──
  fab: {
    position: "absolute",
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: C.bg, // matches app background — DS: `border: 4px solid var(--surface-bg)`
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: C.brand,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  fabActive: {
    backgroundColor: C.brandDeep, // slightly deeper when appointments is active
  },
});
