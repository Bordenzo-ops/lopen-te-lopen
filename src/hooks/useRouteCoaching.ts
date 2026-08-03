/**
 * useRouteCoaching
 *
 * Gesproken + haptische route-coaching tijdens een hardloopsessie, gebouwd op
 * de voortgangscursor-engine uit `src/services/routeFollowing.ts`.
 *
 * ── Waarom niet meer "loop alle instructies af en check de afstand" ─────────
 * De vorige implementatie doorliep bij elke GPS-update ALLE instructies en
 * sprak elke instructie uit waarvan het waypoint binnen 150 m lag, zonder
 * volgorde- of "al gepasseerd"-besef. Bij een outAndBack-route (heen-en-
 * terug, zelfde weg retour) viel het EINDE van de terugweg daardoor al bij
 * de start binnen bereik en werd meteen (fout) als afgehandeld weggestreept
 * — zie de uitgebreide toelichting in routeFollowing.ts. Deze hook gebruikt
 * nu uitsluitend de daar gebouwde voortgangscursor (`prepareRoute` /
 * `createFollowState` / `updateFollowState`): die cursor kan alleen vooruit
 * over de route schuiven binnen een begrensd zoekvenster, en levert per GPS-
 * update kant-en-klaar de eerstvolgende nog niet gepasseerde instructie, de
 * afstand daar LANGS DE ROUTE naartoe, en de off-route-status (met
 * afstandshysterese).
 *
 * ── Twee aankondigingsmomenten per afslag ────────────────────────────────
 * Elke instructie kan hoogstens twee gesproken meldingen krijgen, elk
 * hoogstens één keer (bijgehouden per `originalIndex`, de index van de
 * engine in `plannedRoute.instructions`):
 *   - Vooraankondiging (~150 m): "Over 100 meter: sla links af."
 *   - Eindaankondiging  (~30 m): "Sla links af." (geen afstand meer, de
 *     afslag is er bijna al)
 * Plus een haptische trilcue (~50 m, ONAFHANKELIJK van de stem — zie
 * sectie 5 hieronder) zodat een loper de afslag ook zonder geluid voelt.
 *
 * ── Horlogemelding (routeNotificationService.ts) ─────────────────────────
 * Optioneel, uit `appStore.routeNotificationsEnabled` (default false),
 * rechtstreeks via `useAppStore.getState()` gelezen — zelfde patroon als
 * `voiceService.ts` met `isPremium`. Krijgt UITSLUITEND de vooraankondiging
 * (~150 m), nooit ook de eindaankondiging: twee meldingen zouden twee
 * trilpulsen op een gekoppeld horloge geven, en dat maakt het signaal juist
 * waardeloos. Net als de haptische cue ONAFHANKELIJK van `voiceEnabled` —
 * dit is het stille kanaal. De van-de-route-af-melding deelt de bestaande
 * tijdscooldown (`OFFROUTE_ANNOUNCE_COOLDOWN_MS`) met de gesproken variant
 * i.p.v. een eigen cooldown te introduceren.
 *
 * ── De outAndBack-dubbeling: hoe deze hook ermee omgaat ──────────────────
 * Bij het keerpunt van een outAndBack-route liggen twee instructies (het
 * eind van de heenweg-instructielijst en het begin van de terugweg) op
 * exact dezelfde positie langs de route (hetzelfde, gedupliceerde
 * waypoint). De engine kan daardoor een instructie NOOIT als
 * `nextInstructionIndex` aanwijzen (zie TIE_EPSILON_M/gelijkspel-afhandeling
 * in routeFollowing.ts) — zo'n instructie wordt simpelweg overgeslagen.
 * Omdat al onze bijhoud-logica hieronder uitsluitend reageert op WAT de
 * engine als "eerstvolgende" aanwijst (nooit op een eigen doorloop van
 * `plannedRoute.instructions`), lopen we hier nooit vast en spreken we nooit
 * iets dubbel uit: een overgeslagen instructie krijgt gewoon geen van beide
 * aankondigingen en geen haptische cue — stil overgeslagen, verder niets.
 *
 * ── Off-route: afstandshysterese (engine) + tijdshysterese (hier) ────────
 * De engine filtert al kort-durende afwijkingen eruit (OFF_ROUTE_CONSECUTIVE
 * opeenvolgende updates boven de drempel) en voorkomt dat de status zelf
 * klappert (aparte ENTER/EXIT-drempels). Dat is hysterese op AFSTAND. Een
 * loper die minutenlang precies langs de rand van die drempel loopt (bv. een
 * parallelle stoep net binnen/buiten de marge) kan zo alsnog meerdere keren
 * kort na elkaar een geldige `justWentOffRoute` opleveren — elke keer
 * terecht volgens de afstandslogica, maar vervelend om steeds opnieuw te
 * horen. Deze hook voegt daarom een onafhankelijke hysterese op TIJD toe
 * (OFFROUTE_ANNOUNCE_COOLDOWN_MS): hij gaat alleen over hoe vaak we het
 * MELDEN, nooit over de `isOffRoute`-status zelf (die volgt voor de UI
 * altijd direct en ongefilterd de engine).
 *
 * ── KRITIEK: werkt ook zonder stem (punt 8 van de opdracht) ──────────────
 * De vorige hook stopte bovenaan `onGpsUpdate` zodra `voiceEnabled` false
 * was — dan bleef ook de afslagbalk/voortgang op het scherm stilstaan. Hier
 * draait de cursor-engine (en dus `nextTurn`/`isOffRoute`/`remainingKm`)
 * altijd door zolang er een route is; alleen de daadwerkelijke
 * `voiceService.speakPhrases`-aanroepen zijn aan `voiceEnabled` gekoppeld.
 * De "al aangekondigd"-markering gebeurt WEL binnen diezelfde
 * `voiceEnabled`-tak (samen met het spreken zelf): staat de stem uit, dan
 * telt een instructie dus niet als afgehandeld. Zet een gebruiker de stem
 * middenrit aan, dan hoort hij alsnog de eerstvolgende, nog niet gepasseerde
 * aankondiging; zet hij hem weer uit, dan gaat er niets stuk — er wordt
 * alleen niets meer gesproken, terwijl de afslagbalk en de trilcue (die is
 * sowieso nooit aan `voiceEnabled` gekoppeld) gewoon doorwerken.
 *
 * `enabled` behoudt zijn oorspronkelijke rol: de algemene aan/uit-schakelaar
 * voor route-coaching (in de praktijk door de aanroeper gelijkgesteld aan
 * "is er een route", zie app/session/active.tsx). Zonder `enabled` of zonder
 * route doet deze hook niets en blijft/valt de teruggegeven UI-state terug
 * naar neutraal (geen afslag, niet off-route, 0 km resterend).
 *
 * Gebruik:
 *   const { onGpsUpdate, reset, nextTurn, isOffRoute, remainingKm } =
 *     useRouteCoaching(enabled, voiceEnabled, plannedRoute, voiceType);
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import * as voiceService from '../services/voiceService';
import type { VoiceType } from '../config/voiceConfig';
import { navUtterance, milestoneUtterance, offRouteUtterance, backOnRouteUtterance } from '../config/voicePhrases';
import { PlannedRoute } from '../services/routeService';
import {
  prepareRoute,
  createFollowState,
  updateFollowState,
  PreparedRoute,
  FollowState,
} from '../services/routeFollowing';
import { useAppStore } from '../store/appStore';
import {
  prepareRouteNotifications,
  showTurnNotification,
  showOffRouteNotification,
  clearRouteNotification,
} from '../services/routeNotificationService';

// ── Constanten ────────────────────────────────────────────────────────────────

/**
 * Vooraankondiging van een afslag ("Over 100 meter: ..."): rond deze afstand
 * (meter, LANGS DE ROUTE) klinkt de melding. Zelfde drempel als de vorige
 * implementatie (ANNOUNCE_AT_M).
 */
