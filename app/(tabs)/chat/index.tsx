import React, { useState } from 'react';
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
import { getChatThemeFromBackgroundColors, type Message } from './_chatUtils';

const BOTTOM_TAB_BAR_HEIGHT = 78;

export default function Chat() {
  const { colors } = useWeatherBackground();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(44);
  const chatTheme = getChatThemeFromBackgroundColors(colors);

  const handleSend = () => {
    const cleaned = inputText.trim();
    if (!cleaned) return;

    // Tambahkan pesan user ke UI
    setMessages((prev) => [...prev, { id: Date.now().toString(), text: cleaned, sender: 'user' }]);
    setInputText('');
    setInputHeight(44);

    // TODO: Panggil fungsi RAG API kamu di sini nanti
  };

  return (
    <SafeAreaView
      className="flex-1 bg-transparent"
      style={{ paddingBottom: BOTTOM_TAB_BAR_HEIGHT }}>
      {/* Header WAMchat di pojok kiri atas */}
      <View className="px-4 py-4">
        <Text className="text-xl font-bold" style={{ color: chatTheme.titleColor }}>
          WAMchat
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={BOTTOM_TAB_BAR_HEIGHT}
        className="flex-1">
        {/* Area Daftar Pesan */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          className="flex-1 px-3"
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
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
          {/* Container input menggunakan warna abu-abu solid (bg-gray-100) */}
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
                const nextHeight = event.nativeEvent.contentSize.height;
                setInputHeight(nextHeight);
              }}
              multiline
            />

            {/* Tombol Kirim di dalam container input */}
            <TouchableOpacity
              onPress={handleSend}
              className="items-center justify-center rounded-full p-2">
              {/* Icon kirim diubah menjadi warna biru agar kontras dengan abu-abu */}
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 40, height: 40, backgroundColor: chatTheme.sendIcon }}>
                <Ionicons name="send" size={20} color="#ffffff" />
              </View>
            </TouchableOpacity>
          </View>

          <Text
            className="mt-2 text-xs text-center"
            style={{ color: chatTheme.placeholder }}>
            WAMchat might be wrong. Double-check the important information.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
