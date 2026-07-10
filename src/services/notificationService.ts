/**
 * notificationService
 *
 * Lokale (niet-push) meldingen rond trainingsherinneringen, streak-bescherming
 * en het wekelijkse overzicht. Alles draait via expo-notifications, volledig
 * losstaand van een push-server: er wordt nooit iets naar een backend
 * gestuurd, alle triggers zijn tijd- of weekdag-gebaseerd en worden lokaal op
 * het toestel gepland.
 *
 * Zelfde offline-first opzet als healthConnectService en crashReporting:
 * zonder de geinstalleerde native module, zonder toestemming van de
 * gebruiker of bij een willekeurige fout blijft dit bestand overal stil in.
 * Niets hier mag de app ooit laten crashen.
 *
 * Vereist: npx expo install expo-notifications
 *
 * Ontwerpkeuzes:
 * - Eén "Herinneringen"-schakelaar in Instellingen bepaalt of ALLE lokale
 *   meldingen in dit bestand actief zijn (trainingsherinneringen,
 *   streak-bescherming en het weekoverzicht). Ze delen dezelfde OS-permissie
 *   en dezelfde gebruikersintentie ("stuur me herinneringen"), dus een aparte
 *   schakelaar per meldingstype zou de instellingen nodeloos ingewikkeld
 *   maken zonder concrete meerwaarde.
 * - Streak-bescherming en het weekoverzicht zijn allebei EENMALIGE (niet
 *   herhalende) meldingen gepland op "de eerstvolgende zondag". Een
 *   herhalende wekelijkse trigger zou deze week niet meer te annuleren zijn
 *   zodra hij eenmaal gepland staat: door telkens te annuleren en opnieuw
 *   voor de eerstvolgende zondag te plannen (refreshWeeklyNotifications,
 *   aangeroepen na elke voltooide sessie) herstelt dit zichzelf elke week
 *   vanzelf, zonder een achtergrondtaak nodig te hebben.
 */

import { Linking } from 'react-native';
import { weekStartISO, type CompletedSession } from '../store/appStore';
import { DEFAULT_TRAINING_DAYS } from '../data/trainingPlans';

// ── Eigen minimale typedefinities voor expo-notifications ──────────────────
// Geen import type van de package: tsc moet ook schoon blijven zonder dat het
// pakket geinstalleerd is. Dit dekt alleen wat wij gebruiken.

interface NotificationHandlerResult {
  shouldShowAlert?: boolean;
  shouldPlaySound?: boolean;
  shouldSetBadge?: boolean;
  shouldShowBanner?: boolean;
  shouldShowList?: boolean;
}

interface NotificationPermissionResponse {
  status: 'granted' | 'denied' | 'undetermined';
}

interface NotificationWeeklyTrigger {
  weekday: number;   // 1 = zondag ... 7 = zaterdag (Apple/Expo-conventie)
  hour: number;
  minute: number;
  repeats: true;
}

interface NotificationDateTrigger {
  date: Date;
}

interface ScheduleNotificationRequest {
  identifier?: string;
  content: {
    title?: string;
    body: string;
    sound?: boolean;
  };
  trigger: NotificationWeeklyTrigger | NotificationDateTrigger;
}

interface NotificationsModule {
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<NotificationHandlerResult>;
  }) => void;
  getPermissionsAsync: () => Promise<NotificationPermissionResponse>;
  requestPermissionsAsync: () => Promise<NotificationPermissionResponse>;
  scheduleNotificationAsync: (request: ScheduleNotificationRequest) => Promise<string>;
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
}

// Module-level lazy singleton: de require gebeurt maximaal eenmaal.
let notificationsModule: NotificationsModule | null = null;
let loadAttempted = false;

function loadNotificationsModule(): NotificationsModule | null {
  if (loadAttempted) return notificationsModule;
  loadAttempted = true;

  try {
    // Dynamic require: als het pakket niet geinstalleerd is, gooit dit een
    // fout die we hier afvangen. De service blijft dan permanent uitgeschakeld.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-notifications');
    notificationsModule = mod as NotificationsModule;
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}

/**
 * Stel het gedrag in voor meldingen die binnenkomen terwijl de app open staat
 * (gewoon tonen, met geluid, zonder badge). Wordt hieronder automatisch
 * eenmalig aangeroepen bij het inladen van dit bestand: zo hoeft niemand
 * hiervoor nog iets aan app/_layout.tsx toe te voegen, en blijft de opzet
 * werken zonder de root-layout te hoeven aanraken.
 */
export function setupNotificationHandler(): void {
  const N = loadNotificationsModule();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Faalt stil: zonder handler tonen meldingen nog steeds, alleen met het
    // systeemstandaardgedrag.
  }
}

setupNotificationHandler();

/**
 * Vraagt toestemming voor lokale meldingen. Geeft true terug zodra
 * toestemming (al eerder of net nu) verleend is, anders false. Faalt altijd
 * stil: zonder de module of op een platform zonder ondersteuning is dit
 * gewoon false.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = loadNotificationsModule();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const requested = await N.requestPermissionsAsync();
    return requested.status === 'granted';
  } catch {
    return false;
  }
}

// ── Trainingsherinneringen ──────────────────────────────────────────────────

const TRAINING_REMINDER_PREFIX = 'training-reminder-';

/** Vriendelijke, roulerende teksten voor de trainingsherinnering. */
const TRAINING_MESSAGES = [
  'Vandaag staat je training klaar. Veel loopplezier!',
  'Je schema wacht op je. Kleine stap, groot verschil.',
];

/** Zet ons dagnummer (1=ma..7=zo) om naar Expo's weekday-conventie (1=zo..7=za). */
function toExpoWeekday(appDay: number): number {
  return (appDay % 7) + 1;
}

