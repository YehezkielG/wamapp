// @ts-nocheck

const OPEN_WEATHER_TILE_BASE_URL = 'https://tile.openweathermap.org/map';
const FUNCTION_NAME = 'openweather-tile-proxy';
const ALLOWED_LAYERS = new Set(['temp_new', 'clouds_new', 'precipitation_new', 'wind_new']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function badRequest(message: string, status = 400) {
  return new Response(JSON.stringify({ error: true, message }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function extractTileParams(requestUrl: URL) {
  const parts = requestUrl.pathname.split('/').filter(Boolean);
  const functionIndex = parts.indexOf(FUNCTION_NAME);

  const tail = functionIndex >= 0 ? parts.slice(functionIndex + 1) : parts.slice(-3);
  if (tail.length < 3) {
    return null;
  }

  const z = Number(tail[0]);
  const x = Number(tail[1]);
  const yRaw = tail[2].replace('.png', '');
  const y = Number(yRaw);

  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return null;
  }

  return { z, x, y };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return badRequest('Use GET request.', 405);
  }

  try {
    const apiKey = Deno.env.get('OPENWEATHER_API_KEY');
    if (!apiKey) {
      return badRequest('Missing OPENWEATHER_API_KEY in Edge Function secrets.', 500);
    }

    const requestUrl = new URL(request.url);
    const tileParams = extractTileParams(requestUrl);

    if (!tileParams) {
      return badRequest('Invalid tile path. Expected /{z}/{x}/{y}.png');
    }

    const requestedLayer = (requestUrl.searchParams.get('layer') ?? 'temp_new').toLowerCase();
    const layer = ALLOWED_LAYERS.has(requestedLayer) ? requestedLayer : 'temp_new';

    const upstreamUrl = `${OPEN_WEATHER_TILE_BASE_URL}/${layer}/${tileParams.z}/${tileParams.x}/${tileParams.y}.png?appid=${apiKey}`;

    const upstreamResponse = await fetch(upstreamUrl);
    if (!upstreamResponse.ok) {
      const detail = await upstreamResponse.text();

      if (upstreamResponse.status === 401) {
        return badRequest(
          `OpenWeather tile request unauthorized (401). Check server secret OPENWEATHER_API_KEY and plan access. ${detail}`,
          502
        );
      }

      return badRequest(
        `Tile upstream request failed: ${upstreamResponse.status} ${detail}`,
        502
      );
    }

    const imageBytes = await upstreamResponse.arrayBuffer();

    return new Response(imageBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : 'Unexpected openweather tile proxy error',
      500
    );
  }
});
