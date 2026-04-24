import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeatherStore } from '../../../lib/weather/weatherStore';
import { useNotificationSettingsStore } from '../../../lib/notifications/notificationSettingsStore';
import { useNotificationCenterStore } from '../../../lib/notifications/notificationCenterStore';

export default function Settings() {
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const weatherCode = useWeatherStore((state) => state.data?.weatherCode);
  const notificationsEnabled = useNotificationSettingsStore((state) => state.enabled);
  const notificationBusy = useNotificationSettingsStore((state) => state.isBusy);
  const setNotificationsEnabled = useNotificationSettingsStore((state) => state.setEnabledFromUi);
  const refreshOsPermission = useNotificationSettingsStore((state) => state.refreshOsPermission);
  const clearNotifications = useNotificationCenterStore((state) => state.clearNotifications);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    void refreshOsPermission();
  }, [refreshOsPermission]);

  const isDarkUi = useMemo(() => {
    const isNight = currentHour >= 19 || currentHour < 5;
    const isStorm = weatherCode !== undefined && [95, 96, 99].includes(weatherCode);
    return isNight || isStorm;
  }, [currentHour, weatherCode]);

  const titleClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const textClass = isDarkUi ? 'text-white/90' : 'text-slate-700';
  const mutedClass = isDarkUi ? 'text-white/70' : 'text-slate-500';
  const surfaceClass = isDarkUi
    ? 'border border-white/30 bg-white/15'
    : 'border border-white/70 bg-white/60';

  const toggleTrackClass = notificationsEnabled
    ? isDarkUi
      ? 'bg-white/30 border border-white/40'
      : 'bg-slate-900/20 border border-slate-900/30'
    : isDarkUi
      ? 'bg-white/10 border border-white/25'
      : 'bg-slate-900/10 border border-slate-900/20';
  const toggleThumbClass = notificationsEnabled
    ? isDarkUi
      ? 'bg-white'
      : 'bg-slate-900'
    : isDarkUi
      ? 'bg-white/80'
      : 'bg-slate-700';

  const menuItems = [
    { id: 'appearance', label: 'Appearance', icon: 'color-palette-outline' as const },
    { id: 'notifications', label: 'Notifications', icon: 'notifications-outline' as const },
    { id: 'clearNotifications', label: 'Clear Notifications', icon: 'trash-outline' as const },
    { id: 'about', label: 'About App', icon: 'information-circle-outline' as const },
  ];

  const handleMenuPress = (itemId: string) => {
    if (itemId === 'notifications') {
      void setNotificationsEnabled(!notificationsEnabled);
      return;
    }

    if (itemId === 'clearNotifications') {
      Alert.alert('Clear notifications?', 'All notifications will be removed from this device.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void clearNotifications();
          },
        },
      ]);
    }
  };

  return (
    <View className="flex-1 px-4 pt-8">
      <Text className={`text-2xl font-bold ${titleClass}`}>Settings</Text>
      <Text className={`mt-1 text-xs ${mutedClass}`}>
        Interactive theme follows weather and time.
      </Text>

      <View className={`mt-4 rounded-2xl p-3 ${surfaceClass}`}>
        {menuItems.map((item, index) => (
          <Pressable
            key={item.id}
            className={`flex-row items-center justify-between rounded-xl px-3 py-3 ${
              index !== menuItems.length - 1 ? 'mb-2' : ''
            } ${isDarkUi ? 'bg-white/10' : 'bg-white/75'} ${
              (item.id === 'notifications' && notificationBusy) || item.id === 'clearNotifications'
                ? 'opacity-60'
                : ''
            }`}
            disabled={item.id === 'notifications' && notificationBusy}
            onPress={() => handleMenuPress(item.id)}>
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={
                  item.id === 'notifications'
                    ? notificationsEnabled
                      ? 'notifications-outline'
                      : 'notifications-off-outline'
                    : item.id === 'clearNotifications'
                      ? 'trash-outline'
                    : item.icon
                }
                size={18}
                color={isDarkUi ? '#e2e8f0' : '#334155'}
              />
              <Text className={`text-sm font-medium ${textClass}`}>{item.label}</Text>
            </View>
            {item.id === 'notifications' ? (
              <View className="flex-row items-center gap-2">
                <Text className={`text-xs ${mutedClass}`}>
                  {notificationsEnabled ? 'On' : 'Off'}
                </Text>
                <View
                  accessibilityRole="switch"
                  accessibilityState={{ checked: notificationsEnabled, disabled: notificationBusy }}
                  className={`h-7 w-12 rounded-full p-1 ${toggleTrackClass}`}>
                  <View
                    className={`h-5 w-5 rounded-full ${toggleThumbClass} ${
                      notificationsEnabled ? 'ml-5' : 'ml-0'
                    }`}
                  />
                </View>
              </View>
            ) : item.id === 'clearNotifications' ? (
              <Text className={`text-xs font-semibold ${mutedClass}`}>Tap to clear</Text>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={isDarkUi ? '#cbd5e1' : '#64748b'} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
