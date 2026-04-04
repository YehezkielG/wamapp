import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface TabItem {
  name: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
  { name: 'Your Location', route: '/dashboard', icon: 'location' },
  { name: 'Explore', route: '/explore', icon: 'compass' },
  { name: 'Chat', route: '/chat', icon: 'chatbubble' },
  { name: 'Settings', route: '/settings', icon: 'settings' },
];

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const current = pathname ?? '/';
  const isActive = (route: string) => {
    try {
      const normalized = current.split('?')[0].split('#')[0];
      return normalized === route || normalized.startsWith(route + '/') || normalized.startsWith(route + '?');
    } catch {
      return false;
    }
  };

  return (
    <View style={styles.shell}>
      <View style={styles.container}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.route}
            style={styles.tabButton}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconPill, isActive(tab.route) && styles.iconPillActive]}>
              <Ionicons
                name={isActive(tab.route) ? tab.icon : (`${tab.icon}-outline` as any)}
                size={22}
                color={isActive(tab.route) ? '#0f172a' : '#64748b'}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.16)',
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  iconPillActive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderColor: 'rgba(255,255,255,0.55)',
  },
});