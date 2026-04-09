// hooks/usePushNotifications.ts
import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { saveDevicePushToken } from './explore/markedLocationsService';

// Pengaturan default agar notif muncul walau app sedang dibuka (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const usePushNotifications = () => {
  useEffect(() => {
    // Fungsi langsung dieksekusi saat aplikasi pertama kali dibuka
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        saveTokenToDatabase(token);
      }
    });
  }, []);

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