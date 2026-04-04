# Dashboard Page (`/dashboard`)

This page shows the user's current weather information using **Open-Meteo** and device location.

## Features

- Detects the user's current location using `expo-location`.
- Reverse geocodes latitude/longitude into a readable place name.
- Fetches current weather from Open-Meteo (`temperature_2m`, `weather_code`).
- Displays live time (`HH:mm`) that updates every second.
- Shows temperature in Celsius with a toggle to Fahrenheit.
- Renders a **colored weather icon** based on Open-Meteo `weather_code`.

## Data Source

- API: `https://api.open-meteo.com/v1/forecast`
- Query params used:
  - `latitude`
  - `longitude`
  - `current=temperature_2m,weather_code`
  - `timezone=auto`

## Main File

- `app/(tabs)/dashboard/index.tsx`

## Weather Icon Mapping (summary)

- `0` -> Clear (`sunny`, amber)
- `1-2` -> Partly Cloudy (`partly-sunny`, amber)
- `3` -> Cloudy (`cloudy`, slate)
- `45,48` -> Foggy (`cloudy-outline`, light slate)
- `51,53,55` -> Drizzle (`rainy-outline`, sky)
- `61,63,65` -> Rain (`rainy`, blue)
- `71,73,75` -> Snow (`snow`, cyan)
- `80,81,82` -> Heavy Rain (`rainy`, deep blue)
- `95,96,99` -> Thunderstorm (`thunderstorm`, violet)

## Notes

- If location permission is denied, the page shows a friendly error message.
- If weather data fails, the page keeps rendering with fallback values.
