/**
 * runRecoveryService
 *
 * Crash-herstel voor een actieve run: run-data leefde tot nu toe alleen in
 * refs in het geheugen, dus een crash of geforceerd afsluiten tijdens het
 * hardlopen verloor de hele sessie. Dit bestand slaat periodiek een kleine
 * momentopname (snapshot) van de lopende sessie op in AsyncStorage, zodat
 * app/index.tsx bij de volgende opstart kan aanbieden om de run alsnog op te
 * slaan.
 *
 * Faalt overal stil: opslaan, laden en wissen mogen de app nooit laten
 * crashen. In het slechtste geval verliezen we gewoon de herstelmogelijkheid.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KmSplit } from '../store/appStore';

const SNAPSHOT_KEY = 'active-run-snapshot';

// Cap voor het aantal opgeslagen routepunten: houdt de opslag klein zonder de
// routelijn helemaal te verliezen voor lange runs.
const MAX_RECENT_ROUTE_POINTS = 500;
// Van de oudere (afgekapte) punten bewaren we er nog 1 op de 10, zodat de
// routelijn over de hele afstand grofweg zichtbaar blijft.
const SPARSE_KEEP_EVERY_NTH = 10;

export interface RunSnapshotRoutePoint {
  lat: number;
  lon: number;
  timestamp: number;
}

export interface RunSnapshot {
  /** Id van de trainingssessie (Session['id']) */
  sessionId: string;
  /** Trainingstype, alleen ter info/debug */
  sessionType?: string;
  weekNumber: number;
  /** Epoch ms waarop de run daadwerkelijk begon (na de countdown) */
  startTimestamp: number;
  /** Verstreken tijd in seconden op het moment van opslaan */
  elapsed: number;
  distanceKm: number;
  splits: KmSplit[];
  route: RunSnapshotRoutePoint[];
  /** Is de run op het moment van opslaan gepauzeerd (handmatig of automatisch)? */
  pausedState: boolean;
  /** Epoch ms waarop deze snapshot geschreven is */
  savedAt: number;
}

/** Kapt de route af tot een handzame opslaggrootte, zie MAX_RECENT_ROUTE_POINTS hierboven. */
function capRouteForStorage(route: RunSnapshotRoutePoint[]): RunSnapshotRoutePoint[] {
  if (route.length <= MAX_RECENT_ROUTE_POINTS) return route;

  const recent = route.slice(route.length - MAX_RECENT_ROUTE_POINTS);
  const older = route.slice(0, route.length - MAX_RECENT_ROUTE_POINTS);
  const sparseOlder = older.filter((_, i) => i % SPARSE_KEEP_EVERY_NTH === 0);

  return [...sparseOlder, ...recent];
}

/**
 * Schrijf een snapshot van de actieve run weg. Best-effort: faalt stil bij
 * elke opslagfout (bijvoorbeeld volle opslag).
 */
export async function saveSnapshot(snapshot: RunSnapshot): Promise<void> {
  try {
    const capped: RunSnapshot = {
      ...snapshot,
      route: capRouteForStorage(snapshot.route),
    };
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(capped));
  } catch {
    // Faalt stil: geen snapshot is vervelend, maar mag de run nooit verstoren.
  }
}

/**
 * Laad de laatst opgeslagen snapshot, of null als die er niet is of niet
 * geldig blijkt (bijvoorbeeld corrupte JSON na een halve schrijfactie).
 */
export async function loadSnapshot(): Promise<RunSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunSnapshot;
    if (!parsed || typeof parsed.sessionId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Verwijder de opgeslagen snapshot. Best-effort, faalt stil. */
export async function clearSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // Faalt stil
  }
}
