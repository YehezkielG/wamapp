# Explore Module

Dokumentasi fitur layar `/explore`.

## Tujuan

- Menampilkan weather layer tile di peta.
- Menambahkan, menampilkan, dan menghapus `marked_locations` per perangkat.
- Menyediakan pencarian lokasi berbasis Nominatim (OpenStreetMap).

## Arsitektur (anti-spaghetti)

Agar logic tidak menumpuk di screen, implementasi dipisah ke service:

- `app/(tabs)/explore/index.tsx`
  - UI + orchestration state.
  - Tidak memuat logic networking berat secara inline.
- `lib/explore/nominatimSearch.ts`
  - Search lokasi dari Nominatim.
  - Normalisasi hasil pencarian untuk UI.
- `lib/explore/markedLocationsService.ts`
  - Resolusi `device_id` dari tabel `devices`.
  - CRUD tabel `marked_locations`.

## Flow fitur

1. Screen load:
   - Load lokasi user (izin lokasi).
   - Load `marked_locations` untuk device aktif.
2. Saat map digeser/zoom:
  - Region map diperbarui.
  - `coverage area` ikut berubah.
3. Search lokasi:
   - User input query.
   - Panggil Nominatim (`/search?format=jsonv2...`).
   - Pilih hasil untuk fokus map atau simpan sebagai marked location.
4. Marked locations:
   - Tersimpan ke Supabase (`marked_locations`).
   - Tampil sebagai marker di map.
   - Bisa dihapus dari list.

## Database

Mengacu ke skema:

- `devices(id, push_token, latitude, longitude, last_active)`
- `marked_locations(id, device_id, latitude, longitude, location_name, created_at)`

`device_id` pada `marked_locations` mengarah ke `devices.id`.

## Konfigurasi environment

Pastikan env publik tersedia:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_OPENWEATHER_TILE_API_KEY` (opsional fallback tile langsung)

## Endpoint eksternal

- Nominatim:
  - `https://nominatim.openstreetmap.org/search`

## Catatan maintainability

- Tambahan logic baru sebaiknya dimasukkan ke `lib/explore/*Service.ts` atau `lib/explore/*Client.ts`.
- Hindari menambah HTTP call langsung di file screen kecuali untuk orchestration ringan.
- Tetap gunakan type model terpusat per service agar kontrak data jelas.
- Untuk UI kompleks berikutnya, ekstrak panel menjadi komponen terpisah (mis. `components/explore/*`).
