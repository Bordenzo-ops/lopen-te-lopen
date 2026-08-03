import { useEffect } from 'react';
import { AppState } from 'react-native';
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
import * as SplashScreen from 'expo-splash-screen';
import { useAppStore } from '../src/store/appStore';
import { useIsLightTheme } from '../src/theme/useTheme';
import {
  init as initPurchases,
  addPremiumListener,
  removePremiumListener,
  identifyUser,
  logOut as logOutPurchases,
} from '../src/services/purchaseService';
import { onAuthChange } from '../src/services/authService';
import { retryStravaQueue } from '../src/services/stravaService';
import { maybeAutoUpdatePack } from '../src/services/voicePackService';
import { refreshRaceData } from '../src/services/raceDataService';
import { flushEvents } from '../src/services/analyticsService';
import { initCrashReporting, CrashReportingBoundary } from '../src/services/crashReporting';
import { AnimatedSplash } from '../src/components/AnimatedSplash';
// Side-effect import: garandeert dat de expo-task-manager achtergrondtaak
// gedefinieerd is zodra de app-module laadt, ook na een OS-herstart van de
// app (bijvoorbeeld door het besturingssysteem, zonder dat de gebruiker de
// app zelf opnieuw opent). Zonder deze import bestaat het risico dat de taak
// nog niet geregistreerd is als het OS de achtergrondtaak probeert te hervatten.
import '../src/services/backgroundLocationService';

// Zo vroeg mogelijk op module-niveau, voor de component-definitie: crashes
// tijdens het opstarten van de app worden zo ook al gerapporteerd.
initCrashReporting();

// Houd de native splash zichtbaar totdat de fullscreen JS-splash
// (AnimatedSplash) gerenderd en klaar is om 'm over te nemen. Zo ontstaat er
// geen wit/leeg flitsje tussen de native splash en de eigen opstartafbeelding.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Globaal veiligheidsnet: garandeert dat de native splash ook verdwijnt als
// de JS-splash (AnimatedSplash) nooit mount, bijvoorbeeld door een
// render-crash die de CrashReportingBoundary opvangt of door falend
// font-laden. Zo kan de crash-fallback zichtbaar worden in plaats van een
// bevroren native splash.
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 8000);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
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

  // Best-effort herhaalpoging voor mislukte Strava-uploads bij app-start.
  // Stil, blokkeert de UI nooit, zelfde filosofie als initBackend hierboven.
  useEffect(() => {
    void retryStravaQueue();
  }, []);

  // Werkt het stempakket van de gekozen stem stil bij (klein verschil, geen
  // actieve sessie, wel al premium + een gedownload pakket) bij app-start en
  // telkens als de app naar de voorgrond komt. maybeAutoUpdatePack bewaakt
  // zelf al zijn voorwaarden en gooit nooit, dus hier alleen niet-blokkerend
  // afvuren, zelfde filosofie als flushEvents hieronder.
  // Bewust geabonneerd op de stem in plaats van hem alleen bij mount uit de
  // store te lezen: bij een koude start is het profiel nog niet uit
  // AsyncStorage teruggehaald, dus zou de eerste controle altijd de
  // standaardstem pakken en die van de gebruiker pas na een keer
  // achtergrond/voorgrond aan bod komen. Nu draait de controle opnieuw zodra
  // het profiel binnen is — en meteen ook als iemand in Instellingen van stem
  // wisselt, wat precies het moment is waarop je dat pakket wilt controleren.
  const activeVoiceType = useAppStore(s => s.profile?.voiceType) ?? 'female';
  useEffect(() => {
    void maybeAutoUpdatePack(activeVoiceType).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void maybeAutoUpdatePack(activeVoiceType).catch(() => {});
    });
    return () => sub.remove();
  }, [activeVoiceType]);

  // Ververst de racelijst stil op de achtergrond bij app-start (de service
  // bewaakt zelf zijn eigen ophaalinterval, dus hier geen extra logica nodig
  // — hooguit één keer per dag gaat dit ook echt het netwerk op). Faalt stil
  // naar de bestaande cache of de gebundelde lijst, blokkeert de UI nooit,
  // zelfde filosofie als maybeAutoUpdatePack hierboven.
  useEffect(() => {
    void refreshRaceData().catch(() => {});
  }, []);

  // Best-effort flush van gebufferde analytics-events: bij app-start en
  // telkens als de app naar de voorgrond komt (dan is er vaak weer netwerk en
  // een geldige sessie). Stil, blokkeert de UI nooit.
  useEffect(() => {
    void flushEvents();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushEvents();
    });
    return () => sub.remove();
  }, []);

  // Initialiseer RevenueCat en ververs de premium-status best-effort op de
  // achtergrond. Faalt stil naar geen premium zonder sleutel of netwerk en
  // blokkeert de UI nooit. Registreert daarna een customerInfo-listener zodat
  // latere wijzigingen (automatische verlenging, verlopen abonnement, aankoop
  // op een ander toestel) de store ook bijwerken zonder dat de gebruiker het
  // scherm hoeft te verversen.
  useEffect(() => {
    void (async () => {
      await initPurchases();
      await useAppStore.getState().refreshPremium();
      addPremiumListener((isPremium) => {
        useAppStore.getState().setPremium(isPremium);
      });
    })();
    return () => {
      removePremiumListener();
    };
  }, []);

  // Koppel RevenueCat aan de Supabase-identiteit zodra een gebruiker echt
  // in- of uitlogt (een e-mailaccount aanmaakt/koppelt, inlogt of uitlogt).
  // Login blijft optioneel: zolang niemand inlogt, blijft dit abonnement
  // stil en verandert er niets aan het bestaande (anonieme) RevenueCat-
  // gedrag hierboven. Bewust een apart effect ná initPurchases/refreshPremium
  // hierboven: identifyUser/logOut checken zelf op `configured`, dus een
  // vroege auth-wijziging vóórdat RevenueCat klaar is, is sowieso onschadelijk.
  // Na elke identiteitswissel verversen we premium opnieuw: de customerInfo
  // hoort bij de nieuwe (of geen) gebruiker.
  useEffect(() => {
    const unsubscribe = onAuthChange((session) => {
      void (async () => {
        try {
          if (session?.user?.id) {
            await identifyUser(session.user.id);
          } else {
            await logOutPurchases();
          }
          await useAppStore.getState().refreshPremium();
        } catch {
          // Stil falen: premium-status blijft op de laatst bekende waarde staan
        }
      })();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const isLight = useIsLightTheme();

  // Bij een font-fout starten we door met systeemfonts in plaats van eeuwig
  // achter de native splash te blijven wachten (fontsLoaded blijft dan false).
  if (!fontsLoaded && !fontError) return null;

  return (
    <CrashReportingBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AnimatedSplash>
          <SafeAreaProvider>
            <StatusBar style={isLight ? 'dark' : 'light'} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="session/active" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="session/summary" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="routine/warmup" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="routine/cooldown" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="premium-intro" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="account" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="strava-callback" options={{ animation: 'fade' }} />
            </Stack>
          </SafeAreaProvider>
        </AnimatedSplash>
      </GestureHandlerRootView>
    </CrashReportingBoundary>
  );
}
