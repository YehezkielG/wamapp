import React, { useMemo } from 'react';
import { BlurView } from 'expo-blur';
import { FlatList, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import { useForecastUiStore } from '../../lib/weather/forecastUiStore';
import { weatherCodeToIcon } from './weatherCodeVisual';

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

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function orderHoursForSelectedDay(items: ForecastHourItem[]): ForecastHourItem[] {
  return [...items].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function initialHourIndexForSelectedDay(dateKey: string, items: ForecastHourItem[]): number {
  if (!items.length) return 0;

  const now = new Date();
  const nowMs = now.getTime();
  const nowHour = now.getHours();
  const todayKey = localDateKey(now);

  if (dateKey === todayKey) {
    const exactIndex = items.findIndex((item) => new Date(item.time).getTime() >= nowMs);
    return exactIndex < 0 ? 0 : exactIndex;
  }

  const hourIndex = items.findIndex((item) => new Date(item.time).getHours() >= nowHour);
  return hourIndex < 0 ? 0 : hourIndex;
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
  const { visibleDayCount, selectedDate, loadMoreDays, toggleSelectedDate } = useForecastUiStore(
    useShallow((state) => ({
      visibleDayCount: state.visibleDayCount,
      selectedDate: state.selectedDate,
      loadMoreDays: state.loadMoreDays,
      toggleSelectedDate: state.toggleSelectedDate,
    }))
  );

  const titleClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const cardClass = isDarkUi
    ? 'border border-white/30 bg-white/15'
    : 'border border-white/70 bg-white/60';
  const primaryTextClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const secondaryTextClass = isDarkUi ? 'text-white/70' : 'text-slate-500';
  const skeletonBarClass = isDarkUi ? 'bg-white/30' : 'bg-slate-300/70';

  const hasItems = items.length > 0;

  const visibleDays = useMemo(
    () => (hasItems ? items.slice(0, Math.min(visibleDayCount, items.length)) : []),
    [hasItems, items, visibleDayCount]
  );

  const allSelectedHours = useMemo(() => {
    if (!selectedDate) return [];
    const source = hoursByDate[selectedDate] ?? [];
    return orderHoursForSelectedDay(source);
  }, [hoursByDate, selectedDate]);

  const initialHourIndex = useMemo(() => {
    if (!selectedDate) return 0;
    return initialHourIndexForSelectedDay(selectedDate, allSelectedHours);
  }, [allSelectedHours, selectedDate]);

  return (
    <View className="mt-8 w-full">
      <Text className={`text-2xl font-bold ${titleClass}`}>Next 7 Days</Text>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3"
        contentContainerStyle={{ paddingRight: 8, columnGap: 12 }}
        data={hasItems ? visibleDays : []}
        keyExtractor={(item) => `${item.date}-${item.weatherCode ?? 'u'}`}
        onEndReachedThreshold={0.65}
        onEndReached={() => {
          if (hasItems && visibleDayCount < items.length) {
            loadMoreDays(items.length);
          }
        }}
        ListEmptyComponent={
          isLoading ? (
            <View className="flex-row gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <View key={`skeleton-7d-${index}`} className={`w-32 rounded-2xl p-3 ${cardClass}`}>
                  <View className={`h-3 w-16 rounded ${skeletonBarClass}`} />
                  <View className={`mt-3 h-5 w-5 rounded-full ${skeletonBarClass}`} />
                  <View className={`mt-3 h-4 w-20 rounded ${skeletonBarClass}`} />
                  <View className={`mt-2 h-3 w-14 rounded ${skeletonBarClass}`} />
                </View>
              ))}
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
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
              onPress={() => toggleSelectedDate(item.date)}
              className={`w-32 rounded-2xl p-3 ${cardClass}`}>
              <Text className={`text-xs font-medium ${secondaryTextClass}`}>{dayLabel(index)}</Text>
              <Ionicons
                name={weatherCodeToIcon(item.weatherCode)}
                size={20}
                color="#f59e0b"
                style={{ marginTop: 8 }}
              />
              <Text className={`mt-2 text-xs font-medium ${secondaryTextClass}`}>Max</Text>
              <Text className={`text-base font-bold ${primaryTextClass}`}>{maxTemperature}</Text>
              <Text className={`mt-0.5 text-xs ${secondaryTextClass}`}>Min</Text>
              <Text className={`text-sm font-semibold ${primaryTextClass}`}>{minTemperature}</Text>

              <View className="mt-2.5 items-center">
                <Ionicons
                  name={selectedDate === item.date ? 'chevron-up-circle' : 'chevron-down-circle'}
                  size={16}
                  color={selectedDate === item.date ? '#f59e0b' : '#94a3b8'}
                />
              </View>
            </Pressable>
          );
        }}
      />

      {selectedDate ? (
        <BlurView
          intensity={35}
          tint={isDarkUi ? 'dark' : 'light'}
          className="mt-4 overflow-hidden rounded-2xl border border-white/35">
          <View className="px-3 py-3">
            <Text className={`text-sm font-semibold ${titleClass}`}>Hourly for {selectedDate}</Text>

            <FlatList
              key={selectedDate}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-3"
              contentContainerStyle={{ paddingRight: 8, columnGap: 12 }}
              data={allSelectedHours}
              keyExtractor={(item) => `${item.time}-${item.weatherCode ?? 'u'}`}
              initialScrollIndex={Math.max(0, initialHourIndex)}
              getItemLayout={(_, index) => ({ length: 108, offset: 108 * index, index })}
              ListEmptyComponent={
                <Text className={`text-xs ${secondaryTextClass}`}>Hourly data is unavailable.</Text>
              }
              renderItem={({ item }) => {
                const hourTemperature =
                  unit === 'C'
                    ? `${item.temperatureC.toFixed(1)}°C`
                    : `${celsiusToFahrenheit(item.temperatureC).toFixed(1)}°F`;

                const hourLabel = new Date(item.time).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <View className={`w-24 rounded-2xl p-3 ${cardClass}`}>
                    <Text className={`text-xs font-medium ${secondaryTextClass}`}>{hourLabel}</Text>
                    <Ionicons
                      name={weatherCodeToIcon(item.weatherCode)}
                      size={20}
                      color="#f59e0b"
                      style={{ marginTop: 8 }}
                    />
                    <Text className={`mt-2 text-base font-bold ${primaryTextClass}`}>
                      {hourTemperature}
                    </Text>
                  </View>
                );
              }}
            />
          </View>
        </BlurView>
      ) : null}
    </View>
  );
}
