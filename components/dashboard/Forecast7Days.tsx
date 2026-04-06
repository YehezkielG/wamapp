import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ScrollView, Text, View } from 'react-native';
import { Pressable } from 'react-native';

export type ForecastHourItem = {
  time: string;
  temperatureC: number;
  weatherCode?: number;
};

export type ForecastDayItem = {
  date: string;
  temperatureMaxC: number;
  temperatureMinC: number;
  weatherCode?: number;
};

type Props = {
  items: ForecastDayItem[];
  hoursByDate: Record<string, ForecastHourItem[]>;
  unit: 'C' | 'F';
  isDarkUi: boolean;
  isLoading?: boolean;
};

function celsiusToFahrenheit(valueInCelsius: number) {
  return (valueInCelsius * 9) / 5 + 32;
}

function weatherCodeToIcon(code?: number): keyof typeof Ionicons.glyphMap {
  if (code === 0) return 'sunny';
  if (code === 1 || code === 2) return 'partly-sunny';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'cloudy-outline';
  if (code === 51 || code === 53 || code === 55) return 'rainy-outline';
  if (code === 61 || code === 63 || code === 65) return 'rainy';
  if (code === 71 || code === 73 || code === 75) return 'snow';
  if (code === 80 || code === 81 || code === 82) return 'rainy';
  if (code === 95 || code === 96 || code === 99) return 'thunderstorm';
  return 'help-circle-outline';
}

function weatherCodeToColor(code?: number): string {
  if (code === 0) return '#f59e0b';
  if (code === 1 || code === 2) return '#f59e0b';
  if (code === 3) return '#64748b';
  if (code === 45 || code === 48) return '#94a3b8';
  if (code === 51 || code === 53 || code === 55) return '#0ea5e9';
  if (code === 61 || code === 63 || code === 65) return '#0284c7';
  if (code === 71 || code === 73 || code === 75) return '#38bdf8';
  if (code === 80 || code === 81 || code === 82) return '#0369a1';
  if (code === 95 || code === 96 || code === 99) return '#7c3aed';
  return '#64748b';
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function orderHoursForSelectedDay(dateKey: string, items: ForecastHourItem[]): ForecastHourItem[] {
  if (!items.length) return items;

  const now = new Date();
  const nowMs = now.getTime();
  const nowHour = now.getHours();
  const todayKey = localDateKey(now);

  if (dateKey === todayKey) {
    const upcoming = items.filter((item) => new Date(item.time).getTime() >= nowMs);
    return upcoming.length ? upcoming : items;
  }

  const startIndex = items.findIndex((item) => new Date(item.time).getHours() >= nowHour);
  if (startIndex <= 0) return items;
  return [...items.slice(startIndex), ...items.slice(0, startIndex)];
}

function dayLabel(index: number) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  if (index === 2) return '2 day left';
  if (index === 3) return '3 days left';
  if (index === 4) return '4 days left';
  if (index === 5) return '5 days left';
  if (index === 6) return '6 days left';
  return '7 days left';
}

