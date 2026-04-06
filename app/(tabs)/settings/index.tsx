import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeatherStore } from '../../../lib/weather/weatherStore';

export default function Settings() {
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const weatherCode = useWeatherStore((state) => state.data?.weatherCode);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);

    return () => clearInterval(timerId);
  }, []);

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

  const menuItems = [
    { id: 'appearance', label: 'Appearance', icon: 'color-palette-outline' as const },
    { id: 'notifications', label: 'Notifications', icon: 'notifications-outline' as const },
    { id: 'about', label: 'About App', icon: 'information-circle-outline' as const },
  ];

  return (
    <View className="flex-1 px-4 pt-8">
      <Text className={`text-2xl font-bold ${titleClass}`}>Settings</Text>
      <Text className={`mt-1 text-xs ${mutedClass}`}>Interactive theme follows weather and time.</Text>

      <View className={`mt-4 rounded-2xl p-3 ${surfaceClass}`}>
        {menuItems.map((item, index) => (
          <Pressable
            key={item.id}
            className={`flex-row items-center justify-between rounded-xl px-3 py-3 ${
              index !== menuItems.length - 1 ? 'mb-2' : ''
            } ${isDarkUi ? 'bg-white/10' : 'bg-white/75'}`}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name={item.icon} size={18} color={isDarkUi ? '#e2e8f0' : '#334155'} />
              <Text className={`text-sm font-medium ${textClass}`}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDarkUi ? '#cbd5e1' : '#64748b'} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}