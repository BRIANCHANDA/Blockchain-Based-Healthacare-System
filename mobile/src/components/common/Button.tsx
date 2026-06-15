import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ViewStyle,
  TextStyle,
} from "react-native";

type Variant = "primary" | "outline" | "danger" | "ghost";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

const BRAND = "#059669";
const BRAND_DEEP = "#047857";

export default function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  style,
  textStyle,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "danger" ? "#fff" : BRAND}
        />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text` as const], textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  // DS brand green CTA
  primary: {
    backgroundColor: BRAND,
    ...Platform.select({
      ios: {
        shadowColor: BRAND,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: BRAND,
  },
  danger: { backgroundColor: "#FF5757" },
  ghost: { backgroundColor: "transparent" },

  disabled: { opacity: 0.5 },

  text: { fontSize: 15, fontWeight: "600" },
  primaryText: { color: "#fff" },
  outlineText: { color: BRAND_DEEP },
  dangerText: { color: "#fff" },
  ghostText: { color: BRAND },
});
