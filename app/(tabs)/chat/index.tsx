import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useWeatherBackground } from '../../../components/WeatherBackgroundContext';
import {
  getChatThemeFromBackgroundColors,
  sendMessageToRAGBackend,
  type Message,
} from '../../../lib/chat/_chatUtils';
import ChatSkeleton from '../../../components/skeleton_loading/Chat';
import MarkdownText from '../../../components/MarkdownText';
import { useWeatherStore } from '../../../lib/weather/weatherStore';

const INPUT_BOTTOM_GAP = 8;

type TextSegment = { text: string; bold: boolean };

function parseBoldSegments(input: string): TextSegment[] {
  const text = String(input ?? '');
  if (!text.includes('**')) return [{ text, bold: false }];

  const segments: TextSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const open = text.indexOf('**', cursor);
    if (open === -1) {
      segments.push({ text: text.slice(cursor), bold: false });
      break;
    }

    if (open > cursor) {
      segments.push({ text: text.slice(cursor, open), bold: false });
    }

    const close = text.indexOf('**', open + 2);
    if (close === -1) {
      segments.push({ text: text.slice(open), bold: false });
      break;
    }

    const boldText = text.slice(open + 2, close);
    if (boldText.length > 0) {
      segments.push({ text: boldText, bold: true });
    }

    cursor = close + 2;
  }

  return segments.filter((segment) => segment.text.length > 0);
}

