/**
 * bleHeartRateService
 *
 * Offline-first laag rond react-native-ble-plx: koppelt met een Bluetooth
 * Low Energy-hartslagmeter die het standaard BLE Heart Rate-profiel uitzendt
 * (service 0x180D, characteristic Heart Rate Measurement 0x2A37) — dus elke
 * borstband of horloge dat dit profiel ondersteunt, zoals een Polar H10,
 * Garmin HRM of een Apple Watch met bijv. de gratis app HeartCast.
 *
 * De app werkt volledig zonder deze koppeling: zonder de native module (oude
 * build), zonder Bluetooth-toestemming, zonder gekoppelde meter of bij een
 * fout valt alles stilletjes terug op "geen signaal". Niets in de UI
 * blokkeert hierop en er wordt nooit gecrasht.
 *
 * Let op: react-native-ble-plx is een native module en vereist een nieuwe
 * EAS dev build voordat deze service echt iets kan doen. Tot die tijd blijft
 * isBleAvailable() false.
 *
 * Vereist: npx expo install react-native-ble-plx
 */

import { PermissionsAndroid, Platform } from 'react-native';

// ── Eigen minimale typedefinities voor react-native-ble-plx ────────────────
// Geen import type van de package: tsc moet ook zonder geinstalleerde
// node_modules-entry schoon blijven. Dit dekt alleen wat wij gebruiken.

interface BleCharacteristic {
  uuid: string;
  value: string | null; // base64
}

interface BleDevice {
  id: string;
  name: string | null;
  localName: string | null;
}

interface BleSubscription {
  remove: () => void;
}

interface BleError {
  message?: string;
}

interface BleManagerLike {
  startDeviceScan: (
    uuids: string[] | null,
    options: { allowDuplicates?: boolean } | null,
    listener: (error: BleError | null, device: BleDevice | null) => void,
  ) => void;
  stopDeviceScan: () => void;
  connectToDevice: (deviceId: string) => Promise<BleDevice>;
  cancelDeviceConnection: (deviceId: string) => Promise<BleDevice>;
  isDeviceConnected: (deviceId: string) => Promise<boolean>;
  onDeviceDisconnected: (
    deviceId: string,
    listener: (error: BleError | null, device: BleDevice | null) => void,
  ) => BleSubscription;
  discoverAllServicesAndCharacteristicsForDevice: (deviceId: string) => Promise<BleDevice>;
  monitorCharacteristicForDevice: (
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: BleError | null, characteristic: BleCharacteristic | null) => void,
  ) => BleSubscription;
  destroy: () => void;
}

// ── Standaard BLE Heart Rate-profiel ────────────────────────────────────────
const HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

// Herverbinding: bij een onverwacht verlies tijdens een run proberen we een
// paar keer opnieuw, met oplopende korte pauzes, voordat we het opgeven en
// de UI via onDisconnect laten weten dat er echt geen signaal meer is.
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_BACKOFF_MS = [1000, 2500, 5000];

// ── Module-level lazy singleton ─────────────────────────────────────────────
let manager: BleManagerLike | null = null;
let loadAttempted = false;

function loadBleManager(): BleManagerLike | null {
  if (loadAttempted) return manager;
  loadAttempted = true;

  try {
    // Dynamic require: als het pakket niet geinstalleerd is (of de native
    // module ontbreekt in deze build), gooit dit een fout die we afvangen.
    // De service blijft dan permanent uitgeschakeld.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BleManager } = require('react-native-ble-plx');
    manager = new BleManager() as BleManagerLike;
  } catch {
    manager = null;
  }
  return manager;
}

/**
 * Is BLE (in principe) bruikbaar op dit toestel? False zonder de
 * geinstalleerde native module of als een eerdere poging al mislukte.
 * Zegt niets over toestemming of of Bluetooth daadwerkelijk aanstaat.
 */
export function isBleAvailable(): boolean {
  return loadBleManager() !== null;
}

