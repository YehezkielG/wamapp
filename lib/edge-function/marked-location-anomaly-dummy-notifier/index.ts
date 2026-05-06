// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

const FUNCTION_NAME = 'marked-location-anomaly-dummy-notifier';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

type DeviceRow = {
  id: string;
  push_token: string | null;
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

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(items: T[]) {
  return items[randomInt(0, items.length - 1)];
}

type DummyAnomaly = {
  kind: 'rain' | 'wind' | 'thunderstorm' | 'heat' | 'cold';
  title: string;
  message?: string;
  severity: 'info' | 'warning' | 'critical';
  value: number;
  unit: string;
};

function generateRandomAnomaly(): DummyAnomaly {
  const options: DummyAnomaly[] = [
    {
      kind: 'rain',
      title: 'Heavy Rain Alert',
      severity: 'warning',
      value: randomInt(6, 25),
      unit: 'mm',
    },
    {
      kind: 'wind',
      title: 'Strong Wind Alert',
      severity: 'warning',
      value: randomInt(40, 85),
      unit: 'km/h',
    },
    {
      kind: 'thunderstorm',
      title: 'Thunderstorm Alert',
      severity: 'critical',
      value: 95,
      unit: 'weathercode',
    },
    {
      kind: 'heat',
      title: 'Heat Alert',
      severity: 'warning',
      value: randomInt(35, 42),
      unit: '°C',
    },
    {
      kind: 'cold',
      title: 'Cold Alert',
      severity: 'info',
      value: randomInt(-2, 5),
      unit: '°C',
    },
  ];

  return pickRandom(options);
}

function floorToQuarterHourUtc(date = new Date()) {
  const cloned = new Date(date);
  cloned.setUTCSeconds(0, 0);
  const minute = cloned.getUTCMinutes();
  const next = minute - (minute % 15) + 15;
  cloned.setUTCMinutes(next);
  return cloned;
}

function toSlotIso(date: Date) {
  return date.toISOString().slice(0, 16) + ':00';
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

function buildDummyAnomalyMessage(anomaly: DummyAnomaly, relativeText: string) {
  if (anomaly.kind === 'thunderstorm') {
    return `Potential thunderstorm ${relativeText}.`;
  }

  if (anomaly.kind === 'rain') {
    return `Heavy rain expected ${relativeText} (${anomaly.value.toFixed(1)} mm).`;
  }

  if (anomaly.kind === 'wind') {
    return `Strong wind expected ${relativeText} (${anomaly.value.toFixed(1)} km/h).`;
  }

  if (anomaly.kind === 'heat') {
    return `High temperature expected ${relativeText} (${anomaly.value.toFixed(1)}°C).`;
  }

  return `Low temperature expected ${relativeText} (${anomaly.value.toFixed(1)}°C).`;
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

    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };

    // Load marked locations that have device and coordinates
    const markedLocations = await fetchJsonOrThrow<MarkedLocationRow[]>(
      `${supabaseUrl}/rest/v1/marked_locations?select=id,device_id,location_name,latitude,longitude&device_id=not.is.null&latitude=not.is.null&longitude=not.is.null`,
      { headers },
      'Load marked locations'
    );

    const runId = crypto.randomUUID();

    const summary = {
      function: FUNCTION_NAME,
      runId,
      locationsScanned: markedLocations.length,
      notificationsInserted: 0,
      pushAttempted: 0,
      pushSent: 0,
      pushFailed: 0,
      failures: 0,
      failedLocationIds: [] as string[],
    };

    if (!markedLocations.length) {
      return jsonResponse(summary, 200);
    }

    const deviceIds = [...new Set(markedLocations.map((l) => l.device_id).filter(Boolean) as string[])];
    const inClause = deviceIds.join(',');

    const deviceRows = inClause
      ? await fetchJsonOrThrow<DeviceRow[]>(
          `${supabaseUrl}/rest/v1/devices?select=id,push_token&id=in.(${inClause})`,
          { headers },
          'Load device push tokens'
        )
      : [];

    const tokenByDeviceId = new Map(deviceRows.map((r) => [r.id, r.push_token]));

    for (const location of markedLocations) {
      try {
        if (!location.device_id || location.latitude === null || location.longitude === null) continue;

        const shouldNotify = Math.random() < 0.8; // 80% of locations
        if (!shouldNotify) continue;

        const anomalyCount = randomInt(1, 2);
        const slotOffsetMinutes = randomInt(1, 8) * 15; // soon-ish
        const slotDate = new Date(floorToQuarterHourUtc().getTime() + slotOffsetMinutes * 60 * 1000);
        const slotIso = toSlotIso(slotDate);
        const countdownText = formatRelativeHours(slotIso);
        const countdownSeconds = Math.max(0, Math.round((new Date(slotIso + 'Z').getTime() - Date.now()) / 1000));

        const rows = Array.from({ length: anomalyCount }).map(() => {
          const anomaly = generateRandomAnomaly();
          const locationName = (location.location_name ?? 'Saved Location').trim() || 'Saved Location';
          return {
            device_id: location.device_id,
            title: `${locationName}: ${anomaly.title}`,
            message: buildDummyAnomalyMessage(anomaly, countdownText),
            category: 'weather-anomaly-marked-location-dummy',
            data: {
              source: 'marked-location-dummy',
              run_id: runId,
              anomaly_kind: anomaly.kind,
              severity: anomaly.severity,
              measured_value: anomaly.value,
              measured_unit: anomaly.unit,
              slot_iso: slotIso,
              countdown_seconds: countdownSeconds,
              countdown_text: countdownText,
              location_id: location.id,
              location_name: location.location_name,
              latitude: location.latitude,
              longitude: location.longitude,
            },
            is_read: false,
          };
        });

        const insertResp = await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            ...headers,
            Prefer: 'return=representation',
          },
          body: JSON.stringify(rows),
        });

        const insertedText = await insertResp.text().catch(() => '');
        if (!insertResp.ok) {
          throw new Error(`Insert dummy notifications failed (${insertResp.status}): ${compactErrorBody(insertedText)}`);
        }

        const insertedRows = insertedText ? (JSON.parse(insertedText) as any[]) : [];
        summary.notificationsInserted += rows.length;

        const pushToken = tokenByDeviceId.get(location.device_id);
        if (isExpoPushToken(pushToken)) {
          const pushRows = insertedRows.length ? insertedRows : rows;
          for (const row of pushRows) {
            summary.pushAttempted += 1;
            try {
              await sendExpoPush({
                to: pushToken,
                title: row.title,
                body: row.message,
                data: {
                  category: row.category,
                  device_id: row.device_id,
                  ...(row.data ?? {}),
                },
              });
              summary.pushSent += 1;
            } catch (pushError) {
              summary.pushFailed += 1;
              console.error('expo push send failed (marked-location-dummy)', {
                locationId: location.id,
                error: pushError instanceof Error ? pushError.message : String(pushError),
              });
            }
          }
        }
      } catch (locError) {
        summary.failures += 1;
        summary.failedLocationIds.push(location.id);
        console.error('marked-location dummy processing failed', {
          locationId: location.id,
          error: locError instanceof Error ? locError.message : String(locError),
        });
      }
    }

    return jsonResponse(summary, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: true,
        message: error instanceof Error ? error.message : 'Unexpected marked-location-dummy notifier error',
      },
      500
    );
  }
});
