import type { ColorValue } from 'react-native';

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

export async function sendMessageToRAGBackend(message: string): Promise<string> {
  // Ganti URL ini dengan URL Railway kamu setelah di-deploy
  // Untuk tes lokal di emulator Android gunakan: 'http://10.0.2.2:8000/api/chat'
  // Untuk tes lokal di iOS/Web gunakan: 'http://127.0.0.1:8000/api/chat'
  // const API_URL = 'http://10.119.206.141:8000/api/chat'
  const API_URL = 'https://wamapp-api-chatbot-production.up.railway.app/api/chat'
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message }), 
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.reply; 

  } catch (error) {
    console.error("Error dari backend RAG:", error);
    return "Maaf, koneksi WAMchat ke server terputus. Coba periksa jaringanmu.";
  }
}