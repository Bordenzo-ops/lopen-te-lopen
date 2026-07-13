/**
 * backgroundLocationService
 *
 * Achtergrond-locatietracking voor een actieve hardloopsessie, via
 * expo-task-manager en Location.startLocationUpdatesAsync. Hiermee blijft de
 * run doorlopen als het scherm vergrendeld is of de app naar de achtergrond
 * gaat, in plaats van alleen de voorgrond-tracking van watchPositionAsync.
 *
 * BELANGRIJK over native modules en crash-veiligheid:
 * expo-task-manager en expo-location doen op module-niveau (dus meteen bij
 * een gewone top-level `import`) een `requireNativeModule(...)`-aanroep die
 * SYNCHROON gooit als de native module niet aanwezig is (bijvoorbeeld een
 * build zonder deze native modules, of een onverwachte platformmismatch).
 * Omdat dit bestand via app/_layout.tsx (zie hieronder) al bij het opstarten
 * van de app geladen wordt, zou een gewone top-level import de hele app laten
 * crashen bij het openen als er ook maar iets mis is met een van deze twee
 * native modules. Daarom laden we ze hier lazy via `require()` binnen een
 * try/catch, naar het patroon van src/services/healthConnectService.ts: geen
 * enkele functie in dit bestand mag ooit een ongeguarde crash veroorzaken,
 * de app moet altijd blijven werken (zonder achtergrondtracking) als deze
 * modules onverhoopt ontbreken of falen te laden.
 *
 * BELANGRIJK over TaskManager.defineTask:
 * Dit moet op module-niveau staan (dus hier, buiten elke component of
 * functie), omdat het besturingssysteem de taak op naam moet kunnen
 * terugvinden en opnieuw aanroepen, ook nadat de JS-engine opnieuw is
 * opgestart in de achtergrond. defineTask draait daarom automatisch zodra dit
 * bestand voor het eerst geimporteerd wordt (en de modules succesvol geladen
 * zijn).
 *
 * Vandaag gebeurt de import via app/_layout.tsx (een side-effect import),
 * zodat de taak al geregistreerd is zodra de app opnieuw opstart, ook als
 * het OS de app puur voor een achtergrond-locatie-event opnieuw opstart
 * zonder dat de gebruiker het scherm session/active.tsx heeft geopend.
 */

import type * as TaskManagerType from 'expo-task-manager';
import type * as LocationType from 'expo-location';

/** Naam van de achtergrondtaak, gebruikt door zowel TaskManager als Location. */
export const RUN_TRACKING_TASK = 'lopen-te-lopen-run-tracking';

type LocationsCallback = (locations: LocationType.LocationObject[]) => void;

// Module-level buffer en subscribers: overleven een remount van het scherm
// dat de locaties verwerkt, zolang het JS-proces zelf blijft leven. Puur
// JS-toestand, onafhankelijk van of de native modules beschikbaar zijn.
let locationBuffer: LocationType.LocationObject[] = [];
let subscribers: LocationsCallback[] = [];

// Voorkomt ongelimiteerde geheugengroei als er (tijdelijk) geen subscriber is.
const MAX_BUFFER_SIZE = 1000;

// Module-level lazy singletons: de require gebeurt maximaal eenmaal, buiten
// de functies, zodat er geen herhaalde dynamic requires nodig zijn.
let TaskManagerModule: typeof TaskManagerType | null = null;
let LocationModule: typeof LocationType | null = null;
let modulesLoadAttempted = false;

/**
 * Laad expo-task-manager en expo-location lazy en cache het resultaat. Geeft
 * true terug als beide modules bruikbaar zijn. Faalt geruisloos (en blijft
 * daarna permanent false teruggeven) als een van beide native modules
 * ontbreekt of een fout gooit bij het laden.
 */
function loadModules(): boolean {
  if (modulesLoadAttempted) return TaskManagerModule !== null && LocationModule !== null;
  modulesLoadAttempted = true;

  try {
    // Dynamic require: als een van beide native modules niet beschikbaar is,
    // gooit dit een fout die we hier afvangen. De service blijft dan
    // permanent uitgeschakeld, maar de app crasht niet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    TaskManagerModule = require('expo-task-manager') as typeof TaskManagerType;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    LocationModule = require('expo-location') as typeof LocationType;
  } catch {
    TaskManagerModule = null;
    LocationModule = null;
  }
  return TaskManagerModule !== null && LocationModule !== null;
}

/**
 * Registreert de achtergrondtaak bij TaskManager, als de native modules
 * geladen konden worden. In een eigen functie (in plaats van rechtstreeks op
 * module-niveau) zodat elke referentie naar TaskManagerModule hier via een
 * lokale, functie-scoped narrowing loopt, net als bij startBackgroundTracking
 * en stopBackgroundTracking hieronder.
 */
function registerBackgroundTask(): void {
  if (!loadModules() || !TaskManagerModule) return;
  const TaskManager = TaskManagerModule;

  try {
    TaskManager.defineTask(
      RUN_TRACKING_TASK,
      async ({ data, error }: { data: unknown; error: unknown }) => {
        // Faalt stil: een fout in de achtergrondtaak mag de app nooit laten crashen.
        if (error) return;

        const locations = (data as { locations?: LocationType.LocationObject[] } | undefined)
          ?.locations;
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
  } catch {
    // Faalt stil: taakregistratie mag de app-start nooit blokkeren. Zonder
    // geregistreerde taak zal startBackgroundTracking hieronder alsnog
    // netjes falen (via de eigen try/catch van Location.startLocationUpdatesAsync).
  }
}

// Registreer de achtergrondtaak meteen bij het laden van dit bestand, maar
// alleen als de native modules ook echt geladen konden worden (zie
// registerBackgroundTask hierboven).
registerBackgroundTask();

/**
 * Abonneer op inkomende achtergrondlocaties. Geeft een opzegfunctie terug.
 * Werkt ongeacht of de native modules beschikbaar zijn: zonder modules komen
 * er simpelweg nooit locaties binnen, maar abonneren/opzeggen blijft veilig.
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
export function drainBufferedLocations(): LocationType.LocationObject[] {
  const drained = locationBuffer;
  locationBuffer = [];
  return drained;
}

/**
 * Start de achtergrondlocatietracking. Geeft true terug bij succes, false bij
 * elke fout (bijvoorbeeld ontbrekende achtergrondpermissie, een simulator die
 * dit niet ondersteunt, of ontbrekende native modules), zodat de aanroeper
 * eventueel op een voorgrond-alternatief kan terugvallen. Faalt altijd stil,
 * gooit nooit.
 */
export async function startBackgroundTracking(): Promise<boolean> {
  if (!loadModules() || !TaskManagerModule || !LocationModule) return false;
  const Location = LocationModule;
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
 * stil: als de taak al gestopt was, nooit gestart is, of de native modules
 * niet beschikbaar zijn, gebeurt er niets.
 */
export async function stopBackgroundTracking(): Promise<void> {
  if (loadModules() && TaskManagerModule && LocationModule) {
    const Location = LocationModule;
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK);
      if (started) {
        await Location.stopLocationUpdatesAsync(RUN_TRACKING_TASK);
      }
    } catch {
      // Faalt stil: de notificatie/taak was waarschijnlijk al gestopt.
    }
  }
  locationBuffer = [];
}
