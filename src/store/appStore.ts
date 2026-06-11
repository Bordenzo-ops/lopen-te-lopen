import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTrainingPlan } from '../data/trainingPlans';
import type { GoalType, Session, TrainingWeek } from '../data/trainingPlans';
import type { RacePlan } from '../data/buildRacePlan';

// ── Types ─────────────────────────────────────
export interface UserProfile {
  name: string;
  goal: GoalType;
  startDate: string;       // ISO date string
  maxHeartRate: number;    // berekend: 220 - leeftijd
  age: number;
  voiceGuidance: boolean;  // gesproken begeleiding aan/uit
  /** Routeplanner standaard aan bij sessiestart (default false) */
  routePlannerEnabled?: boolean;
  /** Premium-status — default true zolang betaalmuur niet actief is */
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

  // Actieve loop-sessie (niet persistent — crash-safe)
  activeSession: ActiveSession | null;

  // Wedstrijdschema
  racePlan: RacePlan | null;

  // Schema-modus: vrij trainen of voor een wedstrijd
  schemaMode: 'training' | 'race';

  // Hydration — true zodra AsyncStorage geladen is
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // Actions
  completeOnboarding: (profile: UserProfile) => void;
  setRacePlan: (plan: RacePlan | null) => void;
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
      schemaMode: 'training',
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setRacePlan: (plan) => set({ racePlan: plan }),
      setSchemaMode: (mode) => set({ schemaMode: mode }),

      completeOnboarding: (profile) =>
        set({ profile, hasCompletedOnboarding: true, currentWeek: 1 }),

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
        schemaMode:             state.schemaMode,
      }),
      onRehydrateStorage: () => (state) => {
        // Gezet na succesvolle én mislukte rehydratie
        state?.setHasHydrated(true);
      },
    },
  ),
);

/** Hook: geeft true zodra de store volledig geladen is vanuit AsyncStorage */
export const useHasHydrated = () => useAppStore(s => s._hasHydrated);

// ── Selectors ─────────────────────────────────
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
