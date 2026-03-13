import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// How the notification appears when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Request permission from the user
export async function requestNotificationPermission(): Promise<boolean> {
    if (!Device.isDevice) {
        // Simulators can't receive notifications
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return false;
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('access-requests', {
            name: 'Access Requests',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0A6640',
            sound: 'default',
        });
    }

    return true;
}

// Fire a local notification for a new access request
export async function showAccessRequestNotification(
    requesterName: string,
    role: string,
    count: number
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: count > 1
                ? `${count} New Access Requests`
                : '🔔 New Access Request',
            body: count > 1
                ? `${count} clinicians are requesting access to your records`
                : `${requesterName} (${role.replace('_', ' ')}) wants to access your records`,
            sound: 'default',
            data: { screen: 'Access' },
            ...(Platform.OS === 'android' && { channelId: 'access-requests' }),
        },
        trigger: null, // fire immediately
    });
}

// Clear the badge count
export async function clearBadge() {
    await Notifications.setBadgeCountAsync(0);
}