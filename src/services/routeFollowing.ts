/**
 * routeFollowing
 *
 * Zuivere rekenmodule die bijhoudt waar een loper zich bevindt ten opzichte
 * van een geplande route (`PlannedRoute` uit `routeService.ts`). Geen React,
 * geen hooks, geen state buiten wat de aanroeper zelf doorgeeft.
 *
 * ── Het probleem dat dit bestand oplost ─────────────────────────────────────
 * De oude aanpak (in `useRouteCoaching.ts`) doorloopt bij elke GPS-update
 * ALLE instructies en spreekt elke instructie uit waarvan het waypoint binnen
 * 150 m ligt, zonder volgorde en zonder "ben ik hier al voorbij"-besef. Bij
 * een outAndBack-route wordt de terugweg opgebouwd als de omgekeerde heenweg
 * (zie `generateOutAndBackRoute`): het LAATSTE waypoint van de route valt dan
 * samen met het startpunt. Zodra de loper begint te lopen, liggen de
 * waypoints van het EINDE van de terugweg dus ook al binnen 150 m van de
 * start — die instructies worden dan meteen uitgesproken en voorgoed als
 * "gedaan" weggestreept, met een stille coach op de terugweg als gevolg. Bij
 * een lusroute gebeurt hetzelfde met "Doel bereikt".
 *
 * De oplossing hier is een VOORTGANGSCURSOR: een positie op de route
 * (segmentindex + fractie), die alleen vooruit kan schuiven en die bij elke
 * update slechts in een begrensd venster rond zijn vorige positie naar de
 * dichtstbijzijnde routepositie zoekt (zie LOOKAHEAD_M/LOOKBACK_M). Dat
 * venster is precies wat voorkomt dat de cursor naar het geometrisch
 * identieke maar veel latere stuk van de route springt.
 *
 * Gebruik:
 *   const prepared = prepareRoute(plannedRoute);   // eenmalig, bij ontvangst van de route
 *   let follow = createFollowState();              // eenmalig, bij start van de sessie
 *   // bij elke GPS-update:
 *   const update = updateFollowState(prepared, follow, lat, lon);
 *   follow = update.state;
 */

import { haversineMeters, PlannedRoute, RouteWaypoint } from './routeService';

// ── Constanten ────────────────────────────────────────────────────────────────

/**
 * Hoever de cursor vooruit mag zoeken naar de dichtstbijzijnde routepositie,
 * in meter. GPS-updates komen doorgaans elke paar seconden; op looptempo
 * (~3 m/s) legt een loper daartussen hooguit enkele tientallen meters af.
 * 300 m is ruim voldoende marge daarvoor, maar klein genoeg om nooit het
 * geometrisch identieke stuk aan het (verre) einde van een outAndBack-route
 * te kunnen bereiken — dát begrensde venster is de kern van de fix.
 */
const LOOKAHEAD_M = 300;

/**
 * Kleine terugkijkmarge (in meter langs de route) zodat GPS-ruis niet meteen
 * een net gepasseerd punt buiten het zoekvenster duwt. De cursor zelf mag
 * hierdoor nooit daadwerkelijk terugspringen (zie de max()-clamp in
 * `updateFollowState`) — alleen het zoekvenster kijkt iets terug.
 */
const LOOKBACK_M = 50;

/** Afstand tot de routelijn waarboven een update meetelt als "mogelijk van de route af". */
const OFF_ROUTE_ENTER_M = 40;

/**
 * Aantal opeenvolgende updates boven OFF_ROUTE_ENTER_M voordat we echt
 * off-route melden. Eén GPS-uitschieter (bv. een sprong door reflecties
 * tussen gebouwen) mag geen melding veroorzaken.
 */
const OFF_ROUTE_CONSECUTIVE = 3;

/**
 * Afstand tot de routelijn waaronder we weer als "op de route" gelden.
 * Bewust lager dan OFF_ROUTE_ENTER_M (hysterese): met één gedeelde drempel
 * zou de status heen en weer klapperen zodra een loper precies op de grens
 * loopt. Door in en uit verschillende drempels te gebruiken, zit daar altijd
 * een marge van 15 m tussen.
 */
