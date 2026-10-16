/**
 * notificationService
 *
 * Lokale (niet-push) meldingen: trainingsherinneringen, wekelijkse voortgang
 * en countdown-mijlpalen naar het racedoel. Alles draait via expo-notifications, volledig
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
 * - Drie categorieen, elk apart aan/uit in Instellingen en standaard UIT:
 *   trainingsherinneringen (remindersEnabled), wekelijkse voortgang
 *   (weeklyProgressEnabled) en countdown-mijlpalen (countdownEnabled). Ze
 *   delen dezelfde OS-permissie, maar die wordt pas gevraagd op het moment
 *   dat de gebruiker een categorie aanzet.
 * - Alles wordt door EEN functie gepland: rescheduleNotifications(). Die leest
 *   de actuele store, annuleert alle eigen meldingen en plant ze opnieuw. Zo
 *   blijft er nooit een dubbele of verouderde melding staan en hoeft geen
 *   scherm te weten hoe de planning werkt.
 * - Trainingsherinneringen en het weekbericht staan als EENMALIGE meldingen
 *   in een rollend venster van ROLLING_WINDOW_DAYS dagen (geen herhalende
 *   triggers): de inhoud ("Vandaag: 8 km rustig") hangt van het schema af en
 *   iOS staat maximaal 64 geplande meldingen toe. Het venster schuift mee bij
 *   elke herplanning (app-start, terug naar de voorgrond, afgeronde training,
 *   schema-/doel- of instellingswijziging, zie app/_layout.tsx).
 * - Countdown-mijlpalen liggen buiten dat venster (tot 100 dagen vooruit),
 *   maar zijn er maar vier, dus die plannen we altijd allemaal.
 */

import { useAppStore, weekStartISO } from '../store/appStore';
import { resolveActivePlan } from '../data/activePlan';
import { formatLocalISODate, parseLocalISODate, raceScheduleStatus } from '../data/raceSchedule';
import type { Session, TrainingWeek } from '../data/trainingPlans';

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

/**
 * Het deel van een binnenkomende melding dat de handler nodig heeft om te
 * kunnen onderscheiden of het een route-afslagmelding is (zie
 * routeNotificationService.ts) of een gewone herinnering uit dit bestand.
 * Alleen `content.data` — meer gebruikt de handler hieronder niet. `data`
 * kan ontbreken of een willekeurige vorm hebben (een melding van een ander
 * type, of een toekomstig extra veld), vandaar `unknown` i.p.v. een streng
 * type.
 */
interface IncomingNotification {
  request?: {
    content?: {
      data?: unknown;
    };
  };
}

interface NotificationPermissionResponse {
  status: 'granted' | 'denied' | 'undetermined';
}

interface NotificationDateTrigger {
  type: 'date';
  date: Date;
}

/** Het deel van een geplande melding dat we nodig hebben om de onze terug te vinden. */
interface ScheduledNotification {
  identifier: string;
}

/** Het deel van een tik-op-melding-antwoord dat we nodig hebben. */
export interface NotificationTapResponse {
  notification?: {
    date?: number;
    request?: {
      identifier?: string;
      content?: { data?: unknown };
    };
  };
}

interface ScheduleNotificationRequest {
  identifier?: string;
  content: {
    title?: string;
    body: string;
    sound?: boolean;
    data?: Record<string, unknown>;
  };
  trigger: NotificationDateTrigger;
}

