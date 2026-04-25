import React, { useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type WeatherAlertEmergencyData = {
  title: string;
  message: string;
  createdAt: string;
};

type WeatherAlertEmergencyCardProps = {
  alert: WeatherAlertEmergencyData;
  isDarkUi: boolean;
  onDismiss?: () => void;
  onOpenChat?: () => void;
};

export default function WeatherAlertEmergencyCard({
  alert,
  isDarkUi,
  onDismiss,
  onOpenChat,
}: WeatherAlertEmergencyCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const formattedTime = useMemo(() => {
    const createdDate = new Date(alert.createdAt);
    if (Number.isNaN(createdDate.getTime())) return '';

    const diffMs = Date.now() - createdDate.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;

    return createdDate.toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [alert.createdAt]);

  const cardClass = isDarkUi
    ? 'w-full overflow-hidden rounded-2xl border border-white/20 bg-white/15 p-4'
    : 'w-full overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-4';

  const titleClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const messageClass = isDarkUi ? 'text-white/90' : 'text-slate-800';
  const mutedClass = isDarkUi ? 'text-white/70' : 'text-slate-600';

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 2 && Math.abs(gestureState.dy) < 18,
        onPanResponderMove: (_, gestureState) => {
          translateX.setValue(Math.max(-160, Math.min(160, gestureState.dx)));
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldDismiss = Math.abs(gestureState.dx) > 28 || Math.abs(gestureState.vx) > 0.12;

          if (shouldDismiss) {
            Animated.timing(translateX, {
              toValue: gestureState.dx >= 0 ? 260 : -260,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              onDismiss?.();
            });
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
    [onDismiss, translateX]
  );

  const cardOpacity = translateX.interpolate({
    inputRange: [-160, -80, 0],
    outputRange: [0.2, 0.65, 1],
    extrapolate: 'clamp',
  });

  const swipeHintOpacity = translateX.interpolate({
    inputRange: [-40, 0, 40],
    outputRange: [0.7, 0, 0.7],
    extrapolate: 'clamp',
  });

  return (
    <View className="w-full overflow-hidden rounded-2xl">
      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center"
        style={{ opacity: swipeHintOpacity }}>
        <Text className={`text-[11px] font-semibold ${isDarkUi ? 'text-white/65' : 'text-slate-500'}`}>
          Swipe to dismiss
        </Text>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }], opacity: cardOpacity }}>
        <Pressable className={cardClass} onPress={onOpenChat}>
          <View className="mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="warning-outline" size={18} color="#facc15" />
              <Text className={`text-sm font-bold tracking-wide ${titleClass}`}>WEATHER ALERT</Text>
            </View>
            {formattedTime ? <Text className={`text-[11px] ${mutedClass}`}>{formattedTime}</Text> : null}
          </View>

          <Text className={`text-base font-semibold ${titleClass}`} numberOfLines={2}>
            {alert.title}
          </Text>
          <Text className={`mt-1 text-sm leading-5 ${messageClass}`} numberOfLines={4}>
            {alert.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
