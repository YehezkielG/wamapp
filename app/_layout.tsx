import '../global.css';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import InAppPopupHost from '../components/InAppPoupHost';
import { StatusBar } from 'expo-status-bar';
import ButtonTab from '../components/BottomTabBar';
import { LinearGradient } from 'expo-linear-gradient';
import { WeatherBackgroundProvider, useWeatherBackground } from '../components/WeatherBackgroundContext';
import { StyleSheet, View } from 'react-native';
import { usePushNotifications } from 'lib/usePushNotification';
import { useEffect } from 'react';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { updateDeviceLocationFromCoords } from '../lib/explore/markedLocationsService';

const LOCATION_TASK_NAME = 'background-location-task';

// DAFTARKAN TASK DI LUAR KOMPONEN (Penting!)
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  if (data) {
    const { locations }: any = data;
    try {
      const coords = locations[0]?.coords;
      if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
        // update device location in DB if moved enough (helper checks 500m)
        await updateDeviceLocationFromCoords(coords.latitude, coords.longitude);
      }
    } catch (err) {
      console.warn('Background location update failed', err);
    }
  }
});

function LayoutInner() {
  const { colors } = useWeatherBackground();

  useEffect(() => {
    const setupBackgroundLocation = async () => {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 500,
        });
        // Save initial device location immediately when background updates enabled
        try {
          const pos = await Location.getCurrentPositionAsync({});
          if (pos?.coords) {
            await updateDeviceLocationFromCoords(pos.coords.latitude, pos.coords.longitude, 0);
          }
        } catch (err) {
          console.warn('Initial location save failed', err);
        }
      }
    };

    setupBackgroundLocation();
  }, []);
  
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
  usePushNotifications();
  return (
    <WeatherBackgroundProvider>
      <LayoutInner />
    </WeatherBackgroundProvider>
  );
}