export default function Forecast7Days({
  items,
  hoursByDate,
  unit,
  isDarkUi,
  isLoading = false,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const titleClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const cardClass = isDarkUi
    ? 'border border-white/30 bg-white/15'
    : 'border border-white/70 bg-white/60';
  const primaryTextClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const secondaryTextClass = isDarkUi ? 'text-white/70' : 'text-slate-500';
  const skeletonBarClass = isDarkUi ? 'bg-white/30' : 'bg-slate-300/70';

  const hasItems = items.length > 0;

  const selectedHours = useMemo(() => {
    if (!selectedDate) return [];
    const source = hoursByDate[selectedDate] ?? [];
    return orderHoursForSelectedDay(selectedDate, source);
  }, [hoursByDate, selectedDate]);

  return (
    <View className="mt-8 w-full">
      <Text className={`text-2xl font-bold ${titleClass}`}>Next 7 Days</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3"
        contentContainerClassName="gap-3 pr-2">
        {hasItems
          ? items.map((item, index) => {
              const maxTemperature =
                unit === 'C'
                  ? `${item.temperatureMaxC.toFixed(1)}°C`
                  : `${celsiusToFahrenheit(item.temperatureMaxC).toFixed(1)}°F`;

              const minTemperature =
                unit === 'C'
                  ? `${item.temperatureMinC.toFixed(1)}°C`
                  : `${celsiusToFahrenheit(item.temperatureMinC).toFixed(1)}°F`;

              return (
                <Pressable
                  key={`${item.date}-${item.weatherCode ?? 'u'}`}
                  onPress={() => setSelectedDate((prev) => (prev === item.date ? null : item.date))}
                  className={`w-32 rounded-2xl p-3 ${cardClass}`}>
                  <Text className={`text-xs font-medium ${secondaryTextClass}`}>
                    {dayLabel(index)}
                  </Text>
                  <Ionicons
                    name={weatherCodeToIcon(item.weatherCode)}
                    size={20}
                    color={weatherCodeToColor(item.weatherCode)}
                    style={{ marginTop: 8 }}
                  />
                  <Text className={`mt-2 text-xs font-medium ${secondaryTextClass}`}>Max</Text>
                  <Text className={`text-base font-bold ${primaryTextClass}`}>
                    {maxTemperature}
                  </Text>
                  <Text className={`mt-0.5 text-xs ${secondaryTextClass}`}>Min</Text>
                  <Text className={`text-sm font-semibold ${primaryTextClass}`}>
                    {minTemperature}
                  </Text>

                  <View className="mt-2.5 items-center">
                    <Ionicons
                      name={
                        selectedDate === item.date ? 'chevron-up-circle' : 'chevron-down-circle'
                      }
                      size={16}
                      color={
                        selectedDate === item.date
                          ? weatherCodeToColor(item.weatherCode)
                          : '#94a3b8'
                      }
                    />
                  </View>
                </Pressable>
              );
            })
          : isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <View key={`skeleton-7d-${index}`} className={`w-32 rounded-2xl p-3 ${cardClass}`}>
                  <View className={`h-3 w-16 rounded ${skeletonBarClass}`} />
                  <View className={`mt-3 h-5 w-5 rounded-full ${skeletonBarClass}`} />
                  <View className={`mt-3 h-4 w-20 rounded ${skeletonBarClass}`} />
                  <View className={`mt-2 h-3 w-14 rounded ${skeletonBarClass}`} />
                </View>
              ))
            : null}
      </ScrollView>

      {selectedDate ? (
        <BlurView
          intensity={35}
          tint={isDarkUi ? 'dark' : 'light'}
          className="mt-4 overflow-hidden rounded-2xl border border-white/35">
          <View className="px-3 py-3">
            <Text className={`text-sm font-semibold ${titleClass}`}>Hourly for {selectedDate}</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-3"
              contentContainerClassName="gap-3 pr-2">
              {selectedHours.length ? (
                selectedHours.map((item) => {
                  const hourTemperature =
                    unit === 'C'
                      ? `${item.temperatureC.toFixed(1)}°C`
                      : `${celsiusToFahrenheit(item.temperatureC).toFixed(1)}°F`;

                  const hourLabel = new Date(item.time).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <View
                      key={`${item.time}-${item.weatherCode ?? 'u'}`}
                      className={`w-24 rounded-2xl p-3 ${cardClass}`}>
                      <Text className={`text-xs font-medium ${secondaryTextClass}`}>
                        {hourLabel}
                      </Text>
                      <Ionicons
                        name={weatherCodeToIcon(item.weatherCode)}
                        size={20}
                        color={weatherCodeToColor(item.weatherCode)}
                        style={{ marginTop: 8 }}
                      />
                      <Text className={`mt-2 text-base font-bold ${primaryTextClass}`}>
                        {hourTemperature}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text className={`text-xs ${secondaryTextClass}`}>Hourly data is unavailable.</Text>
              )}
            </ScrollView>
          </View>
        </BlurView>
      ) : null}
    </View>
  );
}
