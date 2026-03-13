import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
// TypeScript lacks declaration for this module; ignore the error for this import
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { MaterialIcons as Icon } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

import { revokeAccess } from "../../api/access";
import { AccessStackParamList } from "../../types";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";

type Props = NativeStackScreenProps<AccessStackParamList, "RevokeAccess">;

export default function RevokeAccessScreen({ route, navigation }: Props) {
  const { granteeName, practitionerId } = route.params;
  const [loading, setLoading] = useState(false);

  const handleRevoke = () => {
    Alert.alert(
      "Confirm Revocation",
      `This will immediately remove ${granteeName}'s access to your records on the blockchain. They will no longer be able to view your medical history.\n\nAre you sure?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Revoke",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await revokeAccess(practitionerId);
              Toast.show({
                type: "success",
                text1: "Access Revoked",
                text2: `${granteeName} no longer has access`,
              });
              navigation.goBack();
            } catch (err: any) {
              const msg =
                err.response?.data?.error?.message ??
                "Could not revoke access. Try again.";
              Toast.show({ type: "error", text1: "Error", text2: msg });
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Card style={styles.warningCard}>
        <View style={styles.iconWrap}>
          <Icon name="warning" size={40} color="#DC2626" />
        </View>
        <Text style={styles.warningTitle}>Revoke Access</Text>
        <Text style={styles.warningBody}>
          You are about to revoke <Text style={styles.bold}>{granteeName}</Text>
          's access to your medical records.
        </Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>What this means</Text>
        {[
          "Their blockchain permission will be removed immediately",
          "They will no longer be able to view your visits, labs, or prescriptions",
          "This action is logged in your audit trail",
          "You can re-grant access at any time",
        ].map((point, i) => (
          <View key={i} style={styles.point}>
            <Icon name="check-circle" size={16} color="#6B7280" />
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <Button
          label="Cancel"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ flex: 1, marginRight: 12 }}
        />
        <Button
          label="Revoke Access"
          variant="danger"
          onPress={handleRevoke}
          loading={loading}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Add to every screen's container style
  container: {
    flex: 1,
    backgroundColor: "#F0F4FF",
    paddingBottom: 80, // clears the tab bar
  },
  warningCard: { alignItems: "center", paddingVertical: 28 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#DC2626",
    marginBottom: 8,
  },
  warningBody: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    lineHeight: 20,
  },
  bold: { fontWeight: "700" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  point: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  pointText: { fontSize: 13, color: "#4B5563", flex: 1, lineHeight: 18 },
  actions: { flexDirection: "row", marginTop: 8 },
});
