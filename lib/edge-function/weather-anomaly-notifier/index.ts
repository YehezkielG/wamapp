// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

const FUNCTION_NAME = 'weather-anomaly-notifier';
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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
  hourly?: {
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

function floorToHour(date: Date) {
  const cloned = new Date(date);
  cloned.setMinutes(0, 0, 0);
  return cloned;
}

function getTargetForecastSlotIso() {
  const now = new Date();
  const nowHour = floorToHour(now);
  const target = new Date(nowHour.getTime() + 3 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 13) + ':00';
}

function detectAnomalies(input: {
  precipitationMm: number;
  windKmh: number;
  weatherCode: number;
  tempC: number;
  slotIso: string;
}) {
  const anomalies: Anomaly[] = [];

  if (input.weatherCode >= 95) {
    anomalies.push({
      kind: 'thunderstorm',
      title: 'Thunderstorm Alert',
      message: `Potential thunderstorm around ${input.slotIso}.`,
      severity: 'critical',
    });
  }

  if (input.precipitationMm >= 6) {
    anomalies.push({
      kind: 'rain',
      title: 'Heavy Rain Alert',
      message: `Heavy rain forecast around ${input.slotIso} (${input.precipitationMm.toFixed(1)} mm).`,
      severity: 'warning',
    });
  }

  if (input.windKmh >= 40) {
    anomalies.push({
      kind: 'wind',
      title: 'Strong Wind Alert',
      message: `Strong wind forecast around ${input.slotIso} (${input.windKmh.toFixed(1)} km/h).`,
      severity: 'warning',
    });
  }

  if (input.tempC >= 35) {
    anomalies.push({
      kind: 'heat',
      title: 'Heat Alert',
      message: `High temperature forecast around ${input.slotIso} (${input.tempC.toFixed(1)}°C).`,
      severity: 'warning',
    });
  }

  if (input.tempC <= 5) {
    anomalies.push({
      kind: 'cold',
      title: 'Cold Alert',
      message: `Low temperature forecast around ${input.slotIso} (${input.tempC.toFixed(1)}°C).`,
      severity: 'info',
    });
  }

  return anomalies;
}

async function fetchForecastThreeHoursAhead(latitude: number, longitude: number, slotIso: string) {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('hourly', 'temperature_2m,precipitation,windspeed_10m,weathercode');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('timezone', 'UTC');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Open-Meteo request failed (${response.status}): ${detail}`);
  }

  const payload = (await response.json()) as ForecastPayload;

  const times = payload.hourly?.time ?? [];
  const idx = times.findIndex((item) => item === slotIso);
  if (idx < 0) {
    return null;
  }

  return {
    precipitationMm: payload.hourly?.precipitation?.[idx] ?? 0,
    windKmh: payload.hourly?.windspeed_10m?.[idx] ?? 0,
    weatherCode: payload.hourly?.weathercode?.[idx] ?? 0,
    tempC: payload.hourly?.temperature_2m?.[idx] ?? 0,
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
  const response = await fetch(EXPO_PUSH_URL, {
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
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Expo push request failed (${response.status}): ${JSON.stringify(result)}`);
  }

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

    const targetSlotIso = getTargetForecastSlotIso();
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    const devicesResp = await fetch(
      `${supabaseUrl}/rest/v1/devices?select=id,latitude,longitude,push_token&latitude=not.is.null&longitude=not.is.null`,
      { headers }
    );

    if (!devicesResp.ok) {
      const detail = await devicesResp.text();
      throw new Error(`Failed to load devices: ${devicesResp.status} ${detail}`);
    }

    const devices = (await devicesResp.json()) as DeviceRow[];

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

        const forecast = await fetchForecastThreeHoursAhead(
          device.latitude,
          device.longitude,
          targetSlotIso
        );
        if (!forecast) continue;

        const anomalies = detectAnomalies({ ...forecast, slotIso: targetSlotIso });
        summary.anomaliesDetected += anomalies.length;
        if (!anomalies.length) continue;

        const existingResp = await fetch(
          `${supabaseUrl}/rest/v1/notifications?select=id,category,data,created_at&device_id=eq.${device.id}&category=eq.weather-anomaly&created_at=gte.${encodeURIComponent(notifSince)}&order=created_at.desc&limit=100`,
          { headers }
        );

        if (!existingResp.ok) {
          const detail = await existingResp.text();
          throw new Error(`Failed to fetch existing notifications: ${existingResp.status} ${detail}`);
        }

        const existing = (await existingResp.json()) as NotificationRow[];
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
            const key = buildAnomalyKey(device.id, targetSlotIso, anomaly.kind);
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
              slot_iso: targetSlotIso,
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
