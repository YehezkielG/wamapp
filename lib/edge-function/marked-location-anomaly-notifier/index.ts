// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

const FUNCTION_NAME = 'marked-location-anomaly-notifier';
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const OPEN_METEO_CALL_INTERVAL_MIN = 15;
const MAX_FORECAST_WINDOW_MINUTES = 60 * 5;
const RECENT_DUPLICATE_WINDOW_MINUTES = 15;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type MarkedLocationRow = {
  id: string;
  device_id: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
};

type DeviceTokenRow = {
  id: string;
  push_token: string | null;
};

type NotificationRow = {
  id: string;
  data: Record<string, unknown> | null;
  created_at: string;
};

type ForecastPayload = {
  minutely_15?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    windspeed_10m?: number[];
    weathercode?: number[];
  };
};

type Anomaly = {
  kind: 'rain' | 'wind' | 'thunderstorm' | 'heat' | 'cold';
  title: string;
  message: string; 
  severity: 'info' | 'warning' | 'critical';
};

type ForecastPoint = {
  slotIso: string;
  precipitationMm: number;
  windKmh: number;
  weatherCode: number;
  tempC: number;
};

type AnomalyCandidate = {
  anomaly: Anomaly;
  forecast: ForecastPoint;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function compactErrorBody(body: string, maxLength = 500) {
  const compacted = body.replace(/\s+/g, ' ').trim();
  if (!compacted) return '(empty body)';
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength)}...` : compacted;
}

async function fetchJsonOrThrow<T>(url: string, init: RequestInit, operation: string): Promise<T> {
  const response = await fetch(url, init);
  const raw = await response.text().catch(() => '');

  if (!response.ok) {
    throw new Error(`${operation} failed (${response.status}): ${compactErrorBody(raw)}`);
  }

  if (!raw) {
    throw new Error(`${operation} failed: empty JSON response`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch (parseError) {
    throw new Error(
      `${operation} failed: invalid JSON response (${parseError instanceof Error ? parseError.message : String(parseError)}). Body: ${compactErrorBody(raw)}`
    );
  }
}

function floorToQuarterHourUtc(date: Date) {
  const cloned = new Date(date);
  cloned.setUTCSeconds(0, 0);
  const minute = cloned.getUTCMinutes();
  cloned.setUTCMinutes(minute - (minute % 15));
  return cloned;
}

function toUtcMinuteIso(date: Date) {
  return date.toISOString().slice(0, 16);
}

function toSlotIso(dateLike: string | Date) {
  const date = typeof dateLike === 'string' ? new Date(dateLike + 'Z') : dateLike;
  return date.toISOString().slice(0, 16) + ':00';
}

function getForecastWindowIso() {
  const now = new Date();
  const start = floorToQuarterHourUtc(now);
  const end = new Date(start.getTime() + MAX_FORECAST_WINDOW_MINUTES * 60 * 1000);

  return {
    startIso: toUtcMinuteIso(start),
    endIso: toUtcMinuteIso(end),
    windowEndIso: toSlotIso(end),
  };
}

function formatRelativeHours(slotIsoStr: string) {
  try {
    const slotDate = new Date(slotIsoStr + 'Z');
    const now = new Date();
    const diffMs = slotDate.getTime() - now.getTime();
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    if (hours <= 0) return 'now';
    if (hours === 1) return 'in 1 hour';
    return `in ${hours} hours`;
  } catch {
    return 'in a few hours';
  }
}

function detectAnomalies(input: {
  precipitationMm: number;
  windKmh: number;
  weatherCode: number;
  tempC: number;
  slotIso: string;
}) {
  const anomalies: Anomaly[] = [];
  const rel = formatRelativeHours(input.slotIso);

  if (input.weatherCode >= 95) {
    anomalies.push({
      kind: 'thunderstorm',
      title: 'Thunderstorm Alert',
      message: `Potential thunderstorm ${rel}.`,
      severity: 'critical',
    });
  }

  if (input.precipitationMm >= 6) {
    anomalies.push({
      kind: 'rain',
      title: 'Heavy Rain Alert',
      message: `Heavy rain forecast ${rel} (${input.precipitationMm.toFixed(1)} mm).`,
      severity: 'warning',
    });
  }

  if (input.windKmh >= 40) {
    anomalies.push({
      kind: 'wind',
      title: 'Strong Wind Alert',
      message: `Strong wind forecast ${rel} (${input.windKmh.toFixed(1)} km/h).`,
      severity: 'warning',
    });
  }

  if (input.tempC >= 35) {
    anomalies.push({
      kind: 'heat',
      title: 'Heat Alert',
      message: `High temperature forecast ${rel} (${input.tempC.toFixed(1)}°C).`,
      severity: 'warning',
    });
  }

  if (input.tempC <= 5) {
    anomalies.push({
      kind: 'cold',
      title: 'Cold Alert',
      message: `Low temperature forecast ${rel} (${input.tempC.toFixed(1)}°C).`,
      severity: 'info',
    });
  }

  return anomalies;
}

async function fetchForecastPointsInWindow(
  latitude: number,
  longitude: number,
  window: { startIso: string; endIso: string }
): Promise<ForecastPoint[]> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('minutely_15', 'temperature_2m,precipitation,windspeed_10m,weathercode');
  url.searchParams.set('start_minutely_15', window.startIso);
  url.searchParams.set('end_minutely_15', window.endIso);
  url.searchParams.set('timezone', 'UTC');

  const payload = await fetchJsonOrThrow<ForecastPayload>(
    url.toString(),
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    'Open-Meteo request'
  );

  const times = payload.minutely_15?.time ?? [];
  if (!times.length) return [];

  return times.map((slotTime, idx) => ({
    slotIso: toSlotIso(slotTime),
    precipitationMm: payload.minutely_15?.precipitation?.[idx] ?? 0,
    windKmh: payload.minutely_15?.windspeed_10m?.[idx] ?? 0,
    weatherCode: payload.minutely_15?.weathercode?.[idx] ?? 0,
    tempC: payload.minutely_15?.temperature_2m?.[idx] ?? 0,
  }));
}

function pickEarliestAnomalyCandidates(points: ForecastPoint[]) {
  const earliestByKind = new Map<Anomaly['kind'], AnomalyCandidate>();

  for (const point of points) {
    const anomaliesAtSlot = detectAnomalies(point);
    for (const anomaly of anomaliesAtSlot) {
      if (!earliestByKind.has(anomaly.kind)) {
        earliestByKind.set(anomaly.kind, {
          anomaly,
          forecast: point,
        });
      }
    }
  }

  return Array.from(earliestByKind.values());
}

function buildAnomalyKey(deviceId: string, locationId: string, slotIso: string, kind: string) {
  return `${deviceId}|${locationId}|${slotIso}|${kind}`;
}

function isExpoPushToken(token: string | null | undefined) {
  if (!token) return false;
  return /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);
}

async function sendExpoPush(payload: {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}) {
  const result = await fetchJsonOrThrow<{ data?: { status?: string } }>(
    EXPO_PUSH_URL,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: payload.to,
        title: payload.title,
        body: payload.body,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        data: payload.data,
      }),
    },
    'Expo push request'
  );

  const status = result?.data?.status;
  if (status && status !== 'ok') {
    throw new Error(`Expo push rejected message: ${JSON.stringify(result)}`);
  }

  return result;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: true, message: 'Use POST request.' }, 405);
  }

  try {
    const nowUtc = new Date();
    if (nowUtc.getUTCMinutes() % OPEN_METEO_CALL_INTERVAL_MIN !== 0) {
      return jsonResponse(
        {
          skipped: true,
          notificationsInserted: 0,
          pushAttempted: 0,
          pushSent: 0,
          anomaliesDetected: 0,
        },
        200
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          error: true,
          message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in function secrets.',
        },
        500
      );
    }

    const windowIso = getForecastWindowIso();
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    const markedLocations = await fetchJsonOrThrow<MarkedLocationRow[]>(
      `${supabaseUrl}/rest/v1/marked_locations?select=id,device_id,location_name,latitude,longitude&device_id=not.is.null&latitude=not.is.null&longitude=not.is.null`,
      { headers },
      'Load marked locations'
    );

    const summary = {
      function: FUNCTION_NAME,
      forecastWindowEndIso: windowIso.windowEndIso,
      locationsScanned: markedLocations.length,
      anomaliesDetected: 0,
      notificationsInserted: 0,
      pushAttempted: 0,
      pushSent: 0,
      pushFailed: 0,
      skippedDuplicates: 0,
      skippedRecentDuplicates: 0,
      failures: 0,
      failedLocationIds: [] as string[],
    };

    if (!markedLocations.length) {
      return jsonResponse(summary, 200);
    }

    const deviceIds = [...new Set(markedLocations.map((item) => item.device_id).filter(Boolean) as string[])];
    const inClause = deviceIds.join(',');

    const deviceRows = inClause
      ? await fetchJsonOrThrow<DeviceTokenRow[]>(
          `${supabaseUrl}/rest/v1/devices?select=id,push_token&id=in.(${inClause})`,
          { headers },
          'Load device push tokens'
        )
      : [];

    const tokenByDeviceId = new Map(deviceRows.map((row) => [row.id, row.push_token]));

    const notifSince = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const recentDuplicateSince = new Date(
      Date.now() - RECENT_DUPLICATE_WINDOW_MINUTES * 60 * 1000
    ).toISOString();

    for (const location of markedLocations) {
      try {
        if (!location.device_id || location.latitude === null || location.longitude === null) continue;

        const forecastPoints = await fetchForecastPointsInWindow(
          location.latitude,
          location.longitude,
          windowIso
        );
        if (!forecastPoints.length) continue;

        const anomalyCandidates = pickEarliestAnomalyCandidates(forecastPoints);
        summary.anomaliesDetected += anomalyCandidates.length;
        if (!anomalyCandidates.length) continue;

        const existing = await fetchJsonOrThrow<NotificationRow[]>(
          `${supabaseUrl}/rest/v1/notifications?select=id,data,created_at&device_id=eq.${location.device_id}&category=eq.weather-anomaly-marked-location&created_at=gte.${encodeURIComponent(notifSince)}&order=created_at.desc&limit=200`,
          { headers },
          'Fetch existing marked-location notifications'
        );

        const existingKeys = new Set(
          existing
            .map((item) => {
              const slot = typeof item.data?.slot_iso === 'string' ? item.data.slot_iso : null;
              const kind = typeof item.data?.anomaly_kind === 'string' ? item.data.anomaly_kind : null;
              const locationId = typeof item.data?.location_id === 'string' ? item.data.location_id : null;
              if (!slot || !kind || !locationId) return null;
              return buildAnomalyKey(location.device_id as string, locationId, slot, kind);
            })
            .filter(Boolean) as string[]
        );

        const recentKindsForLocation = new Set(
          existing
            .filter((item) => item.created_at >= recentDuplicateSince)
            .map((item) => {
              const kind = typeof item.data?.anomaly_kind === 'string' ? item.data.anomaly_kind : null;
              const locationId = typeof item.data?.location_id === 'string' ? item.data.location_id : null;
              if (!kind || !locationId || locationId !== location.id) return null;
              return kind;
            })
            .filter(Boolean) as string[]
        );

        const locationName = (location.location_name ?? 'Saved Location').trim() || 'Saved Location';

        const toInsert = anomalyCandidates
          .filter((candidate) => {
            const key = buildAnomalyKey(
              location.device_id as string,
              location.id,
              candidate.forecast.slotIso,
              candidate.anomaly.kind
            );
            if (existingKeys.has(key)) {
              summary.skippedDuplicates += 1;
              return false;
            }

            if (recentKindsForLocation.has(candidate.anomaly.kind)) {
              summary.skippedRecentDuplicates += 1;
              return false;
            }

            return true;
          })
          .map((candidate) => ({
            device_id: location.device_id,
            title: `${locationName}: ${candidate.anomaly.title}`,
            message: candidate.anomaly.message,
            category: 'weather-anomaly-marked-location',
            data: {
              anomaly_kind: candidate.anomaly.kind,
              severity: candidate.anomaly.severity,
              slot_iso: candidate.forecast.slotIso,
              location_id: location.id,
              location_name: locationName,
              source: 'marked-location',
              forecast: candidate.forecast,
            },
            is_read: false,
          }));

        if (!toInsert.length) continue;

        const insertResp = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(toInsert),
        });

        if (!insertResp.ok) {
          const detail = await insertResp.text();
          throw new Error(`Failed to insert notifications: ${insertResp.status} ${detail}`);
        }

        summary.notificationsInserted += toInsert.length;

        const pushToken = tokenByDeviceId.get(location.device_id);
        if (isExpoPushToken(pushToken)) {
          for (const payload of toInsert) {
            summary.pushAttempted += 1;
            try {
              await sendExpoPush({
                to: pushToken,
                title: payload.title,
                body: payload.message,
                data: {
                  category: payload.category,
                  device_id: payload.device_id,
                  ...payload.data,
                },
              });
              summary.pushSent += 1;
            } catch (pushError) {
              summary.pushFailed += 1;
              console.error('expo push send failed (marked location)', {
                locationId: location.id,
                error: pushError instanceof Error ? pushError.message : String(pushError),
              });
            }
          }
        }
      } catch (locationError) {
        summary.failures += 1;
        summary.failedLocationIds.push(location.id);
        console.error('marked-location anomaly processing failed', {
          locationId: location.id,
          error: locationError instanceof Error ? locationError.message : String(locationError),
        });
      }
    }

    return jsonResponse(summary, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: true,
        message: error instanceof Error ? error.message : 'Unexpected marked-location anomaly notifier error',
      },
      500
    );
  }
});
