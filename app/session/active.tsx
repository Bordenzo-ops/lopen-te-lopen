import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, BackHandler, ActivityIndicator, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pause, Play, Square, ChevronDown, MapPin, Map, Info, Lock } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { typography, spacing, radius, shadows, type ThemeColors } from '../../src/theme/tokens';
import { useThemeColors } from '../../src/theme/useTheme';
import { useAppStore } from '../../src/store/appStore';
import { zoneInfo } from '../../src/data/trainingPlans';
import type { TrainingWeek, HeartRateZone } from '../../src/data/trainingPlans';
import { resolveActivePlan } from '../../src/data/activePlan';
import { ZoneBadge } from '../../src/components/ui/ZoneBadge';
import { useVoiceGuidance } from '../../src/hooks/useVoiceGuidance';
import { useRoutePlanner } from '../../src/hooks/useRoutePlanner';
import { useRouteCoaching } from '../../src/hooks/useRouteCoaching';
import { useHeartRateCoaching } from '../../src/hooks/useHeartRateCoaching';
import { useTechniqueCoaching } from '../../src/hooks/useTechniqueCoaching';
import { useIntervalCoaching } from '../../src/hooks/useIntervalCoaching';
import * as voiceService from '../../src/services/voiceService';
import { sessionIntroUtterance, intervalIntroUtterance, raceFinishUtterance } from '../../src/config/voicePhrases';
import { buildIntervalSegments, intervalStateAt } from '../../src/data/intervals';
import { RoutePreviewSheet } from '../../src/components/ui/RoutePreviewSheet';
import { SessionTypeSheet } from '../../src/components/ui/SessionTypeSheet';
import { CoachExplainerSheet } from '../../src/components/ui/CoachExplainerSheet';
import { Button } from '../../src/components/ui/Button';
import { LiveRouteMap } from '../../src/components/ui/LiveRouteMap';
import { NextTurnBanner } from '../../src/components/ui/NextTurnBanner';
import { PremiumBadge } from '../../src/components/ui/PremiumBadge';
import { PREMIUM_CONFIG } from '../../src/config/premiumConfig';
import { usePremium } from '../../src/hooks/usePremium';
import { useRacePace } from '../../src/hooks/useRacePace';
import { formatPacePerKm } from '../../src/data/paceModel';
import { selectRoutePlansThisWeek } from '../../src/store/appStore';
import type { PlannedRoute } from '../../src/services/routeService';
import type { KmSplit } from '../../src/store/appStore';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  subscribeToLocations,
} from '../../src/services/backgroundLocationService';
import { saveSnapshot, clearSnapshot } from '../../src/services/runRecoveryService';
import { connectToMonitor, disconnectMonitor } from '../../src/services/bleHeartRateService';

// ── Haversine afstandsberekening (meters) ────────────────────────────────────
function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R    = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Glijdend gemiddelde tempo (laatste 10 GPS-punten) ────────────────────────
function calcRollingPace(
  route: Array<{ lat: number; lon: number; timestamp: number }>,
): number {
  const window = route.slice(-10);
  if (window.length < 2) return 0;
  const first = window[0];
  const last  = window[window.length - 1];
  const distM = haversineMeters(first.lat, first.lon, last.lat, last.lon);
  const secs  = (last.timestamp - first.timestamp) / 1000;
  if (distM < 5 || secs < 1) return 0;
  return secs / (distM / 1000); // sec/km
}

// ── Hartslagzone o.b.v. percentage van maxHr (BLE-hartslagmeter, fase A) ─────
// Vaste grenzen, los van de trainingszones per sessie: Z1 <60%, Z2 60-70%,
// Z3 70-80%, Z4 80-90%, Z5 >90% van de maximale hartslag.
function heartRateZoneFromPct(bpm: number, maxHr: number): HeartRateZone {
  const pct = bpm / maxHr;
  if (pct < 0.6) return 'Z1';
  if (pct < 0.7) return 'Z2';
  if (pct < 0.8) return 'Z3';
  if (pct < 0.9) return 'Z4';
  return 'Z5';
}

// GPS-punten met een geschatte nauwkeurigheid slechter dan dit aantal meters
// negeren we volledig: ze verstoren zowel de afstandsberekening als de routelijn.
const GPS_ACCURACY_THRESHOLD_M = 25;

// Plausibiliteitsfilter: een punt dat een impliciete snelheid hoger dan dit
// oplevert t.o.v. het vorige geaccepteerde punt is onmogelijk voor een hardloper
// (28,8 km/u) en wijst op een GPS-sprong. Gewoon overslaan, niets loggen.
const PLAUSIBILITY_MAX_SPEED_MPS = 8;

// Geen geaccepteerd GPS-punt gezien binnen dit aantal milliseconden tijdens een
// lopende (niet-gepauzeerde) sessie: toon de "zwak GPS-signaal"-waarschuwing.
const GPS_WEAK_SIGNAL_THRESHOLD_MS = 20000;

// Interval waarop een crash-herstel-snapshot van de lopende sessie wordt
// weggeschreven, zie runRecoveryService.
const SNAPSHOT_SAVE_INTERVAL_MS = 15000;

// AsyncStorage-sleutel voor de eenmalige locatie-priming, zie
// ensureLocationPriming hieronder. Bewust niet via appStore: dit is een losse,
// permanente vlag die niets met het gebruikersprofiel te maken heeft.
const LOCATION_PRIMING_KEY = 'location-priming-shown';

/**
 * Toont eenmalig een nette uitleg vlak voordat het systeem om locatietoestemming
 * vraagt, zodat de gebruiker begrijpt waarom de app dit vraagt voordat de
 * (soms afschrikwekkende) systeemdialoog verschijnt. Bij een volgende run
 * staat de vlag al in AsyncStorage en slaan we dit moment stilletjes over.
 */
async function ensureLocationPriming(): Promise<void> {
  let alreadyShown: string | null = null;
  try {
    alreadyShown = await AsyncStorage.getItem(LOCATION_PRIMING_KEY);
  } catch {
    // Bij een opslagfout laten we de priming gewoon zien; blokkeert de run niet.
  }
  if (alreadyShown) return;

  await new Promise<void>((resolve) => {
    Alert.alert(
      'Locatie voor je run',
      'Lopen te Lopen gebruikt je locatie om je route, afstand en tempo live te meten tijdens het hardlopen. Je locatie wordt niet gedeeld.',
      [{ text: 'Ga verder', onPress: () => resolve() }],
      { cancelable: false },
    );
  });

  try {
    await AsyncStorage.setItem(LOCATION_PRIMING_KEY, '1');
  } catch {
    // Faalt stil: in het ergste geval verschijnt de priming nog een keer.
  }
}

// Auto-pauze: bij een snelheid onder dit aantal m/s gedurende ongeveer 5
// seconden beschouwen we de loper als stilstaand.
const AUTO_PAUSE_SPEED_THRESHOLD_MPS = 0.5;
const AUTO_PAUSE_STILL_DURATION_MS  = 5000;
// Geen auto-pauze in de eerste 15 seconden na de start: voorkomt een vals
// alarm tijdens het wegzetten van de telefoon vlak na de countdown.
const AUTO_PAUSE_GRACE_PERIOD_MS = 15000;

// Korte, begrijpelijke omschrijving van het trainingstype. Leidt op het actieve
// scherm boven de hartslagzone, zodat een beginner meteen snapt wat de bedoeling
// is. De zonecode blijft als ondersteuning zichtbaar.
const sessionTypeShort: Record<string, string> = {
  easy:  'Rustig',
  tempo: 'Tempo',
  long:  'Lang',
  rest:  'Rust',
  cross: 'Cross',
  interval: 'Interval',
};

