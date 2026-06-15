import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";

type Props = TextInputProps & {
  label: string;
  error?: string;
  secureToggle?: boolean;
};

const C = {
  brand:      "#059669",
  ink:        "#0A0E1A",
  inkSoft:    "#4B5563",
  inkMuted:   "#9CA3AF",
  bg:         "#FAFAFB",
  border:     "#E5E7EB",
  borderFocus:"#059669",
  critical:   "#FF5757",
};

export default function Input({
  label,
  error,
  secureToggle,
  secureTextEntry,
  ...props
}: Props) {
  const [hidden, setHidden] = useState(secureTextEntry ?? false);
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? C.critical
    : focused
    ? C.borderFocus
    : C.border;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.row,
          { borderColor },
          focused && !error && styles.rowFocused,
        ]}
      >
        <TextInput
          {...props}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          style={styles.input}
          placeholderTextColor={C.inkMuted}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
        />
        {secureToggle && (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon
              name={hidden ? "visibility-off" : "visibility"}
              size={20}
              color={C.inkMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: C.inkSoft,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: C.bg,
    paddingHorizontal: 14,
  },
  rowFocused: {
    backgroundColor: "#FFFFFF",
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 15,
    color: C.ink,
    fontWeight: "400",
  },
  eye: { paddingLeft: 8 },
  error: {
    fontSize: 12,
    color: C.critical,
    marginTop: 4,
    fontWeight: "500",
  },
});
