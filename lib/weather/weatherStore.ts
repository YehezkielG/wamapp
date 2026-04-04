import { create } from 'zustand';
import { fetchWeatherSnapshot, type WeatherSnapshot } from './weatherApi';

export const WEATHER_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type WeatherStore = {
  data: WeatherSnapshot | null;
  isLoading: boolean;
  errorMessage: string | null;
  lastFetchedAt: number | null;
  fetchWeather: (options?: { force?: boolean }) => Promise<void>;
};

export const useWeatherStore = create<WeatherStore>((set, get) => ({
  data: null,
  isLoading: false,
  errorMessage: null,
  lastFetchedAt: null,

  fetchWeather: async (options) => {
    const force = options?.force ?? false;
    const currentState = get();
    const now = Date.now();

    if (currentState.isLoading) return;

    if (
      !force &&
      currentState.data &&
      currentState.lastFetchedAt &&
      now - currentState.lastFetchedAt < WEATHER_REFRESH_INTERVAL_MS
    ) {
      return;
    }

    set({
      isLoading: !currentState.data,
      errorMessage: null,
    });

    try {
      const snapshot = await fetchWeatherSnapshot();
      set({
        data: snapshot,
        lastFetchedAt: snapshot.fetchedAt,
        isLoading: false,
        errorMessage: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while loading weather data.',
      });
    }
  },
}));
