import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createSupabaseClientForDevice } from '../supabaseClient';
import { getCurrentDeviceId } from '../explore/markedLocationsService';
import type { Message } from './_chatUtils';

const MAX_PERSISTED_MESSAGES = 10;

type ChatHistoryRow = {
  id: number;
  role: string;
  content: string;
  created_at: string;
};

type ChatStore = {
  messages: Message[];
  hasLoadedHistory: boolean;
  isLoadingHistory: boolean;
  loadedDeviceId: string | null;
  lastLoadedAt: string | null;
  loadChatHistory: () => Promise<void>;
  setMessages: (messages: Message[]) => void;
  appendMessage: (message: Message) => void;
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      hasLoadedHistory: false,
      isLoadingHistory: false,
      loadedDeviceId: null,
      lastLoadedAt: null,

      loadChatHistory: async () => {
        const currentState = get();
        if (currentState.isLoadingHistory) return;

        set({ isLoadingHistory: true });

        try {
          const deviceId = await getCurrentDeviceId().catch(() => null);
          if (!deviceId) {
            set({
              hasLoadedHistory: true,
              isLoadingHistory: false,
              lastLoadedAt: new Date().toISOString(),
            });
            return;
          }

          if (currentState.hasLoadedHistory && currentState.loadedDeviceId === deviceId) {
            set({ isLoadingHistory: false });
            return;
          }

          const chatbotSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL_CHATBOT;
          const chatbotSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_CHATBOT;

          if (!chatbotSupabaseUrl || !chatbotSupabaseAnonKey) {
            set({
              hasLoadedHistory: true,
              isLoadingHistory: false,
              loadedDeviceId: deviceId,
              lastLoadedAt: new Date().toISOString(),
            });
            return;
          }

          const chatbotSupabase = createSupabaseClientForDevice(deviceId);
          const { data, error } = await chatbotSupabase
            .from('chat_history')
            .select('id, role, content, created_at')
            .eq('device_id', deviceId)
            .order('created_at', { ascending: false })
            .limit(MAX_PERSISTED_MESSAGES);

          if (error || !Array.isArray(data)) {
            set({
              hasLoadedHistory: true,
              isLoadingHistory: false,
              loadedDeviceId: deviceId,
              lastLoadedAt: new Date().toISOString(),
            });
            return;
          }

          const restored: Message[] = (data as ChatHistoryRow[])
            .slice()
            .reverse()
            .map((row) => ({
              id: String(row.id),
              text: row.content,
              sender: row.role === 'user' ? 'user' : 'bot',
            }));

          set({
            messages: restored,
            hasLoadedHistory: true,
            isLoadingHistory: false,
            loadedDeviceId: deviceId,
            lastLoadedAt: new Date().toISOString(),
          });
        } catch {
          set({
            hasLoadedHistory: true,
            isLoadingHistory: false,
            lastLoadedAt: new Date().toISOString(),
          });
        }
      },

      setMessages: (messages) => {
        set({ messages });
      },

      appendMessage: (message) => {
        set((state) => ({ messages: [...state.messages, message] }));
      },
    }),
    {
      name: 'wamchat-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        messages: state.messages,
        hasLoadedHistory: state.hasLoadedHistory,
        loadedDeviceId: state.loadedDeviceId,
        lastLoadedAt: state.lastLoadedAt,
      }),
    }
  )
);