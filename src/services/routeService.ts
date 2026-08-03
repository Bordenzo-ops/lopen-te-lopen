/**
 * routeService
 *
 * Genereert hardlooproutes via de OpenRouteService API.
 *
 * Ondersteunt twee types:
 *  - loop       : rondroute die terug naar het startpunt loopt
 *  - outAndBack : heen-en-terug (halve afstand heen, zelfde weg terug)
 *
 * Documentatie: https://openrouteservice.org/dev/#/api-docs/v2/directions
 *
 * De ORS-sleutel zit niet meer in de app (WP3): alle calls lopen via de
 * Supabase edge function `route`, die de sleutel serverside bewaart en de
 * gebruiker via JWT verifieert. Zonder Supabase-configuratie of sessie kan de
 * routeplanner daarom niet werken en faalt hij netjes met een nette melding.
 */

import { getFunctionsBaseUrl } from './supabaseClient';
import { ensureAnonymousSession, getCurrentSession } from './authService';

// ── Config ────────────────────────────────────────────────────────────────────

/** Max. wachttijd op de ORS-routing API voordat we opgeven */
const ORS_TIMEOUT_MS = 20000;

/** Melding bij time-out of netwerkfout (zelfde copy, want de gebruiker kan het toch niet onderscheiden) */
const ORS_TIMEOUT_MESSAGE =
  'Route plannen lukt nu niet. Controleer je verbinding of start zonder route.';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouteWaypoint {
  lat: number;
  lon: number;
}

export interface RouteInstruction {
  text: string;
  distanceToPointM: number;
  waypointIndex: number;
}

export interface PlannedRoute {
  type: 'loop' | 'outAndBack';
  waypoints: RouteWaypoint[];
  instructions: RouteInstruction[];
  totalDistanceKm: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Haversine afstand in meters */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
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

/** Berekent een punt op `distanceKm` km in `bearingDeg` richting vanaf lat/lon */
function destinationPoint(
  lat: number,
  lon: number,
  distanceKm: number,
  bearingDeg: number,
): RouteWaypoint {
  const R  = 6371;
  const δ  = distanceKm / R;
  const θ  = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) +
    Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
  );
  return { lat: (φ2 * 180) / Math.PI, lon: (λ2 * 180) / Math.PI };
}

/**
 * Vertaalt ORS-instructies naar leesbaar Nederlands.
 * ORS geeft soms Engelse instructies terug ondanks language: 'nl'.
 */
function toNl(text: string): string {
  return text
    .replace(/^Head\s+north/i,           'Loop naar het noorden')
    .replace(/^Head\s+south/i,           'Loop naar het zuiden')
    .replace(/^Head\s+east/i,            'Loop naar het oosten')
    .replace(/^Head\s+west/i,            'Loop naar het westen')
    .replace(/^Head\s+northeast/i,       'Loop naar het noordoosten')
    .replace(/^Head\s+northwest/i,       'Loop naar het noordwesten')
    .replace(/^Head\s+southeast/i,       'Loop naar het zuidoosten')
    .replace(/^Head\s+southwest/i,       'Loop naar het zuidwesten')
    .replace(/^Head\s/i,                 'Loop ')
    .replace(/\bTurn sharp left\b/i,     'Sla scherp links af')
    .replace(/\bTurn sharp right\b/i,    'Sla scherp rechts af')
    .replace(/\bTurn slight left\b/i,    'Houd links aan')
    .replace(/\bTurn slight right\b/i,   'Houd rechts aan')
    .replace(/\bTurn left\b/i,           'Sla links af')
    .replace(/\bTurn right\b/i,          'Sla rechts af')
    .replace(/\bKeep left\b/i,           'Houd links aan')
    .replace(/\bKeep right\b/i,          'Houd rechts aan')
    .replace(/\bContinue straight\b/i,   'Ga rechtdoor')
    .replace(/\bArrive at destination\b/i, 'Doel bereikt')
    .replace(/\bon the left\b/i,         'aan de linkerkant')
    .replace(/\bon the right\b/i,        'aan de rechterkant')
    .trim();
}

/**
 * Draait de afslagrichting in een reeds naar het Nederlands vertaalde
 * instructietekst om (links↔rechts, ook in "...kant"-vorm).
 *
 * Nodig voor de terugweg van een heen-en-terug-route (zie
 * generateOutAndBackRoute): de terugweg-instructies worden letterlijk
 * gekopieerd van de heenweg, maar waar je op de heenweg links afsloeg,
 * sla je op de terugweg juist rechts af (en omgekeerd).
 *
 * Eén enkele regex-pass met een callback i.p.v. twee opeenvolgende
 * .replace()-aanroepen (links→rechts, dan rechts→links) — dat laatste zou
 * alles weer terugdraaien omdat de tweede vervanging ook de zojuist
 * geschreven resultaten van de eerste zou raken. Vergelijkbaar met de
 * volgorde-gevoeligheid in toNl() hierboven, maar hier opgelost door alle
 * matches in één keer en onafhankelijk van elkaar te beoordelen.
 *
 * \b op "links"/"rechts" voorkomt dat "rechtdoor" (Continue straight) of
 * "linkerkant"/"rechterkant" als los woord worden geraakt; die twee laatste
 * staan apart in de alternatie zodat ze wél correct mee omdraaien.
 */
