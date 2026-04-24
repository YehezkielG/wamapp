import '../global.css';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import InAppPopupHost from '../components/InAppPoupHost';
import { StatusBar } from 'expo-status-bar';
import ButtonTab from '../components/BottomTabBar';
import { LinearGradient } from 'expo-linear-gradient';
import { WeatherBackgroundProvider, useWeatherBackground } from '../components/WeatherBackgroundContext';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { usePushNotifications } from 'lib/usePushNotification';
import { useEffect, useRef } from 'react';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useWeatherStore } from '../lib/weather/weatherStore';
import { showPopup } from '../lib/inAppPopup';
import {
  saveDeviceLocationNow,
  updateDeviceLocationFromCoords,
} from '../lib/explore/markedLocationsService';

const LOCATION_TASK_NAME = 'background-location-task';
const LOCATION_TRACKING_DISTANCE_METERS = 500;

function weatherCodeToLabelId(code?: number | null): string {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code === 51 || code === 53 || code === 55) return 'Drizzle';
  if (code === 61 || code === 63 || code === 65) return 'Rain';
  if (code === 71 || code === 73 || code === 75) return 'Snow';
  if (code === 80 || code === 81 || code === 82) return 'Heavy Rain';
  if (code === 95 || code === 96 || code === 99) return 'Thunderstorm';
  return 'Unknown';
}

function buildTrackingNotificationBody(
  temperatureC?: number | null,
  weatherCode?: number | null,
  distanceMeters = LOCATION_TRACKING_DISTANCE_METERS
) {
  const tempText = typeof temperatureC === 'number' ? `${temperatureC.toFixed(1)}°C` : '--°C';
  const weatherLabel = weatherCodeToLabelId(weatherCode);
  return `Location updates every ${distanceMeters}m · Temp ${tempText} · Weather ${weatherLabel}`;
}

// REGISTER THE TASK OUTSIDE THE COMPONENT (Important!)
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  if (data) {
    const { locations }: any = data;
    try {
      const coords = locations[0]?.coords;
      if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
        // Update the device location in the database if it moved enough (helper checks 500m)
        await updateDeviceLocationFromCoords(coords.latitude, coords.longitude);
      }
    } catch (err) {
      console.warn('Background location update failed', err);
    }
  }
});

function LayoutInner() {
  console.log('[dbg] Render LayoutInner');
  const { colors } = useWeatherBackground();
  const latestWeather = useWeatherStore((state) => state.data);
  const latestWeatherRef = useRef(latestWeather);
  const foregroundWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const hasSavedInitialLocationRef = useRef(false);

  useEffect(() => {
    latestWeatherRef.current = latestWeather;
  }, [latestWeather]);

  useEffect(() => {
    const setupBackgroundLocation = async () => {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access so your position can be updated every 500 meters.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        );
        return;
      }

      // Save user location immediately when app opens
      const saveInitialLocation = async () => {
        let hasSaved = false;

        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown?.coords) {
            hasSaved = await saveDeviceLocationNow(
              lastKnown.coords.latitude,
              lastKnown.coords.longitude
            );
          }
        } catch (err) {
          console.warn('Initial last-known location save failed', err);
        }

        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (pos?.coords) {
            hasSaved =
              (await saveDeviceLocationNow(pos.coords.latitude, pos.coords.longitude)) ||
              hasSaved;
          }
        } catch (err) {
          console.warn('Initial current location save failed', err);
        }

        hasSavedInitialLocationRef.current = hasSaved;

        if (!hasSaved) {
          setTimeout(() => {
            void (async () => {
              try {
                const retryPos = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                if (retryPos?.coords) {
                  const retrySaved = await saveDeviceLocationNow(
                    retryPos.coords.latitude,
                    retryPos.coords.longitude
                  );
                  if (retrySaved) {
                    hasSavedInitialLocationRef.current = true;
                  }
                }
              } catch (err) {
                console.warn('Initial location retry failed', err);
              }
            })();
          }, 5000);
        }
      };

      await saveInitialLocation();

      // Foreground fallback/update: reliably persist each 500m movement while app is open
      if (!foregroundWatcherRef.current) {
        try {
          const watcher = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: LOCATION_TRACKING_DISTANCE_METERS,
              timeInterval: 15000,
            },
            (location) => {
              const coords = location?.coords;
              if (coords) {
                void (async () => {
                  const minDistance = hasSavedInitialLocationRef.current
                    ? LOCATION_TRACKING_DISTANCE_METERS
                    : 0;

                  const updated = await updateDeviceLocationFromCoords(
                    coords.latitude,
                    coords.longitude,
                    minDistance
                  );

                  if (updated) {
                    const currentWeather = useWeatherStore.getState().data;
                    const tempC = currentWeather?.temperatureC;
                    const weatherLabel = weatherCodeToLabelId(currentWeather?.weatherCode);

                    showPopup({
                      title: 'Location Updated',
                      message: `Moved ≥ ${LOCATION_TRACKING_DISTANCE_METERS}m · Temp: ${typeof tempC === 'number' ? `${tempC.toFixed(1)}°C` : '--°C'} · Weather: ${weatherLabel}`,
                      type: 'info',
                      durationMs: 3000,
                    });
                  }

                  hasSavedInitialLocationRef.current = true;
                })();
              }
            }
          );
          foregroundWatcherRef.current = watcher;
        } catch (err) {
          console.warn('Foreground location watcher failed', err);
        }
      }

      const backgroundCurrent = await Location.getBackgroundPermissionsAsync();
      let backgroundStatus = backgroundCurrent.status;

      if (backgroundStatus !== 'granted') {
        const backgroundReq = await Location.requestBackgroundPermissionsAsync();
        backgroundStatus = backgroundReq.status;
      }

      if (backgroundStatus !== 'granted') {
        Alert.alert(
          'Enable Always Location Access',
          'To update your location automatically after moving 500m, set location permission to "Always allow" in app settings.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        );
        return;
      }

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          distanceInterval: LOCATION_TRACKING_DISTANCE_METERS,
          timeInterval: 15000,
          foregroundService: {
            notificationTitle: 'WAMApp Location Tracking',
            notificationBody: buildTrackingNotificationBody(
              latestWeatherRef.current?.temperatureC,
              latestWeatherRef.current?.weatherCode,
              LOCATION_TRACKING_DISTANCE_METERS
            ),
          },
        });
      }
    };

    void setupBackgroundLocation();

    return () => {
      foregroundWatcherRef.current?.remove();
      foregroundWatcherRef.current = null;
    };
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
  console.log('[dbg] Render Layout');
  usePushNotifications();
  return (
    <WeatherBackgroundProvider>
      <LayoutInner />
    </WeatherBackgroundProvider>
  );
}