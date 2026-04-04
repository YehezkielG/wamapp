import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ColorValue } from 'react-native';

type BackgroundContextValue = {
  colors: ColorValue[];
  setFromWeather: (weatherCode?: number, hour?: number) => void;
};

const WeatherBackgroundContext = createContext<BackgroundContextValue | null>(null);

function defaultGradient(): ColorValue[] {
  return ['#f8fafc', '#e2e8f0'];
}

function computeGradient(weatherCode?: number, hour?: number): ColorValue[] {
  // Prefer weather-based gradients, then fall back to time of day.
  if (weatherCode !== undefined && weatherCode !== null) {
    // Thunderstorm
    if ([95, 96, 99].includes(weatherCode)) return ['#0f172a', '#312e81'];
    // Heavy rain / rain
    if ([80, 81, 82, 61, 63, 65].includes(weatherCode)) return ['#0ea5e9', '#0369a1'];
    // Snow
    if ([71, 73, 75].includes(weatherCode)) return ['#e6f5ff', '#bae6fd'];
    // Fog / cloudy
    if ([45, 48, 3].includes(weatherCode)) return ['#cbd5e1', '#94a3b8'];
    // Drizzle
    if ([51, 53, 55].includes(weatherCode)) return ['#bae6fd', '#7dd3fc'];
    // Partly cloudy
    if ([1, 2].includes(weatherCode)) return ['#fef3c7', '#bfdbfe'];
    // Clear
    if (weatherCode === 0) return ['#ffedd5', '#fef3c7'];
  }

  // Fallback to time of day
  const h = typeof hour === 'number' ? hour : new Date().getHours();
  if (h >= 5 && h < 12) return ['#ffedd5', '#ffd6a5']; // morning
  if (h >= 12 && h < 17) return ['#fef3c7', '#fde68a']; // afternoon
  if (h >= 17 && h < 20) return ['#fed7aa', '#93c5fd']; // evening
  return ['#0f172a', '#0ea5e9']; // night
}

export function WeatherBackgroundProvider({ children }: { children: React.ReactNode }) {
  const [colors, setColors] = useState<ColorValue[]>(defaultGradient());

  const setFromWeather = useCallback((weatherCode?: number, hour?: number) => {
    const g = computeGradient(weatherCode, hour);
    setColors((previous) => {
      if (
        previous.length === g.length &&
        previous.every((value, index) => String(value) === String(g[index]))
      ) {
        return previous;
      }
      return g;
    });
  }, []);

  const value = useMemo(() => ({ colors, setFromWeather }), [colors, setFromWeather]);

  return <WeatherBackgroundContext.Provider value={value}>{children}</WeatherBackgroundContext.Provider>;
}

export function useWeatherBackground() {
  const ctx = useContext(WeatherBackgroundContext);
  if (!ctx) throw new Error('useWeatherBackground must be used within WeatherBackgroundProvider');
  return ctx;
}

export default WeatherBackgroundContext;