// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

const FUNCTION_NAME = 'weather-anomaly-dummy-notifier';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DeviceRow = {
  id: string;
  push_token: string | null;
};

type DummyAnomaly = {
  kind: 'rain' | 'wind' | 'thunderstorm' | 'heat' | 'cold';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  value: number;
  unit: string;
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

function generateRandomAnomaly(): DummyAnomaly {
  const options: DummyAnomaly[] = [
    {
      kind: 'rain',
      title: 'Heavy Rain Alert',
      message: `Dummy alert: heavy rain expected (${randomInt(6, 25)} mm).`,
      severity: 'warning',
      value: randomInt(6, 25),
      unit: 'mm',
    },
    {
      kind: 'wind',
      title: 'Strong Wind Alert',
      message: `Dummy alert: strong wind expected (${randomInt(40, 85)} km/h).`,
      severity: 'warning',
      value: randomInt(40, 85),
      unit: 'km/h',
    },
    {
      kind: 'thunderstorm',
      title: 'Thunderstorm Alert',
      message: 'Dummy alert: potential thunderstorm in your area.',
      severity: 'critical',
      value: 95,
      unit: 'weathercode',
    },
    {
      kind: 'heat',
      title: 'Heat Alert',
      message: `Dummy alert: high temperature expected (${randomInt(35, 42)}°C).`,
      severity: 'warning',
      value: randomInt(35, 42),
      unit: '°C',
    },
    {
      kind: 'cold',
      title: 'Cold Alert',
      message: `Dummy alert: low temperature expected (${randomInt(-2, 5)}°C).`,
      severity: 'info',
      value: randomInt(-2, 5),
      unit: '°C',
    },
  ];

  return pickRandom(options);
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

    const devices = await fetchJsonOrThrow<DeviceRow[]>(
      `${supabaseUrl}/rest/v1/devices?select=id,push_token`,
      { headers },
      'Load devices'
    );

    const runId = crypto.randomUUID();
    const summary = {
      function: FUNCTION_NAME,
      runId,
      devicesScanned: devices.length,
      notificationsInserted: 0,
      pushAttempted: 0,
      pushSent: 0,
      pushFailed: 0,
      failures: 0,
      failedDeviceIds: [] as string[],
    };

    for (const device of devices) {
      try {
        const shouldNotify = Math.random() < 0.8;
        if (!shouldNotify) continue;

        const anomalyCount = randomInt(1, 2);
        const rows = Array.from({ length: anomalyCount }).map(() => {
          const anomaly = generateRandomAnomaly();
          return {
            device_id: device.id,
            title: anomaly.title,
            message: anomaly.message,
            category: 'weather-anomaly-dummy',
            data: {
              source: 'dummy-random',
              run_id: runId,
              anomaly_kind: anomaly.kind,
              severity: anomaly.severity,
              measured_value: anomaly.value,
              measured_unit: anomaly.unit,
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

        const inserted = await insertResp.text().catch(() => '');
        if (!insertResp.ok) {
          throw new Error(`Insert dummy notifications failed (${insertResp.status}): ${compactErrorBody(inserted)}`);
        }

        const insertedRows = inserted ? (JSON.parse(inserted) as { title: string; message: string; data: Record<string, unknown>; category: string }[]) : [];
        summary.notificationsInserted += rows.length;

        if (isExpoPushToken(device.push_token)) {
          const pushRows = insertedRows.length ? insertedRows : rows;
          for (const row of pushRows) {
            summary.pushAttempted += 1;
            try {
              await sendExpoPush({
                to: device.push_token,
                title: row.title,
                body: row.message,
                data: {
                  category: row.category,
                  device_id: device.id,
                  ...(row.data ?? {}),
                },
              });
              summary.pushSent += 1;
            } catch (pushError) {
              summary.pushFailed += 1;
              console.error('expo push send failed (dummy)', {
                deviceId: device.id,
                error: pushError instanceof Error ? pushError.message : String(pushError),
              });
            }
          }
        }
      } catch (deviceError) {
        summary.failures += 1;
        summary.failedDeviceIds.push(device.id);
        console.error('dummy anomaly processing failed', {
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
        message: error instanceof Error ? error.message : 'Unexpected dummy anomaly notifier error',
      },
    );
  }
});
