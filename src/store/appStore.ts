import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTrainingPlan } from '../data/trainingPlans';
import type { GoalType, Session, TrainingWeek } from '../data/trainingPlans';
import type { RacePlan } from '../data/buildRacePlan';
import { ensureAnonymousSession } from '../services/authService';
import { syncAll } from '../services/syncService';
import { isPremiumActive as fetchPremiumActive } from '../services/purchaseService';

// ── Hulpfuncties ──────────────────────────────
/**
 * Geeft de maandag van de week van een datum als ISO-datumstring (YYYY-MM-DD).
 * Gebruikt voor de week-reset van de gratis routeplanner-limiet.
 */
export function weekStartISO(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();              // 0 = zondag, 1 = maandag
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// ── Types ─────────────────────────────────────
export interface UserProfile {
  name: string;
  goal: GoalType;
  startDate: string;       // ISO date string
  maxHeartRate: number;    // berekend: 220 - leeftijd
  age: number;
  voiceGuidance: boolean;  // gesproken begeleiding aan/uit
  /** Stemkeuze voor de coaching (default 'female') */
  voiceType?: 'female' | 'male';
  /** Routeplanner standaard aan bij sessiestart (default false) */
  routePlannerEnabled?: boolean;
  /**
   * Zelfgekozen trainingsdagen: array van 3 weekdagnummers (1=ma t/m 7=zo).
   * Bij ontbreken of ongeldige waarde wordt DEFAULT_TRAINING_DAYS gebruikt.
   */
  trainingDays?: number[];
  /** Premium-status: default true zolang betaalmuur niet actief is */
  isPremium?: boolean;
}

/** Tijd (in seconden) voor een voltooide kilometer, in Strava-stijl splits. */
export interface KmSplit {
  km: number;
  seconds: number;
}

export interface CompletedSession {
  sessionId: string;
  weekNumber: number;
  completedAt: string;     // ISO date string
  actualDistanceKm: number;
  durationSeconds: number;
  avgPaceSecPerKm: number;
  avgHeartRate?: number;
  route?: Array<{ lat: number; lon: number; timestamp: number }>;
  /**
   * Km-splits van deze run, optioneel voor achterwaartse compatibiliteit met
   * eerder opgeslagen runs die dit veld nog niet hebben.
   */
  splits?: KmSplit[];
  source: 'app' | 'strava' | 'garmin' | 'apple_health' | 'google_fit' | 'mi_fitness';
}

/**
 * Een bewust overgeslagen sessie. Telt mee als "afgehandeld" voor de
 * weekvoortgang, zodat een mindere week de gebruiker niet laat vastlopen.
 * Wordt nadrukkelijk niet als prestatie geteld (geen afstand of tempo).
 */
export interface SkippedSession {
  sessionId: string;
  weekNumber: number;
  skippedAt: string;       // ISO date string
}

export interface ActiveSession {
  session: Session;
  weekNumber: number;
  startedAt: string;
  elapsedSeconds: number;
  distanceKm: number;
  currentPaceSecPerKm: number;
  currentHeartRate?: number;
  route: Array<{ lat: number; lon: number; timestamp: number }>;
  isRunning: boolean;
}

interface AppState {
  // Onboarding
  hasCompletedOnboarding: boolean;

  // User
  profile: UserProfile | null;

  // Voortgang
  completedSessions: CompletedSession[];
  /** Bewust overgeslagen sessies (telt als afgehandeld, niet als prestatie) */
  skippedSessions: SkippedSession[];
  currentWeek: number;

  // Actieve loop-sessie (niet persistent, crash-safe)
  activeSession: ActiveSession | null;

  // Wedstrijdschema
  racePlan: RacePlan | null;

  /**
   * Doeltijd voor de gekozen wedstrijd in totale seconden. Premium-feature:
   * hieruit berekent de app een persoonlijk trainingstempo per sessie. Null
   * als de gebruiker geen doeltijd heeft ingesteld. Gepersisteerd, hoort bij
   * het opgeslagen racePlan.
   */
  raceTargetSeconds: number | null;

  // Schema-modus: vrij trainen of voor een wedstrijd
  schemaMode: 'training' | 'race';

  // Thema-voorkeur: volg het systeem, of forceer licht of donker. Gepersisteerd.
  themePreference: 'system' | 'light' | 'dark';
  setThemePreference: (preference: 'system' | 'light' | 'dark') => void;

  // Routeplanner-gebruik (gratis limiet per week, gepersisteerd)
  /** Aantal geplande routes in de huidige week */
  routePlanCount: number;
  /** ISO-datum (maandag) van de week waarin geteld wordt */
  routePlanWeekStart: string | null;

  // Hydration: true zodra AsyncStorage geladen is
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // Strava-koppeling (offline-first, additief)
  /** Is er een actieve Strava-koppeling (geldige tokens opgeslagen)? */
  stravaConnected: boolean;
  /** Naam van de gekoppelde Strava-atleet, voor weergave in Instellingen */
  stravaAthleteName?: string;
  /** Upload voltooide runs automatisch naar Strava? Default true. */
  stravaAutoUpload: boolean;
  /** SessionId's van runs die nog niet succesvol geupload zijn */
  stravaUploadQueue: string[];
  setStravaConnected: (connected: boolean, athleteName?: string) => void;
  setStravaAutoUpload: (enabled: boolean) => void;
  /** Voegt een sessionId toe aan de uploadwachtrij, zonder duplicaten */
  enqueueStravaUpload: (sessionId: string) => void;
  /** Haalt een sessionId uit de uploadwachtrij (na succesvolle upload) */
  dequeueStravaUpload: (sessionId: string) => void;

  // Health Connect-koppeling (offline-first, additief)
  /**
   * Schrijf voltooide runs weg naar Health Connect (Android)? Default false:
   * de gebruiker moet dit bewust aanzetten via Instellingen, waarna eerst
   * toestemming gevraagd wordt via de Health Connect-permissiedialoog.
   */
  healthConnectEnabled: boolean;
  setHealthConnectEnabled: (enabled: boolean) => void;

  // Auto-pauze tijdens het lopen (offline-first, additief)
  /**
   * Pauzeer de timer automatisch bij stilstand tijdens een run? Default true,
   * net als Strava en Runna. Instelbaar via Instellingen.
   */
  autoPauseEnabled: boolean;
  setAutoPauseEnabled: (enabled: boolean) => void;

  // Lokale herinneringen (offline-first, additief)
  /**
   * Staan lokale herinneringen aan (trainingsherinneringen, streak-
   * bescherming en het wekelijkse overzicht)? Default false: de gebruiker
   * moet dit bewust aanzetten via Instellingen, waarna eerst toestemming
   * gevraagd wordt via de systeemdialoog voor meldingen.
   */
  remindersEnabled: boolean;
  setRemindersEnabled: (enabled: boolean) => void;
  /** Gekozen tijdstip (uur, 0-23) voor de dagelijkse trainingsherinnering. Default 8 (08:00). */
  reminderHour: number;
  setReminderHour: (hour: number) => void;
  /**
   * ISO-datum van de laatste keer dat de in-app reviewvraag getoond is, of
   * null als dat nog nooit gebeurd is. Voorkomt dat we vaker dan eens per
   * 90 dagen om een winkelbeoordeling vragen.
   */
  lastReviewPromptAt: string | null;
  setLastReviewPromptAt: (iso: string) => void;

  // Backend (offline-first, additief)
  /**
   * Heeft de gebruiker cloudsync expliciet ingeschakeld? Default false.
   * Zonder toestemming start de app geen anonieme sessie en syncet niets.
   */
  cloudSyncEnabled: boolean;
  setCloudSyncEnabled: (v: boolean) => void;
  /** Is er een actieve Supabase-sessie? Default false (offline). */
  isSignedIn: boolean;
  /** Status van de laatste synchronisatiepoging */
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  /** Laatste succesvolle sync als ISO-string, of null */
  lastSyncedAt: string | null;
  /**
   * Start de backend best-effort: anonieme sessie en eerste sync.
   * Faalt stil naar offline als er geen sleutels of netwerk zijn.
   */
  initBackend: () => Promise<void>;
  /** Best-effort synchronisatie van profiel en sessies. Blokkeert de UI nooit. */
  syncNow: () => Promise<void>;

  // Premium (RevenueCat)
  /**
   * Is premium actief volgens RevenueCat (entitlement "premium")? Default
   * false. Wordt ververst bij app-start en na aankoop, herstel of een
   * customerInfo-update. Wordt bewust wél gepersisteerd (zie partialize
   * hieronder): RevenueCat blijft de bron van waarheid zodra er netwerk is,
   * maar een betalende gebruiker die offline start mag niet per ongeluk de
   * gratis laag te zien krijgen. Bij een netwerkfout blijft daarom de laatst
   * bekende waarde staan (zie refreshPremium).
   */
  isPremium: boolean;
  /**
   * Zet de premium-status direct, bijvoorbeeld na een aankoop, herstel of
   * een update van de RevenueCat-listener. Detecteert zelf de overgang van
   * actief naar verlopen (true -> false) en zet dan premiumExpiredNoticePending,
   * zodat het dashboard dit eenmalig vriendelijk kan melden.
   */
  setPremium: (value: boolean) => void;
  /**
   * Ververs de premium-status best-effort bij RevenueCat. Faalt stil naar
   * de bestaande (gepersisteerde) waarde zonder sleutel, netwerk of bij een
   * fout en blokkeert nooit. Een netwerkfout overschrijft de cache bewust
   * niet: alleen een écht bevestigd antwoord van RevenueCat (actief of
   * verlopen) wordt doorgezet.
   */
  refreshPremium: () => Promise<void>;
  /**
   * Staat er een melding klaar dat premium net verlopen is? Wordt gezet
   * zodra setPremium een overgang van true naar false detecteert (via de
   * RevenueCat-listener of een verversing). Het dashboard toont deze
   * eenmalig en ruimt hem op via dismissPremiumExpiredNotice.
   */
  premiumExpiredNoticePending: boolean;
  /** Ruimt de "premium verlopen"-melding op, bijvoorbeeld na het sluiten ervan. */
  dismissPremiumExpiredNotice: () => void;
  /**
   * Heeft de gebruiker de subtiele premium-upsellkaart op het dashboard al
   * weggeklikt? Blijft daarna permanent verborgen (gepersisteerd).
   */
  dashboardUpsellDismissed: boolean;
  /** Verbergt de dashboard-upsellkaart permanent. */
  dismissDashboardUpsell: () => void;

  /**
   * Registreert dat er een route gepland is en hoogt de weekteller op. Reset
   * de teller automatisch als er een nieuwe week begonnen is. Gepersisteerd.
   */
  registerRoutePlan: () => void;

  // Actions
  completeOnboarding: (profile: UserProfile) => void;
  setRacePlan: (plan: RacePlan | null) => void;
  /**
   * Leg de doeltijd voor de wedstrijd vast (totale seconden), of wis hem met
   * null. Premium-feature voor het persoonlijke trainingstempo.
   */
  setRaceTargetSeconds: (seconds: number | null) => void;
  setSchemaMode: (mode: 'training' | 'race') => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  startSession: (session: Session, weekNumber: number) => void;
  updateActiveSession: (updates: Partial<ActiveSession>) => void;
  /**
   * Voltooi de actieve sessie en hoog currentWeek op als alle sessies
   * van de huidige week afgerond zijn.
   *
   * @param result           Resultaatdata van de sessie
   * @param weekSessions     Alle sessies van de huidige week (voor de week-check)
   */
  completeSession: (
    result: Omit<CompletedSession, 'sessionId' | 'weekNumber' | 'completedAt'>,
    weekSessions: TrainingWeek['sessions'],
  ) => void;
  cancelSession: () => void;
  /**
   * Slaat een sessie bewust over (bijvoorbeeld bij ziekte of een drukke week).
   * De sessie telt daarna als afgehandeld voor de weekvoortgang en blokkeert de
   * voortgang niet, maar telt niet als gelopen kilometers of prestatie. Hoogt
   * currentWeek op als alle sessies van de week afgehandeld zijn.
   */
  skipSession: (
    sessionId: string,
    weekNumber: number,
    weekSessions: TrainingWeek['sessions'],
  ) => void;
  /** Wist voortgang én de persistente opslag */
  resetProgress: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      profile: null,
      completedSessions: [],
      skippedSessions: [],
      currentWeek: 1,
      activeSession: null,
      racePlan: null,
      raceTargetSeconds: null,
      schemaMode: 'training',
      themePreference: 'system',
      routePlanCount: 0,
      routePlanWeekStart: null,
      _hasHydrated: false,

      // Strava-koppeling (offline-first defaults)
      stravaConnected: false,
      stravaAthleteName: undefined,
      stravaAutoUpload: true,
      stravaUploadQueue: [],

      setStravaConnected: (connected, athleteName) =>
        set({
          stravaConnected: connected,
          stravaAthleteName: connected ? athleteName : undefined,
        }),
      setStravaAutoUpload: (enabled) => set({ stravaAutoUpload: enabled }),
      enqueueStravaUpload: (sessionId) =>
        set(state => ({
          stravaUploadQueue: state.stravaUploadQueue.includes(sessionId)
            ? state.stravaUploadQueue
            : [...state.stravaUploadQueue, sessionId],
        })),
      dequeueStravaUpload: (sessionId) =>
        set(state => ({
          stravaUploadQueue: state.stravaUploadQueue.filter(id => id !== sessionId),
        })),

      // Health Connect-koppeling (offline-first defaults)
      healthConnectEnabled: false,
      setHealthConnectEnabled: (enabled) => set({ healthConnectEnabled: enabled }),

      // Auto-pauze (offline-first default: aan)
      autoPauseEnabled: true,
      setAutoPauseEnabled: (enabled) => set({ autoPauseEnabled: enabled }),

      // Lokale herinneringen (offline-first defaults)
      remindersEnabled: false,
      setRemindersEnabled: (enabled) => set({ remindersEnabled: enabled }),
      reminderHour: 8,
      setReminderHour: (hour) => set({ reminderHour: hour }),
      lastReviewPromptAt: null,
      setLastReviewPromptAt: (iso) => set({ lastReviewPromptAt: iso }),

      // Backend-status (offline-first defaults)
      cloudSyncEnabled: false,
      isSignedIn: false,
      syncStatus: 'idle',
      lastSyncedAt: null,

      // Premium-status (RevenueCat, default geen premium)
      isPremium: false,
      premiumExpiredNoticePending: false,
      dashboardUpsellDismissed: false,

      setPremium: (value) => {
        const wasPremium = get().isPremium;
        set({
          isPremium: value,
          // Alleen een echte overgang van actief naar verlopen triggert de melding
          premiumExpiredNoticePending: wasPremium && !value
            ? true
            : get().premiumExpiredNoticePending,
        });
      },

      dismissPremiumExpiredNotice: () => set({ premiumExpiredNoticePending: false }),
      dismissDashboardUpsell: () => set({ dashboardUpsellDismissed: true }),

      setCloudSyncEnabled: (v) => {
        set({ cloudSyncEnabled: v });
        // Zodra de gebruiker sync aanzet, start de backend.
        // Zodra hij het uitzet, wis de Supabase-sessie.
        if (v) {
          void get().initBackend();
        } else {
          set({ isSignedIn: false, syncStatus: 'idle' });
        }
      },

      refreshPremium: async () => {
        try {
          const active = await fetchPremiumActive();
          // null betekent: onbekend door een netwerk- of API-fout. Dan laten
          // we de gepersisteerde waarde bewust staan in plaats van hem te
          // overschrijven met "geen premium".
          if (active !== null) {
            get().setPremium(active);
          }
        } catch (_) {
          // Stil falen: behoud de bestaande premium-status
        }
      },

      initBackend: async () => {
        if (!get().cloudSyncEnabled) return;
        try {
          const session = await ensureAnonymousSession();
          set({ isSignedIn: !!session });
          if (session) {
            // Eerste sync best-effort, mag de UI niet blokkeren
            void get().syncNow();
          }
        } catch (_) {
          // Stil falen: app blijft offline werken
          set({ isSignedIn: false });
        }
      },

      syncNow: async () => {
        if (!get().cloudSyncEnabled) return;
        try {
          // Zorg zelf voor een (anonieme) sessie. Dit voorkomt dat een sync
          // wordt overgeslagen wanneer de sessie nog niet klaar was, en is
          // idempotent: bestaat er al een sessie, dan wordt die hergebruikt.
          const session = await ensureAnonymousSession();
          if (!session) {
            set({ isSignedIn: false });
            return;
          }
          set({ isSignedIn: true, syncStatus: 'syncing' });
          const { profile, completedSessions } = get();
          const result = await syncAll(profile, completedSessions);
          set({
            syncStatus: result.ok ? 'synced' : 'error',
            lastSyncedAt: result.ok ? new Date().toISOString() : get().lastSyncedAt,
          });
        } catch (_) {
          // Sync is best-effort: nooit crashen
          set({ syncStatus: 'error' });
        }
      },

      registerRoutePlan: () => {
        const thisWeek = weekStartISO();
        const { routePlanWeekStart, routePlanCount } = get();
        if (routePlanWeekStart !== thisWeek) {
          // Nieuwe week: teller resetten en deze plan als eerste tellen
          set({ routePlanWeekStart: thisWeek, routePlanCount: 1 });
        } else {
          set({ routePlanCount: routePlanCount + 1 });
        }
      },

      setHasHydrated: (v) => set({ _hasHydrated: v }),
      // Een nieuw (of gewist) wedstrijdschema reset altijd de doeltijd, zodat
      // een tempo van een vorige wedstrijd nooit blijft hangen.
      setRacePlan: (plan) => set({ racePlan: plan, raceTargetSeconds: null }),
      setRaceTargetSeconds: (seconds) => set({ raceTargetSeconds: seconds }),
      setSchemaMode: (mode) => set({ schemaMode: mode }),
      setThemePreference: (preference) => set({ themePreference: preference }),

      completeOnboarding: (profile) => {
        set({ profile, hasCompletedOnboarding: true, currentWeek: 1 });
        // Best-effort sync, blokkeert de onboarding niet
        void get().syncNow();
      },

      updateProfile: (updates) =>
        set(state => ({
          profile: state.profile ? { ...state.profile, ...updates } : null,
        })),

      startSession: (session, weekNumber) =>
        set({
          activeSession: {
            session,
            weekNumber,
            startedAt: new Date().toISOString(),
            elapsedSeconds: 0,
            distanceKm: 0,
            currentPaceSecPerKm: 0,
            route: [],
            isRunning: true,
          },
        }),

      updateActiveSession: (updates) =>
        set(state => ({
          activeSession: state.activeSession
            ? { ...state.activeSession, ...updates }
            : null,
        })),

      completeSession: (result, weekSessions) => {
        const { activeSession, completedSessions, currentWeek, racePlan, schemaMode, profile } = get();
        if (!activeSession) return;

        // Voorkom dubbele opslag als completeSession twee keer snel wordt aangeroepen
        const alreadySaved = completedSessions.some(
          c =>
            c.sessionId  === activeSession.session.id &&
            c.weekNumber === activeSession.weekNumber,
        );
        if (alreadySaved) {
          set({ activeSession: null });
          return;
        }

        const completed: CompletedSession = {
          ...result,
          sessionId: activeSession.session.id,
          weekNumber: activeSession.weekNumber,
          completedAt: new Date().toISOString(),
        };

        const updatedCompleted = [...completedSessions, completed];

        // Controleer of alle sessies van de huidige week nu klaar zijn
        const weekSessionIds = weekSessions.map(s => s.id);
        const completedInWeek = updatedCompleted.filter(
          c => weekSessionIds.includes(c.sessionId),
        );
        const weekDone = completedInWeek.length >= weekSessions.length;

        // Bereken de bovengrens zodat currentWeek nooit voorbij het schema loopt
        const totalWeeks =
          schemaMode === 'race' && racePlan
            ? racePlan.totalWeeks
            : profile
            ? getTrainingPlan(profile.goal).weeks
            : currentWeek; // fallback: niet ophogen

        const nextWeek = weekDone
          ? Math.min(currentWeek + 1, totalWeeks)
          : currentWeek;

        set({
          completedSessions: updatedCompleted,
          activeSession: null,
          currentWeek: nextWeek,
        });

        // Best-effort sync van de nieuwe sessie naar de cloud
        void get().syncNow();

        // Best-effort automatische upload naar Strava. Faalt stil en zet de
        // sessie in de wachtrij voor een latere herhaalpoging: uploaden mag
        // de UI nooit blokkeren of laten crashen.
        if (get().stravaConnected && get().stravaAutoUpload) {
          import('../services/stravaService')
            .then(({ uploadRun }) => uploadRun(completed))
            .then(result => {
              if (!result.ok) get().enqueueStravaUpload(completed.sessionId);
            })
            .catch(() => get().enqueueStravaUpload(completed.sessionId));
        }

        // Best-effort wegschrijven naar Health Connect. Lokale schrijfactie,
        // geen wachtrij nodig: bij een fout is er niets om later opnieuw te
        // proberen, de app blijft gewoon werken zonder deze koppeling.
        if (get().healthConnectEnabled) {
          import('../services/healthConnectService')
            .then(({ writeRunToHealthConnect }) => writeRunToHealthConnect(completed))
            .catch(() => {
              // Stil falen: schrijven naar Health Connect mag nooit crashen
            });
        }

        // Best-effort herplannen van de streak-bescherming en het
        // weekoverzicht. completeSession is de ene plek die altijd geraakt
        // wordt zodra een sessie voltooid is, ongeacht welk scherm dat doet
        // (samenvatting, deep link, etc.), dus dit is de eenvoudigste
        // betrouwbare plek om te herplannen. Alleen als de gebruiker
        // herinneringen aan heeft staan; faalt verder altijd stil.
        if (get().remindersEnabled) {
          import('../services/notificationService')
            .then(({ refreshWeeklyNotifications }) => refreshWeeklyNotifications(updatedCompleted))
            .catch(() => {
              // Stil falen: herinneringen zijn een prettige extra, geen kernfunctie
            });
        }
      },

      cancelSession: () => set({ activeSession: null }),

      skipSession: (sessionId, weekNumber, weekSessions) => {
        const { skippedSessions, completedSessions, currentWeek, racePlan, schemaMode, profile } = get();

        // Al voltooid of al overgeslagen: niets doen
        const alreadyHandled =
          completedSessions.some(c => c.sessionId === sessionId) ||
          skippedSessions.some(s => s.sessionId === sessionId);
        if (alreadyHandled) return;

        const updatedSkipped: SkippedSession[] = [
          ...skippedSessions,
          { sessionId, weekNumber, skippedAt: new Date().toISOString() },
        ];

        // Een week is afgehandeld zodra elke sessie ervan voltooid of
        // overgeslagen is. Zo loopt de gebruiker na een mindere week gewoon door.
        const handledIds = new Set<string>([
          ...completedSessions.map(c => c.sessionId),
          ...updatedSkipped.map(s => s.sessionId),
        ]);
        const weekDone = weekSessions.every(s => handledIds.has(s.id));

        const totalWeeks =
          schemaMode === 'race' && racePlan
            ? racePlan.totalWeeks
            : profile
            ? getTrainingPlan(profile.goal).weeks
            : currentWeek;

        const nextWeek = weekDone
          ? Math.min(currentWeek + 1, totalWeeks)
          : currentWeek;

        set({ skippedSessions: updatedSkipped, currentWeek: nextWeek });
      },

      resetProgress: async () => {
        set({ completedSessions: [], skippedSessions: [], currentWeek: 1, activeSession: null });
        // Wis ook de persistente opslag zodat een herstart schoon begint
        try {
          await AsyncStorage.removeItem('app-store');
        } catch (_) {
          // Negeer storage-fouten bij reset
        }
      },
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => AsyncStorage),
      // activeSession en _hasHydrated bewust NIET opslaan
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        profile:                state.profile,
        completedSessions:      state.completedSessions,
        skippedSessions:        state.skippedSessions,
        currentWeek:            state.currentWeek,
        racePlan:               state.racePlan,
        raceTargetSeconds:      state.raceTargetSeconds,
        schemaMode:             state.schemaMode,
        themePreference:        state.themePreference,
        routePlanCount:         state.routePlanCount,
        routePlanWeekStart:     state.routePlanWeekStart,
        stravaConnected:        state.stravaConnected,
        stravaAthleteName:      state.stravaAthleteName,
        stravaAutoUpload:       state.stravaAutoUpload,
        stravaUploadQueue:      state.stravaUploadQueue,
        healthConnectEnabled:   state.healthConnectEnabled,
        autoPauseEnabled:       state.autoPauseEnabled,
        remindersEnabled:       state.remindersEnabled,
        reminderHour:           state.reminderHour,
        lastReviewPromptAt:     state.lastReviewPromptAt,
        // Laatst bekende premium-status: offline-first zodat een betalende
        // gebruiker zonder netwerk niet per ongeluk de gratis laag ziet.
        // RevenueCat blijft de bron van waarheid zodra er weer netwerk is.
        isPremium:                   state.isPremium,
        premiumExpiredNoticePending: state.premiumExpiredNoticePending,
        dashboardUpsellDismissed:    state.dashboardUpsellDismissed,
      }),
      onRehydrateStorage: () => (state) => {
        // Gezet na succesvolle én mislukte rehydratie
        state?.setHasHydrated(true);
        // Nu het profiel uit de opslag geladen is, alsnog synchroniseren.
        // syncNow zorgt zelf voor een anonieme sessie. Best-effort, faalt stil.
        void state?.syncNow();
      },
    },
  ),
);

