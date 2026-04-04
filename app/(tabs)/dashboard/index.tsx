import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

type WeatherApiResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('Detecting location...');
  const [temperatureC, setTemperatureC] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | undefined>(undefined);
  const [unit, setUnit] = useState<'C' | 'F'>('C');

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const loadWeather = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Location permission was denied.');
        }

        const location = await Location.getCurrentPositionAsync({});
        const latitude = location.coords.latitude;
        const longitude = location.coords.longitude;

        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        const place = reverseGeocode[0];
        const cityOrRegion = place?.city || place?.subregion || place?.region;
        const country = place?.country;

        if (cityOrRegion && country) {
          setLocationName(`${cityOrRegion}, ${country}`);
        } else {
          setLocationName(`${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
        }

        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
        );

        if (!weatherResponse.ok) {
          throw new Error('Failed to fetch weather data.');
        }

        const weatherData = (await weatherResponse.json()) as WeatherApiResponse;
        const currentWeather = weatherData.current;

        if (typeof currentWeather?.temperature_2m !== 'number') {
          throw new Error('Temperature data is unavailable.');
        }

        setTemperatureC(currentWeather.temperature_2m);
        setWeatherCode(currentWeather.weather_code);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while loading weather data.';
        setErrorMessage(message);
        setWeatherCode(undefined);
        setLocationName('Location unavailable');
      } finally {
        setIsLoading(false);
      }
    };

    loadWeather();
  }, []);

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

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-3 text-base text-slate-700">Loading weather data...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 px-6">
      <Text className="mb-3 text-3xl font-bold text-slate-900">Current Weather</Text>

      <Text className="mb-1.5 text-center text-lg text-slate-700">{locationName}</Text>
      <Text className="mb-5 text-4xl font-bold text-slate-800">{displayedTime}</Text>

      <View className="mb-2.5 flex-row items-center gap-3">
        <Text className="text-[56px] font-extrabold leading-[62px] text-slate-900">
          {displayedTemperature}°
        </Text>

        <View className="flex-row overflow-hidden rounded-full border border-slate-300">
          <Pressable
            className={`px-3.5 py-2 ${unit === 'C' ? 'bg-blue-600' : 'bg-white'}`}
            onPress={() => setUnit('C')}
          >
            <Text className={`text-sm font-bold ${unit === 'C' ? 'text-white' : 'text-slate-800'}`}>C</Text>
          </Pressable>

          <Pressable
            className={`px-3.5 py-2 ${unit === 'F' ? 'bg-blue-600' : 'bg-white'}`}
            onPress={() => setUnit('F')}
          >
            <Text className={`text-sm font-bold ${unit === 'F' ? 'text-white' : 'text-slate-800'}`}>F</Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-2 flex-row items-center gap-2 rounded-full bg-white px-4 py-2">
        <Ionicons name={weatherVisual.iconName} size={22} color={weatherVisual.iconColor} />
        <Text className="text-xl font-semibold text-slate-700">{weatherVisual.label}</Text>
      </View>

      {errorMessage ? (
        <Text className="mt-4 text-center text-sm text-red-600">{errorMessage}</Text>
      ) : null}
    </View>
  );
}
