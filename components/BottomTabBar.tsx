import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ColorValue,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useWeatherBackground } from './WeatherBackgroundContext';

type TabItem = {
  name: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap;
  iconFamily?: 'ionicons' | 'material';
};

const TABS: TabItem[] = [
  { name: 'Your Location', route: '/dashboard', icon: 'location' },
  { name: 'Explore', route: '/explore', icon: 'compass' },
  { name: 'Chat', route: '/chat', icon: 'robot', iconFamily: 'material' },
  { name: 'History', route: '/history', icon: 'time' },
];

const CHAT_TOOLTIP_DISMISSED_KEY = 'wam.chat.tooltip.dismissed.v1';

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const fallbackDark = useColorScheme() === 'dark';
  const { colors } = useWeatherBackground();

  const isDark = useMemo(() => {
    const source = (colors?.[1] ?? colors?.[0]) as ColorValue | undefined;
    if (typeof source !== 'string') return fallbackDark;

    const hex = source.trim();
    if (hex.startsWith('#') && (hex.length === 7 || hex.length === 9)) {
      const red = Number.parseInt(hex.slice(1, 3), 16);
      const green = Number.parseInt(hex.slice(3, 5), 16);
      const blue = Number.parseInt(hex.slice(5, 7), 16);
      if ([red, green, blue].some(Number.isNaN)) return fallbackDark;
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      return luminance < 120;
    }

    const rgbMatch = hex.match(/rgba?\(([^)]+)\)/i);
    if (!rgbMatch) return fallbackDark;
    const parts = rgbMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return fallbackDark;
    const [red, green, blue] = parts;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance < 120;
  }, [colors, fallbackDark]);

  const styles = createStyles(isDark);
  const [showChatTooltip, setShowChatTooltip] = useState(false);

  const iconActiveColor = '#0f172a';
  const iconInactiveColor = isDark ? '#94a3b8' : '#64748b';

  const current = pathname ?? '/';

  useEffect(() => {
    let isMounted = true;

    const restoreTooltipState = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(CHAT_TOOLTIP_DISMISSED_KEY);
        if (isMounted) {
          setShowChatTooltip(!dismissed);
        }
      } catch {
        if (isMounted) {
          setShowChatTooltip(true);
        }
      }
    };

    void restoreTooltipState();

    return () => {
      isMounted = false;
    };
  }, []);

  const isActive = (route: string) => {
    try {
      const normalized = current.split('?')[0].split('#')[0];
      return (
        normalized === route ||
        normalized.startsWith(`${route}/`) ||
        normalized.startsWith(`${route}?`)
      );
    } catch {
      return false;
    }
  };

  const dismissChatTooltip = async () => {
    setShowChatTooltip(false);
    try {
      await AsyncStorage.setItem(CHAT_TOOLTIP_DISMISSED_KEY, '1');
    } catch {
      return;
    }
  };

  return (
    <View style={styles.shell}>
      <View style={styles.container}>
        {TABS.map((tab) => {
          const active = isActive(tab.route);
          const isChatTab = tab.route === '/chat';

          return (
            <View key={tab.route} style={styles.tabSlot}>
              {isChatTab && showChatTooltip ? (
                <View style={styles.chatTooltipWrap} pointerEvents="box-none">
                  <View style={styles.chatTooltipBubble}>
                    <TouchableOpacity
                      onPress={() => {
                        void dismissChatTooltip();
                      }}
                      activeOpacity={0.7}
                      style={styles.chatTooltipClose}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss chat tooltip">
                      <Ionicons name="close" size={14} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>

                    <Text style={styles.chatTooltipTitle}>Need weather insights?</Text>
                    <Text style={styles.chatTooltipText}>Tap Chat to ask instantly.</Text>
                  </View>
                  <View style={styles.chatTooltipPointer} />
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => {
                  if (isChatTab && showChatTooltip) {
                    void dismissChatTooltip();
                  }
                  router.push(tab.route as any);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={tab.name}
              >
                <View style={[styles.iconPill, active && styles.iconPillActive]}>
                  {tab.iconFamily === 'material' ? (
                    <MaterialCommunityIcons
                      name={tab.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={22}
                      color={active ? iconActiveColor : iconInactiveColor}
                    />
                  ) : (
                    <Ionicons
                      name={active ? (tab.icon as keyof typeof Ionicons.glyphMap) : (`${tab.icon}-outline` as any)}
                      size={22}
                      color={active ? iconActiveColor : iconInactiveColor}
                    />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(isDark: boolean) {
  const shellBorder = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.08)';
  const shellBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.92)';
  const pillBg = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.04)';
  const pillBorder = isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.06)';
  const pillActiveBg = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.08)';
  const pillActiveBorder = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.12)';
  const chatTooltipBg = isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.98)';
  const chatTooltipBorder = isDark ? 'rgba(148,163,184,0.45)' : 'rgba(15,23,42,0.14)';
  const chatTooltipTitle = isDark ? '#f8fafc' : '#0f172a';
  const chatTooltipText = isDark ? '#cbd5e1' : '#334155';

  return StyleSheet.create({
    shell: {
      marginHorizontal: 12,
      marginBottom: 10,
      borderRadius: 28,
      overflow: 'visible',
      borderWidth: 1,
      borderColor: shellBorder,
      backgroundColor: shellBg,
    },
    container: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingVertical: 12,
      paddingBottom: 14,
    },
    tabButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
    },
    tabSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    iconPill: {
      minWidth: 42,
      minHeight: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: pillBg,
      borderWidth: 1,
      borderColor: pillBorder,
    },
    iconPillActive: {
      backgroundColor: pillActiveBg,
      borderColor: pillActiveBorder,
    },
    chatTooltipWrap: {
      position: 'absolute',
      bottom: 50,
      alignItems: 'center',
      zIndex: 10,
    },
    chatTooltipBubble: {
      minWidth: 172,
      maxWidth: 210,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: chatTooltipBorder,
      backgroundColor: chatTooltipBg,
      paddingTop: 9,
      paddingBottom: 10,
      paddingHorizontal: 11,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 7,
    },
    chatTooltipClose: {
      position: 'absolute',
      right: 4,
      top: 4,
      height: 22,
      width: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
    },
    chatTooltipTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: chatTooltipTitle,
      paddingRight: 22,
    },
    chatTooltipText: {
      marginTop: 2,
      fontSize: 11,
      color: chatTooltipText,
      lineHeight: 15,
      paddingRight: 6,
    },
    chatTooltipPointer: {
      marginTop: -1,
      width: 12,
      height: 12,
      transform: [{ rotate: '45deg' }],
      backgroundColor: chatTooltipBg,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderRightColor: chatTooltipBorder,
      borderBottomColor: chatTooltipBorder,
    },
  });
}
