import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "danger" | "ghost";
  style?: ViewStyle;
  textStyle?: TextStyle;
};

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
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? "#16A34A" : "#fff"} />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`], textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: "rgb(2, 77, 36)" },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgb(2, 77, 36)",
  },
  danger: { backgroundColor: "#DC2626" },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.5 },

  text: { fontSize: 15, fontWeight: "600" },
  primaryText: { color: "#fff" },
  outlineText: { color: "#16A34A" },
  dangerText: { color: "#fff" },
  ghostText: { color: "#16A34A" },
});
