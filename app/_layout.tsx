import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
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
import { useAppStore, useHasHydrated } from '../src/store/appStore';
import { rescheduleNotifications, listenForNotificationTaps } from '../src/services/notificationService';
import { useIsLightTheme } from '../src/theme/useTheme';
import {
  init as initPurchases,
  addPremiumListener,
  removePremiumListener,
  identifyUser,
  ensureIdentified,
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

  // Lokale meldingen (trainingsherinnering, weekvoortgang, countdown, reeks) opnieuw
  // plannen zodra de store geladen is, bij terugkeer naar de voorgrond en bij
  // elke wijziging die de inhoud raakt: schema, doel, trainingsdagen, voltooide
  // of overgeslagen trainingen en de schakelaars in Instellingen. Gebundeld met
  // een korte vertraging zodat een reeks wijzigingen een herplanning oplevert.
  // rescheduleNotifications doet niets zonder aangezette categorie of
  // toestemming en gooit nooit.
  const hasHydrated = useHasHydrated();
  useEffect(() => {
    if (!hasHydrated) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (delayMs: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void rescheduleNotifications(); }, delayMs);
    };
    schedule(0);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule(0);
    });
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (
        state.profile?.trainingDays !== prev.profile?.trainingDays ||
        state.profile?.goal !== prev.profile?.goal ||
        state.schemaMode !== prev.schemaMode ||
        state.racePlan !== prev.racePlan ||
        state.customPlan !== prev.customPlan ||
        state.completedSessions !== prev.completedSessions ||
        state.skippedSessions !== prev.skippedSessions ||
        state.currentWeekTraining !== prev.currentWeekTraining ||
        state.remindersEnabled !== prev.remindersEnabled ||
        state.weeklyProgressEnabled !== prev.weeklyProgressEnabled ||
        state.countdownEnabled !== prev.countdownEnabled ||
        state.streakEnabled !== prev.streakEnabled ||
        state.reminderHour !== prev.reminderHour
      ) {
        schedule(1000);
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
      unsubscribe();
    };
  }, [hasHydrated]);

  // Een tik op een van onze meldingen opent het relevante scherm (training van
  // vandaag of de voortgang). Ook voor een koude start: de korte vertraging
  // laat de opstart-redirect van index.tsx eerst zijn werk doen, zodat de
  // navigatie niet door die redirect wordt overschreven.
  const router = useRouter();
  useEffect(() => {
    if (!hasHydrated) return;
    return listenForNotificationTaps((route) => {
      if (!useAppStore.getState().hasCompletedOnboarding) return;
      setTimeout(() => {
        try {
          router.navigate(route as Href);
        } catch {
          // Navigatie is niet kritiek: de app opent dan gewoon zoals normaal
        }
      }, 800);
    });
  }, [hasHydrated, router]);

  // Initialiseer RevenueCat en ververs de premium-status best-effort op de
  // achtergrond. Faalt stil naar geen premium zonder sleutel of netwerk en
  // blokkeert de UI nooit. Registreert daarna een customerInfo-listener zodat
  // latere wijzigingen (automatische verlenging, verlopen abonnement, aankoop
  // op een ander toestel) de store ook bijwerken zonder dat de gebruiker het
  // scherm hoeft te verversen.
  useEffect(() => {
    void (async () => {
      await initPurchases();
      // Listener direct na init registreren, niet pas na refreshPremium: een
      // update die tijdens de eerste ophaalronde binnenkomt mag niet missen.
      addPremiumListener((isPremium) => {
        useAppStore.getState().setPremium(isPremium);
      });
      await useAppStore.getState().refreshPremium();
    })();
    // Vangnet: bleef RevenueCat anoniem (bijv. geen netwerk bij de eerste
    // start), dan alsnog een sessie maken en koppelen zodra de app terugkomt.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void ensureIdentified();
    });
    return () => {
      sub.remove();
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
    // Alleen reageren op een écht gewijzigde user-id: TOKEN_REFRESHED en
    // INITIAL_SESSION leveren steeds dezelfde gebruiker en mogen geen
    // herhaalde logIn veroorzaken. undefined = nog geen event gezien.
    let lastUserId: string | null | undefined;
    const unsubscribe = onAuthChange((session) => {
      const userId = session?.user?.id ?? null;
      if (userId === lastUserId) return;
      const previous = lastUserId;
      lastUserId = userId;
      void (async () => {
        try {
          if (userId) {
            // identifyUser wacht op init, slaat een ongewijzigde gebruiker
            // over en herstelt eenmalig als premium bij de wissel wegviel.
            const result = await identifyUser(userId);
            if (result.isPremium !== null) {
              useAppStore.getState().setPremium(result.isPremium);
            }
          } else if (previous) {
            // Echte uitlog (er was eerder een gebruiker); een lege
            // INITIAL_SESSION bij de start raakt RevenueCat niet.
            await logOutPurchases();
          } else {
            return;
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