/** Hook: geeft true zodra de store volledig geladen is vanuit AsyncStorage */
export const useHasHydrated = () => useAppStore(s => s._hasHydrated);

// ── Selectors ─────────────────────────────────

/**
 * Aantal routes dat deze week al gepland is. Geeft 0 terug zodra er een
 * nieuwe week begonnen is (de teller wordt pas bij registerRoutePlan echt
 * gereset, maar de selector houdt al rekening met de weekgrens).
 */
export const selectRoutePlansThisWeek = (state: AppState): number => {
  if (state.routePlanWeekStart !== weekStartISO()) return 0;
  return state.routePlanCount;
};

export const selectWeeklyKm = (state: AppState, weekNumber: number): number =>
  state.completedSessions
    .filter(s => s.weekNumber === weekNumber)
    .reduce((sum, s) => sum + s.actualDistanceKm, 0);

export const selectIsSessionCompleted = (
  state: AppState,
  sessionId: string,
): boolean => state.completedSessions.some(s => s.sessionId === sessionId);

export const selectIsSessionSkipped = (
  state: AppState,
  sessionId: string,
): boolean => state.skippedSessions.some(s => s.sessionId === sessionId);

export const selectTotalKm = (state: AppState): number =>
  state.completedSessions.reduce((sum, s) => sum + s.actualDistanceKm, 0);

/**
 * Mag de upsell-kaart na een run getoond worden? Om niet opdringerig te zijn
 * verschijnt deze hooguit eens per 3 voltooide runs (na de 3e, 6e, 9e, ...),
 * afgeleid uit het aantal voltooide sessies zonder aparte teller.
 */
export const selectShowRunUpsell = (state: AppState): boolean =>
  state.completedSessions.length > 0 && state.completedSessions.length % 3 === 0;

export const selectHeartRateZones = (maxHr: number) => ({
  Z1: { min: Math.round(maxHr * 0.50), max: Math.round(maxHr * 0.60) },
  Z2: { min: Math.round(maxHr * 0.61), max: Math.round(maxHr * 0.70) },
  Z3: { min: Math.round(maxHr * 0.71), max: Math.round(maxHr * 0.80) },
  Z4: { min: Math.round(maxHr * 0.81), max: Math.round(maxHr * 0.90) },
  Z5: { min: Math.round(maxHr * 0.91), max: maxHr },
});
