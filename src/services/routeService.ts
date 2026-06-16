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
 */

import { PREMIUM_CONFIG } from '../config/premiumConfig';

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

/** Voert een POST-request uit naar de ORS API */
async function orsPost(endpoint: string, body: object): Promise<any> {
  const res = await fetch(
    `https://api.openrouteservice.org/v2${endpoint}`,
    {
      method: 'POST',
      headers: {
        Authorization:  PREMIUM_CONFIG.ORS_API_KEY,
        'Content-Type': 'application/json',
        Accept:         'application/json, application/geo+json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 403) {
      throw new Error('Ongeldige API-sleutel. Voeg een geldige ORS-sleutel toe in premiumConfig.ts.');
    }
    if (res.status === 429) {
      throw new Error('Dagelijkse limiet bereikt. Probeer het morgen opnieuw.');
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
  const offset   = outRoute.waypoints.length;

  // Keerpunt-instructie
  const turnAround: RouteInstruction = {
    text:             'Keerpunt bereikt! Loop nu terug naar het startpunt.',
    distanceToPointM: 0,
    waypointIndex:    offset - 1,
  };

  // Terugweg: omgekeerde waypoints + instructies
  const returnWaypoints: RouteWaypoint[] = [...outRoute.waypoints].reverse();
  const returnInstructions: RouteInstruction[] = [...outRoute.instructions]
    .reverse()
    .map((inst, i) => ({
      text:             inst.text,
      distanceToPointM: inst.distanceToPointM,
      waypointIndex:    offset + i,
    }));

  return {
    type:             'outAndBack',
    waypoints:        [...outRoute.waypoints, ...returnWaypoints],
    instructions:     [...outRoute.instructions, turnAround, ...returnInstructions],
    totalDistanceKm:  outRoute.totalDistanceKm * 2,
  };
}
