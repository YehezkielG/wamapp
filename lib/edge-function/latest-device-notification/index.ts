// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type NotificationRow = {
  id: string;
  device_id: string | null;
  title: string;
  message: string;
  category: string;
  created_at: string;
};

type RequestBody = {
  action?: 'fetch' | 'mark-read';
  deviceId?: string | null;
  notificationId?: string | null;
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase environment variables' }, 500);
  }

  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    body = {};
  }

  const weatherCategories = ['weather-anomaly', 'weather-anomaly-marked-location'];
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  if (body.action === 'mark-read') {
    if (!body.notificationId) {
      return jsonResponse({ error: 'notificationId is required' }, 400);
    }

    const updateResp = await fetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${body.notificationId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_read: true }),
    });

    if (!updateResp.ok) {
      const detail = await updateResp.text().catch(() => '');
      return jsonResponse({ error: `Failed to mark notification read: ${updateResp.status} ${compactErrorBody(detail)}` }, 500);
    }

    return jsonResponse({ ok: true });
  }

  const cutoffIso = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  const queryParams = new URLSearchParams([
    ['select', 'id,device_id,title,message,category,created_at'],
    ['category', `in.(${weatherCategories.join(',')})`],
    ['is_read', 'eq.false'],
    ['created_at', `gte.${cutoffIso}`],
    ['order', 'created_at.desc'],
    ['limit', '1'],
  ]);

  if (body.deviceId) {
    queryParams.set('device_id', `eq.${body.deviceId}`);
  }

  const notifications = await fetchJsonOrThrow<NotificationRow[]>(
    `${supabaseUrl}/rest/v1/notifications?${queryParams.toString()}`,
    {
      method: 'GET',
      headers,
    },
    'Fetch latest notification'
  );

  if (notifications.length) {
    return jsonResponse({ notification: notifications[0] });
  }

  if (body.deviceId) {
    const fallback = await fetchJsonOrThrow<NotificationRow[]>(
      `${supabaseUrl}/rest/v1/notifications?select=id,device_id,title,message,category,created_at&is_read=eq.false&created_at=gte.${cutoffIso}&order=created_at.desc&limit=1`,
      {
        method: 'GET',
        headers,
      },
      'Fetch fallback latest notification'
    );

    return jsonResponse({ notification: fallback[0] ?? null });
  }

  return jsonResponse({ notification: null });
});