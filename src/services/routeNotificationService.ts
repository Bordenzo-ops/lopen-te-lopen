/**
 * routeNotificationService
 *
 * Spiegelt de eerstvolgende afslag van een geplande route naar een systeem-
 * melding, zodat elk smartwatch/fitnessbandje dat telefoonmeldingen naar de
 * pols spiegelt (vrijwel elk model doet dit standaard) de afslag op de pols
 * laat verschijnen — zonder dat wij daar een eigen watchOS/Wear OS-app voor
 * hoeven te bouwen. De gesproken coach (useRouteCoaching.ts, via
 * voiceService) blijft de hoofdbron voor geluid; dit bestand levert alleen
 * het stille, visuele/haptische kanaal ernaast.
 *
 * Zelfde offline-first opzet als notificationService.ts: eigen minimale
 * typedefinities in plaats van `import type` uit expo-notifications (zodat
 * tsc ook schoon blijft zonder het geïnstalleerde pakket), een lazy
 * `loadNotificationsModule()`-singleton, en overal stil falen. Bewust een
 * volledig los bestand van notificationService.ts (geen gedeelde imports) —
 * zie de toelichting bij TURN_KIND_PATTERNS in useRouteCoaching.ts voor
 * dezelfde reden: eigen kopieën i.p.v. iets exporteren uit een bestand dat
 * deze opdracht niet mag aanraken.
 *
 * Vereist: npx expo install expo-notifications (al aanwezig, zie
 * notificationService.ts).
 *
 * Ontwerpkeuzes:
 * - Eén vaste identifier (ROUTE_NOTIFICATION_ID) voor ZOWEL de afslag- als
 *   de off-route-melding: er is op elk moment hoogstens één zichtbare
 *   route-melding. Een nieuwe afslag vervangt de vorige afslagmelding, en
 *   een off-route-melding vervangt een eventueel zichtbare afslagmelding
 *   (en andersom) — nooit een opeenstapeling van twintig regels in het
 *   meldingencentrum bij een route met twintig afslagen.
 * - Nooit om toestemming vragen (punt 4 van de opdracht): alleen
 *   `getPermissionsAsync` lezen. Een systeemdialoog midden in een
 *   hardloopsessie zou de gebruiker uit zijn ritme halen; toestemming wordt
 *   elders in de app (bij het inschakelen van herinneringen) gevraagd.
 * - Melding direct tonen i.p.v. plannen: `trigger: null`. De geïnstalleerde
 *   expo-notifications-versie (56.x, zie scheduleNotificationAsync.ts in
 *   node_modules) geeft een `null`-trigger letterlijk door aan de native
 *   laag, die dat interpreteert als "presenteer nu" — er is in deze versie
 *   geen aparte presenteer-functie (`presentNotificationAsync` bestaat hier
 *   niet), dus dit is de enige en tevens door de package zelf gedocumenteerde
 *   weg voor een melding die meteen moet verschijnen.
 */

import { Platform } from 'react-native';

// ── Eigen minimale typedefinities voor expo-notifications ──────────────────
// Geen import type van de package: tsc moet ook schoon blijven zonder dat het
// pakket geinstalleerd is. Dit dekt alleen wat wij gebruiken.

interface NotificationPermissionResponse {
  status: 'granted' | 'denied' | 'undetermined';
}

/**
 * Subset van expo-notifications' `AndroidImportance`-enum, hier als losse
 * numerieke constante i.p.v. een geïmporteerde enum (zelfde reden als
 * hierboven: geen afhankelijkheid van het pakket voor tsc). De waarde zelf
 * (5 = DEFAULT) is precies wat de native enum ook als DEFAULT gebruikt.
 */
const ANDROID_IMPORTANCE_DEFAULT = 5;

