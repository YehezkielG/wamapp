import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useWeatherBackground } from '../components/WeatherBackgroundContext';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [dotCount, setDotCount] = useState(0);
  const { setFromWeather } = useWeatherBackground();

  useEffect(() => {
    setFromWeather(undefined, new Date().getHours());

    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, [setFromWeather]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDotCount((previous) => (previous + 1) % 4);
    }, 350);

    return () => clearInterval(timer);
  }, []);

  const loadingText = useMemo(() => `Wam App Loading${'.'.repeat(dotCount)}`, [dotCount]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-transparent px-6">
        <Text className="text-2xl font-bold tracking-wide text-white">{loadingText}</Text>
      </View>
    );
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