interface NotificationsModule {
  setNotificationHandler: (handler: {
    handleNotification: (notification: IncomingNotification) => Promise<NotificationHandlerResult>;
  }) => void;
  getPermissionsAsync: () => Promise<NotificationPermissionResponse>;
  requestPermissionsAsync: () => Promise<NotificationPermissionResponse>;
  scheduleNotificationAsync: (request: ScheduleNotificationRequest) => Promise<string>;
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
  getAllScheduledNotificationsAsync: () => Promise<ScheduledNotification[]>;
  addNotificationResponseReceivedListener: (listener: (response: NotificationTapResponse) => void) => { remove: () => void };
  getLastNotificationResponseAsync: () => Promise<NotificationTapResponse | null>;
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
 * Herkenningswaarde in `content.data.kind` voor route-afslagmeldingen (zie
 * routeNotificationService.ts, punt 6 van die opdracht). Bewust een losse
 * letterlijke string i.p.v. een gedeelde export: dit bestand mag
 * routeNotificationService.ts niet aanraken/importeren, dus beide bestanden
 * herhalen dezelfde letterlijke waarde zelf.
 */
const ROUTE_NOTIFICATION_DATA_KIND = 'route-guidance';

/** Is dit een route-afslagmelding? Defensief: `data` kan ontbreken of alles zijn. */
function isRouteGuidanceNotification(notification: IncomingNotification): boolean {
  const data = notification?.request?.content?.data;
  return !!data && typeof data === 'object' && (data as Record<string, unknown>).kind === ROUTE_NOTIFICATION_DATA_KIND;
}

/**
 * Stel het gedrag in voor meldingen die binnenkomen terwijl de app open
 * staat. Wordt hieronder automatisch eenmalig aangeroepen bij het inladen
 * van dit bestand: zo hoeft niemand hiervoor nog iets aan app/_layout.tsx
 * toe te voegen, en blijft de opzet werken zonder de root-layout te hoeven
 * aanraken.
 *
 * Route-afslagmeldingen (herkenbaar aan `data.kind`, zie hierboven) krijgen
 * bewust een ANDER gedrag dan de rest: tijdens een run staat de app op de
 * voorgrond met het scherm aan, dus zou een banner over het hardloopscherm
 * heen schuiven en een geluidje klinken bovenop de sprekende coach — beide
 * ongewenst. Ze moeten wél in de meldingenlijst belanden: juist DAARDOOR
 * pikt een gekoppeld horloge/bandje de melding op en spiegelt hem naar de
 * pols (zie routeNotificationService.ts). Alle overige meldingen (trainings-
 * herinneringen, streak-bescherming, weekoverzicht) behouden exact het
 * bestaande gedrag.
 */
export function setupNotificationHandler(): void {
  const N = loadNotificationsModule();
  if (!N) return;
  try {
    N.setNotificationHandler({
      // shouldShowAlert bewust weggelaten: die vlag is in expo-notifications 56
      // vervangen door shouldShowBanner + shouldShowList en doet zelf niets
      // meer, behalve een console-waarschuwing loggen zodra hij op true staat
      // (zie NotificationsHandler in het pakket). Dat gebeurde tot nu toe bij
      // elke trainingsherinnering.
      handleNotification: async (notification) => {
        if (isRouteGuidanceNotification(notification)) {
          return {
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: true,
          };
        }
        return {
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
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

/**
 * Is er toestemming om meldingen te sturen? Vraagt NIET zelf toestemming (dat
 * gebeurt alleen via requestNotificationPermission, op het moment dat de
 * gebruiker een categorie aanzet).
 */
async function hasNotificationPermission(): Promise<boolean> {
  const N = loadNotificationsModule();
  if (!N) return false;
  try {
    return (await N.getPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

// ── Planning ────────────────────────────────────────────────────────────────

/** Aantal dagen vooruit dat trainingsherinneringen en weekberichten gepland staan. */
const ROLLING_WINDOW_DAYS = 14;

const TRAINING_ID_PREFIX = 'lt-training-';
const WEEKLY_ID_PREFIX = 'lt-weekly-';
const COUNTDOWN_ID_PREFIX = 'lt-countdown-';
const STREAK_ID_PREFIX = 'lt-streak-';

/** Vaste identifiers van eerdere versies (streak-bescherming, weekoverzicht, herhalende dagen). */
const LEGACY_IDS = [
  'streak-protection',
  'week-overview',
  ...[1, 2, 3, 4, 5, 6, 7].map(d => `training-reminder-${d}`),
];

const NOTIFICATION_TITLE = 'Lopen te Lopen';
const WEEKLY_HOUR = 19;          // zondagavond
const STREAK_HOUR = 18;          // zondagavond, een uur voor het weekbericht
const COUNTDOWN_HOUR = 10;
const COUNTDOWN_DAY_BEFORE_HOUR = 18;

/** Dagen voor de wedstrijd waarop een countdown-melding komt (1 = de dag ervoor). */
export const COUNTDOWN_MILESTONES = [100, 50, 10, 1] as const;

/** Herkenningswaarde in `content.data.kind`, om een tik op de melding te herleiden. */
const DATA_KIND = {
  training: 'training-reminder',
  weekly: 'weekly-progress',
  countdown: 'countdown',
  streak: 'streak-protection',
} as const;

/** Expo Router-paden waar een tik op een melding naartoe leidt. */
const ROUTE_TRAINING = '/(tabs)/dashboard';
const ROUTE_PROGRESS = '/(tabs)/schedule';

/** Datum op een bepaald uur (lokale tijd). */
function atHour(date: Date, hour: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), 0, 0, 0);
}

/** 1 = maandag ... 7 = zondag, gelijk aan Session.day. */
function isoWeekday(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

function formatKm(km: number): string {
  return (Number.isInteger(km) ? String(km) : km.toFixed(1)).replace('.', ',');
}

/** Korte omschrijving van een sessie voor in de melding ("8 km rustig"). */
function describeSession(session: Session): string | null {
  switch (session.type) {
    case 'easy': return `${formatKm(session.distanceKm)} km rustig`;
    case 'long': return `${formatKm(session.distanceKm)} km lange duurloop`;
    case 'tempo': return `${formatKm(session.distanceKm)} km tempo`;
    case 'interval': return 'intervaltraining';
    case 'cross': return 'crosstraining';
    default: return null; // rust of onbekend: geen melding
  }
}

type StoreState = ReturnType<typeof useAppStore.getState>;

/**
 * Het schemaweek dat bij een datum hoort. Wedstrijdschema: kalender-verankerd
 * (null buiten de looptijd van het schema). Trainingsmodus: het schema loopt op
 * voltooiing, dus altijd de huidige week (currentWeekTraining).
 */
function weekForDate(state: StoreState, weeks: TrainingWeek[], date: Date): TrainingWeek | null {
  let weekNumber: number;
  if (state.schemaMode === 'race' && state.racePlan) {
    const status = raceScheduleStatus(state.racePlan, date);
    if (status.status !== 'bezig') return null;
    if (date.getTime() > atHour(parseLocalISODate(state.racePlan.race.date), 23).getTime()) return null;
    weekNumber = status.week;
  } else {
    weekNumber = state.currentWeekTraining;
  }
  return weeks.find(w => w.weekNumber === weekNumber) ?? null;
}

/** Is de gebruiker op deze kalenderdag al klaar met een run? */
function ranOnDate(state: StoreState, date: Date): boolean {
  const key = formatLocalISODate(date);
  return state.completedSessions.some(c => formatLocalISODate(new Date(c.completedAt)) === key);
}

function isSessionHandled(state: StoreState, session: Session): boolean {
  return (
    state.completedSessions.some(c => c.sessionId === session.id) ||
    state.skippedSessions.some(s => s.sessionId === session.id)
  );
}

interface PlannedNotification {
  identifier: string;
  title: string;
  body: string;
  date: Date;
  data: Record<string, unknown>;
}

/** Trainingsherinneringen: een melding per schemadag in het venster. */
function buildTrainingReminders(state: StoreState, weeks: TrainingWeek[], now: Date): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const hour = Number.isInteger(state.reminderHour) ? state.reminderHour : 8;
  const thisWeekKey = weekStartISO(now);
  const isRace = state.schemaMode === 'race' && !!state.racePlan;

  for (let offset = 0; offset < ROLLING_WINDOW_DAYS; offset++) {
    const day = addDays(now, offset);
    const fireAt = atHour(day, hour);
    if (fireAt.getTime() <= now.getTime() + 60_000) continue;
    if (offset === 0 && ranOnDate(state, day)) continue;

    const week = weekForDate(state, weeks, day);
    if (!week) continue;

    // Bonus-duurloopjes (optional) zijn vrijblijvend: daar sturen we geen melding voor.
    const session = week.sessions.find(s => s.day === isoWeekday(day) && !s.optional && describeSession(s));
    if (!session) continue;

    // Afgehandelde sessies krijgen geen melding. In de trainingsmodus geldt dat alleen
    // voor deze kalenderweek: een volgende week begint met een schone lei.
    const filterHandled = isRace || weekStartISO(day) === thisWeekKey;
    if (filterHandled && isSessionHandled(state, session)) continue;

    const isRaceDay = isRace && formatLocalISODate(day) === state.racePlan!.race.date;
    out.push({
      identifier: `${TRAINING_ID_PREFIX}${formatLocalISODate(day)}`,
      title: NOTIFICATION_TITLE,
      body: isRaceDay
        ? `Vandaag is het zover: ${state.racePlan!.race.name}. Veel succes en geniet ervan!`
        : `Vandaag: ${describeSession(session)}`,
      date: fireAt,
      data: { kind: DATA_KIND.training, route: ROUTE_TRAINING },
    });
  }
  return out;
}

/** Wekelijkse voortgang: elke zondagavond in het venster. */
function buildWeeklyProgress(state: StoreState, weeks: TrainingWeek[], now: Date): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  let first = true;

  for (let offset = 0; offset < ROLLING_WINDOW_DAYS; offset++) {
    const day = addDays(now, offset);
    if (isoWeekday(day) !== 7) continue;
    const fireAt = atHour(day, WEEKLY_HOUR);
    if (fireAt.getTime() <= now.getTime() + 60_000) continue;

    let body = 'Hoe liep je week? Bekijk je voortgang in je schema.';
    // Alleen de eerstvolgende zondag kennen we de cijfers van; de volgende
    // krijgt een neutrale tekst en wordt bij de eerstvolgende herplanning scherper.
    if (first) {
      first = false;
      const week = weekForDate(state, weeks, day);
      if (!week) continue;
      const weekKey = weekStartISO(day);
      const done = new Set(
        state.completedSessions
          .filter(c => weekStartISO(new Date(c.completedAt)) === weekKey)
          .map(c => c.sessionId),
      ).size;
      const planned = Math.max(week.sessions.filter(s => !s.optional && s.type !== 'rest').length, done);
      if (planned === 0) continue;
      if (done === 0) body = 'Deze week nog geen training gedaan. Een korte loop telt ook!';
      else if (done >= planned) body = `Deze week alle ${planned} trainingen gedaan. Sterk bezig!`;
      else body = `Deze week ${done} van ${planned} trainingen gedaan.`;
    }

    out.push({
      identifier: `${WEEKLY_ID_PREFIX}${formatLocalISODate(day)}`,
      title: NOTIFICATION_TITLE,
      body,
      date: fireAt,
      data: { kind: DATA_KIND.weekly, route: ROUTE_PROGRESS },
    });
  }
  return out;
}

/**
 * Reeks vasthouden: elke zondag in het venster om 18:00 een duwtje, maar alleen
 * als er in die schemaweek (ma-zo) nog geen training is voltooid. Zo blijft de
 * melding weg voor wie al gelopen heeft; na een voltooide training volgt een
 * herplanning (completeSession) die de melding van die week weer verwijdert.
 */
function buildStreakProtection(state: StoreState, now: Date): PlannedNotification[] {
  const out: PlannedNotification[] = [];

  for (let offset = 0; offset < ROLLING_WINDOW_DAYS; offset++) {
    const day = addDays(now, offset);
    if (isoWeekday(day) !== 7) continue;
    const fireAt = atHour(day, STREAK_HOUR);
    if (fireAt.getTime() <= now.getTime() + 60_000) continue;

    const weekKey = weekStartISO(day);
    if (state.completedSessions.some(c => weekStartISO(new Date(c.completedAt)) === weekKey)) continue;

    out.push({
      identifier: `${STREAK_ID_PREFIX}${formatLocalISODate(day)}`,
      title: NOTIFICATION_TITLE,
      body: 'Nog geen run deze week. Een korte loop telt ook!',
      date: fireAt,
      data: { kind: DATA_KIND.streak, route: ROUTE_TRAINING },
    });
  }
  return out;
}

/** Countdown-mijlpalen naar het racedoel (alleen met een gekozen wedstrijd). */
function buildCountdown(state: StoreState, now: Date): PlannedNotification[] {
  if (state.schemaMode !== 'race' || !state.racePlan) return [];
  const { name, date } = state.racePlan.race;
  const raceDay = parseLocalISODate(date);
  const out: PlannedNotification[] = [];

  for (const days of COUNTDOWN_MILESTONES) {
    const fireAt = atHour(addDays(raceDay, -days), days === 1 ? COUNTDOWN_DAY_BEFORE_HOUR : COUNTDOWN_HOUR);
    if (fireAt.getTime() <= now.getTime() + 60_000) continue;

    let body: string;
    if (days === 1) body = `Morgen is het zover: ${name}. Eet goed, slaap lekker en geniet ervan!`;
    else if (days === 10) body = `Nog 10 dagen tot ${name}. Blijf scherp en neem voldoende rust.`;
    else if (days === 50) body = `Nog 50 dagen tot ${name}. Houd je schema vol, je bent goed op weg.`;
    else body = `Nog ${days} dagen tot ${name}. Elke training brengt je dichterbij de finish!`;

    out.push({
      identifier: `${COUNTDOWN_ID_PREFIX}${days}`,
      title: NOTIFICATION_TITLE,
      body,
      date: fireAt,
      data: { kind: DATA_KIND.countdown, route: ROUTE_PROGRESS },
    });
  }
  return out;
}

/** Annuleert alle meldingen van dit bestand (en van eerdere versies); route-afslagmeldingen blijven ongemoeid. */
async function cancelOwnNotifications(N: NotificationsModule): Promise<void> {
  let ids: string[] = [];
  try {
    const scheduled = await N.getAllScheduledNotificationsAsync();
    ids = scheduled
      .map(n => n.identifier)
      .filter(id =>
        id.startsWith(TRAINING_ID_PREFIX) ||
        id.startsWith(WEEKLY_ID_PREFIX) ||
        id.startsWith(COUNTDOWN_ID_PREFIX) ||
        id.startsWith(STREAK_ID_PREFIX) ||
        LEGACY_IDS.includes(id),
      );
  } catch {
    ids = LEGACY_IDS;
  }
  for (const id of ids) {
    try {
      await N.cancelScheduledNotificationAsync(id);
    } catch {
      // Negeer: de melding was al weg
    }
  }
}

async function runReschedule(): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;

  const state = useAppStore.getState();
  const wantsTraining = state.remindersEnabled;
  const wantsWeekly = state.weeklyProgressEnabled;
  const wantsCountdown = state.countdownEnabled;
  const wantsStreak = state.streakEnabled;

  await cancelOwnNotifications(N);
  if (!wantsTraining && !wantsWeekly && !wantsCountdown && !wantsStreak) return;
  if (!state.profile || !state.hasCompletedOnboarding) return;
  // Zonder toestemming plannen we niets (de OS zou het toch weigeren).
  if (!(await hasNotificationPermission())) return;

  const now = new Date();
  const weeks = resolveActivePlan({
    schemaMode: state.schemaMode,
    racePlan: state.racePlan,
    customPlan: state.customPlan,
    goal: state.profile.goal,
    trainingDays: state.profile.trainingDays,
  }).weeks;

  const planned: PlannedNotification[] = [
    ...(wantsTraining ? buildTrainingReminders(state, weeks, now) : []),
    ...(wantsWeekly ? buildWeeklyProgress(state, weeks, now) : []),
    ...(wantsCountdown ? buildCountdown(state, now) : []),
    ...(wantsStreak ? buildStreakProtection(state, now) : []),
  ];

  for (const n of planned) {
    try {
      await N.scheduleNotificationAsync({
        identifier: n.identifier,
        content: { title: n.title, body: n.body, sound: true, data: n.data },
        trigger: { type: 'date', date: n.date },
      });
    } catch {
      // Eén mislukte melding mag de rest niet blokkeren
    }
  }
}

// Serialiseert herplanningen: de planning bestaat uit annuleren + opnieuw
// plannen, en twee die door elkaar lopen zouden dubbele meldingen kunnen
// opleveren. Komt er tijdens een lopende ronde nog een verzoek, dan volgt
// precies een extra ronde met de dan actuele store.
let rescheduling = false;
let rescheduleQueued = false;

/**
 * Plant alle lokale meldingen opnieuw op basis van de actuele store en de
 * schakelaars in Instellingen. Aan te roepen bij app-start, terug naar de
 * voorgrond, schema-/doelwijziging, afgeronde training en gewijzigde
 * instellingen. Faalt altijd stil.
 */
export async function rescheduleNotifications(): Promise<void> {
  if (rescheduling) {
    rescheduleQueued = true;
    return;
  }
  rescheduling = true;
  try {
    do {
      rescheduleQueued = false;
      try {
        await runReschedule();
      } catch {
        // Stil falen: geen herinneringen is beter dan een crash
      }
    } while (rescheduleQueued);
  } finally {
    rescheduling = false;
  }
}

// ── Tik op een melding ──────────────────────────────────────────────────────

const handledResponses = new Set<string>();

/**
 * Geeft het Expo Router-pad waar een tik op een melding naartoe moet, of null
 * als het geen melding van ons is (bijv. een route-afslagmelding) of al
 * afgehandeld is.
 */
export function resolveNotificationTapRoute(response: NotificationTapResponse | null | undefined): string | null {
  const data = response?.notification?.request?.content?.data;
  if (!data || typeof data !== 'object') return null;
  const { kind, route } = data as Record<string, unknown>;
  if (kind !== DATA_KIND.training && kind !== DATA_KIND.weekly && kind !== DATA_KIND.countdown && kind !== DATA_KIND.streak) return null;
  if (route !== ROUTE_TRAINING && route !== ROUTE_PROGRESS) return null;

  // Dezelfde tik kan zowel via de listener als via getLastNotificationResponse binnenkomen.
  const key = `${response?.notification?.request?.identifier ?? ''}|${response?.notification?.date ?? ''}`;
  if (handledResponses.has(key)) return null;
  handledResponses.add(key);
  return route;
}

/**
 * Luistert naar tikken op meldingen (app op de achtergrond of voorgrond) en
 * geeft ook de tik terug die de app koud gestart heeft. `navigate` krijgt het
 * pad. Geeft een functie terug die de luisteraar opruimt.
 */
export function listenForNotificationTaps(navigate: (route: string) => void): () => void {
  const N = loadNotificationsModule();
  if (!N) return () => {};

  let subscription: { remove: () => void } | null = null;
  try {
    subscription = N.addNotificationResponseReceivedListener(response => {
      const route = resolveNotificationTapRoute(response);
      if (route) navigate(route);
    });
  } catch {
    subscription = null;
  }

  N.getLastNotificationResponseAsync()
    .then(response => {
      const route = resolveNotificationTapRoute(response);
      if (route) navigate(route);
    })
    .catch(() => {
      // Stil falen
    });

  return () => {
    try {
      subscription?.remove();
    } catch {
      // Negeer
    }
  };
}

