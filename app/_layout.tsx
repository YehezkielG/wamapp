import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import InAppPopupHost from '../components/InAppPoupHost';
import { StatusBar } from 'expo-status-bar';
import '../global.css';
import ButtonTab from '../components/BottomTabBar';

export default function Layout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <Stack screenOptions={{ headerShown: false }} />
      <InAppPopupHost />
      <StatusBar style="dark" />
      <ButtonTab />
    </SafeAreaView>
  );
}