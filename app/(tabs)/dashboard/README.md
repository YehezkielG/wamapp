# Dashboard (`/dashboard`)

Halaman ini menampilkan cuaca lokasi pengguna saat ini menggunakan **Open-Meteo** + lokasi perangkat (`expo-location`).

## Fitur Saat Ini

- Menampilkan lokasi pengguna saat ini (hasil reverse geocoding).
- Menampilkan jam realtime (`HH:mm`) yang update setiap detik.
- Menampilkan cuaca saat ini (ikon + label) berdasarkan `weather_code`.
- Menampilkan suhu dan toggle unit **Celsius/Fahrenheit**.
- Menampilkan kartu **Weather Details** (grid 2x2):
  - Kelembapan (`relative_humidity_2m`)
  - Kecepatan angin (`wind_speed_10m`)
  - UV index (`uv_index`)
  - Titik embun (`dew_point_2m`)
- Menampilkan **forecast 12 jam ke depan** pada lokasi user saat ini.
- Menggunakan skeleton loading di dashboard.
- Warna teks adaptif agar tetap terbaca di mode latar terang/gelap.

## Arsitektur (Progress Terbaru)

- **UI halaman utama dashboard**: `app/(tabs)/dashboard/index.tsx`
- **Komponen forecast 12 jam (terpusat)**: `components/dashboard/Forecast12Hours.tsx`
- **Logic request cuaca/lokasi (terpusat di lib)**: `lib/weather/weatherApi.ts`
- **State global + cache**: `lib/weather/weatherStore.ts` (Zustand)

## Mekanisme Cache & Refresh

- Dashboard menggunakan **Zustand** untuk menyimpan data cuaca terakhir.
- Saat masuk ke halaman, data cache dipakai dulu bila masih fresh (tidak loading ulang terus).
- Refresh data otomatis tiap **5 menit** (`WEATHER_REFRESH_INTERVAL_MS = 5 * 60 * 1000`).

## Sumber Data API

- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Query utama:
  - `latitude`
  - `longitude`
  - `current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,uv_index,dew_point_2m`
  - `hourly=temperature_2m,weather_code`
  - `timezone=auto`

## Ringkasan Mapping Ikon Cuaca

- `0` -> Cerah (`sunny`)
- `1-2` -> Cerah berawan (`partly-sunny`)
- `3` -> Berawan (`cloudy`)
- `45,48` -> Berkabut (`cloudy-outline`)
- `51,53,55` -> Gerimis (`rainy-outline`)
- `61,63,65` -> Hujan (`rainy`)
- `71,73,75` -> Salju (`snow`)
- `80,81,82` -> Hujan lebat (`rainy`)
- `95,96,99` -> Badai petir (`thunderstorm`)

## Catatan

- Jika izin lokasi ditolak, dashboard menampilkan pesan error yang ramah.
- Jika request API gagal, dashboard tetap render dengan fallback aman.
