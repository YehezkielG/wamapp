import 'dotenv/config';
import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'WAMApp',
  slug: 'wamapp',
  version: '1.0.0',
  owner: 'zekiell12',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  experiments: {
    tsconfigPaths: true,
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow WAMApp to access your location while using the app.',
        locationAlwaysAndWhenInUsePermission:
          'Allow WAMApp to access your location always to keep location updates running in the background.',
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
  ],
  web: {
    favicon: './assets/favicon.png',
  },
  ios: {
    supportsTablet: true,
    config: {
      googleMapsApiKey:
        process.env.GOOGLE_MAPS_IOS_API_KEY ||
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
        '',
    },
  },
  android: {
    package: 'com.zekiell12.wamapp',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION", // INI KUNCINYA!
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ],
    config: {
      googleMaps: {
        apiKey:
          process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
          '',
      },
    },
    "googleServicesFile": "./google-services.json"
  },
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_ID_PROJECT,
    },
  },
  jsEngine: 'hermes',
});