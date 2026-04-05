import type { ExploreLayerId } from './mapLayers';

export type ExploreAreaLevel = 'province' | 'city' | 'district';

export type ExploreRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type ExplorePlace = {
  name: string;
  state: string;
  country: string;
  level: ExploreAreaLevel;
};

export type ExploreMetrics = {
  humidity: number;
  pressure: number;
  feelsLike: number;
  windDirection: number;
  description: string;
};

export type ExploreSamplePoint = {
  id: string;
  latitude: number;
  longitude: number;
  values: Record<ExploreLayerId, number>;
  place: ExplorePlace;
  metrics: ExploreMetrics;
};

export type ExploreLayerRange = {
  min: number;
  max: number;
};

export type ExploreLayerRanges = Record<ExploreLayerId, ExploreLayerRange>;

export type ExploreLayerFetchResult = {
  samples: ExploreSamplePoint[];
  ranges: ExploreLayerRanges;
  updatedAt: string | null;
};

type ExploreEdgeResponse = {
  error: boolean;
  message?: string;
  updatedAt?: string;
  samples?: ExploreSamplePoint[];
  ranges?: Partial<ExploreLayerRanges>;
};

const EDGE_FUNCTION_NAME = 'openweather-explore';

function getEdgeFunctionUrl() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL in app environment.');
  }

  return `${supabaseUrl}/functions/v1/${EDGE_FUNCTION_NAME}`;
}

export async function fetchOpenWeatherLayerSamples(
  region: ExploreRegion,
  areaLevel: ExploreAreaLevel,
  signal?: AbortSignal
): Promise<ExploreLayerFetchResult> {
  const edgeUrl = getEdgeFunctionUrl();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const response = await fetch(edgeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
    },
    body: JSON.stringify({
      region,
      areaLevel,
    }),
    signal,
  });

  const payload = (await response.json()) as ExploreEdgeResponse;

  if (!response.ok || payload.error) {
    throw new Error(payload.message ?? 'Failed to load OpenWeatherMap layer samples.');
  }

  const samples = payload.samples ?? [];

  const ranges = normalizeRanges(payload.ranges, samples);

  return {
    samples,
    ranges,
    updatedAt: payload.updatedAt ?? null,
  };
}

function buildRangesFromSamples(samples: ExploreSamplePoint[]): ExploreLayerRanges {
  const initial: ExploreLayerRanges = {
    precipitation: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    wind: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    clouds: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
    temperature: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
  };

  for (const sample of samples) {
    for (const layerId of Object.keys(initial) as ExploreLayerId[]) {
      const value = Number(sample.values[layerId]);
      if (!Number.isFinite(value)) continue;
      initial[layerId].min = Math.min(initial[layerId].min, value);
      initial[layerId].max = Math.max(initial[layerId].max, value);
    }
  }

  for (const layerId of Object.keys(initial) as ExploreLayerId[]) {
    const layer = initial[layerId];
    if (!Number.isFinite(layer.min) || !Number.isFinite(layer.max)) {
      initial[layerId] = { min: 0, max: 1 };
      continue;
    }

    if (layer.min === layer.max) {
      initial[layerId] = { min: layer.min, max: layer.max + 1 };
    }
  }

  return initial;
}

function normalizeRanges(
  incomingRanges: Partial<ExploreLayerRanges> | undefined,
  samples: ExploreSamplePoint[]
): ExploreLayerRanges {
  const computed = buildRangesFromSamples(samples);

  if (!incomingRanges) {
    return computed;
  }

  const resolved: ExploreLayerRanges = {
    precipitation: incomingRanges.precipitation ?? computed.precipitation,
    wind: incomingRanges.wind ?? computed.wind,
    clouds: incomingRanges.clouds ?? computed.clouds,
    temperature: incomingRanges.temperature ?? computed.temperature,
  };

  return resolved;
}
