import { Ionicons } from '@expo/vector-icons';

export type MarkedLocationWeather = {
  temperatureC: number | null;
  windSpeedKmh: number | null;
  weatherCode: number | null;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
};

type OpenMeteoCurrentResponse = {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
};

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

function toVisual(code?: number): {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
} {
  if (code === 0) return { label: 'Clear', iconName: 'sunny', iconColor: '#f59e0b' };
  if (code === 1 || code === 2) return { label: 'Partly Cloudy', iconName: 'partly-sunny', iconColor: '#f59e0b' };
  if (code === 3) return { label: 'Cloudy', iconName: 'cloudy', iconColor: '#64748b' };
  if (code === 45 || code === 48) return { label: 'Foggy', iconName: 'cloudy-outline', iconColor: '#94a3b8' };
  if (code === 51 || code === 53 || code === 55) return { label: 'Drizzle', iconName: 'rainy-outline', iconColor: '#0ea5e9' };
  if (code === 61 || code === 63 || code === 65) return { label: 'Rain', iconName: 'rainy', iconColor: '#0284c7' };
  if (code === 71 || code === 73 || code === 75) return { label: 'Snow', iconName: 'snow', iconColor: '#38bdf8' };
  if (code === 80 || code === 81 || code === 82) return { label: 'Heavy Rain', iconName: 'rainy', iconColor: '#0369a1' };
  if (code === 95 || code === 96 || code === 99) {
    return { label: 'Thunderstorm', iconName: 'thunderstorm', iconColor: '#7c3aed' };
  }

  return { label: 'Unknown', iconName: 'help-circle-outline', iconColor: '#64748b' };
}

export async function fetchMarkedLocationWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<MarkedLocationWeather> {
  const query = new URLSearchParams({
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    current: 'temperature_2m,wind_speed_10m,weather_code',
    timezone: 'auto',
  });

  const response = await fetch(`${OPEN_METEO_FORECAST_URL}?${query.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Weather request failed (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as OpenMeteoCurrentResponse;
  const current = payload.current;

  const temperatureC = Number(current?.temperature_2m);
  const windSpeedKmh = Number(current?.wind_speed_10m);
  const weatherCode = Number(current?.weather_code);
  const visual = toVisual(Number.isFinite(weatherCode) ? weatherCode : undefined);

  return {
    temperatureC: Number.isFinite(temperatureC) ? temperatureC : null,
    windSpeedKmh: Number.isFinite(windSpeedKmh) ? windSpeedKmh : null,
    weatherCode: Number.isFinite(weatherCode) ? weatherCode : null,
    label: visual.label,
    iconName: visual.iconName,
    iconColor: visual.iconColor,
  };
}