interface NotificationChannelInput {
  name: string;
  importance: number;
  /** Trilpatroon in ms: [wachttijd, trilduur, wachttijd, trilduur, ...]. */
  vibrationPattern?: number[];
  enableVibrate?: boolean;
  /** `null` = geen kanaalgeluid (Android 8+ negeert het content-niveau `sound`-veld anders). */
  sound?: string | null;
}

interface NotificationContentInput {
  title?: string;
  body?: string;
  /** `false` = stille melding — de gesproken coach levert het geluid al. */
  sound?: boolean;
  /** Herkenningsveld voor de notificatiehandler (zie notificationService.ts). */
  data?: Record<string, unknown>;
}

interface ScheduleNotificationRequest {
  identifier?: string;
  content: NotificationContentInput;
  /** `null` = nu tonen i.p.v. een toekomstig moment plannen (zie bestandscomment). */
  trigger: null;
}

interface NotificationsModule {
  getPermissionsAsync: () => Promise<NotificationPermissionResponse>;
  setNotificationChannelAsync: (
    channelId: string,
    channel: NotificationChannelInput,
  ) => Promise<unknown>;
  scheduleNotificationAsync: (request: ScheduleNotificationRequest) => Promise<string>;
  dismissNotificationAsync: (identifier: string) => Promise<void>;
}

// Module-level lazy singleton: de require gebeurt maximaal eenmaal. Eigen
// exemplaar los van notificationService.ts (zie bestandscomment hierboven).
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
 * Controleert of meldingstoestemming er AL is, zonder ooit een systeem-
 * dialoog te tonen (punt 4 van de opdracht). Faalt stil naar `false`.
 */
async function hasNotificationPermission(N: NotificationsModule): Promise<boolean> {
  try {
    const current = await N.getPermissionsAsync();
    return current.status === 'granted';
  } catch {
    return false;
  }
}

// ── Kanaal + identifiers ─────────────────────────────────────────────────

const ROUTE_CHANNEL_ID = 'route-guidance';
const ROUTE_CHANNEL_NAME = 'Routebegeleiding';

/**
 * Eén vaste identifier voor zowel de afslag- als de off-route-melding: er
 * is op elk moment hoogstens één zichtbare route-melding (zie bestands-
 * comment "Ontwerpkeuzes" hierboven). `scheduleNotificationAsync` met een
 * reeds bestaande identifier vervangt de melding in het meldingencentrum
 * (Android's `NotificationManager.notify` met hetzelfde id-gedrag) i.p.v.
 * er een tweede naast te zetten.
 */
const ROUTE_NOTIFICATION_ID = 'route-guidance-notification';

/**
 * Herkenningswaarde in `content.data.kind`, zodat notificationService.ts
 * (zie punt 6 van de opdracht) deze meldingen kan onderscheiden van de
 * trainingsherinneringen. Bewust een losse letterlijke string i.p.v. een
 * gedeelde export: dit bestand mag geen ander bestand aanraken/koppelen, dus
 * notificationService.ts herhaalt dezelfde letterlijke waarde zelf.
 */
const ROUTE_NOTIFICATION_DATA_KIND = 'route-guidance';

/**
 * Eén korte trilpuls (200 ms) per afslag: "precies één alert per afslag"
 * (punt 1 van de opdracht). Geen meerdere pulsen — dat is al de taak van de
 * losse haptische afslagcue in useRouteCoaching.ts (fireHapticTurnCue, 2/3
 * tikken voor links/rechts); dit kanaal is uitsluitend de brug naar het
 * horloge, niet een tweede haptische taal.
 */
const ROUTE_VIBRATION_PATTERN = [0, 200];

