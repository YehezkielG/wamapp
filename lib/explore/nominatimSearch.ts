export type NominatimSearchResult = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
};

type NominatimRawItem = {
  place_id?: number;
  osm_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
};

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

export async function searchLocationsWithNominatim(
  query: string,
  signal?: AbortSignal
): Promise<NominatimSearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const params = new URLSearchParams({
    q: normalizedQuery,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
  });

  const response = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'id,en',
      'User-Agent': 'wamapp-explore-location-search/1.0',
    },
    signal,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Nominatim search failed (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as NominatimRawItem[];
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      const idValue = item.place_id ?? item.osm_id ?? `${latitude}-${longitude}`;

      return {
        id: String(idValue),
        displayName: item.display_name ?? 'Unknown location',
        latitude,
        longitude,
      } satisfies NominatimSearchResult;
    })
    .filter((item): item is NominatimSearchResult => Boolean(item));
}
