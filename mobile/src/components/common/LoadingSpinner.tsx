import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";

type Props = { message?: string };

export default function LoadingSpinner({ message }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#16A34A" />
      {message ? <Text style={styles.msg}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  msg: { marginTop: 12, fontSize: 14, color: "#6B7280" },
});