/**
 * Vraag de benodigde runtime-toestemmingen voor BLE-scan/verbinding.
 * Android 12+ (API 31+): BLUETOOTH_SCAN (neverForLocation) en BLUETOOTH_CONNECT.
 * Android <12: legacy BLUETOOTH werkt zonder runtime-permissie, maar scannen
 * vereist wel ACCESS_FINE_LOCATION als runtime-toestemming.
 * iOS: geen aparte permissie-API; het aanmaken/gebruiken van de BleManager
 * triggert zelf de systeemprompt voor Bluetooth. Geeft hier altijd true terug.
 * Geeft false terug bij elke weigering of fout — crasht nooit.
 */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (Number(Platform.Version) >= 31) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    // Android <12: scannen vereist locatietoestemming (systeembeperking).
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Parseert het Heart Rate Measurement-formaat (BLE-standaard 0x2A37) uit de
 * base64-gecodeerde characteristic-waarde. Flags-byte bit 0 bepaalt of de
 * hartslag als uint8 (byte 1) of uint16 little-endian (bytes 1-2) gecodeerd
 * is. Geeft null terug bij een onherkenbare of lege waarde — crasht nooit.
 */
export function parseHeartRateMeasurement(base64Value: string | null): number | null {
  if (!base64Value) return null;
  try {
    const bytes = base64ToBytes(base64Value);
    if (bytes.length < 2) return null;

    const flags = bytes[0];
    const isUint16 = (flags & 0x01) === 1;

    if (isUint16) {
      if (bytes.length < 3) return null;
      return bytes[1] | (bytes[2] << 8); // little-endian
    }
    return bytes[1];
  } catch {
    return null;
  }
}

/** Kleine, dependency-vrije base64-decoder (geen Buffer beschikbaar in RN). */
function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < clean.length; i++) {
    const val = chars.indexOf(clean[i]);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** Info over een gescand apparaat, doorgegeven aan de scan-callback. */
export interface ScannedHeartRateDevice {
  id: string;
  name: string;
}

let scanActive = false;

/**
 * Scan gefilterd op het BLE Heart Rate-profiel (0x180D). Roept `onDevice` aan
 * voor elk gevonden apparaat (kan meerdere keren per apparaat). Stopt netjes
 * na `timeoutMs` of bij een volgende `scanForHeartRateMonitors`/`disconnectMonitor`-
 * aanroep. Doet niets (roept onDevice nooit aan) zonder beschikbare module.
 */
export function scanForHeartRateMonitors(
  onDevice: (device: ScannedHeartRateDevice) => void,
  timeoutMs: number = 12000,
): () => void {
  const ble = loadBleManager();
  if (!ble) return () => {};

  scanActive = true;
  const seen = new Set<string>();

  try {
    ble.startDeviceScan([HEART_RATE_SERVICE_UUID], null, (error, device) => {
      if (error || !device) return;
      if (seen.has(device.id)) return;
      seen.add(device.id);
      onDevice({ id: device.id, name: device.name ?? device.localName ?? 'Onbekende hartslagmeter' });
    });
  } catch {
    scanActive = false;
    return () => {};
  }

  const timeout = setTimeout(() => stopScan(ble), timeoutMs);

  return () => {
    clearTimeout(timeout);
    stopScan(ble);
  };
}

function stopScan(ble: BleManagerLike): void {
  if (!scanActive) return;
  scanActive = false;
  try {
    ble.stopDeviceScan();
  } catch {
    // Stil falen: scannen stopt hoe dan ook zodra de manager verdwijnt.
  }
}

// ── Actieve verbinding ───────────────────────────────────────────────────────
let disconnectSubscription: BleSubscription | null = null;
let hrSubscription: BleSubscription | null = null;
let connectedDeviceId: string | null = null;
let reconnectAttempt = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let teardownRequested = false;

function clearReconnectTimer(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

function cleanupSubscriptions(): void {
  hrSubscription?.remove();
  hrSubscription = null;
  disconnectSubscription?.remove();
  disconnectSubscription = null;
}

/**
 * Verbind met een hartslagmeter en abonneer op live bpm-updates. Bij een
 * onverwacht verbindingsverlies tijdens een run probeert dit een paar keer
 * automatisch opnieuw te verbinden (met korte backoff) voordat `onDisconnect`
 * aangeroepen wordt. Faalt overal stil: geen module, geen permissie, of een
 * verbindingsfout resulteert hooguit in een `onDisconnect`-aanroep, nooit een
 * crash.
 */
export async function connectToMonitor(
  deviceId: string,
  onHeartRate: (bpm: number) => void,
  onDisconnect?: () => void,
  // Intern: true als deze aanroep zelf een herverbindingspoging is. Een
  // mislukte herverbinding zet dan de backoff-keten voort (tot de pogingen op
  // zijn) in plaats van meteen onDisconnect te melden — een meter die net even
  // buiten bereik is, krijgt zo echt meerdere kansen.
  isReconnectAttempt = false,
): Promise<boolean> {
  const ble = loadBleManager();
  if (!ble) return false;

  teardownRequested = false;

  const attemptConnect = async (): Promise<boolean> => {
    try {
      await ble.connectToDevice(deviceId);
      await ble.discoverAllServicesAndCharacteristicsForDevice(deviceId);

      connectedDeviceId = deviceId;
      reconnectAttempt = 0;

      hrSubscription = ble.monitorCharacteristicForDevice(
        deviceId,
        HEART_RATE_SERVICE_UUID,
        HEART_RATE_MEASUREMENT_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error || !characteristic) return;
          const bpm = parseHeartRateMeasurement(characteristic.value);
          if (bpm != null && bpm > 0) onHeartRate(bpm);
        },
      );

      disconnectSubscription = ble.onDeviceDisconnected(deviceId, () => {
        cleanupSubscriptions();
        if (teardownRequested) {
          connectedDeviceId = null;
          return;
        }
        // Onverwacht verlies tijdens een run: probeer een paar keer opnieuw
        // met oplopende backoff voordat we de UI laten weten dat het niet lukt.
        attemptReconnectWithBackoff(onHeartRate, onDisconnect);
      });

      return true;
    } catch {
      return false;
    }
  };

  const ok = await attemptConnect();
  if (!ok) {
    if (isReconnectAttempt) {
      attemptReconnectWithBackoff(onHeartRate, onDisconnect);
    } else {
      onDisconnect?.();
    }
  }
  return ok;
}

