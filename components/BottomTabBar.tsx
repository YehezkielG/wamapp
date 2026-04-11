import React, { useMemo } from 'react';
import { ColorValue, StyleSheet, TouchableOpacity, useColorScheme, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWeatherBackground } from './WeatherBackgroundContext';

type TabItem = {
  name: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabItem[] = [
  { name: 'Your Location', route: '/dashboard', icon: 'location' },
  { name: 'Explore', route: '/explore', icon: 'compass' },
  { name: 'Chat', route: '/chat', icon: 'chatbubble' },
  { name: 'History', route: '/history', icon: 'time' },
];

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

  const iconActiveColor = '#0f172a';
  const iconInactiveColor = isDark ? '#94a3b8' : '#64748b';

  const current = pathname ?? '/';

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

  return (
    <View style={styles.shell}>
      <View style={styles.container}>
        {TABS.map((tab) => {
          const active = isActive(tab.route);

          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.tabButton}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={tab.name}
            >
              <View style={[styles.iconPill, active && styles.iconPillActive]}>
                <Ionicons
                  name={active ? tab.icon : (`${tab.icon}-outline` as any)}
                  size={22}
                  color={active ? iconActiveColor : iconInactiveColor}
                />
              </View>
            </TouchableOpacity>
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

  return StyleSheet.create({
    shell: {
      marginHorizontal: 12,
      marginBottom: 10,
      borderRadius: 28,
      overflow: 'hidden',
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
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
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
  });
}
