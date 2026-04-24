import type { ColorValue } from 'react-native';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { useWeatherStore } from '../weather/weatherStore';
import { getCurrentDeviceId } from '../explore/markedLocationsService';

const CHATBOT_API_BASE_URL =
  process.env.EXPO_PUBLIC_CHATBOT_API_BASE_URL;
const CHAT_API_URL = `${CHATBOT_API_BASE_URL}/api/chat`;
const CHAT_TOKEN_URL = `${CHATBOT_API_BASE_URL}/api/chat/token`;
const WAMAPP_CLIENT_KEY = process.env.EXPO_PUBLIC_WAMAPP_CLIENT_KEY ?? '';

export type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
};

export type ChatPromptSource = {
  title?: string;
  message?: string;
  category?: string;
  source?: 'dashboard' | 'history' | 'explore' | 'expo_push';
};

function resolveCountryCodeFromRuntime(): string {
  try {
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const normalizedTimezone = timezoneName.trim();

    if (
      normalizedTimezone === 'Asia/Jakarta' ||
      normalizedTimezone === 'Asia/Makassar' ||
      normalizedTimezone === 'Asia/Jayapura'
    ) {
      return 'ID';
    }

    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const regionMatch = locale.match(/[-_]([A-Za-z]{2})$/);
    if (regionMatch?.[1]) {
      return regionMatch[1].toUpperCase();
    }
  } catch {
    return 'ID';
  }

  return 'ID';
}

export function buildChatPromptFromNotification(source: ChatPromptSource): string {
  const countryCode = resolveCountryCodeFromRuntime();
  const isIndonesia = countryCode === 'ID';

  const title = source.title?.trim() || (isIndonesia ? 'Notifikasi cuaca' : 'Weather notification');
  const message =
    source.message?.trim() ||
    (isIndonesia ? 'Tidak ada detail tambahan.' : 'No additional details available.');
  const category = source.category?.trim() || (isIndonesia ? 'umum' : 'general');

  const originLabel =
    source.source === 'expo_push'
      ? isIndonesia
        ? 'notifikasi push'
        : 'push notification'
      : source.source === 'history'
        ? isIndonesia
          ? 'riwayat notifikasi'
          : 'notification history'
        : source.source === 'explore'
          ? isIndonesia
            ? 'fitur explore'
            : 'explore'
          : 'dashboard';

  if (isIndonesia) {
    return [
      `Saya membuka ${originLabel} dengan kategori ${category}.`,
      `Judul notifikasi: ${title}`,
      `Isi notifikasi: ${message}`,
      '',
      'Tolong jelaskan arti notifikasi ini, tingkat risikonya, dan langkah yang sebaiknya saya lakukan setelah ini.',
    ].join('\n');
  }

  return [
    `I opened ${originLabel} with category ${category}.`,
    `Notification title: ${title}`,
    `Notification content: ${message}`,
    '',
    'Please explain what this notification means, the risk level, and what I should do next.',
  ].join('\n');
}

type ChatAccessTokenCache = {
  deviceId: string;
  token: string;
  expiresAtMs: number;
};

let chatAccessTokenCache: ChatAccessTokenCache | null = null;

export type ChatTheme = {
  titleColor: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  placeholder: string;
  sendIcon: string;
  userBubble: string;
  userText: string;
  botBubble: string;
  botText: string;
};

function toColorString(value: ColorValue | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  return String(value);
}

function hexToRgba(hex: string, alpha: number): string | null {
  const raw = hex.replace('#', '').trim();
  if (!(raw.length === 6 || raw.length === 8)) return null;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isDarkHex(hex: string): boolean {
  const raw = hex.replace('#', '').trim();
  if (raw.length !== 6 && raw.length !== 8) return false;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  // perceived luminance (0..255)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 120;
}

export function getChatThemeFromBackgroundColors(colors: ColorValue[]): ChatTheme {
  const base = toColorString(colors?.[1]) ?? toColorString(colors?.[0]) ?? '#93c5fd';

  const dark = base.startsWith('#') ? isDarkHex(base) : false;
  const baseSoft = base.startsWith('#') ? (hexToRgba(base, 0.22) ?? base) : base;
  const baseSofter = base.startsWith('#') ? (hexToRgba(base, 0.14) ?? base) : base;
  const inputBorder = base.startsWith('#') ? (hexToRgba(base, dark ? 0.55 : 0.45) ?? base) : base;

  return {
    titleColor: dark ? '#f8fafc' : '#111827',
    inputBackground: baseSoft,
    inputBorder,
    inputText: dark ? '#ffffff' : '#111827',
    placeholder: dark ? 'rgba(255,255,255,0.70)' : 'rgba(17,24,39,0.55)',
    sendIcon: base,
    userBubble: base,
    userText: dark ? '#ffffff' : '#ffffff',
    botBubble: baseSofter,
    botText: dark ? '#ffffff' : '#111827',
  };
}

function buildWeatherPrompt(weather: any | null): string {
  if (!weather) return 'No live weather data available for this user.';

  const parts: string[] = [];
  parts.push(
    "You are being provided with the user's current local weather conditions. Treat the following as factual, real-time observations for the user's location. Use this data to answer questions, give suggestions, or produce content that assumes the user's present weather. Do NOT invent or change these values."
  );
  // Instruction for the LLM: prefer human-readable labels over numeric codes
  parts.push(
    "IMPORTANT: When describing weather conditions in your answer, use human-readable labels (e.g. 'Clear', 'Rain', 'Thunderstorm') instead of only numeric codes. If the payload provides both, prioritize the label."
  );
  parts.push(`Location: ${weather.locationName ?? 'unknown'}`);
  parts.push(`Current temperature: ${weather.temperatureC ?? 'unknown'} °C`);
  parts.push(`Weather code: ${weather.weatherCode ?? 'unknown'}`);

  const d = weather.details ?? {};
  parts.push('Details:');
  parts.push(`- Humidity: ${d.humidity ?? 'unknown'}%`);
  parts.push(`- Wind speed: ${d.windSpeed ?? 'unknown'} km/h`);
  parts.push(`- Dew point: ${d.dewPointC ?? 'unknown'} °C`);
  parts.push(`- UV index: ${d.uvIndex ?? 'unknown'}`);

  if (Array.isArray(weather.forecastHours) && weather.forecastHours.length) {
    parts.push('Forecast (next hours):');
    for (const h of weather.forecastHours.slice(0, 6)) {
      parts.push(
        `- ${h.time ?? 'unknown time'} : ${h.temperatureC ?? '??'}°C (code ${h.weatherCode ?? '??'})`
      );
    }
  }

  parts.push(
    'Always assume the user is physically at this location now unless the user explicitly states otherwise. When giving advice (safety, clothing, travel, outdoor plans), base recommendations on these current conditions.'
  );

  return parts.join('\n');
}

async function getUniqueDeviceId(): Promise<string> {
  try {
    // Prioritize the device ID already used across features (marked locations / devices table)
    const sharedDeviceId = await getCurrentDeviceId();
    if (sharedDeviceId) return sharedDeviceId;

    if (Platform.OS === 'android') {
      const maybeAndroidId =
        typeof (Application as any).getAndroidId === 'function'
          ? (Application as any).getAndroidId()
          : null;
      return (
        (typeof maybeAndroidId === 'string' && maybeAndroidId.length > 0 ? maybeAndroidId : null) ??
        'unknown_android'
      );
    } else if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      return iosId || 'unknown_ios';
    }
  } catch (error) {
    console.warn('Failed to retrieve Device ID:', error);
  }
  return 'unknown_device';
}