const OFF_ROUTE_EXIT_M = 25;

/**
 * Kleine tolerantie (meter langs de route) om afrondingsfouten bij het
 * bepalen van de eerstvolgende nog niet gepasseerde instructie op te vangen.
 */
const INSTRUCTION_EPSILON_M = 0.5;

/**
 * Tolerantie (meter) om twee kandidaat-segmenten in het zoekvenster als
 * "even goed" te behandelen. Bij een outAndBack-route ligt elk stuk van de
 * heenweg geometrisch exact op dezelfde lijn als het bijbehorende stuk van
 * de terugweg (het is immers dezelfde weg, retour). Zodra de loper minder
 * dan LOOKAHEAD_M van het keerpunt verwijderd is, vallen dat heenweg-stuk en
 * zijn "tweeling" op de terugweg dus samen in hetzelfde zoekvenster, allebei
 * op (nagenoeg) afstand 0 van de huidige positie.
 *
 * Bij zo'n gelijkspel kiezen we, onder de kandidaten die binnen deze marge
 * even goed passen, altijd eerst een NIET-achterwaartse kandidaat (positie
 * ≥ de huidige cursor) — en daarvan de dichtstbijzijnde. Twee andere opties
 * zijn bewust afgewezen:
 *  - "Kies de verste kandidaat vooruit" laat de cursor bij het binnenkomen
 *    van het venster meteen naar het (nog niet bereikte!) terugweg-stuk
 *    springen, zodra dat stuk geometrisch binnen bereik komt — exact de
 *    oorspronkelijke bug, alleen dan een stuk vóór het keerpunt in plaats
 *    van bij de start.
 *  - "Kies altijd de dichtstbijzijnde, ongeacht richting" laat de cursor
 *    net vóór het keerpunt vastlopen: het net-gepasseerde heenweg-segment
 *    blijft daar een tijdlang toevallig net iets dichter bij de (bevroren)
 *    cursor liggen dan het juiste terugweg-segment, tot het z'n eigen
 *    geldige bereik uit loopt — waarna de cursor in één klap moet inhalen
 *    en tussenliggende instructies overslaat.
 * Door onder de gelijkspelers een niet-achterwaartse kandidaat te
 * verkiezen én daarvan de kleinste stap te nemen, schuift de cursor de hele
 * overgang door het keerpunt in kleine, monotone stapjes op — precies de
 * werkelijke, continue beweging van de loper.
 */
const TIE_EPSILON_M = 1;

const DEG2RAD = Math.PI / 180;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Eén instructie, herleid naar haar positie langs de route (in meter vanaf de start). */
interface PreparedInstruction {
  /** Index in de oorspronkelijke `plannedRoute.instructions`-array. */
  originalIndex: number;
  waypointIndex: number;
}

/** Voorbewerkte route: eenmalig berekend, daarna hergebruikt bij elke GPS-update. */
export interface PreparedRoute {
  waypoints: RouteWaypoint[];
  /** Aantal lijnsegmenten (`waypoints.length - 1`), 0 als de route te kort is om te volgen. */
  segmentCount: number;
  /** Cumulatieve afstand in meter tot elk waypoint, langs de route gemeten. Lengte gelijk aan `waypoints.length`. */
  cumulativeDistances: number[];
  /** Totale routelengte in meter (== laatste waarde van `cumulativeDistances`). */
  totalDistanceM: number;
  /** Instructies gesorteerd op positie langs de route, met behoud van hun oorspronkelijke index. */
  instructionsByWaypoint: PreparedInstruction[];
}

