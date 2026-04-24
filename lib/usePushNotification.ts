// hooks/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { saveDevicePushToken } from './explore/markedLocationsService';
import { useNotificationSettingsStore } from './notifications/notificationSettingsStore';
import { buildChatPromptFromNotification } from './chat/_chatUtils';

// Default configuration so notifications appear while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: useNotificationSettingsStore.getState().enabled,
    shouldShowList: useNotificationSettingsStore.getState().enabled,
    shouldPlaySound: useNotificationSettingsStore.getState().enabled,
    shouldSetBadge: false,
  }),
});

export const usePushNotifications = () => {
  const router = useRouter();
  const enabled = useNotificationSettingsStore((state) => state.enabled);
  const osPermission = useNotificationSettingsStore((state) => state.osPermission);
  const refreshOsPermission = useNotificationSettingsStore((state) => state.refreshOsPermission);
  const setEnabledSilently = useNotificationSettingsStore((state) => state.setEnabledSilently);
  const lastSavedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const routeToChat = (notification: Notifications.Notification) => {
      const content = notification.request.content;
      const data = (content.data ?? {}) as Record<string, unknown>;
      const draft = buildChatPromptFromNotification({
        title: typeof content.title === 'string' ? content.title : undefined,
        message: typeof content.body === 'string' ? content.body : undefined,
        category: typeof data.category === 'string' ? data.category : undefined,
        source: 'expo_push',
      });

      router.push({
        pathname: '/chat',
        params: {
          draft,
          title: typeof content.title === 'string' ? content.title : '',
          message: typeof content.body === 'string' ? content.body : '',
          category: typeof data.category === 'string' ? data.category : '',
          source: 'expo_push',
        },
      });
    };

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeToChat(response.notification);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        routeToChat(response.notification);
      }
    });

    return () => responseSubscription.remove();
  }, [router]);

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

    // Execute immediately when the app is opened for the first time
    registerForPushNotificationsAsync().then((token) => {
      if (token && token !== lastSavedTokenRef.current) {
        lastSavedTokenRef.current = token;
        saveTokenToDatabase(token);
      }
    });
  }, [enabled]);

  // Function to request permission and obtain the token from the OS
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

    // A physical device is required; emulators/simulators often fail to obtain a token
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Failed', 'Notification permission was not granted!');
        return;
      }

      token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
      console.log('Push notifications must be tested on a physical device.');
    }

    return token;
  };

  // Function to save/update the token in Supabase
  const saveTokenToDatabase = async (pushToken: string) => {
    try {
      const saved = await saveDevicePushToken(pushToken);
      if (!saved) {
        console.error('Failed to save token to the database: device ID is unavailable');
      } else {
        console.log('Token saved successfully in Supabase:', pushToken);
      }
    } catch (err) {
      console.error('Supabase Error:', err);
    }
  };
};
