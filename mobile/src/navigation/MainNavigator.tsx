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

type TabConfig = {
  route: keyof MainTabParamList;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  accessibilityLabel: string;
};

const TAB_CONFIG: TabConfig[] = [
  {
    route: "Records",
    icon: "folder-open",
    label: "Records",
    accessibilityLabel: "Medical records",
  },
  {
    route: "Access",
    icon: "security",
    label: "Access",
    accessibilityLabel: "Access management",
  },
  {
    route: "Visits",
    icon: "history",
    label: "History",
    accessibilityLabel: "Visit history",
  },
  {
    route: "Profile",
    icon: "person",
    label: "Profile",
    accessibilityLabel: "Your profile",
  },
];

// ─── Stack Navigators ────────────────────────────────────────────────────────

const RecordsStack = createNativeStackNavigator<RecordsStackParamList>();

function RecordsNavigator() {
  return (
    <RecordsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: PRIMARY },
        headerTintColor: "#fff",
        headerTitleStyle: styles.headerTitle,
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
          headerTitleStyle: [styles.headerTitle, { color: "#0D1F17" }],
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
        headerTitleStyle: [styles.headerTitle, { color: "#0D1F17" }],
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

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const handlePress = useCallback(
    (routeName: string, routeKey: string, isFocused: boolean) => {
      const event = navigation.emit({
        type: "tabPress",
        target: routeKey,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation],
  );

  return (
    <View
      style={[
        styles.tabBar,
        { paddingBottom: insets.bottom, height: TAB_HEIGHT + insets.bottom },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const tab = TAB_CONFIG[index];

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={() => handlePress(route.name, route.key, isFocused)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityState={{ selected: isFocused }}
          >
            <View
              style={[styles.tabIconWrap, isFocused && styles.tabIconActive]}
            >
              <MaterialIcons
                name={tab.icon}
                size={22}
                color={isFocused ? "#fff" : "#8AA89C"}
              />
            </View>
            <Text
              style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerTitle: {
    fontWeight: "700",
    fontSize: 17,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEF4F1",
    paddingHorizontal: 8,
    paddingTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#0A6640",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
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
    backgroundColor: PRIMARY,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8AA89C",
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: PRIMARY,
    fontWeight: "700",
  },
});
