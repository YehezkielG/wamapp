import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type WeatherAlertEmergencyData = {
  title: string;
  message: string;
  createdAt: string;
};

type WeatherAlertEmergencyCardProps = {
  alert: WeatherAlertEmergencyData;
  isDarkUi: boolean;
};

export default function WeatherAlertEmergencyCard({
  alert,
  isDarkUi,
}: WeatherAlertEmergencyCardProps) {
  const formattedTime = useMemo(() => {
    const createdDate = new Date(alert.createdAt);
    if (Number.isNaN(createdDate.getTime())) return '';

    const diffMs = Date.now() - createdDate.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam lalu`;

    return createdDate.toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [alert.createdAt]);

  const cardClass = isDarkUi
    ? 'w-full rounded-2xl border border-rose-300/35 bg-rose-500/20 p-4'
    : 'w-full rounded-2xl border border-rose-300 bg-rose-50/95 p-4';

  const titleClass = isDarkUi ? 'text-rose-100' : 'text-rose-900';
  const messageClass = isDarkUi ? 'text-rose-100/90' : 'text-rose-800';
  const mutedClass = isDarkUi ? 'text-rose-100/75' : 'text-rose-700';

  return (
    <View className={cardClass}>
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="warning-outline" size={18} color={isDarkUi ? '#fecaca' : '#be123c'} />
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
    </View>
  );
}
