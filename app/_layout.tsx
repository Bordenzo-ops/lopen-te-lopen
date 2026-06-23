import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppStore } from '../src/store/appStore';
import { useIsLightTheme } from '../src/theme/useTheme';
import { init as initPurchases } from '../src/services/purchaseService';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Start de backend best-effort op de achtergrond. Faalt stil naar offline
  // als er geen Supabase-sleutels of netwerk zijn. Blokkeert de UI nooit.
  useEffect(() => {
    void useAppStore.getState().initBackend();
  }, []);

  // Initialiseer RevenueCat en ververs de premium-status best-effort op de
  // achtergrond. Faalt stil naar geen premium zonder sleutel of netwerk en
  // blokkeert de UI nooit.
  useEffect(() => {
    void (async () => {
      await initPurchases();
      await useAppStore.getState().refreshPremium();
    })();
  }, []);

  const isLight = useIsLightTheme();

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isLight ? 'dark' : 'light'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="session/active" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="session/summary" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