/**
 * Bereidt het Android-meldingskanaal voor. Aanroepen bij het starten van
 * een sessie met een geplande route (vóór de eerste `showTurnNotification`-
 * aanroep) — een kanaal hoeft maar eenmaal aangemaakt te worden, herhaalde
 * aanroepen zijn goedkoop (Android werkt idempotent: bestaat het kanaal al
 * met dezelfde id, dan wordt het gewoon (opnieuw) geconfigureerd).
 *
 * Alleen relevant op Android — op iOS bestaat het concept "kanaal" niet en
 * bepaalt de melding zelf (title/body/sound) het gedrag, dus daar is dit
 * een no-op.
 *
 * ── Waarom importance DEFAULT (5), niet HIGH of LOW ─────────────────────
 * Een te lage importance (LOW/MIN) laat Android de melding weliswaar in het
 * meldingencentrum tonen, maar zonder gegarandeerde trilling — en juist die
 * trilling is de enige reden dat een gekoppeld horloge/bandje de melding
 * oppikt en naar de pols spiegelt. Te laag betekent dus: het bandje krijgt
 * niets. Een te hoge importance (HIGH/MAX) doet het omgekeerde probleem:
 * die dwingt een "heads-up"-pop-up af die over het lopende scherm heen zou
 * schuiven, precies het schreeuwerige, storende effect dat de opdracht wil
 * vermijden (zie ook de banner-onderdrukking in notificationService.ts,
 * deel 2). DEFAULT zit precies ertussenin: de melding trilt betrouwbaar en
 * verschijnt in het meldingencentrum/op de statusbalk-icoon, zonder een
 * heads-up-overlay te forceren. Het kanaalgeluid staat apart uit
 * (`sound: null`) — de trilling is het enige signaal dat we willen.
 */
export async function prepareRouteNotifications(): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;
  if (Platform.OS !== 'android') return;

  try {
    await N.setNotificationChannelAsync(ROUTE_CHANNEL_ID, {
      name: ROUTE_CHANNEL_NAME,
      importance: ANDROID_IMPORTANCE_DEFAULT,
      vibrationPattern: ROUTE_VIBRATION_PATTERN,
      enableVibrate: true,
      sound: null,
    });
  } catch {
    // Stil falen: zonder kanaal valt de melding (indien hij alsnog lukt)
    // terug op Android's standaardkanaalgedrag — geen crash.
  }
}

// ── Richtingsymbolen ─────────────────────────────────────────────────────

/**
 * Zelfde afslagtypes als `TurnKind` in useRouteCoaching.ts. Eigen kopie
 * i.p.v. een import van/naar dat bestand — dezelfde reden als de kopie van
 * TURN_KIND_PATTERNS daar: dit bestand mag geen ander bestand aanraken, en
 * de string-literal-union is structureel compatibel zonder gedeelde bron.
 */
export type TurnKind =
  | 'left' | 'right' | 'sharp-left' | 'sharp-right'
  | 'keep-left' | 'keep-right' | 'straight' | 'uturn' | 'arrive' | 'unknown';

/**
 * Eén richtingsymbool vóór de instructietekst (punt 5 van de opdracht) —
 * op een klein horlogescherm is een pijltje sneller te lezen dan het woord
 * "links"/"rechts" aan het begin van een afgekapte regel. "houd ... aan"-
 * varianten krijgen hetzelfde pijltje als hun scherpe tegenhanger: de loper
 * gaat het om de kant, niet om de scherpte van de bocht. Onherkende/rechte/
 * aankomst-types krijgen bewust geen symbool: rechtdoor en "doel bereikt"
 * hebben geen kant om aan te wijzen, en een verzonnen symbool zou daar
 * misleidend zijn.
 */
const TURN_SYMBOLS: Partial<Record<TurnKind, string>> = {
  left: '←',
  'sharp-left': '←',
  'keep-left': '←',
  right: '→',
  'sharp-right': '→',
  'keep-right': '→',
  uturn: '↩',
};

/** Rondt af op 10 m, geklemd op 0 (nooit een negatieve afstand tonen). */
function roundDistanceM(distanceM: number): number {
  return Math.round(Math.max(0, distanceM) / 10) * 10;
}

/**
 * Titelregel: "Over 150 m" — de afstand vooraan, want dat is op een klein
 * scherm het eerste (en soms enige zichtbare) stukje tekst. Rondt de
 * afslag al zo dichtbij is af naar "Nu" i.p.v. "Over 0 m".
 */