const PRE_ANNOUNCE_M = 150;

/**
 * Eindaankondiging vlak vóór de afslag: alleen nog de instructietekst,
 * zonder afstandsprefix — de afslag is dan al zo dichtbij dat "over 30
 * meter" geen toegevoegde waarde meer heeft, alleen "Sla links af".
 */
const FINAL_ANNOUNCE_M = 30;

/**
 * Haptische trilcue vóór een afslag. Bewust tussen PRE_ANNOUNCE_M en
 * FINAL_ANNOUNCE_M in: ruim op tijd voor wie geen geluid aan heeft (telefoon
 * in zak/armband), maar dicht genoeg dat de cue nog duidelijk bij ÉÉN
 * specifieke afslag hoort.
 */
const HAPTIC_TRIGGER_M = 50;

/**
 * Afronding (meter) van de afstand die bij de vooraankondiging wordt
 * uitgesproken — "Over 100 meter", niet "Over 103 meter". Zelfde afronding
 * als de vorige implementatie. Zie ook navUtterance() in voicePhrases.ts:
 * die klemt deze waarde intern nogmaals op 50..150 voor de clip-keuze, maar
 * gebruikt de hier al afgeronde waarde ongewijzigd in de fallbacktekst.
 */
const SPEECH_DISTANCE_ROUND_STEP_M = 10;

