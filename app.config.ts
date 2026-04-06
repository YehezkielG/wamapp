import 'dotenv/config';
import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'WAMApp',
  slug: 'WAMApp',
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
  plugins: ['expo-router'],
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
    package: 'com.zekiell12.WAMApp',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
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
      projectId: 'f0603b47-8279-4844-95f8-286bc60bafb6',
    },
  },
});