/** Veranderlijke voortgangstoestand. Behandel als onveranderlijk: geef bij elke update een nieuw object terug. */
export interface FollowState {
  /** Segment waarin de cursor zich bevindt: tussen `waypoints[segmentIndex]` en `waypoints[segmentIndex + 1]`. */
  segmentIndex: number;
  /** Fractie (0..1) van de cursorpositie binnen dat segment. */
  segmentT: number;
  /** Cumulatieve afstand van de cursor langs de route, in meter (afgeleid van segmentIndex/segmentT, hier bewaard voor snelle vergelijking). */
  distanceAlongRouteM: number;
  /** Of de loper op dit moment als "van de route af" geldt. */
  isOffRoute: boolean;
  /** Aantal opeenvolgende updates boven OFF_ROUTE_ENTER_M, voor de hysterese bij het ingaan van off-route. */
  offRouteStreak: number;
}

export interface FollowUpdate {
  state: FollowState;
  /** Kortste afstand van de loper tot de routelijn, in meters. */
  distanceToRouteM: number;
  /** Loopt de gebruiker op dit moment van de route af? */
  isOffRoute: boolean;
  /** True op precies de update waarin off-route ingaat (voor een eenmalige melding). */
  justWentOffRoute: boolean;
  /** True op precies de update waarin de gebruiker weer op de route komt. */
  justReturnedToRoute: boolean;
  /** Index in plannedRoute.instructions van de eerstvolgende nog niet gepasseerde instructie, of null. */
  nextInstructionIndex: number | null;
  /** Afstand LANGS DE ROUTE tot die instructie in meters, of null. */
  distanceToNextTurnM: number | null;
  /** Resterende routeafstand in km, langs de route gemeten. */
  remainingKm: number;
  /** Voortgang 0..1 langs de route. */
  progress: number;
}

// ── Interne helpers ───────────────────────────────────────────────────────────

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function isFiniteCoord(wp: RouteWaypoint | undefined | null): wp is RouteWaypoint {
  return !!wp && Number.isFinite(wp.lat) && Number.isFinite(wp.lon);
}

/**
 * Projecteert punt (lat, lon) op het lijnsegment a→b en geeft de projectiefactor
 * t ∈ [0,1] en het geprojecteerde lat/lon-punt terug.
 *
 * Gebruikt een lokale vlakke (equirectangulaire) benadering: lengtegraad
 * wordt geschaald met cos(breedtegraad) zodat 1 "graad-eenheid" in beide
 * richtingen ongeveer gelijk staat aan dezelfde afstand in meter. Dat is hier
 * ruim voldoende nauwkeurig — een routesegment is hooguit enkele honderden
 * meters lang, en over zo'n korte afstand is de vervorming van een platte
 * benadering verwaarloosbaar. Bovendien wordt deze benadering alleen gebruikt
 * om t te bepalen; de uiteindelijke afstand wordt daarna alsnog met de echte
 * `haversineMeters` berekend op het teruggeprojecteerde lat/lon-punt, dus een
 * kleine fout in t vertaalt zich hooguit in een verwaarloosbare fout in de
 * gekozen positie op het segment, niet in de gerapporteerde afstand.
 */
function projectOntoSegment(
  lat: number, lon: number,
  aLat: number, aLon: number,
  bLat: number, bLon: number,
): { t: number; projLat: number; projLon: number } {
  const refLat = ((aLat + bLat) / 2) * DEG2RAD;
  const cosLat = Math.cos(refLat) || 1e-9; // voorkomt delen door 0; irrelevant voor hardlooproutes (niet nabij de polen)

  const ax = aLon * cosLat, ay = aLat;
  const bx = bLon * cosLat, by = bLat;
  const px = lon * cosLat, py = lat;

  const abx = bx - ax, aby = by - ay;
  const lenSq = abx * abx + aby * aby;

  let t = 0;
  if (lenSq > 0) {
    const apx = px - ax, apy = py - ay;
    t = (apx * abx + apy * aby) / lenSq;
  }
  t = clamp(t, 0, 1);

  return {
    t,
    projLat: aLat + t * (bLat - aLat),
    projLon: aLon + t * (bLon - aLon),
  };
}

/**
 * Zoekt het laatste segment waarvan het startpunt (cumulatieve afstand) niet
 * verder ligt dan `distM`. Binaire zoektocht: `cumulativeDistances` is per
 * constructie niet-dalend.
 */
