/**
 * healthConnectService
 *
 * Offline-first laag rond react-native-health-connect: schrijft voltooide
 * runs weg naar Health Connect, het Android-platform voor gezondheidsdata.
 * Andere apps die Health Connect uitlezen (zoals Mi Fitness) zien de run dan
 * automatisch mee, zonder dat deze app daar rechtstreeks iets voor hoeft te
 * doen. Google Fit is uitgefaseerd; Health Connect is de vervanger.
 *
 * De app werkt volledig zonder deze koppeling: zonder het platform Android,
 * zonder de native module, zonder Health Connect op het toestel of bij een
 * fout valt alles stilletjes terug op "niet beschikbaar". Niets in de UI
 * blokkeert hierop en er wordt nooit gecrasht.
 *
 * Let op: react-native-health-connect is een native module en vereist een
 * nieuwe EAS dev build voordat deze service echt iets kan wegschrijven. Tot
 * die tijd blijft isHealthConnectAvailable() false.
 *
 * Vereist: npx expo install react-native-health-connect
 */

import type { CompletedSession } from '../store/appStore';
import { Platform } from 'react-native';

// ── Eigen minimale typedefinities voor react-native-health-connect v3 ──────
// Geen import type van de package: tsc moet ook zonder geinstalleerde
// node_modules-entry schoon blijven. Dit dekt alleen wat wij gebruiken.

interface HealthConnectRecordResult {
  recordIds: string[];
}

interface HealthConnectModule {
  initialize: () => Promise<boolean>;
  requestPermission: (
    permissions: Array<{ accessType: 'read' | 'write'; recordType: string }>,
  ) => Promise<Array<{ accessType: 'read' | 'write'; recordType: string }>>;
  insertRecords: (records: unknown[]) => Promise<HealthConnectRecordResult>;
}

// Module-level lazy singleton: de require gebeurt maximaal eenmaal, buiten
// de functies, zodat er geen herhaalde dynamic requires nodig zijn.
let healthConnectModule: HealthConnectModule | null = null;
let loadAttempted = false;

function loadHealthConnectModule(): HealthConnectModule | null {
  if (loadAttempted) return healthConnectModule;
  loadAttempted = true;

  if (Platform.OS !== 'android') {
    healthConnectModule = null;
    return null;
  }

  try {
    // Dynamic require: als het pakket niet geinstalleerd is, gooit dit een
    // fout die we hier afvangen. De service blijft dan permanent uitgeschakeld.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-health-connect');
    healthConnectModule = mod as HealthConnectModule;
  } catch {
    healthConnectModule = null;
  }
  return healthConnectModule;
}

/**
 * Is Health Connect bruikbaar op dit toestel? False op iOS, zonder de
 * geinstalleerde native module, of als een eerdere poging al mislukte.
 */
export function isHealthConnectAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  return loadHealthConnectModule() !== null;
}

let initialized = false;

/**
 * Initialiseer Health Connect en vraag schrijftoestemming voor
 * ExerciseSession- en Distance-records. Geeft true terug bij succes, false
 * bij elke afwijzing of fout (module niet aanwezig, platform niet Android,
 * Health Connect niet geinstalleerd op het toestel, gebruiker weigert).
 */
export async function enableHealthConnect(): Promise<boolean> {
  const hc = loadHealthConnectModule();
  if (!hc) return false;

  try {
    const ok = await hc.initialize();
    if (!ok) return false;

    initialized = true;

    const granted = await hc.requestPermission([
      { accessType: 'write', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'Distance' },
    ]);

    const hasExercise = granted.some(p => p.recordType === 'ExerciseSession');
    const hasDistance = granted.some(p => p.recordType === 'Distance');
    return hasExercise && hasDistance;
  } catch {
    return false;
  }
}

/**
 * Schrijf een voltooide run weg naar Health Connect: een ExerciseSession
 * (type hardlopen) en een Distance-record over dezelfde periode. Fire-and-
 * forget-veilig: elke fout wordt gelogd en opgeslikt, dit mag de UI nooit
 * laten crashen en heeft geen retourwaarde die afgehandeld hoeft te worden.
 */
export async function writeRunToHealthConnect(session: CompletedSession): Promise<void> {
  const hc = loadHealthConnectModule();
  if (!hc) return;

  try {
    if (!initialized) {
      const ok = await hc.initialize();
      if (!ok) return;
      initialized = true;
    }

    const endTime = new Date(session.completedAt);
    const startTime = new Date(endTime.getTime() - session.durationSeconds * 1000);
    const distanceMeters = session.actualDistanceKm * 1000;

    await hc.insertRecords([
      {
        recordType: 'ExerciseSession',
        exerciseType: 56, // Health Connect ExerciseType.RUNNING
        title: 'Hardlopen met Lopen te Lopen',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      {
        recordType: 'Distance',
        distance: { value: distanceMeters, unit: 'meters' },
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    ]);
  } catch (e) {
    // Stil falen: het wegschrijven naar Health Connect mag de app nooit
    // laten crashen. Loggen voor eigen debugdoeleinden.
    console.log('[healthConnectService] wegschrijven mislukt', e);
  }
}