/**
 * Plant wekelijks terugkerende lokale meldingen op de gekozen trainingsdagen,
 * op het gekozen uur. Annuleert eerst alle bestaande trainingsherinneringen,
 * zodat een herhaalde aanroep (bijv. na een gewijzigd tijdstip) nooit
 * dubbele meldingen oplevert.
 */
export async function scheduleTrainingReminders(
  trainingDays: number[] | undefined,
  hour: number = 8,
): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;

  try {
    await cancelTrainingReminders();

    const validDays = (trainingDays ?? []).filter(d => Number.isInteger(d) && d >= 1 && d <= 7);
    const days = validDays.length > 0 ? validDays : DEFAULT_TRAINING_DAYS;

    for (let i = 0; i < days.length; i++) {
      const appDay = days[i];
      const body = TRAINING_MESSAGES[i % TRAINING_MESSAGES.length];
      try {
        await N.scheduleNotificationAsync({
          identifier: `${TRAINING_REMINDER_PREFIX}${appDay}`,
          content: { title: 'Lopen te Lopen', body, sound: true },
          trigger: { weekday: toExpoWeekday(appDay), hour, minute: 0, repeats: true },
        });
      } catch {
        // Eén mislukte dag mag de andere dagen niet blokkeren
      }
    }
  } catch {
    // Stil falen: geen herinneringen is beter dan een crash
  }
}

/** Annuleert alle geplande trainingsherinneringen (alle 7 mogelijke dagen). */
export async function cancelTrainingReminders(): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;
  for (let day = 1; day <= 7; day++) {
    try {
      await N.cancelScheduledNotificationAsync(`${TRAINING_REMINDER_PREFIX}${day}`);
    } catch {
      // Negeer: identifier bestond waarschijnlijk niet
    }
  }
}

// ── Streak-bescherming en weekoverzicht ─────────────────────────────────────

const STREAK_PROTECTION_ID = 'streak-protection';
const WEEK_OVERVIEW_ID = 'week-overview';

/**
 * Berekent de eerstvolgende datum/tijd op zondag om het gevraagde uur. Als
 * "nu" al voorbij dat moment is (bijv. het is al zondagavond na 19:00), wordt
 * een week verder gepland zodat de melding nooit in het verleden ligt.
 */
function getUpcomingSunday(hour: number, minute: number): Date {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7; // 0 als vandaag al zondag is
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntilSunday);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

/**
 * Plant (of annuleert) de streak-beschermingsmelding voor aankomende zondag
 * 18:00. Is er deze week al een run voltooid, dan wordt de melding alleen
 * geannuleerd (geen waarschuwing nodig). Anders wordt hij (opnieuw) gepland
 * voor de eerstvolgende zondag.
 */
export async function refreshStreakProtection(hasSessionThisWeek: boolean): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(STREAK_PROTECTION_ID);
  } catch {
    // Negeer: identifier bestond waarschijnlijk niet
  }
  if (hasSessionThisWeek) return;

  try {
    await N.scheduleNotificationAsync({
      identifier: STREAK_PROTECTION_ID,
      content: {
        title: 'Lopen te Lopen',
        body: 'Nog geen run deze week. Een korte loop telt ook!',
        sound: true,
      },
      trigger: { date: getUpcomingSunday(18, 0) },
    });
  } catch {
    // Stil falen
  }
}

/**
 * Plant (of annuleert) het wekelijkse overzicht voor aankomende zondag 19:00,
 * met de actuele cijfers van deze week. Zonder runs deze week wordt er niets
 * gepland: een overzicht van "0 runs" heeft geen toegevoegde waarde.
 */
export async function refreshWeekOverview(runsThisWeek: number, kmThisWeek: number): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(WEEK_OVERVIEW_ID);
  } catch {
    // Negeer: identifier bestond waarschijnlijk niet
  }
  if (runsThisWeek <= 0) return;

  try {
    const kmLabel = kmThisWeek.toFixed(1).replace('.', ',');
    const runLabel = runsThisWeek === 1 ? 'run' : 'runs';
    await N.scheduleNotificationAsync({
      identifier: WEEK_OVERVIEW_ID,
      content: {
        title: 'Lopen te Lopen',
        body: `Deze week: ${runsThisWeek} ${runLabel}, ${kmLabel} km. Lekker bezig!`,
        sound: true,
      },
      trigger: { date: getUpcomingSunday(19, 0) },
    });
  } catch {
    // Stil falen
  }
}

/**
 * Herberekent en herplant de streak-bescherming en het weekoverzicht op basis
 * van alle voltooide sessies. Aan te roepen na elke voltooide sessie (zie
 * completeSession in appStore) en bij het aanzetten van de herinneringen in
 * Instellingen, zodat de cijfers meteen kloppen.
 */
export async function refreshWeeklyNotifications(completedSessions: CompletedSession[]): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;

  const thisWeekKey = weekStartISO();
  const thisWeek = completedSessions.filter(c => weekStartISO(new Date(c.completedAt)) === thisWeekKey);
  const km = thisWeek.reduce((sum, c) => sum + c.actualDistanceKm, 0);

  await refreshStreakProtection(thisWeek.length > 0);
  await refreshWeekOverview(thisWeek.length, km);
}

/** Annuleert alle lokale meldingen uit dit bestand: training, streak en weekoverzicht. */
export async function cancelAllReminders(): Promise<void> {
  await cancelTrainingReminders();
  const N = loadNotificationsModule();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(STREAK_PROTECTION_ID);
  } catch {
    // Negeer
  }
  try {
    await N.cancelScheduledNotificationAsync(WEEK_OVERVIEW_ID);
  } catch {
    // Negeer
  }
}
