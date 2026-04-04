import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';

export type ForecastHourItem = {
  time: string;
  temperatureC: number;
  weatherCode?: number;
};

type Props = {
  items: ForecastHourItem[];
  unit: 'C' | 'F';
  isDarkUi: boolean;
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

export default function Forecast12Hours({ items, unit, isDarkUi }: Props) {
  const titleClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const cardClass = isDarkUi
    ? 'border border-white/30 bg-white/15'
    : 'border border-white/70 bg-white/60';
  const primaryTextClass = isDarkUi ? 'text-white' : 'text-slate-900';
  const secondaryTextClass = isDarkUi ? 'text-white/70' : 'text-slate-500';

  return (
    <View className="mt-8 w-full">
      <Text className={`text-2xl font-bold ${titleClass}`}>Next 12 Hours</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3"
        contentContainerClassName="gap-3 pr-2"
      >
        {items.map((item) => {
          const temperature =
            unit === 'C'
              ? `${item.temperatureC.toFixed(1)}°C`
              : `${celsiusToFahrenheit(item.temperatureC).toFixed(1)}°F`;

          const hourLabel = new Date(item.time).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <View key={`${item.time}-${item.weatherCode ?? 'u'}`} className={`w-24 rounded-2xl p-3 ${cardClass}`}>
              <Text className={`text-xs font-medium ${secondaryTextClass}`}>{hourLabel}</Text>
              <Ionicons name={weatherCodeToIcon(item.weatherCode)} size={20} color="#f59e0b" style={{ marginTop: 8 }} />
              <Text className={`mt-2 text-base font-bold ${primaryTextClass}`}>{temperature}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