/**
 * Minimale tijd (ms) tussen twee gesproken "je bent van de route af"-
 * meldingen. Zie de toelichting bovenaan dit bestand over tijds- versus
 * afstandshysterese. 60 seconden is lang genoeg om een rand-van-de-route-
 * loper niet te laten "zeuren", kort genoeg om bij een echte, aanhoudende
 * afwijking niet te lang stil te blijven.
 */
const OFFROUTE_ANNOUNCE_COOLDOWN_MS = 60_000;

/**
 * Tussenpauze (ms) tussen twee haptische tikken van dezelfde afslagcue. Kort
 * genoeg om als één samenhangende cue te voelen, lang genoeg om de tikken
 * individueel te kunnen onderscheiden (te kort en het voelt als één bromtik).
 */
const HAPTIC_TICK_INTERVAL_MS = 180;

/**
 * Stapgrootte (meter) waarin de afstand tot de eerstvolgende afslag wordt
 * afgerond vóórdat die als React-state wordt weggeschreven. Zie de
 * toelichting bij de "UI-snapshot" verderop: dit is de kern van punt 9
 * (rendergedrag) uit de opdracht.
 */
const RENDER_DISTANCE_STEP_M = 10;

/** Zelfde idee als RENDER_DISTANCE_STEP_M, maar in km, toegepast op remainingKm. */
const RENDER_REMAINING_STEP_KM = RENDER_DISTANCE_STEP_M / 1000;

/** Voortgangsmijlpalen: voortgangsfractie + bijbehorend catalogus-percentage (ongewijzigd t.o.v. de vorige implementatie). */
const MILESTONES: Array<[number, 25 | 50 | 75]> = [
  [0.25, 25],
  [0.50, 50],
  [0.75, 75],
];

// ── Afslagtype ────────────────────────────────────────────────────────────────

export type TurnKind =
  | 'left' | 'right' | 'sharp-left' | 'sharp-right'
  | 'keep-left' | 'keep-right' | 'straight' | 'uturn' | 'arrive' | 'unknown';

/**
 * Herkenningspatronen voor het afslagtype uit de Nederlandse instructietekst
 * (`toNl()` in routeService.ts). Dit is BEWUST een eigen kopie van de
 * volgorde/patronen in TURN_PATTERNS (src/config/voicePhrases.ts) — die tabel
 * is daar niet geëxporteerd, en dit bestand mag (opdracht) geen ander bestand
 * aanraken om hem alsnog te exporteren. Zelfde volgorde als daar: "scherp"-
 * en "houd ... aan"-varianten vóór de simpele "sla ... af" (ze overlappen
 * elkaar toch niet als substring). WIJZIG je TURN_PATTERNS in
 * voicePhrases.ts, wijzig dan ook TURN_KIND_PATTERNS hier mee — beide lijsten
 * moeten gelijk blijven.
 */
const TURN_KIND_PATTERNS: Array<[string, TurnKind]> = [
  ['sla scherp links af',  'sharp-left'],
  ['sla scherp rechts af', 'sharp-right'],
  ['houd links aan',       'keep-left'],
  ['houd rechts aan',      'keep-right'],
  ['sla links af',         'left'],
  ['sla rechts af',        'right'],
  ['ga rechtdoor',         'straight'],
  ['keer om',              'uturn'],
  ['doel bereikt',         'arrive'],
];