function looksMostlyEnglish(input: string): boolean {
  const normalized = input.toLowerCase().replace(/[^a-z\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  const markers = new Set([
    'the',
    'is',
    'are',
    'you',
    'your',
    'weather',
    'temperature',
    'humidity',
    'wind',
    'forecast',
    'today',
    'tomorrow',
    'please',
  ]);

  let hits = 0;
  for (const w of words) {
    if (markers.has(w)) hits += 1;
  }

  return hits >= 2 || hits / words.length >= 0.25;
}

async function translateEnglishToIndonesian(text: string): Promise<string> {
  if (!text || !looksMostlyEnglish(text)) return text;

  try {
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=' +
      encodeURIComponent(text);

    const response = await fetch(url);
    if (!response.ok) return text;

    const data = await response.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) return text;

    const translated = data[0]
      .map((chunk: unknown) => (Array.isArray(chunk) ? String(chunk[0] ?? '') : ''))
      .join('')
      .trim();

    return translated || text;
  } catch {
    return text;
  }
}

export default function Chat() {
  const { colors } = useWeatherBackground();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(44);
  const [isLoading, setIsLoading] = useState(false); // State untuk loading bot
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const translateCacheRef = useRef<Map<string, string>>(new Map());
  const chatTheme = getChatThemeFromBackgroundColors(colors);
  const weatherCode = useWeatherStore((state) => state.data?.weatherCode);

  const isDarkUi = useMemo(() => {
    const isNight = currentHour >= 19 || currentHour < 5;
    const isStorm = weatherCode !== undefined && [95, 96, 99].includes(weatherCode);
    return isNight || isStorm;
  }, [currentHour, weatherCode]);

  const headerSurfaceClass = isDarkUi
    ? 'rounded-2xl border border-white/30 bg-white/12'
    : 'rounded-2xl border border-white/70 bg-white/60';

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);

    return () => clearInterval(timerId);
  }, []);

  // Reference untuk autoscroll ke bawah
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    const cleaned = inputText.trim();
    if (!cleaned || isLoading) return; // Cegah spam klik saat loading

    // 1. Tambahkan pesan user
    setMessages((prev) => [...prev, { id: Date.now().toString(), text: cleaned, sender: 'user' }]);
    setInputText('');
    setInputHeight(44);

    // 2. Mulai loading bot
    setIsLoading(true);

    // 3. Panggil fungsi modular dari utils
    const botReply = await sendMessageToRAGBackend(cleaned);
    let localizedReply = botReply;

    const cached = translateCacheRef.current.get(botReply);
    if (cached) {
      localizedReply = cached;
    } else {
      localizedReply = await translateEnglishToIndonesian(botReply);
      translateCacheRef.current.set(botReply, localizedReply);
      if (translateCacheRef.current.size > 60) {
        const oldestKey = translateCacheRef.current.keys().next().value;
        if (oldestKey) translateCacheRef.current.delete(oldestKey);
      }
    }

    // 4. Tambahkan balasan bot
    setMessages((prev) => [
      ...prev,
      { id: (Date.now() + 1).toString(), text: localizedReply, sender: 'bot' },
    ]);

    // 5. Matikan loading
    setIsLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-transparent" style={{ paddingBottom: INPUT_BOTTOM_GAP }}>
      {/* Header WAMchat */}
      <View className={`mx-4 mt-3 px-4 py-4 ${headerSurfaceClass}`}>
        <Text className="text-xl font-bold" style={{ color: chatTheme.titleColor }}>
          WAMchat
        </Text>
        <Text className="mt-1 text-sm" style={{ color: chatTheme.placeholder }}>
          Ask me anything about the weather or get personalized recommendations!
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : INPUT_BOTTOM_GAP}
        className="flex-1">
        {/* Area Daftar Pesan */}
        {isLoading && messages.length === 0 ? (
          <ChatSkeleton />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            className="flex-1 px-3"
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              isLoading && messages.length > 0 ? (
                <View className="pt-2">
                  <Text className="mb-2 text-xs" style={{ color: chatTheme.placeholder }}>
                    generating a response...
                  </Text>

                  <View
                    className="min-w-[82%] self-start rounded-2xl rounded-tl-sm p-4"
                    style={{ backgroundColor: chatTheme.botBubble }}>
                    <View
                      className="mb-3 h-4 rounded-full"
                      style={{
                        width: '92%',
                        backgroundColor: chatTheme.inputBackground,
                        opacity: 0.9,
                      }}
                    />
                    <View
                      className="mb-3 h-4 rounded-full"
                      style={{
                        width: '85%',
                        backgroundColor: chatTheme.inputBackground,
                        opacity: 0.85,
                      }}
                    />
                    <View
                      className="mb-3 h-4 rounded-full"
                      style={{
                        width: '76%',
                        backgroundColor: chatTheme.inputBackground,
                        opacity: 0.8,
                      }}
                    />
                    <View
                      className="h-4 rounded-full"
                      style={{
                        width: '54%',
                        backgroundColor: chatTheme.inputBackground,
                        opacity: 0.75,
                      }}
                    />
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <View
                className={`my-1 max-w-[80%] rounded-2xl p-3 ${item.sender === 'user' ? 'self-end rounded-tr-sm' : 'self-start rounded-tl-sm'}`}
                style={{
                  backgroundColor:
                    item.sender === 'user' ? chatTheme.userBubble : chatTheme.botBubble,
                }}>
                <Text
                  style={{
                    color: item.sender === 'user' ? chatTheme.userText : chatTheme.botText,
                  }}>
                  {parseBoldSegments(item.text).map((segment, idx) => (
                    <Text
                      key={`${item.id}-${idx}`}
                      style={segment.bold ? { fontWeight: '700' } : undefined}>
                      {segment.text}
                    </Text>
                  ))}
                </Text>
              </View>
            )}
          />
        )}

        {/* Area Input Pesan */}
        <View className="p-3">
          <View
            className="flex-row items-end rounded-3xl px-2 py-1"
            style={{
              backgroundColor: chatTheme.inputBackground,
              borderWidth: 1,
              borderColor: chatTheme.inputBorder,
            }}>
            <TextInput
              className="flex-1 px-4 py-2"
              style={{
                color: chatTheme.inputText,
                minHeight: 44,
                maxHeight: 140,
                height: Math.min(140, Math.max(44, inputHeight)),
                textAlignVertical: 'top',
              }}
              placeholder="Write a message..."
              placeholderTextColor={chatTheme.placeholder}
              value={inputText}
              onChangeText={setInputText}
              onContentSizeChange={(event) => {
                setInputHeight(event.nativeEvent.contentSize.height);
              }}
              multiline
              editable={!isLoading} // Kunci input saat loading
            />

            <TouchableOpacity
              onPress={handleSend}
              disabled={isLoading || !inputText.trim()}
              className="items-center justify-center rounded-full p-2">
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor:
                    !inputText.trim() || isLoading ? chatTheme.botBubble : chatTheme.sendIcon, // Ubah warna ikon kalau disable
                  opacity: !inputText.trim() || isLoading ? 0.5 : 1,
                }}>
                <Ionicons name="send" size={20} color="#ffffff" />
              </View>
            </TouchableOpacity>
          </View>

          <Text className="mt-2 text-center text-xs" style={{ color: chatTheme.placeholder }}>
            Double-check the important information.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