async function detectCountryCode(): Promise<string> {
  try {
    return resolveCountryCodeFromRuntime();
  } catch {
    return 'ID';
  }
}

async function getChatAccessToken(deviceId: string, forceRefresh = false): Promise<string> {
  const nowMs = Date.now();
  if (
    !forceRefresh &&
    chatAccessTokenCache &&
    chatAccessTokenCache.deviceId === deviceId &&
    chatAccessTokenCache.expiresAtMs > nowMs + 30_000
  ) {
    return chatAccessTokenCache.token;
  }

  const response = await fetch(CHAT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wamapp-client-key': WAMAPP_CLIENT_KEY,
    },
    body: JSON.stringify({ device_id: deviceId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to retrieve chat token (status: ${response.status})`);
  }

  const data = await response.json();
  const token = typeof data?.token === 'string' ? data.token : '';
  const expiresIn = Number.isFinite(data?.expires_in) ? Number(data.expires_in) : 600;

  if (!token) {
    throw new Error('Invalid chat token returned by the server.');
  }

  chatAccessTokenCache = {
    deviceId,
    token,
    expiresAtMs: nowMs + Math.max(60, expiresIn) * 1000,
  };

  return token;
}

async function postChatMessage(params: {
  message: string;
  deviceId: string;
  weatherPayload: any;
  systemPrompt: string;
  accessToken: string;
  timezoneName: string | null;
  utcOffsetMinutes: number;
  countryCode: string;
}): Promise<Response> {
  return fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      message: params.message,
      device_id: params.deviceId,
      weather: params.weatherPayload,
      system_instructions: params.systemPrompt,
      timezone_name: params.timezoneName,
      utc_offset_minutes: params.utcOffsetMinutes,
      country_code: params.countryCode,
    }),
  });
}

export async function sendMessageToRAGBackend(message: string): Promise<string> {
  // Collect current weather state from Zustand store
  const weatherState = useWeatherStore.getState().data;

  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  const utcOffsetMinutes = new Date().getTimezoneOffset() * -1;
  const countryCode = await detectCountryCode();

  const weatherPayload = weatherState
    ? {
        locationName: weatherState.locationName ?? null,
        temperatureC: weatherState.temperatureC ?? null,
        weatherCode: weatherState.weatherCode ?? null,
        details: weatherState.details ?? null,
      }
    : null;

  const systemPrompt = buildWeatherPrompt(weatherPayload);

  // Get the device ID before sending the request
  const deviceId = await getUniqueDeviceId();
  let accessToken = '';

  try {
    accessToken = await getChatAccessToken(deviceId);

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug('[WAMCHAT] sending payload to RAG backend:', {
        message,
        device_id: deviceId,
        weather: weatherPayload,
        system_instructions: systemPrompt,
        timezone_name: timezoneName,
        utc_offset_minutes: utcOffsetMinutes,
        country_code: countryCode,
        token_attached: Boolean(accessToken),
      });
    }
  } catch {
    // ignore logging errors
  }

  try {
    let response = await postChatMessage({
      message,
      deviceId,
      weatherPayload,
      systemPrompt,
      accessToken,
      timezoneName,
      utcOffsetMinutes,
      countryCode,
    });

    if (response.status === 401) {
      accessToken = await getChatAccessToken(deviceId, true);
      response = await postChatMessage({
        message,
        deviceId,
        weatherPayload,
        systemPrompt,
        accessToken,
        timezoneName,
        utcOffsetMinutes,
        countryCode,
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (typeof data === 'string') return data;
    if (data && typeof data.reply === 'string') return data.reply;
    if (data && typeof data.answer === 'string') return data.answer;

    return 'Sorry, the chat server did not return a valid response.';
  } catch (error) {
    console.error('Error dari backend RAG:', error);
    return 'Sorry, the WAMchat connection to the server was interrupted. Please check your network.';
  }
}
