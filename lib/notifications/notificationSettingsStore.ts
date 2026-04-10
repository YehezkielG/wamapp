import { create } from 'zustand';
import { Alert, Linking, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { clearDevicePushToken } from '../explore/markedLocationsService';

export type NotificationPermissionStatus = Notifications.PermissionStatus;

type NotificationSettingsStore = {
  enabled: boolean;
  isBusy: boolean;
  osPermission: NotificationPermissionStatus | null;
  setEnabledSilently: (nextEnabled: boolean) => void;
  refreshOsPermission: () => Promise<NotificationPermissionStatus>;
  setEnabledFromUi: (nextEnabled: boolean) => Promise<void>;
};

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

async function getOsPermissionStatus(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

async function requestOsPermission(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

async function cancelAllLocalNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

export const useNotificationSettingsStore = create<NotificationSettingsStore>((set, get) => ({
  enabled: false,
  isBusy: false,
  osPermission: null,

  setEnabledSilently: (nextEnabled) => {
    set({ enabled: nextEnabled });
  },

  refreshOsPermission: async () => {
    const status = await getOsPermissionStatus();
    set({ osPermission: status });
    if (status !== 'granted') {
      set({ enabled: false });
    }
    return status;
  },

  setEnabledFromUi: async (nextEnabled) => {
    if (get().isBusy) return;
    set({ isBusy: true });

    try {
      if (!nextEnabled) {
        set({ enabled: false });
        await clearDevicePushToken();
        await cancelAllLocalNotifications();
        return;
      }

      await ensureAndroidChannel();

      if (!Device.isDevice) {
        Alert.alert(
          'Push Notifications',
          'Push notifications (token) biasanya butuh perangkat fisik (HP asli). Kamu masih bisa pakai local notifications, tapi token mungkin tidak tersedia.'
        );
      }

      const existing = await getOsPermissionStatus();
      let finalStatus = existing;

      if (existing !== 'granted') {
        finalStatus = await requestOsPermission();
      }

      set({ osPermission: finalStatus });

      if (finalStatus !== 'granted') {
        set({ enabled: false });
        Alert.alert(
          'Izin Notifikasi Ditolak',
          'Notifikasi belum bisa diaktifkan karena izin belum diberikan. Kamu bisa mengaktifkannya lewat Settings perangkat.',
          [
            { text: 'Batal', style: 'cancel' },
            {
              text: 'Buka Settings',
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        );
        return;
      }

      set({ enabled: true });
    } finally {
      set({ isBusy: false });
    }
  },
}));
