import * as Location from 'expo-location';

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

export type WeatherDetails = {
  humidity: number | null;
  windSpeed: number | null;
  uvIndex: number | null;
  dewPointC: number | null;
};

export type WeatherSnapshot = {
  locationName: string;
  temperatureC: number;
  weatherCode?: number;
  details: WeatherDetails;
  forecastHours: ForecastHourItem[];
  forecastDays: ForecastDayItem[];
  forecastHoursByDate: Record<string, ForecastHourItem[]>;
  fetchedAt: number;
};

type WeatherApiResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    uv_index?: number;
    dew_point_2m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

export async function fetchWeatherSnapshot(): Promise<WeatherSnapshot> {
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

  const locationName =
    cityOrRegion && country
      ? `${cityOrRegion}, ${country}`
      : `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;

  const weatherResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,uv_index,dew_point_2m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=8&timezone=auto`
  );

  if (!weatherResponse.ok) {
    throw new Error('Failed to fetch weather data.');
  }

  const weatherData = (await weatherResponse.json()) as WeatherApiResponse;
  const currentWeather = weatherData.current;

  if (typeof currentWeather?.temperature_2m !== 'number') {
    throw new Error('Temperature data is unavailable.');
  }

  const details: WeatherDetails = {
    humidity:
      typeof currentWeather.relative_humidity_2m === 'number'
        ? currentWeather.relative_humidity_2m
        : null,
    windSpeed:
      typeof currentWeather.wind_speed_10m === 'number' ? currentWeather.wind_speed_10m : null,
    uvIndex: typeof currentWeather.uv_index === 'number' ? currentWeather.uv_index : null,
    dewPointC: typeof currentWeather.dew_point_2m === 'number' ? currentWeather.dew_point_2m : null,
  };

  const hourlyTime = weatherData.hourly?.time ?? [];
  const hourlyTemp = weatherData.hourly?.temperature_2m ?? [];
  const hourlyCode = weatherData.hourly?.weather_code ?? [];
  const dailyTime = weatherData.daily?.time ?? [];
  const dailyCode = weatherData.daily?.weather_code ?? [];
  const dailyMax = weatherData.daily?.temperature_2m_max ?? [];
  const dailyMin = weatherData.daily?.temperature_2m_min ?? [];

  let forecastHours: ForecastHourItem[] = [];
  let forecastDays: ForecastDayItem[] = [];
  let forecastHoursByDate: Record<string, ForecastHourItem[]> = {};

  if (hourlyTime.length && hourlyTemp.length) {
    const nowMs = Date.now();
    const combined: ForecastHourItem[] = hourlyTime
      .map((time, index) => ({
        time,
        temperatureC: hourlyTemp[index],
        weatherCode: hourlyCode[index],
      }))
      .filter((item) => typeof item.temperatureC === 'number');

    const upcoming = combined.filter((item) => new Date(item.time).getTime() >= nowMs).slice(0, 12);

    forecastHours = upcoming.length ? upcoming : combined.slice(0, 12);

    forecastHoursByDate = combined.reduce<Record<string, ForecastHourItem[]>>((acc, item) => {
      const dateKey = item.time.slice(0, 10);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(item);
      return acc;
    }, {});
  }

  if (dailyTime.length && dailyMax.length && dailyMin.length) {
    forecastDays = dailyTime
      .map((date, index) => ({
        date,
        temperatureMaxC: dailyMax[index],
        temperatureMinC: dailyMin[index],
        weatherCode: dailyCode[index],
      }))
      .filter(
        (item) =>
          typeof item.temperatureMaxC === 'number' && typeof item.temperatureMinC === 'number'
      )
      .slice(0, 8);
  }

  return {
    locationName,
    temperatureC: currentWeather.temperature_2m,
    weatherCode: currentWeather.weather_code,
    details,
    forecastHours,
    forecastDays,
    forecastHoursByDate,
    fetchedAt: Date.now(),
  };
}
