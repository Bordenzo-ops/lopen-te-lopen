/**
 * backgroundLocationService
 *
 * Achtergrond-locatietracking voor een actieve hardloopsessie, via
 * expo-task-manager en Location.startLocationUpdatesAsync. Hiermee blijft de
 * run doorlopen als het scherm vergrendeld is of de app naar de achtergrond
 * gaat, in plaats van alleen de voorgrond-tracking van watchPositionAsync.
 *
 * BELANGRIJK over TaskManager.defineTask:
 * Dit moet op module-niveau staan (dus hier, buiten elke component of
 * functie), omdat het besturingssysteem de taak op naam moet kunnen
 * terugvinden en opnieuw aanroepen, ook nadat de JS-engine opnieuw is
 * opgestart in de achtergrond. defineTask draait daarom automatisch zodra dit
 * bestand voor het eerst geimporteerd wordt.
 *
 * Vandaag gebeurt die import via app/session/active.tsx, dus de taak is pas
 * geregistreerd zodra dat scherm een keer geladen is in de huidige app-sessie.
 * Voor de meeste gevallen is dat voldoende: de taak wordt gestart vanuit
 * hetzelfde scherm dat hem ook definieert. Voor een waterdichte garantie dat
 * de taak ook na het volledig herstarten van het OS-proces (bijvoorbeeld
 * wanneer iOS de app puur voor een achtergrond-locatie-event opnieuw opstart)
 * meteen geregistreerd is, zou dit bestand idealiter ook vanuit app/_layout.tsx
 * geimporteerd moeten worden (bijvoorbeeld met een side-effect import
 * bovenaan). Dat bestand valt buiten de scope van deze wijziging en wordt
 * beheerd door een andere agent.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

/** Naam van de achtergrondtaak, gebruikt door zowel TaskManager als Location. */
export const RUN_TRACKING_TASK = 'lopen-te-lopen-run-tracking';

type LocationsCallback = (locations: Location.LocationObject[]) => void;

// Module-level buffer en subscribers: overleven een remount van het scherm
// dat de locaties verwerkt, zolang het JS-proces zelf blijft leven.
let locationBuffer: Location.LocationObject[] = [];
let subscribers: LocationsCallback[] = [];

// Voorkomt ongelimiteerde geheugengroei als er (tijdelijk) geen subscriber is.
const MAX_BUFFER_SIZE = 1000;

TaskManager.defineTask(
  RUN_TRACKING_TASK,
  async ({ data, error }: { data: unknown; error: unknown }) => {
    // Faalt stil: een fout in de achtergrondtaak mag de app nooit laten crashen.
    if (error) return;

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    if (!locations || locations.length === 0) return;

    locationBuffer = [...locationBuffer, ...locations];
    if (locationBuffer.length > MAX_BUFFER_SIZE) {
      locationBuffer = locationBuffer.slice(-MAX_BUFFER_SIZE);
    }

    subscribers.forEach((cb) => {
      try {
        cb(locations);
      } catch {
        // Faalt stil: een fout bij één subscriber mag de andere niet raken.
      }
    });
  },
);

/**
 * Abonneer op inkomende achtergrondlocaties. Geeft een opzegfunctie terug.
 */
export function subscribeToLocations(cb: LocationsCallback): () => void {
  subscribers.push(cb);
  return () => {
    subscribers = subscribers.filter((s) => s !== cb);
  };
}

/**
 * Haal alle gebufferde locaties op die nog niet via een subscriber verwerkt
 * zijn (bijvoorbeeld omdat het scherm nog niet geabonneerd was) en leeg de
 * buffer meteen. Nuttig als active.tsx later opnieuw mount terwijl de taak
 * intussen al liep.
 */
export function drainBufferedLocations(): Location.LocationObject[] {
  const drained = locationBuffer;
  locationBuffer = [];
  return drained;
}

/**
 * Start de achtergrondlocatietracking. Geeft true terug bij succes, false bij
 * elke fout (bijvoorbeeld ontbrekende achtergrondpermissie of een simulator
 * die dit niet ondersteunt), zodat de aanroeper eventueel op een
 * voorgrond-alternatief kan terugvallen. Faalt altijd stil, gooit nooit.
 */
export async function startBackgroundTracking(): Promise<boolean> {
  try {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK).catch(
      () => false,
    );
    if (alreadyStarted) return true;

    await Location.startLocationUpdatesAsync(RUN_TRACKING_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 1000,
      // iOS: activiteitstype "Fitness" optimaliseert het GPS-gedrag voor
      // hardlopen en toont bewust een systeemindicator dat de app op de
      // achtergrond locatie gebruikt, zodat dit nooit ongemerkt gebeurt.
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      // Android: verplicht een zichtbare notificatie zolang de foreground
      // service actief is, zodat de gebruiker altijd weet dat de run
      // doorloopt en er makkelijk naar kan terugkeren.
      foregroundService: {
        notificationTitle: 'Lopen te Lopen volgt je run',
        notificationBody: 'Tik om terug te keren naar je training',
        notificationColor: '#FD7642',
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop de achtergrondlocatietracking. Ruimt ook de buffer op. Faalt altijd
 * stil: als de taak al gestopt was of nooit gestart is, gebeurt er niets.
 */
export async function stopBackgroundTracking(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(RUN_TRACKING_TASK);
    }
  } catch {
    // Faalt stil: de notificatie/taak was waarschijnlijk al gestopt.
  }
  locationBuffer = [];
}
