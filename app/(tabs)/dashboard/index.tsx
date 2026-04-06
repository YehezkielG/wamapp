import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardSkeleton from '../../../components/skeleton_loading/Dashboard';
import { useWeatherBackground } from '../../../components/WeatherBackgroundContext';
import Forecast12Hours from '../../../components/dashboard/Forecast12Hours';
import Forecast7Days from '../../../components/dashboard/Forecast7Days';
import { useWeatherStore, WEATHER_REFRESH_INTERVAL_MS } from '../../../lib/weather/weatherStore';
import { useShallow } from 'zustand/react/shallow';

type WeatherVisual = {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
};

function weatherCodeToVisual(code?: number): WeatherVisual {
  if (code === 0) return { label: 'Clear', iconName: 'sunny', iconColor: '#f59e0b' };
  if (code === 1 || code === 2) {
    return { label: 'Partly Cloudy', iconName: 'partly-sunny', iconColor: '#f59e0b' };
  }
  if (code === 3) return { label: 'Cloudy', iconName: 'cloudy', iconColor: '#64748b' };
  if (code === 45 || code === 48) {
    return { label: 'Foggy', iconName: 'cloudy-outline', iconColor: '#94a3b8' };
  }
  if (code === 51 || code === 53 || code === 55) {
    return { label: 'Drizzle', iconName: 'rainy-outline', iconColor: '#0ea5e9' };
  }
  if (code === 61 || code === 63 || code === 65) {
    return { label: 'Rain', iconName: 'rainy', iconColor: '#0284c7' };
  }
  if (code === 71 || code === 73 || code === 75) {
    return { label: 'Snow', iconName: 'snow', iconColor: '#38bdf8' };
  }
  if (code === 80 || code === 81 || code === 82) {
    return { label: 'Heavy Rain', iconName: 'rainy', iconColor: '#0369a1' };
  }
  if (code === 95 || code === 96 || code === 99) {
    return { label: 'Thunderstorm', iconName: 'thunderstorm', iconColor: '#7c3aed' };
  }
  return { label: 'Unknown Weather', iconName: 'help-circle-outline', iconColor: '#64748b' };
}

function celsiusToFahrenheit(valueInCelsius: number) {
  return (valueInCelsius * 9) / 5 + 32;
}

