import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import InAppPopupHost from '../components/InAppPoupHost';
import { StatusBar } from 'expo-status-bar';
import ButtonTab from '../components/BottomTabBar';
import '../global.css';
import { LinearGradient } from 'expo-linear-gradient';
import { WeatherBackgroundProvider, useWeatherBackground } from '../components/WeatherBackgroundContext';
import { StyleSheet, View } from 'react-native';

function LayoutInner() {
  const { colors } = useWeatherBackground();

  // ensure tuple type for LinearGradient colors prop
  const gradientColors = (colors.length ? colors : ['white', 'white']) as any;
  return (
    <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View
          style={{
            position: 'absolute',
            top: 40,
            left: -40,
            width: 180,
            height: 180,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.24)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 220,
            right: -30,
            width: 220,
            height: 220,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.12)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 120,
            left: 60,
            width: 140,
            height: 140,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.10)',
          }}
        />
      </View>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <InAppPopupHost />
        <StatusBar style="light" />
        <ButtonTab />
      </SafeAreaView>
    </LinearGradient>
  );
}

export default function Layout() {
  return (
    <WeatherBackgroundProvider>
      <LayoutInner />
    </WeatherBackgroundProvider>
  );
}