function attemptReconnectWithBackoff(
  onHeartRate: (bpm: number) => void,
  onDisconnect?: () => void,
): void {
  clearReconnectTimer();
  const deviceId = connectedDeviceId;
  if (!deviceId) {
    onDisconnect?.();
    return;
  }

  if (reconnectAttempt >= RECONNECT_ATTEMPTS) {
    connectedDeviceId = null;
    reconnectAttempt = 0;
    onDisconnect?.();
    return;
  }

  const delay = RECONNECT_BACKOFF_MS[Math.min(reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
  reconnectAttempt += 1;

  reconnectTimeout = setTimeout(() => {
    if (teardownRequested) return;
    void connectToMonitor(deviceId, onHeartRate, onDisconnect, true);
  }, delay);
}

/**
 * Verbreek de actieve verbinding netjes: ruimt subscriptions op, stopt een
 * eventuele lopende herverbindingspoging en sluit de BLE-connectie. Veilig
 * om aan te roepen zonder actieve verbinding of zonder beschikbare module.
 */
export async function disconnectMonitor(): Promise<void> {
  teardownRequested = true;
  clearReconnectTimer();
  cleanupSubscriptions();

  const ble = manager;
  const deviceId = connectedDeviceId;
  connectedDeviceId = null;
  reconnectAttempt = 0;

  if (!ble || !deviceId) return;

  try {
    const isConnected = await ble.isDeviceConnected(deviceId);
    if (isConnected) await ble.cancelDeviceConnection(deviceId);
  } catch {
    // Stil falen: er is toch niets meer aan te doen als dit misgaat.
  }
}
