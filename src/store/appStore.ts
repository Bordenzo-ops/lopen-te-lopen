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

export interface CompletedSession {
  sessionId: string;
  weekNumber: number;
  completedAt: string;     // ISO date string
  actualDistanceKm: number;
  durationSeconds: number;
  avgPaceSecPerKm: number;
  avgHeartRate?: number;
  route?: Array<{ lat: number; lon: number; timestamp: number }>;
  source: 'app' | 'strava' | 'garmin' | 'apple_health' | 'google_fit' | 'mi_fitness';
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

  // Routeplanner-gebruik (gratis limiet per week, gepersisteerd)
  /** Aantal geplande routes in de huidige week */
  routePlanCount: number;
  /** ISO-datum (maandag) van de week waarin geteld wordt */
  routePlanWeekStart: string | null;

  // Hydration: true zodra AsyncStorage geladen is
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // Backend (offline-first, additief)
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

  // Premium (RevenueCat, niet persistent als bron van waarheid)
  /**
   * Is premium actief volgens RevenueCat (entitlement "premium")? Default
   * false. Wordt ververst bij app-start en na aankoop of herstel. Wordt
   * bewust niet gepersisteerd: RevenueCat is de bron van waarheid.
   */
  isPremium: boolean;
  /** Zet de premium-status direct, bijvoorbeeld na een aankoop of herstel. */
  setPremium: (value: boolean) => void;
  /**
   * Ververs de premium-status best-effort bij RevenueCat. Faalt stil naar
   * de bestaande waarde zonder sleutel of netwerk en blokkeert nooit.
   */
  refreshPremium: () => Promise<void>;

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
  /** Wist voortgang én de persistente opslag */
  resetProgress: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      profile: null,
      completedSessions: [],
      currentWeek: 1,
      activeSession: null,
      racePlan: null,
      raceTargetSeconds: null,
      schemaMode: 'training',
      routePlanCount: 0,
      routePlanWeekStart: null,
      _hasHydrated: false,

      // Backend-status (offline-first defaults)
      isSignedIn: false,
      syncStatus: 'idle',
      lastSyncedAt: null,

      // Premium-status (RevenueCat, default geen premium)
      isPremium: false,

      setPremium: (value) => set({ isPremium: value }),

      refreshPremium: async () => {
        try {
          const active = await fetchPremiumActive();
          set({ isPremium: active });
        } catch (_) {
          // Stil falen: behoud de bestaande premium-status
        }
      },

      initBackend: async () => {
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
      },

      cancelSession: () => set({ activeSession: null }),

      resetProgress: async () => {
        set({ completedSessions: [], currentWeek: 1, activeSession: null });
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
        currentWeek:            state.currentWeek,
        racePlan:               state.racePlan,
        raceTargetSeconds:      state.raceTargetSeconds,
        schemaMode:             state.schemaMode,
        routePlanCount:         state.routePlanCount,
        routePlanWeekStart:     state.routePlanWeekStart,
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

export const selectTotalKm = (state: AppState): number =>
  state.completedSessions.reduce((sum, s) => sum + s.actualDistanceKm, 0);

export const selectHeartRateZones = (maxHr: number) => ({
  Z1: { min: Math.round(maxHr * 0.50), max: Math.round(maxHr * 0.60) },
  Z2: { min: Math.round(maxHr * 0.61), max: Math.round(maxHr * 0.70) },
  Z3: { min: Math.round(maxHr * 0.71), max: Math.round(maxHr * 0.80) },
  Z4: { min: Math.round(maxHr * 0.81), max: Math.round(maxHr * 0.90) },
  Z5: { min: Math.round(maxHr * 0.91), max: maxHr },
});