export default function Dashboard() {
  const [now, setNow] = useState(new Date());
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const { data, isLoading, errorMessage } = useWeatherStore(
    useShallow((state) => ({
      data: state.data,
      isLoading: state.isLoading,
      errorMessage: state.errorMessage,
    }))
  );

  const locationName = data?.locationName ?? 'Detecting location...';
  const temperatureC = data?.temperatureC ?? null;
  const weatherCode = data?.weatherCode;
  const details =
    data?.details ??
    ({
      humidity: null,
      windSpeed: null,
      uvIndex: null,
      dewPointC: null,
    } as const);
  const forecastHours = data?.forecastHours ?? [];
  const forecastDays = data?.forecastDays ?? [];
  const forecastHoursByDate = data?.forecastHoursByDate ?? {};

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const runFetch = () => {
      void useWeatherStore.getState().fetchWeather();
    };

    runFetch();

    const refreshIntervalId = setInterval(() => {
      runFetch();
    }, WEATHER_REFRESH_INTERVAL_MS);

    return () => clearInterval(refreshIntervalId);
  }, []);

  // update global background when weather or time changes
  const { setFromWeather } = useWeatherBackground();
  const currentHour = useMemo(() => now.getHours(), [now]);

  useEffect(() => {
    try {
      setFromWeather(weatherCode, currentHour);
    } catch {
      // noop if provider not available
    }
  }, [weatherCode, currentHour, setFromWeather]);

  const displayedTime = useMemo(
    () =>
      now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [now]
  );

  const displayedTemperature = useMemo(() => {
    if (temperatureC === null) return '--';
    if (unit === 'C') return temperatureC.toFixed(1);
    return celsiusToFahrenheit(temperatureC).toFixed(1);
  }, [temperatureC, unit]);

  const weatherVisual = useMemo(() => weatherCodeToVisual(weatherCode), [weatherCode]);

  const isDarkUi = useMemo(() => {
    const isNight = currentHour >= 19 || currentHour < 5;
    const isStorm = weatherCode !== undefined && [95, 96, 99].includes(weatherCode);
    return isNight || isStorm;
  }, [currentHour, weatherCode]);

  const textColor = useMemo(
    () => ({
      title: isDarkUi ? 'text-white' : 'text-slate-900',
      primary: isDarkUi ? 'text-white' : 'text-slate-800',
      secondary: isDarkUi ? 'text-white/85' : 'text-slate-700',
      muted: isDarkUi ? 'text-white/70' : 'text-slate-500',
      cardValue: isDarkUi ? 'text-white' : 'text-slate-900',
      weatherLabel: isDarkUi ? 'text-white/90' : 'text-slate-800',
      error: isDarkUi ? 'text-red-200' : 'text-red-700',
    }),
    [isDarkUi]
  );

  const surfaceClass = useMemo(
    () => (isDarkUi ? 'border border-white/30 bg-white/15' : 'border border-white/70 bg-white/60'),
    [isDarkUi]
  );

  const unitBorderClass = isDarkUi ? 'border-white/40' : 'border-slate-300';

  const timeOfDay = useMemo(() => {
    const hour = now.getHours();
    if (hour >= 5 && hour < 12)
      return { label: 'Morning', iconName: 'sunny' as const, color: '#f59e0b' };
    if (hour >= 12 && hour < 17)
      return { label: 'Afternoon', iconName: 'partly-sunny' as const, color: '#fb923c' };
    if (hour >= 17 && hour < 20)
      return { label: 'Evening', iconName: 'partly-sunny' as const, color: '#7c3aed' };
    return { label: 'Night', iconName: 'moon' as const, color: '#2563eb' };
  }, [now]);

  const displayedDewPoint = useMemo(() => {
    if (details.dewPointC === null) return '--';
    if (unit === 'C') return `${details.dewPointC.toFixed(1)} °C`;
    return `${celsiusToFahrenheit(details.dewPointC).toFixed(1)} °F`;
  }, [details.dewPointC, unit]);

  const weatherDetailItems = useMemo(
    () => [
      {
        label: 'Humidity',
        value: details.humidity === null ? '--' : `${details.humidity.toFixed(0)}%`,
      },
      {
        label: 'Wind Speed',
        value: details.windSpeed === null ? '--' : `${details.windSpeed.toFixed(1)} km/h`,
      },
      {
        label: 'UV Index',
        value: details.uvIndex === null ? '--' : details.uvIndex.toFixed(1),
      },
      {
        label: 'Dew Point',
        value: displayedDewPoint,
      },
    ],
    [details.humidity, details.windSpeed, details.uvIndex, displayedDewPoint]
  );

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  return (
    <ScrollView
      className="flex-1 bg-transparent"
      contentContainerClassName="items-center px-6 pt-14 pb-12">
      <Text className={`mb-3 text-center text-3xl font-bold ${textColor.title}`}>
        Current Weather
      </Text>

      <Text className={`mb-1.5 text-center text-lg ${textColor.secondary}`}>{locationName}</Text>
      <Text className={`mb-2 text-center text-4xl font-bold ${textColor.primary}`}>
        {displayedTime}
      </Text>

      <View className="mb-2.5 flex-row items-center justify-center gap-3">
        <Text className={`text-[56px] font-extrabold leading-[62px] ${textColor.primary}`}>
          {displayedTemperature}°
        </Text>

        <View className={`flex-row overflow-hidden rounded-full border ${unitBorderClass}`}>
          <Pressable
            className={`px-3.5 py-2 ${unit === 'C' ? 'bg-blue-600/50' : 'bg-white/50'}`}
            onPress={() => setUnit('C')}>
            <Text className={`text-sm font-bold ${unit === 'C' ? 'text-white' : 'text-slate-800'}`}>
              C
            </Text>
          </Pressable>

          <Pressable
            className={`px-3.5 py-2 ${unit === 'F' ? 'bg-blue-600/50' : 'bg-white/50'}`}
            onPress={() => setUnit('F')}>
            <Text className={`text-sm font-bold ${unit === 'F' ? 'text-white' : 'text-slate-800'}`}>
              F
            </Text>
          </Pressable>
        </View>
      </View>

      <View
        className={`mt-2 flex-row items-center justify-center gap-2 rounded-full px-4 py-2 ${surfaceClass}`}>
        <Ionicons name={timeOfDay.iconName} size={22} color={timeOfDay.color} />
        <Ionicons name={weatherVisual.iconName} size={22} color={weatherVisual.iconColor} />
        <Text className={`text-xl font-semibold ${textColor.weatherLabel}`}>
          {weatherVisual.label}
        </Text>
      </View>

      <Text className={`mt-8 text-2xl font-bold ${textColor.title}`}>Weather Details</Text>
      <View className="mt-3 flex-row flex-wrap justify-between gap-y-3">
        {weatherDetailItems.map((item) => (
          <View key={item.label} className={`w-[48%] rounded-2xl p-4 ${surfaceClass}`}>
            <Text className={`mt-2 text-lg font-bold ${textColor.cardValue}`}>{item.value}</Text>
            <Text className={`text-sm font-medium ${textColor.muted}`}>{item.label}</Text>
          </View>
        ))}
      </View>

      {forecastHours.length ? (
        <Forecast12Hours items={forecastHours} unit={unit} isDarkUi={isDarkUi} />
      ) : null}

      <Forecast7Days
        items={forecastDays}
        hoursByDate={forecastHoursByDate}
        unit={unit}
        isDarkUi={isDarkUi}
        isLoading={isLoading && !data}
      />

      {errorMessage ? (
        <Text className={`mt-4 text-center text-sm ${textColor.error}`}>{errorMessage}</Text>
      ) : null}
    </ScrollView>
  );
}