function findSegmentForDistance(prepared: PreparedRoute, distM: number): number {
  const { cumulativeDistances, segmentCount } = prepared;
  if (segmentCount <= 0) return 0;

  let lo = 0;
  let hi = segmentCount - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumulativeDistances[mid] <= distM) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/** Neutrale update voor de robuustheids-gevallen (te korte route, ongeldige coördinaten). State blijft ongewijzigd. */
function neutralUpdate(state: FollowState): FollowUpdate {
  return {
    state,
    distanceToRouteM: 0,
    isOffRoute: state.isOffRoute,
    justWentOffRoute: false,
    justReturnedToRoute: false,
    nextInstructionIndex: null,
    distanceToNextTurnM: null,
    remainingKm: 0,
    progress: 0,
  };
}

// ── Publieke functies ─────────────────────────────────────────────────────────

/** Verwerkt een PlannedRoute eenmalig tot de vorm die `updateFollowState` nodig heeft. */
export function prepareRoute(route: PlannedRoute): PreparedRoute {
  const waypoints = Array.isArray(route?.waypoints) ? route.waypoints : [];
  const n = waypoints.length;
  const segmentCount = Math.max(0, n - 1);

  // Cumulatieve afstand per waypoint. Ongeldige coördinaten (NaN/Infinity,
  // kan in theorie uit een kapotte routeresponse komen) leveren een
  // segmentlengte van 0 op in plaats van een crash of een NaN die zich door
  // de rest van de berekening voortplant.
  const cumulativeDistances: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    let segM = 0;
    if (isFiniteCoord(a) && isFiniteCoord(b)) {
      const d = haversineMeters(a.lat, a.lon, b.lat, b.lon);
      if (Number.isFinite(d)) segM = d;
    }
    cumulativeDistances[i] = cumulativeDistances[i - 1] + segM;
  }
  const totalDistanceM = n > 0 ? cumulativeDistances[n - 1] : 0;

  const rawInstructions = Array.isArray(route?.instructions) ? route.instructions : [];
  const maxWaypointIndex = Math.max(0, n - 1);
  const instructionsByWaypoint: PreparedInstruction[] = rawInstructions
    .map((instr, originalIndex) => ({
      originalIndex,
      waypointIndex: clamp(
        Number.isFinite(instr?.waypointIndex) ? instr.waypointIndex : 0,
        0,
        maxWaypointIndex,
      ),
    }))
    // Sorteren op positie langs de route: zo kunnen we bij elke update
    // simpelweg de eerste nog niet gepasseerde instructie zoeken.
    .sort((a, b) => a.waypointIndex - b.waypointIndex);

  return { waypoints, segmentCount, cumulativeDistances, totalDistanceM, instructionsByWaypoint };
}

/** Starttoestand: cursor op het begin van de route, op-route. */
export function createFollowState(): FollowState {
  return {
    segmentIndex: 0,
    segmentT: 0,
    distanceAlongRouteM: 0,
    isOffRoute: false,
    offRouteStreak: 0,
  };
}