function formatDistanceTitle(distanceM: number): string {
  const rounded = roundDistanceM(distanceM);
  return rounded <= 0 ? 'Nu' : `Over ${rounded} m`;
}

/**
 * Toont/vervangt de afslagmelding. Bijvoorbeeld: titel "Over 150 m", tekst
 * "→ Sla rechts af". Faalt altijd stil (punt 8): ontbrekend pakket,
 * geweigerde toestemming of een willekeurige fout mogen een lopende sessie
 * nooit onderbreken.
 */
export async function showTurnNotification(
  text: string,
  distanceM: number,
  kind: TurnKind,
): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;

  try {
    if (!(await hasNotificationPermission(N))) return;

    const symbol = TURN_SYMBOLS[kind];
    await N.scheduleNotificationAsync({
      identifier: ROUTE_NOTIFICATION_ID,
      content: {
        title: formatDistanceTitle(distanceM),
        body: symbol ? `${symbol} ${text}` : text,
        sound: false,
        data: { kind: ROUTE_NOTIFICATION_DATA_KIND },
      },
      trigger: null,
    });
  } catch {
    // Stil falen: geen afslagmelding is beter dan een crash midden in de sessie.
  }
}

const OFF_ROUTE_TITLE = 'Van de route af';
// Zelfde rustige, niet-beschuldigende toon als OFFROUTE_TEXTS in
// voicePhrases.ts (bewust geen import daarvandaan, zie bestandscomment):
// geen "je loopt verkeerd", geen belofte om te herberekenen — alleen de
// enige zinvolle actie zonder scherm: teruggaan naar de lijn zodra het kan.
// Kort gehouden zodat een horlogescherm de kern niet afkapt.
const OFF_ROUTE_BODY = 'Zoek de lijn weer op zodra het uitkomt.';

/**
 * Toont/vervangt de melding dat de loper van de uitgestippelde route af is.
 * Gebruikt dezelfde identifier als showTurnNotification, dus vervangt een
 * eventueel zichtbare afslagmelding (en andersom) — nooit twee route-
 * meldingen tegelijk. Faalt altijd stil (punt 8).
 */
export async function showOffRouteNotification(): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;

  try {
    if (!(await hasNotificationPermission(N))) return;

    await N.scheduleNotificationAsync({
      identifier: ROUTE_NOTIFICATION_ID,
      content: {
        title: OFF_ROUTE_TITLE,
        body: OFF_ROUTE_BODY,
        sound: false,
        data: { kind: ROUTE_NOTIFICATION_DATA_KIND },
      },
      trigger: null,
    });
  } catch {
    // Stil falen
  }
}

/**
 * Haalt de route-melding weg (indien aanwezig). Aanroepen bij het einde van
 * de sessie. `dismissNotificationAsync` is de juiste tegenhanger van een
 * met `trigger: null` DIRECT getoonde melding — dat is een reeds AFGELEVERDE
 * melding in het meldingencentrum, geen nog wachtende geplande melding, dus
 * `cancelScheduledNotificationAsync` (zoals notificationService.ts voor zijn
 * wél geplande herinneringen gebruikt) zou hier niets doen.
 *
 * Zonder ooit een melding getoond te hebben (bv. een sessie zonder route,
 * of route-coaching die nooit een afslag binnen bereik kreeg) roept dit
 * `dismissNotificationAsync` aan met een identifier die nooit bestaan heeft
 * — dat is op Android een no-op (er is simpelweg niets om te verwijderen)
 * en gooit geen fout; de omringende try/catch vangt eventuele afwijkende
 * platformgevallen sowieso af.
 */
export async function clearRouteNotification(): Promise<void> {
  const N = loadNotificationsModule();
  if (!N) return;

  try {
    await N.dismissNotificationAsync(ROUTE_NOTIFICATION_ID);
  } catch {
    // Stil falen
  }
}
