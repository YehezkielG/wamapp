import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ActivityIndicator, Animated, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import HistorySkeleton from '../../../components/skeleton_loading/History';
import { useWeatherStore } from '../../../lib/weather/weatherStore';
import { useWeatherBackground } from '../../../components/WeatherBackgroundContext';
import { useNotificationSettingsStore } from '../../../lib/notifications/notificationSettingsStore';
import { useNotificationCenterStore } from '../../../lib/notifications/notificationCenterStore';
import { buildChatPromptFromNotification } from '../../../lib/chat/_chatUtils';

type NotificationHistoryRow = {
  id: string;
  title: string;
  message: string;
  category: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

type NotificationRowProps = {
  item: NotificationHistoryRow;
  isDarkUi: boolean;
  onDelete: (notificationId: string) => Promise<void>;
  onMarkUnread: (notificationId: string) => Promise<void>;
  onOpenChat: (item: NotificationHistoryRow) => void;
};

function NotificationRow({ item, isDarkUi, onDelete, onMarkUnread, onOpenChat }: NotificationRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isBusy, setIsBusy] = useState(false);

  const createdAtText = useMemo(() => {
    const createdDate = new Date(item.created_at);
    if (Number.isNaN(createdDate.getTime())) return '';

    return createdDate.toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [item.created_at]);

  const cardClass = item.is_read
    ? isDarkUi
      ? 'border border-white/15 bg-white/8'
      : 'border border-slate-200 bg-white/75'
    : isDarkUi
      ? 'border border-sky-300/35 bg-sky-500/18'
      : 'border border-sky-300 bg-sky-50/95';

  const titleClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const messageClass = isDarkUi ? 'text-white/85' : 'text-slate-700';
  const mutedClass = isDarkUi ? 'text-white/65' : 'text-slate-500';
  const runAction = async (action: 'delete' | 'markUnread') => {
    if (isBusy) return;
    setIsBusy(true);

    Animated.timing(translateX, {
      toValue: action === 'delete' ? -220 : 220,
      duration: 180,
      useNativeDriver: true,
    }).start(async () => {
      try {
        if (action === 'delete') {
          await onDelete(item.id);
        } else {
          await onMarkUnread(item.id);
        }
      } catch {
        Animated.spring(translateX, {
          toValue: 0,
          speed: 18,
          bounciness: 0,
          useNativeDriver: true,
        }).start();
      } finally {
        setIsBusy(false);
      }
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 2 && Math.abs(gestureState.dy) < 18,
        onPanResponderMove: (_, gestureState) => {
          translateX.setValue(Math.max(-160, Math.min(160, gestureState.dx)));
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldDelete = gestureState.dx < -26 || gestureState.vx < -0.12;
          const shouldMarkUnread = gestureState.dx > 26 || gestureState.vx > 0.12;

          if (shouldDelete) {
            void runAction('delete');
            return;
          }

          if (shouldMarkUnread) {
            void runAction('markUnread');
            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            speed: 18,
            bounciness: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            speed: 18,
            bounciness: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [runAction, translateX]
  );

  const cardOpacity = translateX.interpolate({
    inputRange: [-160, -80, 0, 80, 160],
    outputRange: [0.25, 0.7, 1, 0.7, 0.25],
    extrapolate: 'clamp',
  });

  const backgroundOpacity = translateX.interpolate({
    inputRange: [-120, -24, 0, 24, 120],
    outputRange: [1, 0.45, 0, 0.45, 1],
    extrapolate: 'clamp',
  });

  return (
    <View className="w-full overflow-hidden rounded-2xl">
      <Animated.View
        pointerEvents="none"
        className="absolute inset-y-0 left-0 right-0 flex-row"
        style={{ opacity: backgroundOpacity }}>
        <View className="flex-1 items-start justify-center rounded-l-2xl bg-sky-500/90 pl-4">
          <Ionicons name="mail-open-outline" size={18} color="#fff" />
        </View>
        <View className="flex-1 items-end justify-center rounded-r-2xl bg-rose-500/90 pr-4">
          <Ionicons name="trash-outline" size={18} color="#fff" />
        </View>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }], opacity: cardOpacity }}>
        <Pressable
          disabled={isBusy}
          onPress={() => onOpenChat(item)}
          className={`w-full rounded-2xl px-3 py-3 ${cardClass}`}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className={`text-sm font-semibold ${titleClass}`} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.is_read ? (
                  <View className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                ) : null}
              </View>
              <Text className={`mt-1 text-[11px] ${mutedClass}`} numberOfLines={1}>
                {item.category}
              </Text>
            </View>
            {createdAtText ? <Text className={`text-[11px] ${mutedClass}`}>{createdAtText}</Text> : null}
          </View>

          <Text className={`mt-2 text-sm leading-5 ${messageClass}`} numberOfLines={3}>
            {item.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function History() {
  const router = useRouter();
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const weatherCode = useWeatherStore((state) => state.data?.weatherCode);
  const { setFromWeather } = useWeatherBackground();
  const notifications = useNotificationCenterStore((state) => state.notifications);
  const isLoading = useNotificationCenterStore((state) => state.isLoading);
  const errorMessage = useNotificationCenterStore((state) => state.errorMessage);
  const loadNotifications = useNotificationCenterStore((state) => state.loadNotifications);
  const clearNotifications = useNotificationCenterStore((state) => state.clearNotifications);
  const deleteNotification = useNotificationCenterStore((state) => state.deleteNotification);
  const markNotificationsRead = useNotificationCenterStore((state) => state.markNotificationsRead);
  const markNotificationUnread = useNotificationCenterStore((state) => state.markNotificationUnread);
  const notificationsEnabled = useNotificationSettingsStore((state) => state.enabled);
  const notificationBusy = useNotificationSettingsStore((state) => state.isBusy);
  const setNotificationsEnabled = useNotificationSettingsStore((state) => state.setEnabledFromUi);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    try {
      setFromWeather(weatherCode, currentHour);
    } catch {
      // noop
    }
  }, [weatherCode, currentHour, setFromWeather]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (!unreadIds.length) return;

    void markNotificationsRead(unreadIds);
  }, [markNotificationsRead, notifications]);

  const isDarkUi = useMemo(() => {
    const isNight = currentHour >= 19 || currentHour < 5;
    const isStorm = weatherCode !== undefined && [95, 96, 99].includes(weatherCode);
    return isNight || isStorm;
  }, [currentHour, weatherCode]);

  const titleClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const textClass = isDarkUi ? 'text-white/90' : 'text-slate-700';
  const mutedClass = isDarkUi ? 'text-white/65' : 'text-slate-500';
  const surfaceClass = isDarkUi ? 'border border-white/25 bg-white/10' : 'border border-white/70 bg-white/60';
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

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const handleClearNotifications = () => {
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
  };

  const handleOpenChatFromNotification = (item: NotificationHistoryRow) => {
    const draft = buildChatPromptFromNotification({
      title: item.title,
      message: item.message,
      category: item.category,
      source: 'history',
    });

    router.push({
      pathname: '/chat',
      params: {
        draft,
        title: item.title,
        message: item.message,
        category: item.category,
        source: 'history',
      },
    });
  };

  return (
    <ScrollView
      className="flex-1 bg-transparent"
      contentContainerClassName="px-4 pt-8 pb-12">
      <View className={`rounded-2xl p-4 ${surfaceClass}`}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className={`text-2xl font-bold ${titleClass}`}>History</Text>
            <Text className={`mt-1 text-xs ${mutedClass}`}>
              {unreadCount} unread • {notifications.length} total
            </Text>
          </View>
          <Pressable
            disabled={notificationBusy}
            onPress={() => void setNotificationsEnabled(!notificationsEnabled)}
            className={`rounded-full px-3 py-2 ${isDarkUi ? 'bg-white/10' : 'bg-white/80'} ${
              notificationBusy ? 'opacity-60' : ''
            }`}>
            <Text className={`text-xs font-semibold ${textClass}`}>
              {notificationsEnabled ? 'Notifications On' : 'Notifications Off'}
            </Text>
          </Pressable>
        </View>

        <View className="mt-3 flex-row items-center gap-3">
          <Pressable
            disabled={notificationBusy}
            onPress={() => void setNotificationsEnabled(!notificationsEnabled)}
            className={`flex-row items-center gap-2 rounded-full px-3 py-2 ${surfaceClass} ${
              notificationBusy ? 'opacity-60' : ''
            }`}>
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
            <Text className={`text-xs font-medium ${mutedClass}`}>
              {notificationsEnabled ? 'Tap to turn off' : 'Tap to turn on'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleClearNotifications}
            className={`rounded-full border px-3 py-2 ${isDarkUi ? 'border-white/20 bg-white/10' : 'border-slate-200 bg-white/80'}`}>
            <Text className={`text-xs font-semibold ${textClass}`}>Clear</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <HistorySkeleton />
      ) : notifications.length === 0 ? (
        <View className={`mt-4 rounded-2xl p-4 ${surfaceClass}`}>
          <Text className={`text-sm ${textClass}`}>No notifications yet.</Text>
        </View>
      ) : (
        <View className="mt-4 gap-3">
          <Text className={`text-xs font-semibold ${mutedClass}`}>Swipe left to delete • swipe right to mark unread</Text>
          {notifications.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              isDarkUi={isDarkUi}
              onDelete={deleteNotification}
              onMarkUnread={markNotificationUnread}
              onOpenChat={handleOpenChatFromNotification}
            />
          ))}
        </View>
      )}

      {errorMessage ? <Text className="mt-4 text-sm text-red-500">{errorMessage}</Text> : null}
    </ScrollView>
  );
}
