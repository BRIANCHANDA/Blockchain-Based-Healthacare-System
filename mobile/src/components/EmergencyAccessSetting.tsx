import React, { useRef, useState } from 'react';
import { View, Text, Switch, Alert, Pressable, ActivityIndicator } from 'react-native';
import { getEmergencyAccessPreference, setEmergencyAccessPreference } from '../api/patient';
import { usePatientResource } from '../hooks/usePatientResource';
import { useAuthStore } from '../store/authStore';

export default function EmergencyAccessSetting() {
  const resource = usePatientResource<boolean | null>(getEmergencyAccessPreference, null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const token = useAuthStore(s => s.token);
  const save = async (enabled: boolean) => {
    if (pending.current || token !== useAuthStore.getState().token) return;
    pending.current = true;
    setSaving(true);
    try {
      const confirmed = await setEmergencyAccessPreference(enabled);
      if (token === useAuthStore.getState().token) resource.update(() => confirmed);
    } catch {
      if (token === useAuthStore.getState().token) {
        Alert.alert('Setting not confirmed', 'We could not confirm the change. Please check the setting and try again.');
        void resource.refresh();
      }
    } finally { pending.current = false; setSaving(false); }
  };
  const change = (enabled: boolean) => {
    if (!enabled) { void save(false); return; }
    Alert.alert('Allow emergency access?',
      'Clinical staff may access your cross-hospital history for 24 hours without a new approval in an emergency. Access requires a reason and is logged. You can turn this off at any time.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Allow', onPress: () => { void save(true); } }]);
  };
  return <View style={{ margin: 20, padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#0A0E1A', flex: 1 }}>Emergency access to my records</Text>
      <Switch accessibilityLabel="Allow emergency access to my records" value={resource.data === true}
        disabled={resource.loading || resource.refreshing || resource.error || resource.data === null || saving}
        onValueChange={change} trackColor={{ true: '#059669' }} />
    </View>
    <Text style={{ color: '#4B5563', marginTop: 8, lineHeight: 20 }}>
      For your own records, not a dependent’s. Off by default. When enabled, clinical staff can use a logged emergency override without asking for a new approval.
      Turning this off revokes active emergency grants. Normal consent and home-hospital access are unchanged.
    </Text>
    {(resource.loading || saving) && <ActivityIndicator accessibilityLabel={saving ? 'Saving' : 'Loading'} />}
    {resource.error && <Pressable accessibilityRole="button" onPress={() => { void resource.refresh(); }}>
      <Text style={{ color: '#B91C1C', marginTop: 12 }}>Could not load setting. Tap to retry.</Text>
    </Pressable>}
  </View>;
}
