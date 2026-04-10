// hooks/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { saveDevicePushToken } from './explore/markedLocationsService';
import { useNotificationSettingsStore } from './notifications/notificationSettingsStore';

// Pengaturan default agar notif muncul walau app sedang dibuka (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: useNotificationSettingsStore.getState().enabled,
    shouldShowList: useNotificationSettingsStore.getState().enabled,
    shouldPlaySound: useNotificationSettingsStore.getState().enabled,
    shouldSetBadge: false,
  }),
});

export const usePushNotifications = () => {
  const enabled = useNotificationSettingsStore((state) => state.enabled);
  const osPermission = useNotificationSettingsStore((state) => state.osPermission);
  const refreshOsPermission = useNotificationSettingsStore((state) => state.refreshOsPermission);
  const setEnabledSilently = useNotificationSettingsStore((state) => state.setEnabledSilently);
  const lastSavedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (osPermission !== null) return;

    void (async () => {
      const status = await refreshOsPermission();
      if (status === 'granted') {
        setEnabledSilently(true);
      }
    })();
  }, [osPermission, refreshOsPermission, setEnabledSilently]);

  useEffect(() => {
    if (!enabled) return;

    // Fungsi langsung dieksekusi saat aplikasi pertama kali dibuka
    registerForPushNotificationsAsync().then((token) => {
      if (token && token !== lastSavedTokenRef.current) {
        lastSavedTokenRef.current = token;
        saveTokenToDatabase(token);
      }
    });
  }, [enabled]);

  // Fungsi untuk minta izin dan ambil token dari OS
  const registerForPushNotificationsAsync = async () => {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Wajib di HP asli, emulator/simulator sering gagal dapet token
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Gagal', 'Izin notifikasi tidak diberikan!');
        return;
      }

      token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
      console.log('Push notification harus di-test di perangkat fisik (HP Asli).');
    }

    return token;
  };

  // Fungsi untuk simpan/update ke Supabase
  const saveTokenToDatabase = async (pushToken: string) => {
    try {
      const saved = await saveDevicePushToken(pushToken);
      if (!saved) {
        console.error('Gagal simpan token ke DB: device ID tidak tersedia');
      } else {
        console.log('Token berhasil diamankan di Supabase:', pushToken);
      }
    } catch (err) {
      console.error('Supabase Error:', err);
    }
  };
};
