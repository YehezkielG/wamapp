// hooks/usePushNotifications.ts
import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseClient';

// Pengaturan default agar notif muncul walau app sedang dibuka (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
      
      // Ambil token (Jika nanti pakai EAS Build, butuh projectId di app.json)
      token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
      console.log('Push notification harus di-test di perangkat fisik (HP Asli).');
    }

    return token;
  };

  // Fungsi untuk simpan/update ke Supabase
  const saveTokenToDatabase = async (pushToken: string) => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .upsert(
          { 
            push_token: pushToken, 
            last_active: new Date().toISOString() 
            // Nanti kalau fitur lokasi jalan, tambahin latitude & longitude di sini
          },
          { onConflict: 'push_token' } // Ini kunci dari fitur "Upsert"
        );

      if (error) {
        console.error("Gagal simpan token ke DB:", error.message);
      } else {
        console.log("Token berhasil diamankan di Supabase:", pushToken);
      }
    } catch (err) {
      console.error("Supabase Error:", err);
    }
  };
};