function mirrorTurnText(text: string): string {
  const MIRROR: Record<string, string> = {
    links:       'rechts',
    rechts:      'links',
    linkerkant:  'rechterkant',
    rechterkant: 'linkerkant',
  };
  return text.replace(/\b(links|rechts|linkerkant|rechterkant)\b/gi, (match) => {
    const mirrored = MIRROR[match.toLowerCase()];
    // Hoofdletter van het origineel behouden (bv. begin van de zin)
    return match[0] === match[0].toUpperCase()
      ? mirrored[0].toUpperCase() + mirrored.slice(1)
      : mirrored;
  });
}

/** Verwerkt een ORS GeoJSON FeatureCollection naar PlannedRoute */
function parseOrsGeoJson(data: any, type: 'loop' | 'outAndBack'): PlannedRoute {
  const feature = data.features?.[0];
  if (!feature) {
    throw new Error('Geen route ontvangen. Controleer je API-sleutel of probeer het opnieuw.');
  }

  // Coördinaten: ORS gebruikt [lon, lat] (GeoJSON standaard)
  const coords: [number, number][] = feature.geometry?.coordinates ?? [];
  const waypoints: RouteWaypoint[] = coords.map(([lon, lat]) => ({ lat, lon }));

  const steps: any[] = feature.properties?.segments?.[0]?.steps ?? [];
  const instructions: RouteInstruction[] = steps
    .filter(s => s.instruction)
    .map(s => ({
      text:              toNl(s.instruction),
      distanceToPointM: s.distance ?? 0,
      waypointIndex:    s.way_points?.[0] ?? 0,
    }));

  const totalDistanceKm = (feature.properties?.summary?.distance ?? 0) / 1000;
  return { type, waypoints, instructions, totalDistanceKm };
}

/**
 * Voert een routeverzoek uit via de Supabase edge function `route`, met
 * time-out (anders blijft de UI eindeloos laden). De edge function voegt
 * serverside de ORS-sleutel toe en geeft de ORS-response ongewijzigd terug,
 * zodat de foutafhandeling hieronder identiek blijft.
 */
async function orsPost(endpoint: string, body: object): Promise<any> {
  const base = getFunctionsBaseUrl();
  if (!base) {
    // Zonder Supabase-configuratie is er geen route-proxy en dus geen
    // routeplanner. Faal met dezelfde nette copy als bij een netwerkfout.
    throw new Error(ORS_TIMEOUT_MESSAGE);
  }

  // Zorg voor een (anonieme) sessie en haal het access token op, zodat de
  // edge function de JWT kan verifiëren. Zonder token kan de proxy niet.
  await ensureAnonymousSession();
  const session = await getCurrentSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error(ORS_TIMEOUT_MESSAGE);
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), ORS_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(
      `${base}/route`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept:         'application/json, application/geo+json',
        },
        body:   JSON.stringify({ endpoint, body }),
        signal: controller.signal,
      },
    );
  } catch (err: any) {
    // Zowel een time-out-abort als een netwerkfout (geen verbinding) komen hier terecht
    throw new Error(ORS_TIMEOUT_MESSAGE);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 403) {
      // 403 kan meerdere oorzaken hebben (daglimiet, geweigerde sleutel,
      // niet-toegestane route). Toon de echte ORS-melding in plaats van te
      // gokken dat het de sleutel is.
      let reason = '';
      try {
        const json = JSON.parse(text);
        reason = json?.error?.message ?? json?.error ?? '';
      } catch {
        reason = text;
      }
      throw new Error(
        reason
          ? `Routeplanner geweigerd: ${reason}`
          : 'Routeplanner geweigerd (403). Mogelijk je ORS-daglimiet of sleutel. Probeer het later opnieuw.',
      );
    }
    if (res.status === 429) {
      throw new Error('Te veel aanvragen in korte tijd. Wacht een minuut en probeer het opnieuw.');
    }
    // Probeer de echte ORS-foutmelding uit de response body te halen
    let detail = '';
    try {
      const json = JSON.parse(text);
      detail = json?.error?.message ?? json?.error ?? '';
    } catch {
      detail = text;
    }
    const suffix = detail ? `: ${detail}` : '';
    throw new Error(`Route ophalen mislukt (${res.status})${suffix}. Probeer het opnieuw.`);
  }

  return res.json();
}

// ── Publieke functies ─────────────────────────────────────────────────────────

