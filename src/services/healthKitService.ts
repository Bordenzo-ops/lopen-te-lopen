/**
 * healthKitService
 *
 * Offline-first laag rond @kingstinct/react-native-healthkit: schrijft
 * voltooide runs weg naar Apple Health, het iOS-platform voor gezondheidsdata.
 * Andere apps die Apple Health uitlezen zien de run dan automatisch mee,
 * zonder dat deze app daar rechtstreeks iets voor hoeft te doen.
 *
 * De app werkt volledig zonder deze koppeling: zonder het platform iOS,
 * zonder de native module, zonder toestemming van de gebruiker of bij een
 * fout valt alles stilletjes terug op "niet beschikbaar". Niets in de UI
 * blokkeert hierop en er wordt nooit gecrasht.
 *
 * Let op: @kingstinct/react-native-healthkit is een native module (via
 * react-native-nitro-modules) en vereist een nieuwe EAS dev build voordat
 * deze service echt iets kan wegschrijven. Tot die tijd blijft
 * isHealthKitAvailable() false.
 *
 * Alleen schrijven: er wordt geen leestoestemming gevraagd en er wordt nooit
 * GPS-route weggeschreven, alleen een workout (hardlopen) met duur en afstand.
 *
 * Vereist: npx expo install @kingstinct/react-native-healthkit react-native-nitro-modules
 */

import type { CompletedSession } from '../store/appStore';
import { Platform } from 'react-native';

// ── Eigen minimale typedefinities voor @kingstinct/react-native-healthkit ──
// Geen import type van de package: tsc moet ook zonder geinstalleerde
// node_modules-entry schoon blijven. Dit dekt alleen wat wij gebruiken.

type HKAuthorizationStatus = 0 | 1 | 2; // notDetermined | sharingDenied | sharingAuthorized

interface HKQuantitySampleForSaving {
  startDate: Date;
  endDate: Date;
  quantityType: string;
  quantity: number;
  unit: string;
}

interface HealthKitModule {
  isHealthDataAvailable: () => boolean;
  requestAuthorization: (toRequest: {
    toShare?: readonly string[];
    toRead?: readonly string[];
  }) => Promise<boolean>;
  authorizationStatusFor?: (type: string) => HKAuthorizationStatus;
  WorkoutTypeIdentifier: string;
  WorkoutActivityType: { running: number };
  saveWorkoutSample: (
    workoutActivityType: number,
    quantities: readonly HKQuantitySampleForSaving[],
    startDate: Date,
    endDate: Date,
  ) => Promise<unknown>;
}

const DISTANCE_TYPE = 'HKQuantityTypeIdentifierDistanceWalkingRunning';

// Module-level lazy singleton: de require gebeurt maximaal eenmaal, buiten
// de functies, zodat er geen herhaalde dynamic requires nodig zijn.
let healthKitModule: HealthKitModule | null = null;
let loadAttempted = false;

function loadHealthKitModule(): HealthKitModule | null {
  if (loadAttempted) return healthKitModule;
  loadAttempted = true;

  if (Platform.OS !== 'ios') {
    healthKitModule = null;
    return null;
  }

  try {
    // Dynamic require: als het pakket niet geinstalleerd is, gooit dit een
    // fout die we hier afvangen. De service blijft dan permanent uitgeschakeld.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@kingstinct/react-native-healthkit');
    healthKitModule = mod as HealthKitModule;
  } catch {
    healthKitModule = null;
  }
  return healthKitModule;
}

/**
 * Is Apple Health bruikbaar op dit toestel? False op niet-iOS, zonder de
 * geinstalleerde native module, of als een eerdere poging al mislukte.
 */
export function isHealthKitAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  const hk = loadHealthKitModule();
  if (!hk) return false;

  try {
    return hk.isHealthDataAvailable();
  } catch {
    return false;
  }
}

/**
 * Vraag schrijftoestemming aan voor workouts en hardloopafstand. Geeft true
 * terug bij succes, false bij elke afwijzing of fout (module niet aanwezig,
 * platform niet iOS, gebruiker weigert). Apple geeft nooit prijs of de
 * gebruiker toestemming heeft geweigerd of het scherm nooit heeft gezien, dus
 * na een geslaagde aanvraag wordt de schrijfstatus per type nagekeken; kan
 * dat niet, dan is een geslaagde aanvraag zelf voldoende voor true.
 */
export async function enableHealthKit(): Promise<boolean> {
  const hk = loadHealthKitModule();
  if (!hk) return false;

  try {
    const toShare = [hk.WorkoutTypeIdentifier, DISTANCE_TYPE];
    const ok = await hk.requestAuthorization({ toShare });
    if (!ok) return false;

    if (typeof hk.authorizationStatusFor === 'function') {
      const workoutStatus = hk.authorizationStatusFor(hk.WorkoutTypeIdentifier);
      const distanceStatus = hk.authorizationStatusFor(DISTANCE_TYPE);
      return workoutStatus === 2 && distanceStatus === 2; // sharingAuthorized
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Schrijf een voltooide run weg naar Apple Health: een workout-record (type
 * hardlopen) met de afgelegde afstand. Fire-and-forget-veilig: elke fout
 * wordt gelogd en opgeslikt, dit mag de UI nooit laten crashen en heeft geen
 * retourwaarde die afgehandeld hoeft te worden.
 */
export async function writeRunToHealthKit(session: CompletedSession): Promise<void> {
  const hk = loadHealthKitModule();
  if (!hk) return;

  try {
    const endDate = new Date(session.completedAt);
    const startDate = new Date(endDate.getTime() - session.durationSeconds * 1000);
    const distanceMeters = session.actualDistanceKm * 1000;

    await hk.saveWorkoutSample(
      hk.WorkoutActivityType.running,
      [
        {
          startDate,
          endDate,
          quantityType: DISTANCE_TYPE,
          quantity: distanceMeters,
          unit: 'm',
        },
      ],
      startDate,
      endDate,
    );
  } catch (e) {
    // Stil falen: het wegschrijven naar Apple Health mag de app nooit laten
    // crashen. Loggen voor eigen debugdoeleinden.
    console.log('[healthKitService] wegschrijven mislukt', e);
  }
}
