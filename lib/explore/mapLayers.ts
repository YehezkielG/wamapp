export type ExploreLayerId = 'precipitation' | 'wind' | 'clouds' | 'temperature';

export type OpenWeatherVariable = 'rain_1h' | 'wind_speed' | 'clouds_all' | 'temp';

export type ExploreLayer = {
  id: ExploreLayerId;
  label: string;
  variable: OpenWeatherVariable;
  unit: string;
  min: number;
  max: number;
};

export const EXPLORE_LAYERS: ExploreLayer[] = [
  {
    id: 'precipitation',
    label: 'Precipitation',
    variable: 'rain_1h',
    unit: 'mm',
    min: 0,
    max: 10,
  },
  {
    id: 'wind',
    label: 'Wind Speed (10m)',
    variable: 'wind_speed',
    unit: 'km/h',
    min: 0,
    max: 80,
  },
  {
    id: 'clouds',
    label: 'Cloud Cover',
    variable: 'clouds_all',
    unit: '%',
    min: 0,
    max: 100,
  },
  {
    id: 'temperature',
    label: 'Temperature (2m)',
    variable: 'temp',
    unit: '°C',
    min: -10,
    max: 45,
  },
];