// ── Scherm ────────────────────────────────────────────────────────────────────
export default function ActiveSessionScreen() {
  const { sessionId, weekNumber } = useLocalSearchParams<{ sessionId: string; weekNumber: string }>();
  const profile         = useAppStore(s => s.profile);
  const racePlan        = useAppStore(s => s.racePlan);
  const customPlan      = useAppStore(s => s.customPlan);
  const schemaMode      = useAppStore(s => s.schemaMode);
  const startSession    = useAppStore(s => s.startSession);
  const completeSession = useAppStore(s => s.completeSession);
  // Aantal eerder voltooide sessies: rouleert de dagdeel-begroeting en de
  // finish-afsluitzin over meerdere runs heen (CP4, zie voicePhrases.ts).
  const completedSessionsCount = useAppStore(s => s.completedSessions.length);
  const cancelSession   = useAppStore(s => s.cancelSession);
  const activeSession   = useAppStore(s => s.activeSession);
  const updateProfile   = useAppStore(s => s.updateProfile);
  const registerRoutePlan = useAppStore(s => s.registerRoutePlan);
  const routePlansThisWeek = useAppStore(selectRoutePlansThisWeek);
  const autoPauseEnabled = useAppStore(s => s.autoPauseEnabled);
  const hrMonitorDeviceId = useAppStore(s => s.hrMonitorDeviceId);
  const { hasAccess, promptUpgrade } = usePremium();
  const { paceForType } = useRacePace();

  // Houd het scherm aan tijdens de hele actieve sessie, zodat de run niet
  // onderbreekt doordat het scherm vergrendelt.
  useKeepAwake();

  const [elapsed, setElapsed]               = useState(0);
  const [isRunning, setIsRunning]           = useState(false);
  const [distanceKm, setDistanceKm]         = useState(0);
  const [paceSecPerKm, setPace]             = useState(0);
  const [gpsReady, setGpsReady]             = useState(false);
  const [gpsError, setGpsError]             = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [showTypeInfo, setShowTypeInfo]     = useState(false);
  // Countdown: 3-2-1 fullscreen voorafgaand aan de GPS-tracking en de timer.
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [countdownActive, setCountdownActive] = useState(false);
  // Km-splits: tijd per voltooide kilometer, in Strava-stijl getoond op de samenvatting.
  const [splits, setSplits] = useState<KmSplit[]>([]);
  const lastSplitKmRef  = useRef(0);
  const lastSplitTimeRef = useRef(0);
  // Auto-pauze: automatisch pauzeren bij stilstand, met eigen melding op het scherm.
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const stillSinceRef      = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const isAutoPausedRef    = useRef(false);
  const manuallyPausedRef  = useRef(false);
  const countdownActiveRef = useRef(false);
  // Gesproken sessie-intro (fase E): moet precies één keer per sessie klinken,
  // zie de countdown-effect hieronder waar dit bewaakt wordt.
  const introSpokenRef    = useRef(false);
  // Schermvergrendeling: voorkomt dat een veeg of broekzak de run onderbreekt.
  // De ref houdt de actuele waarde vast voor de hardware-terugknop-handler.
  const [isLocked, setIsLocked]             = useState(false);
  const isLockedRef                         = useRef(false);
  // GPS-verlies-detectie: waarschuwing als er te lang geen geaccepteerd punt is.
  const [weakGpsSignal, setWeakGpsSignal]   = useState(false);
  // Toont "Open instellingen" als de locatietoestemming expliciet geweigerd is.
  const [permissionDenied, setPermissionDenied] = useState(false);
  // Live hartslag van een gekoppelde BLE-hartslagmeter (fase A). Null zolang
  // er geen signaal is: geen meter gekoppeld, nog niet verbonden, of verlies
  // van signaal tijdens de run.
  const [heartRate, setHeartRate] = useState<number | null>(null);
  // Alle metingen van deze run, voor het gemiddelde bij het afronden. Een ref
  // (geen state): dit hoeft nergens tussentijds op te renderen.
  const hrSamplesRef = useRef<number[]>([]);
  const hrMaxRef      = useRef(0);
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ── Routeplanner ──────────────────────────────────────────────────────────
  // Gratis gebruikers mogen een beperkt aantal routes per week plannen; premium
  // is onbeperkt. Offline-first: onbekende premium-status telt als gratis.
  const routeLimitReached =
    !hasAccess && routePlansThisWeek >= PREMIUM_CONFIG.FREE_ROUTE_PLANS_PER_WEEK;
  const canUsePlanner = hasAccess || !routeLimitReached;
  const [showRouteQuestion, setShowRouteQuestion] = useState(false);
  // Uitlegscherm "Wat kun je verwachten van je coach?": alleen relevant terwijl
  // er nog gewacht wordt op GPS/route (zie de render hieronder), vandaar hier
  // en niet bij de andere sheets verderop in dit bestand.
  const [showCoachExplainer, setShowCoachExplainer] = useState(false);
  const [showRoutePreview, setShowRoutePreview]   = useState(false);
  const [activePlannedRoute, setActivePlannedRoute] = useState<PlannedRoute | null>(null);
  const routePlanTriggered = useRef(false);
  const firstGpsRef = useRef<{ lat: number; lon: number } | null>(null);

  // Refs zodat callbacks altijd de laatste waarden zien
  const routeRef      = useRef<Array<{ lat: number; lon: number; timestamp: number }>>([]);
  const distanceRef   = useRef(0);
  const paceRef       = useRef(0);
  const isRunningRef  = useRef(false);
  const elapsedRef    = useRef(0);
  const locationSub   = useRef<Location.LocationSubscription | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Achtergrondtracking: opzegfunctie van het locatie-abonnement.
  const unsubscribeLocationsRef = useRef<(() => void) | null>(null);
  // Laatste GPS-punt dat zowel de nauwkeurigheids- als plausibiliteitsfilter
  // doorstond. Basis voor het plausibiliteitsfilter en de GPS-verlies-detectie.
  const lastAcceptedPointRef = useRef<{ lat: number; lon: number; timestamp: number } | null>(null);
  const lastAcceptedAtRef    = useRef<number | null>(null);
  // Spiegelt de splits-state naar een ref, zodat de snapshot-timer altijd de
  // laatste waarde ziet zonder de interval-callback opnieuw te hoeven maken.
  const splitsRef = useRef<KmSplit[]>([]);
  useEffect(() => { splitsRef.current = splits; }, [splits]);
  // Wijst altijd naar de laatste persistSnapshot-functie (zie verderop), zodat
  // de GPS-callback (met een leeg dependency-array) hem zonder stale closure
  // kan aanroepen bij auto-pauze/hervatten.
  const persistSnapshotRef = useRef<() => void>(() => {});

  // ── Zoek sessie ───────────────────────────────────────────────────────────
  const weekNum = parseInt(weekNumber ?? '1');
  const resolveWeek = (): TrainingWeek | undefined => {
    if (!profile) return undefined;
    return resolveActivePlan({ schemaMode, racePlan, customPlan, goal: profile.goal, trainingDays: profile.trainingDays })
      .weeks.find(w => w.weekNumber === weekNum);
  };
  const week    = resolveWeek();
  const session = week?.sessions.find(s => s.id === sessionId);

  // Is dit de RACE-sessie van de laatste week van een actief wedstrijdschema?
  // Detectie via dezelfde description die buildRacePlan.injectRaceName op
  // precies díé ene sessie zet ("{racenaam}: RACE DAG!"), plus het
  // weeknummer als extra zekerheid — zie ook raceFinishUtterance hieronder
  // en de pep-talk-intro (CP7).
  const isRaceDaySession = !!(
    session && schemaMode === 'race' && racePlan &&
    weekNum === racePlan.totalWeeks &&
    session.description === `${racePlan.race.name}: RACE DAG!`
  );

  // ── Routeplanner hook ─────────────────────────────────────────────────────
  const planner = useRoutePlanner(session?.distanceKm ?? 5);

  // ── Gesproken begeleiding ─────────────────────────────────────────────────
  const voiceEnabled = profile?.voiceGuidance ?? false;
  const voiceType    = profile?.voiceType ?? 'female';
  const { onKmUpdate, onFinish, stop: stopVoice } = useVoiceGuidance(
    voiceEnabled,
    session?.distanceKm ?? 0,
    voiceType,
  );
  const {
    onGpsUpdate: onRouteCoachingUpdate,
    nextTurn:    nextRouteTurn,
    isOffRoute,
  } = useRouteCoaching(
    !!activePlannedRoute,
    voiceEnabled,
    activePlannedRoute ?? undefined,
    voiceType,
  );
  // Max. hartslag voor de live hartslagzone (fase A) en -coaching (fase B):
  // profiel.maxHeartRate, met 220-leeftijd als nooddoorval mocht dat veld
  // onbekend zijn. Zonder beide blijft alleen de bpm zichtbaar/gemeten,
  // zonder zone-indicatie of coaching. Vóór de "!profile"-guard berekend
  // (rules of hooks): de hook hieronder moet altijd aangeroepen worden.
  const maxHrForZones = profile?.maxHeartRate || (profile?.age ? 220 - profile.age : null);
  const { onHeartRateUpdate: onHeartRateCoachingUpdate } = useHeartRateCoaching(
    voiceEnabled,
    session?.zone,
    maxHrForZones,
    voiceType,
  );
  // Techniek-cues tijdens lange duurlopen (fase G/CP7) — zuiver tijdgedreven,
  // zie useTechniqueCoaching.ts. Via een ref hieronder aangeroepen vanuit de
  // secondetimer (leeg dependency-array), net als intervalOnTickRef.
  const { onTick: onTechniqueTick } = useTechniqueCoaching(
    voiceEnabled,
    session?.type === 'long',
    voiceType,
  );
  const techniqueOnTickRef = useRef(onTechniqueTick);
  techniqueOnTickRef.current = onTechniqueTick;
  // Via een ref doorgegeven aan het BLE-verbindingseffect hieronder: de
  // callback wisselt van identiteit als bijv. de spraak aan/uit gaat, en dat
  // mag de bluetooth-verbinding niet laten her-opzetten middenin een run.
  const onHeartRateCoachingUpdateRef = useRef(onHeartRateCoachingUpdate);
  onHeartRateCoachingUpdateRef.current = onHeartRateCoachingUpdate;

  // ── Intervalcoaching (sessietype 'interval') ──────────────────────────────
  const isInterval = session?.type === 'interval' && !!session.interval;
  const intervalSegments = useMemo(
    () => (session?.interval ? buildIntervalSegments(session.interval) : []),
    [session],
  );
  const intervalCoaching = useIntervalCoaching(voiceEnabled, session?.interval, voiceType);
  // Refs zodat de secondetimer hieronder (met een leeg dependency-array)
  // altijd de laatste waarden ziet, net als onHeartRateCoachingUpdateRef hierboven.
  const isIntervalRef = useRef(isInterval);
  isIntervalRef.current = isInterval;
  const intervalOnTickRef = useRef(intervalCoaching.onTick);
  intervalOnTickRef.current = intervalCoaching.onTick;

  // ── Init sessie ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (session && !activeSession) {
      startSession(session, weekNum);
    }
  }, []);

  // ── Sessie intern starten (na GPS/route-flow) ─────────────────────────────
  // Start eerst de fullscreen 3-2-1 countdown. Pas als die afgelopen is,
  // beginnen de GPS-tracking en de secondetimer echt (zie countdown-effect).
  const startSessionNow = useCallback((route: PlannedRoute | null) => {
    setActivePlannedRoute(route);
    setSessionStarted(true);
    setCountdownActive(true);
    countdownActiveRef.current = true;
    setCountdownValue(3);
  }, []);

  // ── Countdown: elke seconde een haptische tik, bij "Start" een zwaardere ──
  useEffect(() => {
    if (!countdownActive) return;

    if (countdownValue === null) return;

    if (countdownValue <= 0) {
      // Countdown klaar: zwaardere tik en de echte sessie start nu pas.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setCountdownActive(false);
      countdownActiveRef.current = false;
      const now = Date.now();
      sessionStartTimeRef.current = now;
      setIsRunning(true);
      isRunningRef.current = true;

      // Gesproken sessie-intro (fase E, zie voicePhrases.sessionIntroUtterance):
      // precies één keer per sessie, op het moment dat er daadwerkelijk gelopen
      // wordt. Dit is bewust de plek — en niet een aparte useEffect op
      // `isRunning` — omdat dit de ENIGE tak is waar isRunning van false naar
      // true gaat ná de countdown; latere isRunning-wissels (handmatige
      // pauze/hervatten, auto-pauze) lopen nooit via deze tak, dus
      // introSpokenRef.current is voldoende om "precies één keer" te
      // garanderen zonder een extra "was dit de allereerste keer running"
      // -check. Alleen met spraak aan en een bekend, loopbaar sessietype
      // (geen 'rest' — daar loop je niet naartoe — en geen sessie zonder
      // type, de toekomstige "vrije run" uit het ontwerpdoc).
      if (voiceEnabled && !introSpokenRef.current && session && isInterval) {
        // Intervalsessie: eigen intro (dekt de warming-up al) in plaats van
        // de gewone sessie-intro, en de coachingtoestand van de nieuwe
        // sessie op nul zetten.
        introSpokenRef.current = true;
        intervalCoaching.reset();
        void voiceService.speakPhrases(
          intervalIntroUtterance({ hour: new Date().getHours(), variant: completedSessionsCount }),
          voiceType,
        );
      } else if (
        voiceEnabled && !introSpokenRef.current && session &&
        (session.type === 'easy' || session.type === 'tempo' ||
         session.type === 'long' || session.type === 'cross')
      ) {
        introSpokenRef.current = true;
        void voiceService.speakPhrases(
          sessionIntroUtterance(
            session.type, session.distanceKm, session.zone,
            { hour: new Date().getHours(), variant: completedSessionsCount },
            // Pep-talk (CP7): alleen bij een lange duurloop of de racedag zelf
            // — daar is een mentale aanmoediging vooraf het meest op zijn plek.
            (session.type === 'long' || isRaceDaySession) ? completedSessionsCount : undefined,
          ),
          voiceType,
        );
      }
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const timeout = setTimeout(() => setCountdownValue(v => (v ?? 1) - 1), 1000);
    return () => clearTimeout(timeout);
  }, [countdownActive, countdownValue]);

  // ── GPS opstarten ─────────────────────────────────────────────────────────
  // Achtergrondtracking via expo-task-manager (backgroundLocationService), zodat
  // de run doorloopt met vergrendeld scherm of de app op de achtergrond. Bij een
  // fout in het starten van die achtergrondtaak (bijvoorbeeld een simulator die
  // dit niet ondersteunt) valt dit terug op de klassieke voorgrond-tracking van
  // watchPositionAsync, zodat GPS-tracking nooit helemaal uitvalt.
  useEffect(() => {
    let mounted = true;
    if (!profile) return;

    // Verwerk één binnenkomend locatiepunt. Exact dezelfde logica als voorheen
    // (nauwkeurigheidsfilter, eerste fix, auto-pauze, splits, haptics), plus
    // het nieuwe plausibiliteitsfilter en de GPS-verlies-detectie.
    const handleLocation = (loc: Location.LocationObject) => {
      if (!mounted) return;

      const { latitude, longitude, accuracy, speed } = loc.coords;
      const now = loc.timestamp;

      // ── GPS-nauwkeurigheidsfilter: te onnauwkeurige punten negeren we
      // volledig, zowel voor de afstandsberekening als de routelijn.
      if (accuracy != null && accuracy > GPS_ACCURACY_THRESHOLD_M) return;

      // ── Plausibiliteitsfilter: een onmogelijke sprong t.o.v. het vorige
      // geaccepteerde punt (harder dan 8 m/s) wijst op een GPS-fout. Gewoon
      // overslaan, verder niets doen met dit punt.
      const lastAccepted = lastAcceptedPointRef.current;
      if (lastAccepted) {
        const dtSec = (now - lastAccepted.timestamp) / 1000;
        if (dtSec > 0) {
          const jumpMeters = haversineMeters(lastAccepted.lat, lastAccepted.lon, latitude, longitude);
          if (jumpMeters / dtSec > PLAUSIBILITY_MAX_SPEED_MPS) return;
        }
      }
      lastAcceptedPointRef.current = { lat: latitude, lon: longitude, timestamp: now };
      lastAcceptedAtRef.current = now;

      // GPS blijkt (alsnog) beschikbaar: wis een eerdere "geen GPS"-melding,
      // anders blijft de banner staan terwijl de afstand wél wordt bijgehouden.
      setGpsError(prev => (prev ? null : prev));

      // ── Eerste GPS-fix ──────────────────────────────────────────────
      if (!gpsReady) {
        if (gpsTimeoutRef.current) {
          clearTimeout(gpsTimeoutRef.current);
          gpsTimeoutRef.current = null;
        }
        setGpsReady(true);
        firstGpsRef.current = { lat: latitude, lon: longitude };

        // Intervalsessie: geen routevraag, meteen starten zonder route (de
        // segmentklok stuurt de sessie, een vooraf uitgestippelde route heeft
        // hier geen functie).
        if (isIntervalRef.current && !routePlanTriggered.current) {
          routePlanTriggered.current = true;
          startSessionNow(null);
        } else if (canUsePlanner && !routePlanTriggered.current) {
          routePlanTriggered.current = true;
          setShowRouteQuestion(true);
        } else if (!routePlanTriggered.current) {
          routePlanTriggered.current = true;
          // Gratis weeklimiet bereikt: nette upgrade-prompt en zonder route starten
          if (routeLimitReached) {
            promptUpgrade(
              'Routeplanner-limiet bereikt',
              `Met gratis kun je ${PREMIUM_CONFIG.FREE_ROUTE_PLANS_PER_WEEK} routes per week plannen. Met premium plan je onbeperkt routes. Je sessie start gewoon, zonder vooraf geplande route.`,
            );
          }
          startSessionNow(null);
        }
      }

      // ── Auto-pauze: detecteer stilstand/beweging, ook tijdens pauze ──
      // Dit loopt zodra de sessie (na de countdown) begonnen is, ongeacht
      // of de timer op dit moment loopt, zodat we automatisch weer kunnen
      // hervatten zodra de loper in beweging komt.
      if (countdownActiveRef.current) return;
      if (!sessionStartTimeRef.current) return;

      if (autoPauseEnabled && !manuallyPausedRef.current) {
        const sinceStart = now - sessionStartTimeRef.current;
        const isStill = speed != null
          ? speed < AUTO_PAUSE_SPEED_THRESHOLD_MPS
          : false;

        if (sinceStart >= AUTO_PAUSE_GRACE_PERIOD_MS) {
          if (isStill) {
            if (stillSinceRef.current == null) stillSinceRef.current = now;
            const stillFor = now - stillSinceRef.current;
            if (!isAutoPausedRef.current && stillFor >= AUTO_PAUSE_STILL_DURATION_MS) {
              isAutoPausedRef.current = true;
              isRunningRef.current = false;
              setIsAutoPaused(true);
              setIsRunning(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              persistSnapshotRef.current();
            }
          } else {
            stillSinceRef.current = null;
            if (isAutoPausedRef.current) {
              isAutoPausedRef.current = false;
              isRunningRef.current = true;
              setIsAutoPaused(false);
              setIsRunning(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              persistSnapshotRef.current();
            }
          }
        }
      }

      // ── GPS-tracking (alleen als de sessie daadwerkelijk loopt) ─────
      if (!isRunningRef.current) return;

      const prev = routeRef.current[routeRef.current.length - 1];
      // Aanvullen, niet kopiëren. Dit stond eerder als een spread naar een
      // nieuwe array, en dat is O(n²) over een hele run: bij ongeveer één punt
      // per seconde zit een marathonloper na vier uur op ~14.000 punten, wat
      // neerkomt op ~14.000 nieuwe arrays en in totaal ruim honderd miljoen
      // gekopieerde verwijzingen — precies het soort geheugendruk waar iOS een
      // app om afschiet (zie de WatchdogTermination in Sentry).
      //
      // Let op bij toekomstige wijzigingen: routeRef.current gaat als prop
      // `coveredRoute` naar LiveRouteMap en houdt nu dus zijn identiteit. Dat
      // is veilig omdat die component niet gememoïseerd is en zijn camera-
      // effect ook aan currentLat/currentLon hangt (die wél per punt wijzigen).
      // Zet er dus geen React.memo op en memoïseer daar niets op `coveredRoute`
      // alleen, want dan bevriest de kaart.
      routeRef.current.push({ lat: latitude, lon: longitude, timestamp: now });

      if (prev) {
        const meters = haversineMeters(prev.lat, prev.lon, latitude, longitude);
        distanceRef.current += meters / 1000;
        setDistanceKm(parseFloat(distanceRef.current.toFixed(3)));
      }

      const pace = calcRollingPace(routeRef.current);
      if (pace > 0) {
        paceRef.current = pace;
        setPace(pace);
      }

      // ── Km-splits: sla de tijd van elke voltooide kilometer op ──────
      const completedKm = Math.floor(distanceRef.current);
      if (completedKm > lastSplitKmRef.current) {
        const nowElapsed = elapsedRef.current;
        for (let km = lastSplitKmRef.current + 1; km <= completedKm; km++) {
          const splitSeconds = nowElapsed - lastSplitTimeRef.current;
          setSplits(prevSplits => [...prevSplits, { km, seconds: splitSeconds }]);
          lastSplitTimeRef.current = nowElapsed;
        }
        lastSplitKmRef.current = completedKm;
        // Haptische tik bij elke kilometer-cue, net als de gesproken melding.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Km-/halverwege-cues slaan we over bij een intervalsessie: die wordt
      // gestuurd door de segmentklok (useIntervalCoaching), niet door afstand.
      if (!isIntervalRef.current) onKmUpdate(distanceRef.current, paceRef.current);
      onRouteCoachingUpdate(latitude, longitude, distanceRef.current);
    };

    (async () => {
      await ensureLocationPriming();
      if (!mounted) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setGpsError('Geen locatietoestemming. Geef toegang via je telefooninstellingen.');
        setGpsReady(true);
        startSessionNow(null);
        return;
      }

      // 30-seconden timeout
      gpsTimeoutRef.current = setTimeout(() => {
        if (!mounted) return;
        setGpsError('Geen GPS-signaal. Afstand wordt niet bijgehouden.');
        setGpsReady(true);
        startSessionNow(null);
      }, 30_000);

      // Abonneer altijd eerst, zodat we niets missen zodra de achtergrondtaak
      // (of het voorgrond-fallbackpad hieronder) begint te leveren.
      unsubscribeLocationsRef.current = subscribeToLocations((locations) => {
        locations.forEach(handleLocation);
      });

      const backgroundStarted = await startBackgroundTracking();
      if (!backgroundStarted && mounted) {
        // Faalt stil terug naar voorgrond-tracking: de run mag nooit zonder
        // GPS-tracking komen te zitten, ook al werkt de achtergrondtaak niet.
        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy:         Location.Accuracy.BestForNavigation,
            distanceInterval: 5,
            timeInterval:     1000,
          },
          handleLocation,
        );
      }
    })();

    return () => {
      mounted = false;
      unsubscribeLocationsRef.current?.();
      locationSub.current?.remove();
      void stopBackgroundTracking();
      if (gpsTimeoutRef.current) clearTimeout(gpsTimeoutRef.current);
    };
  }, []);

  // ── Hartslagmeter verbinden (fase A) ──────────────────────────────────────
  // Alleen als er een meter gekoppeld is (Instellingen). Niet-blokkerend: dit
  // loopt los van de GPS-opstart hierboven en de rest van het scherm wacht
  // hier niet op. Werkt zonder gekoppelde meter, zonder BLE-module en zonder
  // Bluetooth-toestemming gewoon niet: dan blijft heartRate simpelweg null en
  // verschijnt er geen hartslag-UI (zie de statsGrid hieronder).
  useEffect(() => {
    if (!hrMonitorDeviceId) return;
    let mounted = true;

    void connectToMonitor(
      hrMonitorDeviceId,
      (bpm) => {
        if (!mounted) return;
        setHeartRate(bpm);
        hrSamplesRef.current.push(bpm);
        if (bpm > hrMaxRef.current) hrMaxRef.current = bpm;
        // Hartslagcoaching (fase B): alleen als de sessie daadwerkelijk loopt.
        // isRunningRef is ook false bij auto-pauze en tijdens de countdown,
        // dus de coach blijft stil zolang de loper stilstaat of nog moet
        // starten. De meter zelf blijft gewoon meten (voor het gemiddelde),
        // alleen de coaching-melding wordt overgeslagen.
        if (isRunningRef.current) {
          onHeartRateCoachingUpdateRef.current(bpm, elapsedRef.current);
        }
      },
      () => {
        // Geen signaal (nog) niet verbonden, of de herverbindingspogingen
        // van bleHeartRateService zijn uitgeput: toon "geen signaal".
        if (mounted) setHeartRate(null);
      },
    );

    return () => {
      mounted = false;
      void disconnectMonitor();
    };
  }, [hrMonitorDeviceId]);

  // ── GPS-verlies-detectie: waarschuw als er te lang geen geaccepteerd punt
  // binnenkomt tijdens een lopende (niet-gepauzeerde) sessie. Verdwijnt vanzelf
  // zodra er weer punten binnenkomen.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRunningRef.current) {
        setWeakGpsSignal(false);
        return;
      }
      const lastAt = lastAcceptedAtRef.current;
      if (lastAt == null) return;
      setWeakGpsSignal(Date.now() - lastAt > GPS_WEAK_SIGNAL_THRESHOLD_MS);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ── Crash-herstel: schrijf periodiek een snapshot van de lopende sessie ───
  const persistSnapshot = useCallback(() => {
    if (!sessionStarted || countdownActiveRef.current) return;
    if (!sessionId || !session) return;
    void saveSnapshot({
      sessionId,
      sessionType:    session.type,
      weekNumber:     weekNum,
      startTimestamp: sessionStartTimeRef.current ?? Date.now(),
      elapsed:        elapsedRef.current,
      distanceKm:     distanceRef.current,
      splits:         splitsRef.current,
      route:          routeRef.current,
      pausedState:    !isRunningRef.current,
      savedAt:        Date.now(),
    });
  }, [sessionStarted, sessionId, session, weekNum]);

  useEffect(() => { persistSnapshotRef.current = persistSnapshot; }, [persistSnapshot]);

  useEffect(() => {
    if (!sessionStarted) return;
    const interval = setInterval(persistSnapshot, SNAPSHOT_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [sessionStarted, persistSnapshot]);

  // ── Secondetimer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setElapsed(e => {
        const next = e + 1;
        elapsedRef.current = next;
        // Intervalcoaching: de segmentklok loopt gelijk met deze timer, dus
        // pauzeert vanzelf mee (deze tak draait alleen terwijl isRunning).
        if (isIntervalRef.current) intervalOnTickRef.current(next);
        // Techniek-cues (CP7): pauzeert om dezelfde reden vanzelf mee. De hook
        // zelf bepaalt of dit sessietype/tijdstip een cue oplevert.
        techniqueOnTickRef.current(next);
        return next;
      }), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    isRunningRef.current = isRunning;
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // ── Android hardware-terugknop ────────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Tijdens vergrendeling negeren we de terugknop, zodat de run niet per
      // ongeluk afgebroken wordt.
      if (isLockedRef.current) return true;
      handleCancel();
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── Route preview callbacks ───────────────────────────────────────────────
  const handleStartWithRoute = useCallback(() => {
    setShowRoutePreview(false);
    startSessionNow(planner.route);
  }, [planner.route, startSessionNow]);

  const handleStartWithoutRoute = useCallback(() => {
    setShowRoutePreview(false);
    startSessionNow(null);
  }, [startSessionNow]);

  const handleReplan = useCallback(() => {
    const pos = firstGpsRef.current;
    if (pos) planner.planRoute(pos.lat, pos.lon);
  }, [planner]);

  // ── Routevraag beantwoorden ───────────────────────────────────────────────
  const handlePlanRoute = useCallback(() => {
    setShowRouteQuestion(false);
    updateProfile({ routePlannerEnabled: true });
    // Tel dit als een geplande route voor de gratis weeklimiet (premium telt
    // ook mee maar wordt nooit begrensd)
    registerRoutePlan();
    const pos = firstGpsRef.current;
    if (pos) {
      setShowRoutePreview(true);
      planner.planRoute(pos.lat, pos.lon);
    } else {
      startSessionNow(null);
    }
  }, [planner, startSessionNow, updateProfile, registerRoutePlan]);

  const handleSkipRoute = useCallback(() => {
    setShowRouteQuestion(false);
    updateProfile({ routePlannerEnabled: false });
    startSessionNow(null);
  }, [startSessionNow, updateProfile]);

  // Pas na alle hooks: zonder profiel valt er niets te tonen
  if (!profile) return null;

  // ── Afgeleid ──────────────────────────────────────────────────────────────
  const targetPct = session ? Math.min(100, (distanceKm / session.distanceKm) * 100) : 0;
  const zoneColor = session ? zoneInfo[session.zone].color : colors.brandPrimary;
  // Persoonlijk doeltempo voor deze sessie (premium + ingestelde doeltijd).
  const targetTrainingPace = session ? paceForType(session.type) : null;

  const formatTime = (s: number) => {
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const formatPace = (secPerKm: number) => {
    if (secPerKm === 0) return '--:--';
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ── Stoppen ───────────────────────────────────────────────────────────────
  const handleStop = () => {
    Alert.alert(
      'Sessie afsluiten',
      'Wil je deze sessie opslaan en afsluiten?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Opslaan en afsluiten',
          onPress: () => {
            if (timerRef.current) clearInterval(timerRef.current);
            unsubscribeLocationsRef.current?.();
            locationSub.current?.remove();
            void stopBackgroundTracking();
            void clearSnapshot();
            void disconnectMonitor();
            const finalDist = parseFloat(distanceRef.current.toFixed(2));
            const avgPace   = finalDist > 0 ? Math.round(elapsed / finalDist) : 0;
            const hrSamples = hrSamplesRef.current;
            const avgHeartRate = hrSamples.length > 0
              ? Math.round(hrSamples.reduce((sum, bpm) => sum + bpm, 0) / hrSamples.length)
              : undefined;
            const maxHeartRateBpm = hrMaxRef.current > 0 ? hrMaxRef.current : undefined;

            // Race-felicitatie (fase E, zie voicePhrases.raceFinishUtterance):
            // vervangt de standaard "Sessie voltooid!"-melding (onFinish)
            // wanneer dit de RACE-sessie van de laatste week van een actief
            // wedstrijdschema is. Detectie via dezelfde description die
            // buildRacePlan.injectRaceName op precies díé ene sessie zet
            // ("{racenaam}: RACE DAG!"), plus de weeknummer als extra
            // zekerheid. Bewust VERVANGEN in plaats van na elkaar spreken:
            // speakPhrases/onFinish beginnen altijd met stop() op de vorige
            // uitspraak (zie voiceService.ts), dus een tweede melding vlak na
            // "Sessie voltooid!" zou die gewoon afkappen — door elkaar heen
            // praten dus. Eén heldere felicitatie is hier het betere moment.
            if (isRaceDaySession) {
              if (voiceEnabled) {
                voiceService.speakPhrases(
                  raceFinishUtterance(racePlan.race.id, racePlan.race.name),
                  voiceType,
                );
              }
            } else {
              onFinish(finalDist, elapsed, completedSessionsCount);
            }
            completeSession(
              {
                actualDistanceKm: finalDist,
                durationSeconds:  elapsed,
                avgPaceSecPerKm:  avgPace,
                avgHeartRate,
                maxHeartRateBpm,
                route:            routeRef.current,
                splits:           splits,
                source:           'app',
              },
              week?.sessions ?? [],
            );
            router.replace({
              pathname: '/session/summary',
              params: {
                distanceKm:      finalDist.toFixed(2),
                durationSeconds: String(elapsed),
                avgPace:         String(avgPace),
                sessionId,
                weekNumber,
                splits:          JSON.stringify(splits),
              },
            });
          },
        },
      ],
    );
  };

  // ── Annuleren ─────────────────────────────────────────────────────────────
  const handleCancel = () => {
    Alert.alert(
      'Sessie annuleren',
      'Je voortgang wordt niet opgeslagen.',
      [
        { text: 'Doorgaan met lopen', style: 'cancel' },
        {
          text: 'Stop zonder opslaan',
          style: 'destructive',
          onPress: () => {
            if (timerRef.current) clearInterval(timerRef.current);
            unsubscribeLocationsRef.current?.();
            locationSub.current?.remove();
            void stopBackgroundTracking();
            void clearSnapshot();
            void disconnectMonitor();
            stopVoice();
            cancelSession();
            router.back();
          },
        },
      ],
    );
  };

  // ── Fout: sessie niet gevonden ────────────────────────────────────────────
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Sessie niet gevonden</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Terug naar dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Fullscreen countdown, vlak voor de start van GPS-tracking en timer ────
  if (countdownActive) {
    return (
      <View style={[styles.container, styles.countdownContainer]}>
        <SafeAreaView style={styles.countdownInner}>
          <Text style={styles.countdownLabel}>Klaar voor de start</Text>
          <Text style={styles.countdownNumber}>
            {countdownValue !== null && countdownValue > 0 ? countdownValue : 'Start'}
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  // ── Wachten op GPS / route planning ──────────────────────────────────────
  if (!gpsReady || !sessionStarted) {
    return (
      <View style={[styles.container, styles.loadingBg]}>
        <SafeAreaView style={styles.loadingInner}>
          {!showRouteQuestion && (
            <>
              {/* Workout-briefing: korte, persoonlijke voorbereiding vlak voor de start,
                  zodat het wachten op GPS niet leeg aanvoelt en de gebruiker weet wat
                  deze training van hem vraagt. */}
              <View style={styles.briefingCard}>
                <Text style={styles.briefingGreeting}>{profile.name}, dit is jouw training</Text>
                <Text style={styles.briefingType}>
                  {sessionTypeShort[session.type] ?? zoneInfo[session.zone].label} · {session.distanceKm} km
                </Text>
                <Text style={styles.briefingTip} numberOfLines={3}>{session.coachTip}</Text>
              </View>

              <View style={styles.gpsIconBox}>
                <MapPin size={36} color={colors.brandPrimary} strokeWidth={1.5} />
              </View>

              <View style={styles.gpsTextBlock}>
                <ActivityIndicator size="small" color={colors.brandPrimary} style={{ marginBottom: spacing[1] }} />
                <Text style={styles.gpsWaitTitle}>GPS-signaal zoeken...</Text>
                <Text style={styles.gpsWaitSub}>
                  We zoeken je locatie. Geen signaal na 30 seconden?{'\n'}
                  Dan starten we zonder GPS.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowCoachExplainer(true)}
                style={styles.coachExplainerLink}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Uitleg: wat doet je coach tijdens het lopen?"
              >
                <Text style={styles.coachExplainerLinkText}>Wat doet je coach tijdens het lopen?</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Routevraag: GPS gevonden, wil je een route plannen? */}
          {showRouteQuestion && (
            <View style={styles.routeQuestionCard}>
              <View style={styles.plannerLabelRow}>
                <Map size={18} color={colors.brandPrimary} strokeWidth={2} />
                <Text style={styles.plannerLabel}>Routeplanner</Text>
                <PremiumBadge />
              </View>
              <Text style={styles.routeQuestionTitle}>Wil je een route plannen?</Text>
              <Text style={styles.routeQuestionSub}>
                Voor deze training staat {session.distanceKm} km op het programma. De app kan een
                route van die lengte voor je uitstippelen vanaf je startpunt.
              </Text>
              {!hasAccess && (
                <Text style={styles.routeQuestionLimit}>
                  Nog {Math.max(0, PREMIUM_CONFIG.FREE_ROUTE_PLANS_PER_WEEK - routePlansThisWeek)} van {PREMIUM_CONFIG.FREE_ROUTE_PLANS_PER_WEEK} gratis routes deze week. Met premium plan je onbeperkt.
                </Text>
              )}
              <Button label="Plan mijn route" onPress={handlePlanRoute} fullWidth />
              <Button label="Start zonder route" onPress={handleSkipRoute} variant="secondary" fullWidth />
              <TouchableOpacity
                onPress={() => setShowCoachExplainer(true)}
                style={styles.coachExplainerLink}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Uitleg: wat doet je coach tijdens het lopen?"
              >
                <Text style={styles.coachExplainerLinkText}>Wat doet je coach tijdens het lopen?</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showRouteQuestion && (
            <TouchableOpacity
              onPress={() => {
                if (gpsTimeoutRef.current) clearTimeout(gpsTimeoutRef.current);
                setGpsError('Geen GPS-signaal. Afstand wordt niet bijgehouden.');
                setGpsReady(true);
                startSessionNow(null);
              }}
              style={styles.skipGpsBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Nu starten zonder GPS"
            >
              <Text style={styles.skipGpsText}>Nu starten zonder GPS</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>

        {/* Route preview sheet, verschijnt bovenop GPS-wachtscherm */}
        {session && (
          <RoutePreviewSheet
            visible={showRoutePreview}
            plannedRoute={planner.route}
            routeType={planner.routeType}
            isLoading={planner.isLoading}
            error={planner.error}
            targetDistanceKm={session.distanceKm}
            onSelectType={(type) => {
              planner.setRouteType(type);
              handleReplan();
            }}
            onReplan={handleReplan}
            onStartWithRoute={handleStartWithRoute}
            onStartWithoutRoute={handleStartWithoutRoute}
            onClose={handleStartWithoutRoute}
          />
        )}

        <CoachExplainerSheet
          visible={showCoachExplainer}
          onClose={() => setShowCoachExplainer(false)}
        />
      </View>
    );
  }

  // ── Actief sessie-scherm ──────────────────────────────────────────────────
  const lastPos = routeRef.current[routeRef.current.length - 1];
  // Houd de ref gelijk met de state voor de terugknop-handler.
  isLockedRef.current = isLocked;
  // Intervalpaneel: huidige segmenttoestand o.b.v. de verstreken tijd. Alleen
  // berekend bij een intervalsessie, andere sessietypes gebruiken de gewone
  // afstand-voortgangsbalk hieronder en blijven ongewijzigd.
  const ivState = isInterval ? intervalStateAt(intervalSegments, elapsed) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgBase }]}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleCancel} style={styles.closeBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Sessie annuleren">
            <ChevronDown size={24} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.sessionMeta}>
            <Text style={styles.sessionName}>{session.description}</Text>
            <ZoneBadge zone={session.zone} size="sm" />
          </View>
          <View style={styles.gpsIndicator}>
            <MapPin size={14} color={gpsError ? colors.error : colors.success} strokeWidth={2} />
            <Text style={[styles.gpsIndicatorText, { color: gpsError ? colors.error : colors.success }]}>
              {gpsError ? 'Geen GPS' : 'GPS'}
            </Text>
          </View>
        </View>

        {/* GPS-foutmelding */}
        {gpsError && (
          <View style={styles.gpsBanner}>
            <Text style={styles.gpsBannerText}>{gpsError}</Text>
            {permissionDenied && (
              <TouchableOpacity
                onPress={() => Linking.openSettings()}
                style={styles.gpsSettingsBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Open instellingen"
              >
                <Text style={styles.gpsSettingsBtnText}>Open instellingen</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Zwak GPS-signaal: langer dan 20 seconden geen geaccepteerd punt */}
        {!gpsError && weakGpsSignal && (
          <View style={styles.gpsBanner}>
            <Text style={styles.gpsBannerText}>Zwak GPS-signaal. Je afstand kan even achterlopen.</Text>
          </View>
        )}

        {/* Auto-pauze: automatisch gepauzeerd omdat de loper vrijwel stilstaat */}
        {isAutoPaused && (
          <View style={styles.autoPauseBanner}>
            <Text style={styles.autoPauseBannerText}>Auto-pauze</Text>
          </View>
        )}

        {/* Afslagbalk: de eerstvolgende afslag (of een off-route-melding),
            zodat de loper niet naar de kaart hoeft te kijken. Rendert zelf
            null zonder route (nextRouteTurn/isOffRoute komen dan altijd
            neutraal terug uit useRouteCoaching, ook bij een intervalsessie
            — zie de isIntervalRef-tak hierboven, die start altijd zonder
            geplande route). */}
        <NextTurnBanner nextTurn={nextRouteTurn} isOffRoute={isOffRoute} accentColor={zoneColor} />

        {/* Hoofdmetric: tijd */}
        <View style={styles.mainMetric}>
          <Text style={styles.timerLabel}>Looptijd</Text>
          <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        </View>

        {/* Afstand progress bar, of het intervalpaneel bij een intervalsessie */}
        {isInterval && ivState ? (
          <View style={styles.intervalPanel}>
            <Text style={[styles.intervalPhaseLabel, { color: zoneInfo[ivState.segment.zone].color }]}>
              {ivState.phase === 'warmup' ? 'WARMING-UP'
                : ivState.phase === 'work' ? `INTERVAL ${ivState.segment.repIndex ?? ''} / ${ivState.segment.repTotal ?? ''}`
                : ivState.phase === 'recovery' ? 'HERSTEL'
                : 'COOLING-DOWN'}
            </Text>
            <Text style={[styles.intervalCountdown, { color: zoneInfo[ivState.segment.zone].color }]}>
              {formatTime(ivState.segmentRemainingSec)}
            </Text>
            {ivState.segment.repTotal ? (
              <View style={styles.intervalDots}>
                {Array.from({ length: ivState.segment.repTotal }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.intervalDot,
                      i < (ivState.segment.repIndex ?? 0)
                        ? { backgroundColor: zoneInfo[ivState.segment.zone].color }
                        : { backgroundColor: colors.borderDefault },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${targetPct}%`, backgroundColor: zoneColor }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>{distanceKm.toFixed(2)} km</Text>
              <Text style={styles.progressTarget}>Doel: {session.distanceKm} km</Text>
            </View>
          </View>
        )}

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Tempo</Text>
            <Text style={styles.statValue}>{formatPace(paceSecPerKm)}</Text>
            {targetTrainingPace != null && targetTrainingPace > 0 ? (
              <Text style={styles.statTargetPace} accessibilityLabel={`Doeltempo ${formatPacePerKm(targetTrainingPace)}`}>
                doel {formatPacePerKm(targetTrainingPace)}
              </Text>
            ) : (
              <Text style={styles.statUnit}>min/km</Text>
            )}
          </View>
          <View style={[styles.statCell, styles.statCellCenter]}>
            <Text style={styles.statLabel}>Afstand</Text>
            <Text style={[styles.statValue, { color: zoneColor }]}>{distanceKm.toFixed(2)}</Text>
            <Text style={styles.statUnit}>km</Text>
          </View>
          <TouchableOpacity
            style={styles.statCell}
            onPress={() => setShowTypeInfo(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Type training: ${sessionTypeShort[session.type] ?? zoneInfo[session.zone].label}, zone ${session.zone}, ${zoneInfo[session.zone].label}. Uitleg over deze training`}
          >
            <View style={styles.statLabelRow}>
              <Text style={[styles.statLabel, { marginBottom: 0 }]}>Type</Text>
              <Info size={11} color={colors.textTertiary} strokeWidth={2} />
            </View>
            <Text style={[styles.statValue, { color: zoneColor }]}>{sessionTypeShort[session.type] ?? session.zone}</Text>
            <Text style={styles.statUnit}>{session.zone} {zoneInfo[session.zone].label}</Text>
          </TouchableOpacity>

          {/* Live hartslag, alleen zichtbaar met een gekoppelde BLE-hartslagmeter
              (Instellingen). Zonder koppeling, permissie of native module blijft
              deze cel gewoon weg — geen lege plek in de grid. */}
          {hrMonitorDeviceId && (
            <View style={[styles.statCell, styles.statCellBorderLeft]}>
              <Text style={styles.statLabel}>Hartslag</Text>
              {heartRate != null ? (
                <>
                  <Text
                    style={[
                      styles.statValue,
                      maxHrForZones ? { color: zoneInfo[heartRateZoneFromPct(heartRate, maxHrForZones)].color } : null,
                    ]}
                  >
                    {heartRate}
                  </Text>
                  <Text style={styles.statUnit}>
                    {maxHrForZones ? `${heartRateZoneFromPct(heartRate, maxHrForZones)} bpm` : 'bpm'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.statValue, styles.statValueMuted]}>—</Text>
                  <Text style={styles.statUnit}>geen signaal</Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* Live kaart, alleen als routeplanner actief is */}
        {activePlannedRoute && lastPos && (
          <LiveRouteMap
            plannedRoute={activePlannedRoute}
            currentLat={lastPos.lat}
            currentLon={lastPos.lon}
            coveredRoute={routeRef.current}
            accentColor={zoneColor}
          />
        )}

        {/* Coach tip, alleen tonen als er geen kaart is */}
        {!activePlannedRoute && (
          <View style={styles.tipBanner}>
            <Text style={styles.tipText} numberOfLines={2}>{session.coachTip}</Text>
          </View>
        )}

        {/* Knoppen */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => setIsLocked(true)}
            style={styles.lockBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Scherm vergrendelen"
          >
            <Lock size={22} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              const next = !isRunning;
              // Handmatige pauze/hervatten heeft altijd voorrang op auto-pauze.
              manuallyPausedRef.current = !next;
              isAutoPausedRef.current = false;
              stillSinceRef.current = null;
              setIsAutoPaused(false);
              setIsRunning(next);
              if (!next) stopVoice();
              // Meteen een snapshot schrijven bij pauzeren/hervatten, niet
              // wachten op de eerstvolgende periodieke opslag.
              persistSnapshot();
            }}
            style={[styles.pauseBtn, { borderColor: `${zoneColor}55` }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isRunning ? 'Pauzeren' : 'Hervatten'}
          >
            {isRunning
              ? <Pause size={28} color={colors.textPrimary} strokeWidth={2} />
              : <Play  size={28} color={colors.textPrimary} strokeWidth={2} fill={colors.textPrimary} />
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={handleStop} style={styles.stopBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Sessie stoppen en opslaan">
            <Square size={24} color="#fff" strokeWidth={2} fill="#fff" />
            <Text style={styles.stopLabel}>Stoppen</Text>
          </TouchableOpacity>
        </View>

        {/* Uitleg over dit trainingstype, bereikbaar via de zone-statcel */}
        <SessionTypeSheet
          sessionType={showTypeInfo ? session.type : null}
          onClose={() => setShowTypeInfo(false)}
        />
      </SafeAreaView>

      {/* Vergrendel-overlay: vangt alle aanrakingen op zodat de run doorloopt.
          Ontgrendelen gaat bewust met ingedrukt houden, niet met een enkele tik. */}
      {isLocked && (
        <View style={styles.lockOverlay}>
          <View style={styles.lockCard}>
            <Lock size={30} color={colors.textPrimary} strokeWidth={2} />
            <Text style={styles.lockTitle}>Scherm vergrendeld</Text>
            <Text style={styles.lockSub}>Je run loopt door, ook met het scherm vergrendeld.</Text>
            <TouchableOpacity
              onLongPress={() => setIsLocked(false)}
              delayLongPress={600}
              activeOpacity={0.8}
              style={styles.unlockBtn}
              accessibilityRole="button"
              accessibilityLabel="Houd ingedrukt om te ontgrendelen"
            >
              <Text style={styles.unlockBtnText}>Houd ingedrukt om te ontgrendelen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },

  loadingBg: {
    backgroundColor: colors.bgBase,
  },
  loadingInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
  },

  // Fullscreen countdown
  countdownContainer: {
    backgroundColor: colors.bgBase,
  },
  countdownInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  countdownLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.md,
    color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
  },
  countdownNumber: {
    fontFamily: typography.fontFamily.display, fontSize: 140,
    color: colors.brandPrimary, letterSpacing: -4,
  },

  errorText: {
    color: colors.textSecondary, textAlign: 'center', marginTop: 80,
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
  },
  backLink: { marginTop: spacing[2], alignItems: 'center' },
  backLinkText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.brandPrimary,
  },

  // GPS wachten
  gpsIconBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: `${colors.brandPrimary}18`,
    borderWidth: 1.5, borderColor: `${colors.brandPrimary}44`,
    alignItems: 'center', justifyContent: 'center',
  },
  gpsTextBlock: { alignItems: 'center', gap: 4 },
  gpsWaitTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl,
    color: colors.textPrimary, textAlign: 'center',
  },
  gpsWaitSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary, textAlign: 'center', maxWidth: 280,
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
  },

  // Workout-briefing (GPS-wachtscherm)
  briefingCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing[2.5],
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    width: '88%',
    gap: 4,
  },
  briefingGreeting: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  briefingType: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.brandLight, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wide,
  },
  briefingTip: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, fontStyle: 'italic', marginTop: 4,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },

  // Routevraag card
  routeQuestionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    width: '88%',
    gap: spacing[1.5],
    ...shadows.sm,
  },
  plannerLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
  },
  plannerLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  routeQuestionTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.xl,
    color: colors.textPrimary,
  },
  routeQuestionSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
    marginBottom: spacing[0.5],
  },
  routeQuestionLimit: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    marginBottom: spacing[0.5],
  },

  skipGpsBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderDefault,
  },
  skipGpsText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },

  // Subtiele tekstlink naar CoachExplainerSheet — géén volle knop, mag de
  // aandacht niet wegtrekken van de route-vraag/GPS-status erboven.
  coachExplainerLink: {
    alignSelf: 'center',
    marginTop: spacing[1.5],
    paddingVertical: spacing[0.5],
    paddingHorizontal: spacing[1],
  },
  coachExplainerLinkText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    textDecorationLine: 'underline',
  },

  // Actief scherm
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[2], paddingTop: spacing[1], paddingBottom: spacing[1],
  },
  closeBtn: { padding: spacing[1] },
  sessionMeta: { alignItems: 'center', gap: 4 },
  sessionName: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  gpsIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gpsIndicatorText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
  },
  gpsBanner: {
    marginHorizontal: spacing[3], backgroundColor: `${colors.error}22`,
    borderRadius: radius.md, padding: spacing[1], borderWidth: 1,
    borderColor: `${colors.error}44`, marginBottom: spacing[1],
  },
  gpsBannerText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.error, textAlign: 'center',
  },
  gpsSettingsBtn: {
    alignSelf: 'center', marginTop: spacing[1],
    paddingHorizontal: spacing[2], paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.error,
  },
  gpsSettingsBtnText: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.error,
  },
  autoPauseBanner: {
    marginHorizontal: spacing[3], backgroundColor: `${colors.warning}22`,
    borderRadius: radius.md, padding: spacing[1], borderWidth: 1,
    borderColor: `${colors.warning}44`, marginBottom: spacing[1],
  },
  autoPauseBannerText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.warning, textAlign: 'center', textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
  },
  mainMetric: {
    alignItems: 'center', paddingTop: spacing[3], paddingBottom: spacing[2],
  },
  timerLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.sm,
    color: colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest, marginBottom: spacing[1],
  },
  timer: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['5xl'],
    color: colors.textPrimary, letterSpacing: -4,
    fontVariant: ['tabular-nums'],
  },
  progressContainer: {
    paddingHorizontal: spacing[3], gap: spacing[1], marginBottom: spacing[2],
  },
  progressTrack: {
    height: 6, backgroundColor: colors.borderDefault, borderRadius: radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.full },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.sm, color: colors.textPrimary,
  },
  progressTarget: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm, color: colors.textTertiary,
  },

  // Intervalpaneel (vervangt de afstand-progressbar bij sessietype 'interval')
  intervalPanel: {
    paddingHorizontal: spacing[3], alignItems: 'center', gap: spacing[1], marginBottom: spacing[2],
  },
  intervalPhaseLabel: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.sm,
    textTransform: 'uppercase', letterSpacing: typography.letterSpacing.widest,
  },
  intervalCountdown: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['4xl'],
    letterSpacing: -2, fontVariant: ['tabular-nums'],
  },
  intervalDots: {
    flexDirection: 'row', gap: 6, marginTop: 2,
  },
  intervalDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row', marginHorizontal: spacing[3], marginBottom: spacing[2],
    backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.borderSubtle, ...shadows.sm,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[2] },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  statCellCenter: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.borderSubtle },
  statCellBorderLeft: { borderLeftWidth: 1, borderColor: colors.borderSubtle },
  statLabel: {
    fontFamily: typography.fontFamily.sansMedium, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: typography.letterSpacing.wider,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: typography.fontFamily.display, fontSize: typography.fontSize['2xl'],
    color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight,
  },
  statUnit: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.xs,
    color: colors.textTertiary, marginTop: 2,
  },
  statValueMuted: { color: colors.textTertiary },
  statTargetPace: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.xs,
    color: colors.brandLight, marginTop: 2,
  },
  tipBanner: {
    marginHorizontal: spacing[3], backgroundColor: colors.bgSurface,
    borderRadius: radius.lg, padding: spacing[1.5], marginBottom: spacing[2],
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  tipText: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center',
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[3], paddingHorizontal: spacing[3],
  },
  lockBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderDefault,
    alignItems: 'center', justifyContent: 'center', ...shadows.sm,
  },
  pauseBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.bgCard, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', ...shadows.md,
  },
  lockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgOverlay,
    alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: spacing[8],
    zIndex: 20,
  },
  lockCard: {
    alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    marginHorizontal: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  lockTitle: {
    fontFamily: typography.fontFamily.sansBold, fontSize: typography.fontSize.lg,
    color: colors.textPrimary, marginTop: spacing[1],
  },
  lockSub: {
    fontFamily: typography.fontFamily.sans, fontSize: typography.fontSize.sm,
    color: colors.textSecondary, marginBottom: spacing[2],
  },
  unlockBtn: {
    minHeight: 52, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.bgCard,
  },
  unlockBtnText: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: colors.error, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], ...shadows.md,
  },
  stopLabel: {
    fontFamily: typography.fontFamily.sansSemi, fontSize: typography.fontSize.base, color: '#fff',
  },
});