/** Onherkende tekst → 'unknown' (geen crash, gewoon geen specifieke links/rechts-cue). */
function detectTurnKind(instructionText: string): TurnKind {
  const haystack = instructionText.toLowerCase();
  for (const [pattern, kind] of TURN_KIND_PATTERNS) {
    if (haystack.includes(pattern)) return kind;
  }
  return 'unknown';
}

/**
 * Aantal haptische tikken per afslagtype (punt 5 van de opdracht): 2 voor
 * links, 3 voor rechts, 1 voor de rest. "Links"/"rechts" omvat hier ook de
 * scherpe en de "houd ... aan"-varianten — het gaat de loper om de kant, niet
 * om de scherpte van de bocht (die kant weet hij toch niet uit het aantal
 * tikken af te lezen).
 */
function hapticPulseCount(kind: TurnKind): number {
  switch (kind) {
    case 'left':
    case 'sharp-left':
    case 'keep-left':
      return 2;
    case 'right':
    case 'sharp-right':
    case 'keep-right':
      return 3;
    default:
      return 1;
  }
}

// ── Returnwaarden ─────────────────────────────────────────────────────────────

export interface NextTurn {
  /** Volledige instructietekst, inclusief eventuele straatnaam. */
  text: string;
  /** Afstand langs de route tot de afslag, in meters. */
  distanceM: number;
  kind: TurnKind;
}