/**
 * Genereert een lusroute die terugkeert naar het startpunt.
 * Gebruikt de ORS round_trip extensie.
 */
export async function generateLoopRoute(
  lat: number,
  lon: number,
  targetDistanceKm: number,
): Promise<PlannedRoute> {
  const data = await orsPost('/directions/foot-walking/geojson', {
    coordinates: [[lon, lat]],
    options: {
      round_trip: {
        length: targetDistanceKm * 1000,
        points: 4,
        seed:   Math.floor(Math.random() * 90) + 1,
      },
    },
    instructions: true,
    language:     'nl',
    units:        'm',
  });
  return parseOrsGeoJson(data, 'loop');
}

/**
 * Genereert een heen-en-terug route.
 * Loopt de halve doelafstand in een willekeurige richting en keert dan om.
 */
export async function generateOutAndBackRoute(
  lat: number,
  lon: number,
  targetDistanceKm: number,
): Promise<PlannedRoute> {
  const halfKm  = targetDistanceKm / 2;
  const bearing = Math.random() * 360;
  // 0.75 factor compenseert voor bochten en omwegen
  const dest = destinationPoint(lat, lon, halfKm * 0.75, bearing);

  const data = await orsPost('/directions/foot-walking/geojson', {
    coordinates: [[lon, lat], [dest.lon, dest.lat]],
    instructions: true,
    language:     'nl',
    units:        'm',
  });

  const outRoute = parseOrsGeoJson(data, 'outAndBack');
  const N        = outRoute.waypoints.length;
  const offset   = N;

  // Keerpunt-instructie
  const turnAround: RouteInstruction = {
    text:             'Keerpunt bereikt! Loop nu terug naar het startpunt.',
    distanceToPointM: 0,
    waypointIndex:    offset - 1,
  };

  // Terugweg: omgekeerde waypoints + instructies.
  //
  // returnWaypoints is de omgekeerde heenweg, dus voor elke k geldt
  // returnWaypoints[k] === outRoute.waypoints[N - 1 - k]. Een heenweg-
  // instructie die bij waypoint w hoort (inst.waypointIndex === w) hoort op
  // de terugweg dus bij relatieve positie (N - 1 - w), en dat in de
  // samengevoegde waypoints-array ([...outRoute.waypoints, ...returnWaypoints])
  // op absolute index offset + (N - 1 - w).
  //
  // (Vroegere bug: hier stond `offset + i` met i de instructie-teller i.p.v.
  // een waypoint-index. Bij bv. 200 waypoints maar 8 instructies duwde dat
  // alle acht terugweg-instructies in de eerste acht waypoints ná het
  // keerpunt — ze hoorden dan vrijwel allemaal bij hetzelfde punt, en de rest
  // van de terugweg had geen enkele instructie meer.)
  //
  // Omdat w oploopt over de (al op waypointIndex gesorteerde) heenweg-
  // instructies, loopt (N - 1 - w) daarentegen af. Het .reverse() hieronder
  // keert de iteratie-volgorde om, waardoor de resulterende waypointIndex-
  // waarden weer oplopend zijn — dezelfde truc die het bestaande .reverse()
  // hier al toepaste, nu gecombineerd met de juiste formule.
  //
  // Tweede bug: de instructietekst werd 1-op-1 gekopieerd, terwijl een
  // linkerafslag op de heenweg op de terugweg een rechterafslag is (en
  // omgekeerd). mirrorTurnText() draait dat om.
  const returnWaypoints: RouteWaypoint[] = [...outRoute.waypoints].reverse();
  const returnInstructions: RouteInstruction[] = [...outRoute.instructions]
    .reverse()
    .map((inst) => ({
      text:             mirrorTurnText(inst.text),
      distanceToPointM: inst.distanceToPointM,
      waypointIndex:    offset + (N - 1 - inst.waypointIndex),
    }));

  // De eerste heenweg-instructie is een startinstructie ("Loop naar het
  // noorden" e.d., zie de Head-vervangingen in toNl()). Na omkering staat
  // die als LAATSTE terugweg-instructie, precies bij aankomst op het
  // startpunt — waar een windrichting geen zin heeft. Vervang die door een
  // aankomstmelding. "Doel bereikt." wordt letterlijk herkend door
  // TURN_PATTERNS in src/config/voicePhrases.ts (patroon 'doel bereikt' →
  // clip turn_arrive), dus exact zo schrijven.
  if (returnInstructions.length > 0) {
    const lastIndex = returnInstructions.length - 1;
    returnInstructions[lastIndex] = {
      ...returnInstructions[lastIndex],
      text: 'Doel bereikt.',
    };
  }

  return {
    type:             'outAndBack',
    waypoints:        [...outRoute.waypoints, ...returnWaypoints],
    instructions:     [...outRoute.instructions, turnAround, ...returnInstructions],
    totalDistanceKm:  outRoute.totalDistanceKm * 2,
  };
}