/** Verwerkt één GPS-positie tegen de voorbewerkte route en geeft de nieuwe voortgangstoestand + afgeleide info terug. */
export function updateFollowState(
  prepared: PreparedRoute,
  state: FollowState,
  lat: number,
  lon: number,
): FollowUpdate {
  // Robuustheid: route met 0/1 waypoints of ongeldige invoercoördinaten kan
  // hieronder geen zinnig resultaat opleveren — geef een neutrale update
  // terug in plaats van te crashen (dit draait midden in een hardloopsessie).
  if (prepared.segmentCount < 1 || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return neutralUpdate(state);
  }

  const clampedSegIndex = clamp(state.segmentIndex, 0, prepared.segmentCount - 1);
  const cursorDistM = clamp(state.distanceAlongRouteM, 0, prepared.totalDistanceM);

  // ── Begrensd zoekvenster rond de cursor ────────────────────────────────
  // Dit venster (LOOKBACK_M terug, LOOKAHEAD_M vooruit — beide gemeten in
  // afstand LANGS de route, niet hemelsbreed) is de kern van de fix voor de
  // outAndBack-bug: het einde van de terugweg ligt duizenden meters verderop
  // langs de route, dus dat segment komt hier domweg nooit in het venster
  // terecht, ook al liggen de coördinaten geometrisch vlak bij de start.
  const windowStartM = Math.max(0, cursorDistM - LOOKBACK_M);
  const windowEndM = Math.min(prepared.totalDistanceM, cursorDistM + LOOKAHEAD_M);
  const loSeg = findSegmentForDistance(prepared, windowStartM);
  const hiSeg = findSegmentForDistance(prepared, windowEndM);

  // Eerste doorgang: projecteer op elk segment in het venster en verzamel de
  // kandidaten. (Het venster is klein — enkele tot enkele tientallen
  // segmenten — dus twee doorgangen hierover zijn verwaarloosbaar duur.)
  interface Candidate { seg: number; t: number; dist: number; distAlongM: number; }
  const candidates: Candidate[] = [];
  for (let j = loSeg; j <= hiSeg; j++) {
    const a = prepared.waypoints[j];
    const b = prepared.waypoints[j + 1];
    if (!isFiniteCoord(a) || !isFiniteCoord(b)) continue;

    const { t, projLat, projLon } = projectOntoSegment(lat, lon, a.lat, a.lon, b.lat, b.lon);
    const d = haversineMeters(lat, lon, projLat, projLon);
    if (!Number.isFinite(d)) continue;

    const segStartM = prepared.cumulativeDistances[j];
    const segEndM = prepared.cumulativeDistances[j + 1];
    const distAlongM = segStartM + t * (segEndM - segStartM);
    candidates.push({ seg: j, t, dist: d, distAlongM });
  }

  if (candidates.length === 0) {
    // Kon geen enkel segment in het venster beoordelen (bv. alle
    // coördinaten in het venster ongeldig) — neutraal, niet crashen.
    return neutralUpdate(state);
  }

  // Tweede doorgang: bepaal het WERKELIJKE minimum over het hele venster, en
  // kies daarna — onder alle kandidaten die daar binnen TIE_EPSILON_M van
  // zitten — met voorrang voor kandidaten die niet-achterwaarts zijn
  // (distAlongM ≥ cursorDistM), en daaronder de dichtstbijzijnde (de
  // kleinste stap vooruit). Alleen als ECHT geen enkele gelijkwaardige
  // kandidaat vooruit ligt, valt de keuze terug op de dichtstbijzijnde
  // achterwaartse kandidaat (die de cursor toch nooit terugzet, zie de
  // clamp verderop).
  //
  // Waarom "dichtstbij-vooruit" en niet "verst vooruit"? Bij een
  // outAndBack-route ligt, zodra de loper minder dan LOOKAHEAD_M van het
  // keerpunt verwijderd is, het laatste stuk heenweg geometrisch exact op
  // dezelfde lijn als het eerste stuk terugweg — beide op afstand ~0 van de
  // huidige positie. "Verst vooruit" zou de cursor dan onmiddellijk naar het
  // (nog niet bereikte!) terugweg-stuk laten springen. Door bij een
  // gelijkspel altijd de DICHTSTBIJZIJNDE (kleinste) niet-achterwaartse
  // kandidaat te kiezen, schuift de cursor per update maximaal een klein
  // stukje op — precies zoals de werkelijke, continue beweging van de loper
  // — en pas wanneer de loper het keerpunt daadwerkelijk gepasseerd is,
  // wordt het terugweg-stuk de dichtstbijzijnde (en dus gekozen) kandidaat.
  //
  // Belangrijk: de tolerantie wordt steeds tegen het ene vaste minimum over
  // het hele venster getoetst, niet tegen de zojuist gekozen kandidaat. Zou
  // je telkens tegen de laatst gekozen kandidaat vergelijken, dan kan de
  // keuze in kleine stapjes van <1 m over het hele venster "wegdrijven" (een
  // cascade van opeenvolgende geldige tie-breaks) — met een vast minimum als
  // ijkpunt kan dat niet gebeuren.
  let minDist = Infinity;
  for (const c of candidates) {
    if (c.dist < minDist) minDist = c.dist;
  }
  const tieThreshold = minDist + TIE_EPSILON_M;

  let bestForward: Candidate | null = null;
  let bestBehind: Candidate | null = null;
  for (const c of candidates) {
    if (c.dist > tieThreshold) continue; // buiten de tolerantie: geen serieuze kandidaat
    if (c.distAlongM >= cursorDistM) {
      if (bestForward === null || c.distAlongM < bestForward.distAlongM) bestForward = c;
    } else {
      if (bestBehind === null || c.distAlongM > bestBehind.distAlongM) bestBehind = c;
    }
  }
  // Eén van beide is altijd gevonden: de kandidaat die het vaste minimum
  // realiseert, voldoet per definitie aan dist <= tieThreshold.
  const chosen = (bestForward ?? bestBehind)!;

  const bestDist = chosen.dist;
  const bestSeg = chosen.seg;
  const bestT = chosen.t;
  const bestDistAlongM = chosen.distAlongM;

  // De cursor mag nooit vóór zijn vorige waarde terechtkomen. Normaliter is
  // dit door het begrensde venster hierboven al gegarandeerd; deze clamp is
  // een expliciet tweede vangnet tegen kleine terugval door GPS-ruis binnen
  // de LOOKBACK_M-marge.
  const newDistAlongM = Math.max(bestDistAlongM, cursorDistM);
  const cursorMovedForward = newDistAlongM === bestDistAlongM;
  const newSeg = cursorMovedForward ? bestSeg : clampedSegIndex;
  const newT = cursorMovedForward ? bestT : state.segmentT;

  // ── Off-route met hysterese ─────────────────────────────────────────────
  // Twee verschillende drempels (ENTER hoger dan EXIT) plus een minimum
  // aantal opeenvolgende updates om in te gaan, voorkomen dat de status heen
  // en weer klappert wanneer de loper precies op de grens loopt, en dat één
  // GPS-uitschieter meteen een melding veroorzaakt.
  let isOffRoute = state.isOffRoute;
  let offRouteStreak = state.offRouteStreak;
  let justWentOffRoute = false;
  let justReturnedToRoute = false;

  if (!isOffRoute) {
    if (bestDist > OFF_ROUTE_ENTER_M) {
      offRouteStreak += 1;
      if (offRouteStreak >= OFF_ROUTE_CONSECUTIVE) {
        isOffRoute = true;
        justWentOffRoute = true;
        offRouteStreak = 0;
      }
    } else {
      offRouteStreak = 0;
    }
  } else if (bestDist < OFF_ROUTE_EXIT_M) {
    isOffRoute = false;
    justReturnedToRoute = true;
    offRouteStreak = 0;
  }

  // ── Eerstvolgende instructie ────────────────────────────────────────────
  let nextInstructionIndex: number | null = null;
  let distanceToNextTurnM: number | null = null;
  for (const instr of prepared.instructionsByWaypoint) {
    const wpDistM = prepared.cumulativeDistances[instr.waypointIndex] ?? 0;
    if (wpDistM >= newDistAlongM - INSTRUCTION_EPSILON_M) {
      nextInstructionIndex = instr.originalIndex;
      distanceToNextTurnM = Math.max(0, wpDistM - newDistAlongM);
      break;
    }
  }

  const remainingKm = Math.max(0, prepared.totalDistanceM - newDistAlongM) / 1000;
  const progress = prepared.totalDistanceM > 0
    ? clamp(newDistAlongM / prepared.totalDistanceM, 0, 1)
    : 0;

  const newState: FollowState = {
    segmentIndex: newSeg,
    segmentT: newT,
    distanceAlongRouteM: newDistAlongM,
    isOffRoute,
    offRouteStreak,
  };

  return {
    state: newState,
    distanceToRouteM: bestDist,
    isOffRoute,
    justWentOffRoute,
    justReturnedToRoute,
    nextInstructionIndex,
    distanceToNextTurnM,
    remainingKm,
    progress,
  };
}
