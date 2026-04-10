// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

const FUNCTION_NAME = 'weather-anomaly-notifier';
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const OPEN_METEO_CALL_INTERVAL_MIN = 15; // only call Open-Meteo on quarter-hour marks (UTC)
const FORECAST_WINDOW_MINUTES = 60 * 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DeviceRow = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  push_token: string | null;
};

type NotificationRow = {
  id: string;
  category: string;
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
  const end = new Date(start.getTime() + FORECAST_WINDOW_MINUTES * 60 * 1000);

  return {
    startIso: toUtcMinuteIso(start),
    endIso: toUtcMinuteIso(end),
    targetSlotIso: toSlotIso(end),
  };
}

function detectAnomalies(input: {
  precipitationMm: number;
  windKmh: number;
  weatherCode: number;
  tempC: number;
  slotIso: string;
}) {
  const anomalies: Anomaly[] = [];

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

async function fetchForecastInWindow(
  latitude: number,
  longitude: number,
  window: { startIso: string; endIso: string }
) {
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
      headers: {
        'Accept': 'application/json',
      },
    },
    'Open-Meteo request'
  );

  const times = payload.minutely_15?.time ?? [];
  if (!times.length) {
    return null;
  }

  const targetIdx = times.findIndex((item) => item === window.endIso || item.startsWith(window.endIso));
  const idx = targetIdx >= 0 ? targetIdx : times.length - 1;

  if (idx < 0) {
    return null;
  }

  return {
    slotIso: toSlotIso(times[idx]),
    precipitationMm: payload.minutely_15?.precipitation?.[idx] ?? 0,
    windKmh: payload.minutely_15?.windspeed_10m?.[idx] ?? 0,
    weatherCode: payload.minutely_15?.weathercode?.[idx] ?? 0,
    tempC: payload.minutely_15?.temperature_2m?.[idx] ?? 0,
  };
}

function buildAnomalyKey(deviceId: string, slotIso: string, kind: string) {
  return `${deviceId}|${slotIso}|${kind}`;
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
    // Only run heavy Open-Meteo requests on quarter-hour marks (UTC).
    const nowUtc = new Date();
    if (nowUtc.getUTCMinutes() % OPEN_METEO_CALL_INTERVAL_MIN !== 0) {
      // Skip heavy Open-Meteo work outside quarter-hour marks (UTC).
      // Return 200 with a small JSON summary so callers can inspect totals.
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
    const targetSlotIso = windowIso.targetSlotIso;
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    const devices = await fetchJsonOrThrow<DeviceRow[]>(
      `${supabaseUrl}/rest/v1/devices?select=id,latitude,longitude,push_token&latitude=not.is.null&longitude=not.is.null`,
      { headers },
      'Load devices'
    );

    const notifSince = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const summary = {
      function: FUNCTION_NAME,
      targetSlotIso,
      devicesScanned: devices.length,
      anomaliesDetected: 0,
      notificationsInserted: 0,
      pushAttempted: 0,
      pushSent: 0,
      pushFailed: 0,
      skippedDuplicates: 0,
      failures: 0,
      failedDeviceIds: [] as string[],
    };

    for (const device of devices) {
      try {
        if (device.latitude === null || device.longitude === null) continue;

        const forecast = await fetchForecastInWindow(
          device.latitude,
          device.longitude,
          windowIso
        );
        if (!forecast) continue;

        const effectiveSlotIso = forecast.slotIso ?? targetSlotIso;
        const anomalies = detectAnomalies({ ...forecast, slotIso: effectiveSlotIso });
        summary.anomaliesDetected += anomalies.length;
        if (!anomalies.length) continue;

        const existing = await fetchJsonOrThrow<NotificationRow[]>(
          `${supabaseUrl}/rest/v1/notifications?select=id,category,data,created_at&device_id=eq.${device.id}&category=eq.weather-anomaly&created_at=gte.${encodeURIComponent(notifSince)}&order=created_at.desc&limit=100`,
          { headers },
          'Fetch existing notifications'
        );
        const existingKeys = new Set(
          existing
            .map((item) => {
              const slot = typeof item.data?.slot_iso === 'string' ? item.data.slot_iso : null;
              const kind = typeof item.data?.anomaly_kind === 'string' ? item.data.anomaly_kind : null;
              if (!slot || !kind) return null;
              return buildAnomalyKey(device.id, slot, kind);
            })
            .filter(Boolean) as string[]
        );

        const toInsert = anomalies
          .filter((anomaly) => {
            const key = buildAnomalyKey(device.id, effectiveSlotIso, anomaly.kind);
            if (existingKeys.has(key)) {
              summary.skippedDuplicates += 1;
              return false;
            }
            return true;
          })
          .map((anomaly) => ({
            device_id: device.id,
            title: anomaly.title,
            message: anomaly.message,
            category: 'weather-anomaly',
            data: {
              anomaly_kind: anomaly.kind,
              severity: anomaly.severity,
              slot_iso: effectiveSlotIso,
              forecast: forecast,
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

        if (isExpoPushToken(device.push_token)) {
          for (const payload of toInsert) {
            summary.pushAttempted += 1;
            try {
              await sendExpoPush({
                to: device.push_token,
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
              console.error('expo push send failed', {
                deviceId: device.id,
                error: pushError instanceof Error ? pushError.message : String(pushError),
              });
            }
          }
        }
      } catch (deviceError) {
        summary.failures += 1;
        summary.failedDeviceIds.push(device.id);
        console.error('device anomaly processing failed', {
          deviceId: device.id,
          error: deviceError instanceof Error ? deviceError.message : String(deviceError),
        });
      }
    }

    return jsonResponse(summary, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: true,
        message: error instanceof Error ? error.message : 'Unexpected anomaly notifier error',
      },
      500
    );
  }
});
