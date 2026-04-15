import React, { Fragment, useEffect, useMemo, useRef } from 'react';
import { BlurView } from 'expo-blur';
import { FlatList, Pressable, Text, View } from 'react-native';
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
  const todayKey = localDateKey(now);

  if (dateKey !== todayKey) return 0;

  const nowHour = now.getHours();
  const targetTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const currentHourIndex = items.findIndex((item) => new Date(item.time).getHours() >= nowHour);
  const targetHourIndex = items.findIndex(
    (item) => new Date(item.time).getTime() >= targetTime.getTime()
  );

  if (currentHourIndex >= 0 && targetHourIndex >= 0) {
    // Keep current hour visible while still biasing the list toward now + 3 hours.
    return Math.max(0, Math.min(currentHourIndex, targetHourIndex - 1));
  }

  if (currentHourIndex >= 0) return Math.max(0, currentHourIndex);
  if (targetHourIndex >= 0) return Math.max(0, targetHourIndex - 1);
  return 0;
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
  const { selectedDate, setSelectedDate, toggleSelectedDate } = useForecastUiStore(
    useShallow((state) => ({
      selectedDate: state.selectedDate,
      setSelectedDate: state.setSelectedDate,
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

  const allSelectedHours = useMemo(() => {
    if (!selectedDate) return [];
    const source = hoursByDate[selectedDate] ?? [];
    return orderHoursForSelectedDay(source);
  }, [hoursByDate, selectedDate]);

  const initialHourIndex = useMemo(() => {
    if (!selectedDate) return 0;
    return initialHourIndexForSelectedDay(selectedDate, allSelectedHours);
  }, [allSelectedHours, selectedDate]);

  const hourlyListRef = useRef<FlatList<ForecastHourItem>>(null);
  const hasInitializedDefaultSelectionRef = useRef(false);

  useEffect(() => {
    if (hasInitializedDefaultSelectionRef.current) return;
    if (!items.length) return;

    const todayDate = localDateKey(new Date());
    const defaultDate = items.find((item) => item.date === todayDate)?.date ?? items[0]?.date;

    if (defaultDate) {
      setSelectedDate(defaultDate);
    }

    hasInitializedDefaultSelectionRef.current = true;
  }, [items, selectedDate, setSelectedDate]);

  useEffect(() => {
    if (!selectedDate || !allSelectedHours.length) return;

    const timer = setTimeout(() => {
      hourlyListRef.current?.scrollToIndex({
        index: initialHourIndex,
        animated: false,
        viewPosition: 0,
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedDate, allSelectedHours.length, initialHourIndex]);

  return (
    <View className="mt-8 pb-5 w-full">
      <Text className={`text-2xl font-bold ${titleClass}`}>Next 7 Days</Text>

      <View className="mt-3 gap-3">
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

              const isOpen = selectedDate === item.date;
              const detailHours = isOpen ? allSelectedHours : [];

              return (
                <Fragment key={`${item.date}-${item.weatherCode ?? 'u'}`}>
                  <Pressable
                    onPress={() => toggleSelectedDate(item.date)}
                    className={`w-full rounded-2xl px-3 py-3 ${cardClass}`}>
                    <Text className={`text-xs ${secondaryTextClass}`}>{dayLabel(index)}</Text>

                    <View className="mt-3 flex-row items-center gap-3">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5">
                          <Text className={`text-xs ${secondaryTextClass}`}>Min</Text>
                          <Text className={`text-xs ${primaryTextClass}`}>{minTemperature}</Text>
                        </View>

                        <View className="mt-1.5 flex-row items-center gap-1.5">
                          <Text className={`text-xs ${secondaryTextClass}`}>Max</Text>
                          <Text className={`text-xs ${primaryTextClass}`}>{maxTemperature}</Text>
                        </View>
                      </View>
                    </View>

                    <View className="absolute" style={{ right: 12, top: '50%', marginTop: -13 }}>
                      <Ionicons
                        name={weatherCodeToIcon(item.weatherCode)}
                        size={26}
                        color="#f59e0b"
                      />
                    </View>
                  </Pressable>

                  {isOpen ? (
                    <BlurView
                      intensity={35}
                      tint={isDarkUi ? 'dark' : 'light'}
                      className="overflow-hidden rounded-2xl border border-white/35">
                      <View className="px-3 py-3">
                        <Text className={`text-sm font-semibold ${titleClass}`}>
                          Hourly for {item.date}
                        </Text>

                        <FlatList
                          ref={hourlyListRef}
                          key={item.date}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          className="mt-3"
                          contentContainerStyle={{ paddingRight: 8, columnGap: 12 }}
                          data={detailHours}
                          keyExtractor={(hourItem) =>
                            `${hourItem.time}-${hourItem.weatherCode ?? 'u'}`
                          }
                          getItemLayout={(_, listIndex) => ({
                            length: 108,
                            offset: 108 * listIndex,
                            index: listIndex,
                          })}
                          onScrollToIndexFailed={() => {
                            hourlyListRef.current?.scrollToOffset({
                              offset: Math.max(0, initialHourIndex) * 108,
                              animated: false,
                            });
                          }}
                          ListEmptyComponent={
                            <Text className={`text-xs ${secondaryTextClass}`}>
                              Hourly data is unavailable.
                            </Text>
                          }
                          renderItem={({ item: hourItem }) => {
                            const hourTemperature =
                              unit === 'C'
                                ? `${hourItem.temperatureC.toFixed(1)}°C`
                                : `${celsiusToFahrenheit(hourItem.temperatureC).toFixed(1)}°F`;

                            const hourLabel = new Date(hourItem.time).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                            });

                            return (
                              <View className={`w-24 rounded-2xl p-3 ${cardClass}`}>
                                <Text className={`text-xs font-medium ${secondaryTextClass}`}>
                                  {hourLabel}
                                </Text>
                                <Ionicons
                                  name={weatherCodeToIcon(hourItem.weatherCode)}
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
                </Fragment>
              );
            })
          : isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <View
                  key={`skeleton-7d-${index}`}
                  className={`h-24 w-full rounded-2xl p-3 ${cardClass}`}>
                  <View className={`h-3 w-24 rounded ${skeletonBarClass}`} />
                  <View className={`mt-3 h-4 w-40 rounded ${skeletonBarClass}`} />
                  <View className={`mt-2 h-4 w-36 rounded ${skeletonBarClass}`} />
                </View>
              ))
            : null}
      </View>
    </View>
  );
}