export interface UseRouteCoachingReturn {
  /** Aanroepen bij elke GPS-update. */
  onGpsUpdate: (lat: number, lon: number, totalDistanceKm: number) => void;
  /** Wist alle uitgesproken/getrilde markeringen, de FollowState en de UI-state (gebruik bij sessie-reset). */
  reset: () => void;
  /** Eerstvolgende afslag, voor de afslagbalk op het actieve scherm. Null als er geen route of geen volgende afslag is. */
  nextTurn: NextTurn | null;
  /** Loopt de gebruiker van de route af? Voor de waarschuwing op het scherm. */
  isOffRoute: boolean;
  /** Resterende routeafstand in km, langs de route gemeten. */
  remainingKm: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRouteCoaching(
  enabled:      boolean,
  voiceEnabled: boolean,
  plannedRoute: PlannedRoute | undefined,
  voiceType:    VoiceType = 'female',
): UseRouteCoachingReturn {
  // ── Cursor-engine: eenmalig voorbewerkt per route-identiteit (useMemo
  // memoïseert al op referentiële gelijkheid van plannedRoute), voortgang
  // zit in een ref (geen React-state — die verandert bij elke GPS-update en
  // hoort dus niet rechtstreeks een re-render te triggeren, zie punt 9).
  const prepared = useMemo(
    () => (plannedRoute ? prepareRoute(plannedRoute) : null),
    [plannedRoute],
  );
  const preparedRef    = useRef<PreparedRoute | null>(null);
  const followStateRef = useRef<FollowState>(createFollowState());

  // ── Uitgesproken/getrilde markeringen, per instructie-index (de
  // `originalIndex` die de engine als nextInstructionIndex teruggeeft — dat
  // is de index in plannedRoute.instructions). ──────────────────────────────
  const preAnnouncedRef      = useRef<Set<number>>(new Set());
  const finalAnnouncedRef    = useRef<Set<number>>(new Set());
  const hapticFiredRef       = useRef<Set<number>>(new Set());
  const spokenMilestonesRef  = useRef<Set<25 | 50 | 75>>(new Set());
  // Losse markering voor de horlogemelding (punt 2 hieronder): ONAFHANKELIJK
  // van preAnnouncedRef, want die wordt alleen binnen de voiceEnabled-tak
  // gezet. Zonder eigen set zou een afslag geen melding krijgen zolang de
  // stem uit staat (of precies andersom: dubbel gemarkeerd raken t.o.v. de
  // stem-markering, met alle timinggrilligheid van dien).
  const routeNotifiedRef     = useRef<Set<number>>(new Set());

  // ── Off-route: rouleervariant (zelfde opzet als useHeartRateCoaching) +
  // tijd-cooldown voor de MELDING (zie OFFROUTE_ANNOUNCE_COOLDOWN_MS). ─────
  const offRouteVariantRef        = useRef(0);
  const lastOffRouteSpokenAtMsRef = useRef<number | null>(null);

  // ── Haptiek-timerketting: bewaard zodat we hem bij unmount kunnen opruimen. ──
  const hapticTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearHapticTimeouts = useCallback(() => {
    hapticTimeoutsRef.current.forEach(id => clearTimeout(id));
    hapticTimeoutsRef.current = [];
  }, []);

  // Sessie kan midden in een lopende trilketting worden afgebroken (de
  // gebruiker stopt de app/navigeert weg) — zonder deze cleanup zou een
  // timeout na unmount nog Haptics.impactAsync proberen aan te roepen.
  useEffect(() => () => clearHapticTimeouts(), [clearHapticTimeouts]);

  // Zonder deze cleanup zou een afslag- of van-de-route-af-melding op het
  // horloge blijven staan nadat de sessie al voorbij is (scherm verlaten
  // zonder expliciete reset(), bv. terugnavigeren). clearRouteNotification()
  // faalt zelf altijd stil; de lege .catch is hier alleen voor de vorm, in de
  // geest van hoe deze hook fire-and-forget-aanroepen behandelt.
  useEffect(() => () => { clearRouteNotification().catch(() => {}); }, []);

  const fireHapticTurnCue = useCallback((kind: TurnKind) => {
    const count = hapticPulseCount(kind);
    clearHapticTimeouts();
    for (let i = 0; i < count; i++) {
      const id = setTimeout(() => {
        try {
          // .catch: sommige toestellen/simulators ondersteunen haptiek niet —
          // dat mag nooit een crash geven, dit draait midden in een sessie.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        } catch {
          // Defensief: zelfs een synchrone fout (bv. module ontbreekt) mag
          // de sessie niet onderuithalen.
        }
      }, i * HAPTIC_TICK_INTERVAL_MS);
      hapticTimeoutsRef.current.push(id);
    }
  }, [clearHapticTimeouts]);

  // ── UI-snapshot: React-state, maar bewust NIET bij elke GPS-update
  // bijgewerkt (punt 9 — rendergedrag) ────────────────────────────────────
  // nextTurn/remainingKm veranderen bij elke GPS-update een klein beetje (de
  // afstand loopt af), en horen samen bij dezelfde returnwaarde. Alleen
  // nextTurn throttlen en remainingKm ongemoeid laten zou het doel missen:
  // het scherm dat deze hook gebruikt zou dan alsnog elke tick re-renderen
  // op remainingKm. Daarom throttlen we de hele snapshot in samenhang: elk
  // stuk krijgt zijn eigen "laatst weggeschreven waarde"-ref (afgerond op
  // dezelfde 10 m-stap) en we roepen de bijbehorende setState alleen aan als
  // die afgeronde waarde (of de instructietekst/het type/de off-route-vlag)
  // daadwerkelijk verandert.
  const [nextTurn, setNextTurn]       = useState<NextTurn | null>(null);
  const [isOffRoute, setIsOffRoute]   = useState(false);
  const [remainingKm, setRemainingKm] = useState(0);

  const lastTurnSnapshotRef  = useRef<{ steppedM: number; text: string; kind: TurnKind } | null>(null);
  const lastRemainingStepRef = useRef<number | null>(null);
  const lastIsOffRouteRef    = useRef(false);

  /** Zet alle interne bijhoud-state + UI-state terug naar de starttoestand. */
  const resetInternal = useCallback(() => {
    followStateRef.current = createFollowState();
    preAnnouncedRef.current.clear();
    finalAnnouncedRef.current.clear();
    hapticFiredRef.current.clear();
    spokenMilestonesRef.current.clear();
    routeNotifiedRef.current.clear();
    offRouteVariantRef.current = 0;
    lastOffRouteSpokenAtMsRef.current = null;
    clearHapticTimeouts();
    // Geen route (meer) actief: haal een eventueel zichtbare afslag- of
    // van-de-route-af-melding van het horloge weg (punt 2 van de opdracht).
    // Fire-and-forget, faalt zelf altijd stil.
    clearRouteNotification().catch(() => {});

    lastTurnSnapshotRef.current = null;
    lastRemainingStepRef.current = null;
    lastIsOffRouteRef.current = false;
    setNextTurn(null);
    setIsOffRoute(false);
    setRemainingKm(0);
  }, [clearHapticTimeouts]);

  const reset = useCallback(() => {
    resetInternal();
  }, [resetInternal]);

  const onGpsUpdate = useCallback((lat: number, lon: number, _totalDistanceKm: number) => {
    // _totalDistanceKm: niet meer gebruikt — remainingKm/progress komen nu
    // van de engine (afstand LANGS DE ROUTE, nauwkeuriger, klopt ook als de
    // loper een stuk afsnijdt). Het argument blijft bestaan zodat de
    // signatuur (en dus de aanroep in app/session/active.tsx) ongewijzigd
    // blijft.

    if (!enabled || !prepared) {
      // Geen route (meer), of coaching uitgezet: niets te volgen. Laat geen
      // stale afslagbalk/waarschuwing/trilketting "hangen" van een vorige route.
      if (preparedRef.current !== null) {
        preparedRef.current = null;
        resetInternal();
      }
      return;
    }

    // Nieuwe route-identiteit (andere dan de vorige update)? Volledige
    // reset — anders lopen instructie-indices/cursorpositie van de vorige
    // route door in de nieuwe.
    if (preparedRef.current !== prepared) {
      resetInternal();
      preparedRef.current = prepared;
      // Nieuwe route actief: kanaal voor de horlogemeldingen vast klaarzetten
      // (punt 2 van de opdracht) — idempotent en fire-and-forget, faalt zelf
      // altijd stil (zie routeNotificationService.ts).
      prepareRouteNotifications().catch(() => {});
    }

    const update = updateFollowState(prepared, followStateRef.current, lat, lon);
    followStateRef.current = update.state;

    // ── Eerstvolgende afslag: tekst/afstand/type bepalen ──────────────────
    let hasNext    = false;
    let nextIdx    = -1;
    let turnText   = '';
    let turnKind: TurnKind = 'unknown';
    let turnDistM  = 0;
    if (update.nextInstructionIndex !== null && update.distanceToNextTurnM !== null) {
      const instr = plannedRoute?.instructions[update.nextInstructionIndex];
      if (instr) {
        hasNext   = true;
        nextIdx   = update.nextInstructionIndex;
        turnText  = instr.text;
        turnKind  = detectTurnKind(turnText);
        turnDistM = update.distanceToNextTurnM;
      }
    }

    // ── UI-snapshot bijwerken (ALTIJD, ongeacht voiceEnabled — punt 8) ────
    if (hasNext) {
      const steppedM = Math.round(turnDistM / RENDER_DISTANCE_STEP_M) * RENDER_DISTANCE_STEP_M;
      const prevSnap = lastTurnSnapshotRef.current;
      const turnChanged = !prevSnap
        || prevSnap.steppedM !== steppedM
        || prevSnap.text !== turnText
        || prevSnap.kind !== turnKind;
      if (turnChanged) {
        lastTurnSnapshotRef.current = { steppedM, text: turnText, kind: turnKind };
        setNextTurn({ text: turnText, distanceM: turnDistM, kind: turnKind });
      }
    } else if (lastTurnSnapshotRef.current !== null) {
      lastTurnSnapshotRef.current = null;
      setNextTurn(null);
    }

    const steppedRemainingKm = Math.round(update.remainingKm / RENDER_REMAINING_STEP_KM) * RENDER_REMAINING_STEP_KM;
    if (lastRemainingStepRef.current !== steppedRemainingKm) {
      lastRemainingStepRef.current = steppedRemainingKm;
      setRemainingKm(update.remainingKm);
    }

    if (lastIsOffRouteRef.current !== update.isOffRoute) {
      lastIsOffRouteRef.current = update.isOffRoute;
      setIsOffRoute(update.isOffRoute);
    }

    // ── Haptische afslagcue (~50 m) — ONAFHANKELIJK van voiceEnabled ─────
    // Dit is bewust het stille kanaal: moet ook werken als de gebruiker de
    // stem heeft uitgezet (telefoon in zak/armband, geen koptelefoon).
    if (hasNext && turnDistM <= HAPTIC_TRIGGER_M && !hapticFiredRef.current.has(nextIdx)) {
      hapticFiredRef.current.add(nextIdx);
      fireHapticTurnCue(turnKind);
    }

    // ── Afslagmelding naar het horloge (~150 m) — ONAFHANKELIJK van
    // voiceEnabled, net als de haptische cue hierboven: dit is het stille
    // kanaal dat juist moet werken als de stem uit staat. Alleen op het
    // VOORaankondigingsmoment, nooit ook nog eens bij de eindaankondiging —
    // twee meldingen (en dus twee trilpulsen op de pols) per afslag zouden
    // het signaal juist waardeloos maken. Losse markering (routeNotifiedRef)
    // i.p.v. preAnnouncedRef: die laatste wordt alleen binnen de
    // voiceEnabled-tak gezet. De instelling wordt hier rechtstreeks uit de
    // store gelezen (net als voiceService.ts met isPremium doet), zodat de
    // hooksignatuur niet hoeft te wijzigen.
    if (hasNext && turnDistM <= PRE_ANNOUNCE_M && !routeNotifiedRef.current.has(nextIdx)) {
      if (useAppStore.getState().routeNotificationsEnabled) {
        routeNotifiedRef.current.add(nextIdx);
        showTurnNotification(turnText, turnDistM, turnKind).catch(() => {});
      }
    }

    // ── Gesproken afslagaankondigingen (voor/eind) ────────────────────────
    // De "al aangekondigd"-markering gebeurt hier BINNEN de voiceEnabled-tak
    // (samen met het spreken): zie de toelichting bovenaan dit bestand.
    if (hasNext && voiceEnabled) {
      if (turnDistM <= PRE_ANNOUNCE_M && !preAnnouncedRef.current.has(nextIdx)) {
        preAnnouncedRef.current.add(nextIdx);
        const roundedDistM = Math.round(turnDistM / SPEECH_DISTANCE_ROUND_STEP_M) * SPEECH_DISTANCE_ROUND_STEP_M;
        voiceService.speakPhrases(navUtterance(turnText, roundedDistM), voiceType);
      } else if (turnDistM <= FINAL_ANNOUNCE_M && !finalAnnouncedRef.current.has(nextIdx)) {
        finalAnnouncedRef.current.add(nextIdx);
        voiceService.speakPhrases(navUtterance(turnText), voiceType);
      }
    }

    // ── Van-de-route-af / terug-op-route ──────────────────────────────────
    // De tijdscooldown (OFFROUTE_ANNOUNCE_COOLDOWN_MS) geldt nu voor BEIDE
    // kanalen samen — gesproken melding en horlogemelding delen dezelfde
    // lastOffRouteSpokenAtMsRef, zodat er geen tweede, eigen cooldown komt
    // (punt 2 van de opdracht: "hergebruik die bestaande cooldown-logica").
    // De cooldown-klok tikt alleen door als er ook echt iets gemeld wordt op
    // minstens één kanaal — staan beide uit, dan gebeurt hier niets, ook niet
    // met de tijdstempel.
    if (update.justWentOffRoute) {
      const nowMs = Date.now();
      const last  = lastOffRouteSpokenAtMsRef.current;
      const cooldownExpired = last === null || nowMs - last >= OFFROUTE_ANNOUNCE_COOLDOWN_MS;
      const notifyWatch = useAppStore.getState().routeNotificationsEnabled;
      if (cooldownExpired && (voiceEnabled || notifyWatch)) {
        lastOffRouteSpokenAtMsRef.current = nowMs;
        if (voiceEnabled) {
          const variant = offRouteVariantRef.current;
          offRouteVariantRef.current += 1;
          voiceService.speakPhrases(offRouteUtterance(variant), voiceType);
        }
        if (notifyWatch) {
          showOffRouteNotification().catch(() => {});
        }
      }
    }
    if (voiceEnabled && update.justReturnedToRoute) {
      voiceService.speakPhrases(backOnRouteUtterance(), voiceType);
    }

    // ── Voortgangsmijlpalen (25/50/75%), nu op afstand LANGS DE ROUTE ─────
    if (voiceEnabled) {
      for (const [pct, pctId] of MILESTONES) {
        if (spokenMilestonesRef.current.has(pctId)) continue;
        if (update.progress < pct) continue;
        voiceService.speakPhrases(milestoneUtterance(pctId, update.remainingKm), voiceType);
        spokenMilestonesRef.current.add(pctId);
      }
    }
  }, [enabled, voiceEnabled, voiceType, prepared, plannedRoute, resetInternal, fireHapticTurnCue]);

  return { onGpsUpdate, reset, nextTurn, isOffRoute, remainingKm };
}
