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
  secureToggle?: boolean; // show eye icon for password fields
};

export default function Input({
  label,
  error,
  secureToggle,
  secureTextEntry,
  ...props
}: Props) {
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, error ? styles.rowError : styles.rowNormal]}>
        <TextInput
          {...props}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          style={styles.input}
          placeholderTextColor="#9CA3AF"
        />
        {secureToggle && (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
          >
            <Icon
              name={hidden ? "visibility-off" : "visibility"}
              size={20}
              color="#6B7280"
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
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
  },
  rowNormal: { borderColor: "#D1D5DB" },
  rowError: { borderColor: "#DC2626" },
  input: { flex: 1, height: 48, fontSize: 15, color: "#111827" },
  eye: { padding: 4 },
  error: { fontSize: 12, color: "#DC2626", marginTop: 4 },
});
