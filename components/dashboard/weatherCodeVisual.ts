import { Ionicons } from '@expo/vector-icons';

export function weatherCodeToIcon(code?: number): keyof typeof Ionicons.glyphMap {
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

export function weatherCodeToColor(code?: number): string {
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
