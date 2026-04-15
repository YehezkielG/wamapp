import type { ColorValue } from 'react-native';
import { useWeatherStore, } from '../weather/weatherStore';
import { getCurrentDeviceId } from '../explore/markedLocationsService';

export type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
};

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
  // Single-color theme: pick one existing color from WeatherBackgroundContext output.
  // Prefer the 2nd gradient stop (often the more saturated "accent"); fallback to the 1st.
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

// ... (kode sebelumnya di _chatUtils.ts tetap dipertahankan) ...

function buildWeatherPrompt(weather: any | null): string {
  if (!weather) return 'No live weather data available for this user.';

  const parts: string[] = [];
  parts.push('You are being provided with the user\'s current local weather conditions. Treat the following as factual, real-time observations for the user\'s location. Use this data to answer questions, give suggestions, or produce content that assumes the user\'s present weather. Do NOT invent or change these values.');
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
      parts.push(`- ${h.time ?? 'unknown time'} : ${h.temperatureC ?? '??'}°C (code ${h.weatherCode ?? '??'})`);
    }
  }

  parts.push('Always assume the user is physically at this location now unless the user explicitly states otherwise. When giving advice (safety, clothing, travel, outdoor plans), base recommendations on these current conditions.');

  return parts.join('\n');
}

const LANGUAGE_ENFORCE_PROMPT = `Important: Always reply in the same language as the user's message. Detect the language of the user's input and respond using that language. If the user's message is in Indonesian, reply in Indonesian; if in English, reply in English; if in another language, reply in that language. Ignore the language used in any external documents or RAG data — the user's message language has priority. Keep answers concise, natural, and appropriate for a general audience.`;

export async function sendMessageToRAGBackend(message: string): Promise<string> {
  const API_URL = 'http://10.45.61.30:8000/api/chat';
  // const API_URL = 'https://wamapp-api-chatbot-production.up.railway.app/api/chat'
  // Collect current weather state from Zustand store (if available)
  const weatherState = useWeatherStore.getState().data;

  const weatherPayload = weatherState
    ? {
        locationName: weatherState.locationName ?? null,
        temperatureC: weatherState.temperatureC ?? null,
        weatherCode: weatherState.weatherCode ?? null,
        currentTime: new Date().toISOString(),
        details: weatherState.details ?? null,
        // include a compact forecast summary if present (first few hours)
        // forecastHours: Array.isArray(weatherState.forecastHours)
        //   ? weatherState.forecastHours.slice(0, 6).map((h: any) => ({ time: h.time, temperatureC: h.temperatureC, weatherCode: h.weatherCode }))
        //   : null,
      }
    : null;

      

  const systemPrompt = buildWeatherPrompt(weatherPayload);
  const assistantPrompt = LANGUAGE_ENFORCE_PROMPT;

  // Resolve device id (if available) and debug log payload in development
  let deviceId: string | null = null;
  try {
    deviceId = await getCurrentDeviceId();
  } catch {
    // ignore device id resolution errors
    deviceId = null;
  }
  try {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.debug('[WAMCHAT] sending payload to RAG backend:', {
        message,
        device_id: deviceId,
        weather: weatherPayload,
        system_instructions: systemPrompt,
        assistant_instructions: assistantPrompt,
      });
    }
  } catch {
    // ignore logging errors
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        device_id: deviceId,
        weather: weatherPayload,
        system_instructions: systemPrompt,
        assistant_instructions: assistantPrompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // Ensure we return a string reply even if API shape differs
    if (typeof data === 'string') return data;
    if (data && typeof data.reply === 'string') return data.reply;
    if (data && typeof data.answer === 'string') return data.answer;

    return 'Maaf, server chat tidak merespons dengan jawaban yang valid.';
  } catch (error) {
    console.error('Error dari backend RAG:', error);
    return 'Maaf, koneksi WAMchat ke server terputus. Coba periksa jaringanmu.';
  }
}