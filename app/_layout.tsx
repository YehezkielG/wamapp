import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import InAppPopupHost from '../components/InAppPoupHost';
import { StatusBar } from 'expo-status-bar';
import ButtonTab from '../components/BottomTabBar';
import '../global.css';

export default function Layout() {
  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <Stack screenOptions={{ headerShown: false }} />
      <InAppPopupHost />
      <StatusBar style="dark" />
      <ButtonTab />
    </SafeAreaView>
  );
}