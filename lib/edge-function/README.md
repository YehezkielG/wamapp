# Supabase Edge Functions for Explore

Folder ini berisi kode function untuk memanggil provider cuaca dari server-side.

## Function yang dipakai

- `openweather-explore` → file: `openweather-explore/index.ts`
- `weather-anomaly-notifier` → file: `weather-anomaly-notifier/index.ts`
- `marked-location-anomaly-notifier` → file: `marked-location-anomaly-notifier/index.ts`
- `weather-anomaly-dummy-notifier` → file: `weather-anomaly-dummy-notifier/index.ts`

## Weather anomaly dummy notifier (random)

`weather-anomaly-dummy-notifier` melakukan:

- Ambil daftar `devices`.
- Generate data anomaly cuaca acak per device (dummy data).
- Insert ke tabel `notifications` dengan `category = weather-anomaly-dummy`.
- Kirim push ke Expo jika `devices.push_token` valid.

### Trigger via cron (setiap 15 menit)

Gunakan SQL di:

- `scripts/sql/cron_weather_anomaly_dummy_notifier.sql`

Ganti placeholder:

- `<PROJECT_REF>`
- `<SUPABASE_SERVICE_ROLE_KEY>`

Lalu jalankan di Supabase SQL Editor.

## Marked location anomaly notifier (5 jam ke depan)

`marked-location-anomaly-notifier` melakukan:

- Ambil daftar `marked_locations` yang punya `device_id`, `latitude`, dan `longitude`.
- Ambil forecast Open-Meteo (`minutely_15`) untuk slot **5 jam setelah waktu sekarang** (UTC).
- Deteksi anomaly cuaca per lokasi yang ditandai user.
- Insert ke tabel `notifications` dengan `category = weather-anomaly-marked-location`.
- Cegah duplikasi per `device_id + location_id + slot_iso + anomaly_kind`.
- Kirim push ke Expo jika `devices.push_token` valid.

### Trigger via cron (setiap 15 menit)

Gunakan SQL di:

- `scripts/sql/cron_marked_location_anomaly_notifier.sql`

Ganti placeholder:

- `<PROJECT_REF>`
- `<SUPABASE_SERVICE_ROLE_KEY>`

Lalu jalankan di Supabase SQL Editor.

## Weather anomaly notifier (5 jam ke depan)

`weather-anomaly-notifier` melakukan:

- Ambil daftar device yang punya `latitude` dan `longitude`.
- Ambil forecast Open-Meteo untuk slot **5 jam setelah waktu sekarang** (UTC).
- Deteksi anomaly cuaca (petir, hujan lebat, angin kencang, panas ekstrem, dingin ekstrem).
- Insert ke tabel `notifications` dengan `category = weather-anomaly`.
- Cegah duplikasi per `device_id + slot_iso + anomaly_kind`.
- Kirim push ke Expo (`https://exp.host/--/api/v2/push/send`) jika `devices.push_token` valid.

### Trigger via cron per menit

Job ini berjalan setiap menit, jadi notifikasi bisa diproses pada menit berapa saja tanpa menunggu jam tertentu.

Gunakan SQL di:

- `scripts/sql/cron_weather_anomaly_notifier.sql`

Ganti placeholder:

- `<PROJECT_REF>`
- `<SUPABASE_SERVICE_ROLE_KEY>`

Lalu jalankan di Supabase SQL Editor.
Skrip akan membuat job yang memanggil function setiap 15 menit.

### Trigger via cron (setiap 15 menit)

Function ini mengambil data OpenWeatherMap untuk grid titik pada area map Explore.
API key OpenWeatherMap disimpan sebagai secret di Supabase, bukan di client app.

### Request body (POST)

```json
{
	"region": {
		"latitude": -6.2,
		"longitude": 106.81,
		"latitudeDelta": 1.5,
		"longitudeDelta": 1.5
	},
	"areaLevel": "district"
}
```

- `areaLevel`: `district` atau `city`
	- `district` → titik lebih rapat (detail area)
	- `city` → agregasi per kota

### Response highlights

Setiap sample mengandung:

- `values`: precipitation, wind, clouds, temperature
- `place`: `name`, `state`, `country`, `level`
- `metrics`: humidity, pressure, feelsLike, windDirection, description

### Request body (POST)

```json
{
	"region": {
		"latitude": -6.2,
		"longitude": 106.81,
		"latitudeDelta": 1.5,
		"longitudeDelta": 1.5
	},
	"areaLevel": "district"
}
```

- `areaLevel`: `district` atau `city`
	- `district` → titik lebih rapat (detail area)
	- `city` → agregasi per kota

### Response highlights

Setiap sample mengandung:

- `values`: precipitation, wind, clouds, temperature
- `place`: `name`, `state`, `country`, `level`
- `metrics`: humidity, pressure, feelsLike, windDirection, description

## Deploy

```bash
supabase functions deploy openweather-explore --project-ref <YOUR_PROJECT_REF>
supabase functions deploy weather-anomaly-notifier --project-ref <YOUR_PROJECT_REF>
supabase functions deploy marked-location-anomaly-notifier --project-ref <YOUR_PROJECT_REF>
supabase functions deploy weather-anomaly-dummy-notifier --project-ref <YOUR_PROJECT_REF>
```

## Set secret

```bash
supabase secrets set OPENWEATHER_API_KEY=<YOUR_OPENWEATHER_API_KEY> --project-ref <YOUR_PROJECT_REF>
```

## Env yang dibutuhkan di app (client)

Isi di `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

> Catatan: `EXPO_PUBLIC_*` memang dikirim ke client. Jangan taruh `OPENWEATHER_API_KEY` di `.env` app.
