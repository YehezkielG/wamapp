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
import { useWeatherStore } from '../../../lib/weather/weatherStore';

const INPUT_BOTTOM_GAP = 8;

export default function Chat() {
  const { colors } = useWeatherBackground();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(44);
  const [isLoading, setIsLoading] = useState(false); // State untuk loading bot
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
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

    // 4. Tambahkan balasan bot
    setMessages((prev) => [
      ...prev,
      { id: (Date.now() + 1).toString(), text: botReply, sender: 'bot' },
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
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : INPUT_BOTTOM_GAP}
        className="flex-1">
        {/* Area Daftar Pesan */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          className="flex-1 px-3"
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isLoading ? (
              <View className="pt-2">
                <Text className="mb-2 text-xs" style={{ color: chatTheme.placeholder }}>
                  generating a response...
                </Text>

                <View
                  className="max-w-[82%] self-start rounded-2xl rounded-tl-sm p-4"
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
                style={{ color: item.sender === 'user' ? chatTheme.userText : chatTheme.botText }}>
                {item.text}
              </Text>
            </View>
          )}
        />

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
